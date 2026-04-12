/**
 * Stripe Checkout API for Serverly static site.
 *
 * POST /create-checkout-session: body: { tier, email? (optional; omit for Stripe-hosted email), goal, serverMode, hasFollowers, size, channelPattern, channelPatternLabel }
 * POST /webhook: Stripe webhook (checkout.session.completed) sends receipt + product emails
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Stripe = require("stripe");
const nodemailer = require("nodemailer");
const { resolveDiscordTemplateUrl, getTemplateEnvKey } = require("./template-registry.js");
const {
  normalizeLayoutType,
  normalizeChannelPattern,
  isValidStripeCheckoutSessionId,
  sanitizeChannelPatternLabel,
  safePublicHttpUrl,
  securityHeadersMiddleware,
  strictBrowserOriginMiddleware,
  corsProtocolCompanionOrigins,
} = require("./checkout-security.js");

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Base URL for Stripe return links (no trailing slash).
 * github.io: CLIENT_SITE_PATH can add /Repo when CLIENT_URL is origin-only (project pages).
 * Custom domains & localhost: use origin only — strips accidental /Serverly on CLIENT_URL and ignores CLIENT_SITE_PATH.
 */
function buildPublicSiteBaseUrl() {
  const raw = (process.env.CLIENT_URL || "http://localhost:5500").trim().replace(/\/$/, "");
  const extraPath = (process.env.CLIENT_SITE_PATH || "").replace(/^\/+|\/+$/g, "").trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  const host = u.hostname.toLowerCase();
  const isGithubIo = host === "github.io" || host.endsWith(".github.io");
  if (!isGithubIo) {
    return `${u.protocol}//${u.host}`.replace(/\/$/, "");
  }
  if (extraPath && (!u.pathname || u.pathname === "/")) {
    return `${u.origin}/${extraPath}`.replace(/\/$/, "");
  }
  return raw;
}

const clientUrl = buildPublicSiteBaseUrl();
const port = parseInt(process.env.PORT || "3000", 10);
const digitalDeliveryUrl = (process.env.DIGITAL_DELIVERY_URL || "").trim();

function warnIfGithubPagesMissingRepoPath() {
  const raw = (process.env.CLIENT_URL || "").trim().replace(/\/$/, "");
  const extraPath = (process.env.CLIENT_SITE_PATH || "").replace(/^\/+|\/+$/g, "").trim();
  if (!raw || extraPath) return;
  try {
    const u = new URL(raw);
    const pathEmpty = !u.pathname || u.pathname === "/";
    if (u.hostname.endsWith(".github.io") && pathEmpty) {
      console.warn(
        "[Serverly] CLIENT_URL is only %s; project sites need the repo name. Add env CLIENT_SITE_PATH=Serverly (or your repo) OR set CLIENT_URL=https://%s/Serverly. Otherwise Stripe sends buyers to %s/thank-you.html and GitHub shows “no site here”.",
        u.origin,
        u.hostname,
        u.origin
      );
    }
  } catch {
    /* ignore */
  }
}

function githubPagesMissingProjectPathError() {
  try {
    const u = new URL(clientUrl);
    if (!u.hostname.endsWith(".github.io")) return null;
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length > 0) return null;
    return (
      "Server misconfigured: CLIENT_URL is only " +
      u.origin +
      " but your site is a project page. Set CLIENT_URL to https://" +
      u.hostname +
      "/YOUR_REPO (no trailing slash) or add CLIENT_SITE_PATH=YOUR_REPO on Render, then redeploy. Wrong URL sends customers to " +
      u.origin +
      "/thank-you.html which does not exist."
    );
  } catch {
    return null;
  }
}

function originFromSiteUrl(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * Also allow www ↔ apex for simple registrable hosts (e.g. CLIENT_URL=https://serverly.store → allow https://www.serverly.store).
 * Skips localhost, IPs, github.io, and deeper subdomains (app.example.com).
 */
function corsWwwApexCompanionOrigins(originStr) {
  const out = [];
  try {
    const u = new URL(originStr);
    if (u.protocol !== "http:" && u.protocol !== "https:") return out;
    const host = u.hostname.toLowerCase();
    if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return out;
    if (host.endsWith(".github.io") || host.endsWith(".localhost")) return out;
    const port = u.port ? `:${u.port}` : "";
    const base = `${u.protocol}//`;
    if (host.startsWith("www.")) {
      const apex = host.slice(4);
      if (apex) out.push(`${base}${apex}${port}`);
      return out;
    }
    if (host.split(".").length === 2) {
      out.push(`${base}www.${host}${port}`);
    }
  } catch {
    /* ignore */
  }
  return out;
}

function buildCorsOriginOption() {
  const siteOrigin = originFromSiteUrl(clientUrl).replace(/\/$/, "");
  const allow = new Set();
  (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .forEach((o) => {
      allow.add(o);
      if (/^https?:\/\//i.test(o)) {
        corsWwwApexCompanionOrigins(o).forEach((w) => allow.add(w));
        corsProtocolCompanionOrigins(o).forEach((p) => allow.add(p));
        corsProtocolCompanionOrigins(o).forEach((p) => {
          corsWwwApexCompanionOrigins(p).forEach((w) => allow.add(w));
        });
      }
    });
  if (siteOrigin.startsWith("http")) {
    const fromSite = new Set([siteOrigin]);
    corsWwwApexCompanionOrigins(siteOrigin).forEach((o) => fromSite.add(o));
    Array.from(fromSite).forEach((o) => {
      corsProtocolCompanionOrigins(o).forEach((p) => fromSite.add(p));
    });
    Array.from(fromSite).forEach((o) => {
      corsWwwApexCompanionOrigins(o).forEach((w) => fromSite.add(w));
    });
    fromSite.forEach((o) => allow.add(o));
  }
  const allowNull =
    process.env.CORS_ALLOW_NULL_ORIGIN === "1" ||
    process.env.CORS_ALLOW_NULL_ORIGIN === "true";
  if (allowNull) allow.add("null");
  [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5501",
    "http://127.0.0.1:5501",
    "http://localhost:5502",
    "http://127.0.0.1:5502",
    "http://localhost:5503",
    "http://127.0.0.1:5503",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://localhost:8888",
    "http://127.0.0.1:8888",
  ].forEach((o) => allow.add(o));
  return function corsOriginCallback(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, "");
    if (allow.has(normalized)) return callback(null, true);
    console.warn("[CORS] blocked origin:", origin);
    return callback(null, false);
  };
}

const CHECKOUT_GENERIC_ERROR = "Checkout could not be started. Please try again in a moment.";

if (!stripeSecret) {
  console.warn("Warning: STRIPE_SECRET_KEY is not set.");
}

const stripe = stripeSecret ? Stripe(stripeSecret) : null;

const TIERS = {
  /** Fallback label only; checkout + emails use checkoutLineItemPresentation when layout/style metadata exists. */
  advanced: { amount: 2000, name: "Serverly: Discord layout package" },
};

const GOAL_LABELS = {
  "full-server": "New template",
  aesthetic: "Style-first",
  both: "Structure + look",
  exploring: "Not sure yet (browse first)",
};

const SERVER_LABELS = {
  update: "Fix my current server (coming soon, not available)",
  fresh: "New server template (new or reset server)",
};

function effectiveServerMode(sm) {
  if (sm === "update") return "fresh";
  return sm || "";
}

const SIZE_LABELS = {
  small: "Under 500 (following / reach)",
  medium: "500 – 5,000",
  large: "5,000+",
  "not-yet": "Other / Rather not say",
};

const LAYOUT_TYPE_LABELS = {
  content_creator: "Content creator",
  business: "Businesses",
  education: "Education",
  startup: "Startup workspace",
  private: "Private servers",
};

/** Wizard chip labels (keep in sync with script.js DEMO_PATTERN_OPTIONS). */
const CHANNEL_PATTERN_LABELS = {
  "regular-text": "Regular Text",
  "bar-divider": "Bar Divider",
  "sparkle-dot": "White Brackets",
  "bold-column": "Column",
  chevrons: "Chevrons",
  "corner-brackets": "Corner Brackets",
  "dot-separator": "Star Separator",
  flourish: "Flourish Wrap",
  "em-dash": "Fullwidth",
};

function slugToLabel(slug) {
  if (!slug) return "";
  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Human-readable naming style from Stripe metadata (label preferred, else pattern id). */
function namingStyleFromMeta(meta) {
  const lab = (meta.channelPatternLabel || "").toString().trim();
  if (lab) return lab;
  const id = (meta.channelPattern || "").toString().trim();
  if (!id) return "";
  return CHANNEL_PATTERN_LABELS[id] || slugToLabel(id);
}

function layoutLabelForCheckout(layoutTypeKey) {
  const k = (layoutTypeKey || "").toString().trim();
  if (!k) return "Discord server layout";
  if (LAYOUT_TYPE_LABELS[k]) return LAYOUT_TYPE_LABELS[k];
  return slugToLabel(k.replace(/_/g, "-")) || "Discord server layout";
}

/** Stripe line item + invoice: layout focus and channel name style (matches wizard). */
function checkoutLineItemPresentation(layoutTypeKey, namingStyleLabel) {
  const k = (layoutTypeKey || "").toString().trim();
  let layoutTitle;
  if (k && LAYOUT_TYPE_LABELS[k]) {
    layoutTitle = `${LAYOUT_TYPE_LABELS[k]} layout`;
  } else if (k) {
    const phrase = layoutLabelForCheckout(layoutTypeKey);
    layoutTitle = /\blayout\b/i.test(phrase) ? phrase : `${phrase} layout`;
  } else {
    layoutTitle = "Discord server layout";
  }
  const style = (namingStyleLabel || "").toString().trim();
  const name = style
    ? `Serverly: ${layoutTitle} · ${style}`
    : `Serverly: ${layoutTitle}`;
  return {
    name: name.slice(0, 250),
    description:
      "Includes your Discord template link, full channel map, roles, and setup notes for the layout and channel name style you selected.".slice(
        0,
        500
      ),
  };
}

function includesForTier(tier, goal, serverMode) {
  const base = {
    simple: [
      "Full channel map",
      "41+ channels",
      "Regular channel names",
      "Member, mod, admin roles",
      "Clean categories",
      "Text & voice",
      "On-time delivery",
    ],
    advanced: [
      "Everything in Basic",
      "55+ channels",
      "Custom channel names",
      "Rules channel blueprint",
      "High-traffic room presets",
      "One to two name patterns",
      "Voice & stage ideas",
      "Public-ready hierarchy",
      "Tier timeline delivery",
    ],
    professional: [
      "Everything in Advanced",
      "24/7 Discord moderation",
      "1:1 helper / mentor",
      "High-quality, white-glove service",
      "Priority support & iteration",
    ],
  };
  let list = [...(base[tier] || base.simple)];
  if (goal === "aesthetic" && tier === "simple") {
    list.push("Extra polish on names where it fits");
  }
  if (effectiveServerMode(serverMode) === "fresh") {
    list.push("Delivered as an implementable layout (template-style + notes)");
  }
  return list;
}

function thankYouPageUrl(checkoutSessionId) {
  const base = `${clientUrl}/thank-you.html`;
  return checkoutSessionId
    ? `${base}?session_id=${encodeURIComponent(checkoutSessionId)}`
    : base;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Reply-To / support address on Serverly emails and printed on Stripe invoice footer. */
function getSupportReplyEmail() {
  const a = (process.env.EMAIL_REPLY_TO || "").trim();
  if (a) return a;
  return (process.env.INVOICE_SUPPORT_EMAIL || "").trim();
}

/** Short payment + invoice email (first of two). */
function buildReceiptEmail(meta, customerEmail, extras) {
  extras = extras || {};
  const checkoutSessionId = extras.checkoutSessionId || "";
  const stripeInvoiceUrl = extras.stripeInvoiceUrl || "";
  const support = getSupportReplyEmail();
  const thankYou = thankYouPageUrl(checkoutSessionId);

  const lines = [
    "SERVERLY — Payment received",
    "",
    "Thank you. Your payment was successful.",
    "",
    "HOSTED INVOICE (Stripe)",
    stripeInvoiceUrl
      ? stripeInvoiceUrl
      : "Stripe emails a receipt separately. The hosted invoice link is included there when your account sends it for this checkout.",
    "",
    "ORDER PAGE (next steps)",
    thankYou,
    "",
    "Checkout reference: " + (checkoutSessionId || "(n/a)"),
    "",
    'You will receive a second email: "Serverly: Your Discord template & order details" with your Discord template link and full order summary.',
    "",
  ];
  if (support) {
    lines.push(
      "Questions about this order? Reply to this email, or write to: " + support,
      "(Our messages use Reply-To so your reply reaches us.)",
      "",
    );
  }
  lines.push("- Serverly");

  const text = lines.join("\n");

  let html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.55;color:#1e293b;max-width:40rem;margin:0;padding:1rem">';
  html += '<h1 style="font-size:1.25rem;margin:0 0 0.75rem">Payment received — Serverly</h1>';
  html += "<p>Thank you. Your payment was successful.</p>";
  html += '<h2 style="font-size:1rem;margin:1.25rem 0 0.5rem">Hosted invoice</h2>';
  if (stripeInvoiceUrl) {
    html +=
      '<p style="margin:0;word-break:break-all"><a href="' +
      escapeHtml(stripeInvoiceUrl) +
      '">' +
      escapeHtml(stripeInvoiceUrl) +
      "</a></p>";
  } else {
    html +=
      "<p style=\"margin:0\">Stripe sends a receipt email separately; the hosted invoice link appears there when available.</p>";
  }
  html += '<h2 style="font-size:1rem;margin:1.25rem 0 0.5rem">Order page</h2>';
  html +=
    '<p style="margin:0 0 0.75rem"><a href="' + escapeHtml(thankYou) + '">' + escapeHtml(thankYou) + "</a></p>";
  html +=
    '<p style="margin:0 0 0.75rem"><strong>Checkout reference:</strong> ' +
    escapeHtml(checkoutSessionId || "(n/a)") +
    "</p>";
  html +=
    "<p style=\"margin:0 0 1rem\">You will receive a <strong>second email</strong> titled <em>Serverly: Your Discord template & order details</em> with your template link and full order summary.</p>";
  if (support) {
    html +=
      '<p style="margin:0">Questions? Reply to this message or email <a href="mailto:' +
      escapeHtml(support) +
      '">' +
      escapeHtml(support) +
      "</a>.</p>";
  }
  html += '<p style="margin:1.5rem 0 0;color:#64748b;font-size:0.9rem">- Serverly</p></body></html>';

  return { text, html };
}

function buildProductDeliveryEmail(meta, customerEmail, extras) {
  extras = extras || {};
  const checkoutSessionId = extras.checkoutSessionId || "";
  const stripeInvoiceUrl = extras.stripeInvoiceUrl || "";
  const tier = meta.tier || "simple";
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
  const layoutForPackage = normalizeLayoutType(meta.layout_type);
  const namingStyleLine = namingStyleFromMeta(meta);
  const packageLine =
    checkoutLineItemPresentation(layoutForPackage, namingStyleLine).name ||
    (TIERS[tier] && TIERS[tier].name) ||
    tierName;
  const metaDiscord = (meta.discord_template_url && String(meta.discord_template_url).trim()) || "";
  const instantUrl = (metaDiscord || digitalDeliveryUrl || "").trim();
  const isDiscordTemplate = !!metaDiscord;

  const chPrevParts = [];
  for (let pi = 0; pi < 15; pi++) {
    const pk = `ch_prev_${pi}`;
    if (meta[pk] && String(meta[pk]).trim()) chPrevParts.push(String(meta[pk]));
  }

  const lines = [
    "SERVERLY — Your Discord template & order details",
    "",
    "This email is the second message we send after checkout. It has your template link, your choices from the website, and delivery notes.",
    "",
  ];

  if (instantUrl) {
    lines.push(
      "1) INSTANT ACCESS: your digital product",
      isDiscordTemplate
        ? "Open this link while signed into Discord to create a server from your purchased template (same link as your thank-you page):"
        : "Use this link right away for your starter resource or download:",
      instantUrl,
      ""
    );
  }

  const layoutSectionNum = instantUrl ? "2)" : "1)";
  const orderPageSectionNum = instantUrl ? "3)" : "2)";
  lines.push(
    `${layoutSectionNum} CUSTOM DISCORD LAYOUT (${instantUrl ? "your main purchase" : "your purchase"})`,
    "This is the personalized server blueprint: channels, categories, roles, and setup notes based on your answers on the website.",
    "We deliver it to this email in line with your tier timeline unless we reach out separately.",
    "",
    `${orderPageSectionNum} ORDER PAGE (bookmark)`,
    thankYouPageUrl(checkoutSessionId),
    "",
    "Emails sent to " + customerEmail + ":",
    "• Stripe: payment receipt (enable under Dashboard → Settings → Customer emails if missing).",
    stripeInvoiceUrl
      ? "• Stripe: hosted invoice: " + stripeInvoiceUrl
      : "• Stripe: hosted invoice link when your account sends invoices for this Checkout session.",
    "• Serverly: this email is your product delivery and spec snapshot.",
    "",
    "Checkout reference: " + (checkoutSessionId || "(n/a)") + "",
    "",
    "---",
    "ORDER SNAPSHOT (what you selected)",
    "",
    `Package: ${packageLine}`,
    `Delivery email: ${customerEmail}`,
    "",
  );
  if (meta.goal) lines.push(`Goal: ${GOAL_LABELS[meta.goal] || meta.goal}`);
  if (meta.layout_type) {
    lines.push(`Layout focus: ${LAYOUT_TYPE_LABELS[meta.layout_type] || meta.layout_type}`);
  }
  if (meta.serverMode) {
    const sm = effectiveServerMode(meta.serverMode);
    lines.push(`Server approach: ${SERVER_LABELS[sm] || meta.serverMode || sm}`);
  }
  if (meta.hasFollowers === "true") {
    lines.push("Established audience: Yes");
  }
  if (meta.hasFollowers === "false") {
    lines.push("Established audience: No (following size skipped)");
  }
  if (meta.size) lines.push(`Following / reach: ${SIZE_LABELS[meta.size] || meta.size}`);
  if (namingStyleLine) lines.push(`Channel naming style: ${namingStyleLine}`);
  if (chPrevParts.length) {
    lines.push(
      "",
      "Channel names as shown at checkout (left = canonical, tab = display):",
      "",
      chPrevParts.join("\n"),
    );
  }
  lines.push("", "---", "Included in this tier:", "");
  const inc = includesForTier(tier, meta.goal, effectiveServerMode(meta.serverMode));
  inc.forEach((x) => lines.push(`• ${x}`));
  lines.push("", "- Serverly");

  const text = lines.join("\n");

  let html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.55;color:#1e293b;max-width:40rem;margin:0;padding:1rem">';
  html += '<h1 style="font-size:1.25rem;margin:0 0 0.75rem">Your Discord template & order details — Serverly</h1>';
  html +=
    "<p>This is your <strong>product delivery</strong> email (sent right after your payment confirmation). Below are your template link, choices, and what is included.</p>";

  if (instantUrl) {
    if (isDiscordTemplate) {
      html +=
        '<h2 style="font-size:1rem;margin:1.25rem 0 0.5rem">Discord server template (instant)</h2><p style="margin:0 0 0.5rem">Open this link while signed into Discord. It matches the template you purchased:</p><p style="margin:0;word-break:break-all"><a href="' +
        escapeHtml(instantUrl) +
        '">' +
        escapeHtml(instantUrl) +
        "</a></p>";
    } else {
      html +=
        '<h2 style="font-size:1rem;margin:1.25rem 0 0.5rem">Instant access</h2><p style="margin:0 0 0.5rem">Use this link right away for your starter resource or download:</p><p style="margin:0;word-break:break-all"><a href="' +
        escapeHtml(instantUrl) +
        '">' +
        escapeHtml(instantUrl) +
        "</a></p>";
    }
  }

  html +=
    '<h2 style="font-size:1rem;margin:1.25rem 0 0.5rem">Custom Discord layout</h2><p style="margin:0 0 0.75rem">Your personalized server blueprint (channels, roles, notes) is produced from your answers on the website and delivered to <strong>' +
    escapeHtml(customerEmail) +
    "</strong> on your tier timeline.</p>";

  html += '<h2 style="font-size:1rem;margin:1.25rem 0 0.5rem">Thank-you page</h2><p style="margin:0 0 0.75rem"><a href="' + escapeHtml(thankYouPageUrl(checkoutSessionId)) + '">' + escapeHtml(thankYouPageUrl(checkoutSessionId)) + "</a></p>";

  html += "<h2 style=\"font-size:1rem;margin:1.25rem 0 0.5rem\">Stripe</h2><ul style=\"margin:0;padding-left:1.25rem\">";
  html += "<li>Receipt from Stripe (check spam).</li>";
  if (stripeInvoiceUrl) {
    html +=
      '<li>Hosted invoice: <a href="' + escapeHtml(stripeInvoiceUrl) + '">' + escapeHtml(stripeInvoiceUrl) + "</a></li>";
  } else {
    html += "<li>Hosted invoice link when your invoice is available.</li>";
  }
  html += "</ul>";

  html +=
    '<p style="margin:1rem 0 0"><strong>Checkout reference:</strong> ' +
    escapeHtml(checkoutSessionId || "(n/a)") +
    "</p>";

  html += '<h2 style="font-size:1rem;margin:1.25rem 0 0.5rem">Order snapshot</h2><dl style="margin:0 0 1rem">';
  html += "<dt style=\"font-weight:600;color:#64748b\">Package</dt><dd style=\"margin:0 0 0.5rem\">" + escapeHtml(packageLine) + "</dd>";
  html +=
    '<dt style="font-weight:600;color:#64748b">Delivery email</dt><dd style="margin:0 0 0.5rem">' +
    escapeHtml(customerEmail) +
    "</dd>";
  if (meta.goal) {
    html +=
      "<dt style=\"font-weight:600;color:#64748b\">Goal</dt><dd style=\"margin:0 0 0.5rem\">" +
      escapeHtml(GOAL_LABELS[meta.goal] || meta.goal) +
      "</dd>";
  }
  if (meta.layout_type) {
    html +=
      "<dt style=\"font-weight:600;color:#64748b\">Layout focus</dt><dd style=\"margin:0 0 0.5rem\">" +
      escapeHtml(LAYOUT_TYPE_LABELS[meta.layout_type] || meta.layout_type) +
      "</dd>";
  }
  if (meta.serverMode) {
    const sm = effectiveServerMode(meta.serverMode);
    html +=
      "<dt style=\"font-weight:600;color:#64748b\">Server approach</dt><dd style=\"margin:0 0 0.5rem\">" +
      escapeHtml(SERVER_LABELS[sm] || meta.serverMode || sm) +
      "</dd>";
  }
  if (meta.hasFollowers === "true") {
    html +=
      '<dt style="font-weight:600;color:#64748b">Established audience</dt><dd style="margin:0 0 0.5rem">Yes</dd>';
  }
  if (meta.hasFollowers === "false") {
    html +=
      '<dt style="font-weight:600;color:#64748b">Established audience</dt><dd style="margin:0 0 0.5rem">No</dd>';
  }
  if (meta.size) {
    html +=
      "<dt style=\"font-weight:600;color:#64748b\">Following / reach</dt><dd style=\"margin:0 0 0.5rem\">" +
      escapeHtml(SIZE_LABELS[meta.size] || meta.size) +
      "</dd>";
  }
  if (namingStyleLine) {
    html +=
      "<dt style=\"font-weight:600;color:#64748b\">Channel naming style</dt><dd style=\"margin:0 0 0.5rem\">" +
      escapeHtml(namingStyleLine) +
      "</dd>";
  }
  html += "</dl>";
  if (chPrevParts.length) {
    html +=
      '<h2 style="font-size:1rem;margin:1rem 0 0.5rem">Channel names at checkout</h2><pre style="white-space:pre-wrap;word-break:break-word;font-size:0.82rem;line-height:1.45;background:#f8fafc;padding:0.75rem;border-radius:0.35rem;border:1px solid #e2e8f0;margin:0 0 1rem">' +
      escapeHtml(chPrevParts.join("\n")) +
      "</pre>";
  }

  html += '<h2 style="font-size:1rem;margin:1rem 0 0.5rem">Included in this tier</h2><ul style="margin:0;padding-left:1.25rem">';
  inc.forEach((x) => {
    html += "<li>" + escapeHtml(x) + "</li>";
  });
  html += "</ul>";

  html += '<p style="margin:1.5rem 0 0;color:#64748b;font-size:0.9rem">- Serverly</p>';

  html += "</body></html>";

  return { text, html };
}

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.EMAIL_FROM) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transporter;
}

function isOrderEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

async function sendOrderEmail(to, subject, text, html) {
  const tx = getTransporter();
  if (!tx) {
    console.error(
      "[Serverly] Order email NOT sent: SMTP_HOST / EMAIL_FROM missing on server. Customer:",
      to || "(no address)"
    );
    return false;
  }
  const mail = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  };
  if (html) mail.html = html;
  const replyTo = getSupportReplyEmail();
  if (replyTo) mail.replyTo = replyTo;
  if (process.env.EMAIL_BCC) mail.bcc = process.env.EMAIL_BCC;
  await tx.sendMail(mail);
  return true;
}

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeadersMiddleware);

const checkoutIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(1, parseInt(process.env.CHECKOUT_RATE_LIMIT_MAX || "40", 10)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts from this network. Please try again later." },
});

const orderInstantIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(1, parseInt(process.env.ORDER_INSTANT_RATE_LIMIT_MAX || "80", 10)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

app.use(
  cors({
    origin: buildCorsOriginOption(),
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !webhookSecret) {
      return res.status(500).send("Webhook not configured");
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], webhookSecret);
    } catch (err) {
      console.error("Webhook signature:", err.message);
      return res.status(400).send("Webhook Error");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.mode !== "payment") {
        return res.json({ received: true });
      }
      const meta = session.metadata || {};
      const email =
        session.customer_details?.email || session.customer_email || meta.customer_email || "";
      if (email) {
        let stripeInvoiceUrl = "";
        if (stripe && session.invoice) {
          try {
            const invId = typeof session.invoice === "string" ? session.invoice : session.invoice.id;
            const inv = await stripe.invoices.retrieve(invId);
            if (inv.hosted_invoice_url) stripeInvoiceUrl = inv.hosted_invoice_url;
          } catch (invErr) {
            console.warn("Could not load Stripe invoice for email:", invErr.message);
          }
        }
        const extras = { checkoutSessionId: session.id, stripeInvoiceUrl };
        try {
          const rec = buildReceiptEmail(meta, email, extras);
          await sendOrderEmail(email, "Serverly: Payment received — receipt & invoice", rec.text, rec.html);
        } catch (e1) {
          console.error("Receipt email failed:", e1);
        }
        try {
          const prod = buildProductDeliveryEmail(meta, email, extras);
          await sendOrderEmail(
            email,
            "Serverly: Your Discord template & order details",
            prod.text,
            prod.html
          );
        } catch (e2) {
          console.error("Product delivery email failed:", e2);
        }
      } else {
        console.warn("No email on completed session", session.id);
      }
    }

    res.json({ received: true });
  }
);

app.use(express.json({ limit: "64kb" }));

app.get("/order-instant", orderInstantIpLimiter, async (req, res) => {
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id.trim() : "";
  if (!sessionId || !stripe) {
    return res.status(400).json({ error: "Missing session_id or Stripe not configured." });
  }
  if (!isValidStripeCheckoutSessionId(sessionId)) {
    return res.status(400).json({ error: "Invalid session_id." });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== "payment") {
      return res.status(403).json({ error: "Payment not confirmed for this session." });
    }
    const paid =
      session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (!paid) {
      return res.status(403).json({ error: "Payment not confirmed for this session." });
    }
    const meta = session.metadata || {};
    const metaTier = (meta.tier || "").toString().trim();
    if (metaTier && metaTier !== "advanced") {
      return res.status(403).json({ error: "Payment not confirmed for this session." });
    }
    let discordTemplateUrl = safePublicHttpUrl(meta.discord_template_url);
    if (!discordTemplateUrl) {
      const resolved = resolveDiscordTemplateUrl({
        layoutType: normalizeLayoutType(meta.layout_type),
        channelPattern: normalizeChannelPattern(meta.channelPattern),
      });
      discordTemplateUrl = safePublicHttpUrl(resolved);
    }
    return res.json({ discordTemplateUrl: discordTemplateUrl || "" });
  } catch (e) {
    console.error("order-instant:", e.message);
    return res.status(400).json({ error: "Could not load checkout session." });
  }
});

app.post(
  "/create-checkout-session",
  strictBrowserOriginMiddleware,
  checkoutIpLimiter,
  async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe is not configured on the server." });
  }

  const {
    tier,
    email,
    goal,
    serverMode,
    hasFollowers,
    size,
    channelPattern,
    channelPatternLabel,
    channelPreviewChunks,
    layoutType,
  } = req.body || {};

  const paidTier = "advanced";
  if (!TIERS[paidTier]) {
    return res.status(500).json({ error: "Checkout product is not configured." });
  }

  const emailStr = typeof email === "string" ? email.trim() : "";
  if (emailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    return res.status(400).json({ error: "Invalid email." });
  }

  const ghPagesErr = githubPagesMissingProjectPathError();
  if (ghPagesErr) {
    console.error(ghPagesErr);
    return res.status(500).json({
      error: "Checkout is not available right now. If this continues, contact support.",
    });
  }

  const t = TIERS[paidTier];
  const patId = normalizeChannelPattern(channelPattern);
  let patLab = sanitizeChannelPatternLabel(channelPatternLabel, 450);
  if (!patLab && patId) {
    patLab = sanitizeChannelPatternLabel(CHANNEL_PATTERN_LABELS[patId] || slugToLabel(patId), 450);
  }
  const layoutTypeMeta = normalizeLayoutType(layoutType);
  const templateFields = {
    layoutType: layoutTypeMeta,
    channelPattern: patId,
  };
  const templateEnvKey = getTemplateEnvKey(templateFields);
  const discordTemplateUrl =
    safePublicHttpUrl(resolveDiscordTemplateUrl(templateFields).slice(0, 500)) || "";
  const hasFollowersMeta =
    hasFollowers === true || hasFollowers === "true"
      ? "true"
      : hasFollowers === false || hasFollowers === "false"
        ? "false"
        : "";

  const previewMeta = {};
  const rawChunks = Array.isArray(channelPreviewChunks) ? channelPreviewChunks : [];
  for (let ci = 0; ci < Math.min(rawChunks.length, 12); ci++) {
    const piece = sanitizeChannelPatternLabel(String(rawChunks[ci] || ""), 500);
    if (piece.trim()) previewMeta[`ch_prev_${ci}`] = piece;
  }

  try {
    const thankYouPage = `${clientUrl}/thank-you.html`;
    let invoiceFooter = `Next steps & layout guide: ${thankYouPage}`;
    const supportFooter = getSupportReplyEmail();
    if (supportFooter) invoiceFooter += `\n\nSupport / replies: ${supportFooter}`;
    const checkoutLine = checkoutLineItemPresentation(layoutTypeMeta, patLab);
    const sessionParams = {
      mode: "payment",
      allow_promotion_codes: true,
      invoice_creation: {
        enabled: true,
        invoice_data: {
          footer: invoiceFooter,
        },
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: t.amount,
            product_data: {
              name: checkoutLine.name,
              description: checkoutLine.description,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${thankYouPage}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/?checkout=cancel`,
      metadata: {
        tier: paidTier,
        goal: sanitizeChannelPatternLabel(goal || "", 200),
        serverMode: sanitizeChannelPatternLabel(
          effectiveServerMode(serverMode) || serverMode || "",
          80
        ),
        hasFollowers: hasFollowersMeta,
        size: sanitizeChannelPatternLabel(size || "", 80),
        channelPattern: patId,
        channelPatternLabel: patLab,
        layout_type: layoutTypeMeta,
        template_env_key: templateEnvKey,
        discord_template_url: discordTemplateUrl,
        customer_email: emailStr,
        ...previewMeta,
      },
    };
    if (emailStr) {
      sessionParams.customer_email = emailStr;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.json({ url: session.url });
  } catch (e) {
    console.error("create-checkout-session:", e);
    return res.status(500).json({ error: CHECKOUT_GENERIC_ERROR });
  }
  }
);

app.get("/health", (_req, res) => {
  const verbose =
    process.env.HEALTH_VERBOSE === "1" || process.env.HEALTH_VERBOSE === "true";
  if (verbose) {
    res.json({
      ok: true,
      stripeConfigured: !!stripe,
      webhookConfigured: !!webhookSecret,
      orderEmailConfigured: isOrderEmailConfigured(),
      replyToConfigured: !!getSupportReplyEmail(),
    });
  } else {
    res.json({ ok: true });
  }
});

app.listen(port, () => {
  warnIfGithubPagesMissingRepoPath();
  console.log(`Checkout API listening on http://localhost:${port}`);
  console.log(`Stripe return / CORS site base: ${clientUrl}`);
  if (stripe && webhookSecret && !isOrderEmailConfigured()) {
    console.error(
      "[Serverly] Paid customers will not get the Serverly order email until SMTP_HOST and EMAIL_FROM are set (see env.example)."
    );
  }
  if (stripe && webhookSecret && isOrderEmailConfigured() && !getSupportReplyEmail()) {
    console.warn(
      "[Serverly] Set EMAIL_REPLY_TO so customers can reply to receipt/product emails; invoice PDF footer will also list support."
    );
  }
});
