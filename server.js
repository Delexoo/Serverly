/**
 * Stripe Checkout API for Serverly static site.
 *
 * POST /create-checkout-session — body: { tier, email, goal, serverMode, hasFollowers, size, channelPattern, channelPatternLabel }
 * POST /webhook — Stripe webhook (checkout.session.completed) → sends order email
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const nodemailer = require("nodemailer");
const { resolveDiscordTemplateUrl } = require("./template-registry.js");

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function buildPublicSiteBaseUrl() {
  const raw = (process.env.CLIENT_URL || "http://localhost:5500").trim().replace(/\/$/, "");
  const extraPath = (process.env.CLIENT_SITE_PATH || "").replace(/^\/+|\/+$/g, "").trim();
  if (!extraPath) return raw;
  try {
    const u = new URL(raw);
    const pathEmpty = !u.pathname || u.pathname === "/";
    if (pathEmpty) return `${u.origin}/${extraPath}`.replace(/\/$/, "");
  } catch {
    /* keep raw */
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
        "[Serverly] CLIENT_URL is only %s — project sites need the repo name. Add env CLIENT_SITE_PATH=Serverly (or your repo) OR set CLIENT_URL=https://%s/Serverly. Otherwise Stripe sends buyers to %s/thank-you.html and GitHub shows “no site here”.",
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

if (!stripeSecret) {
  console.warn("Warning: STRIPE_SECRET_KEY is not set.");
}

const stripe = stripeSecret ? Stripe(stripeSecret) : null;

const TIERS = {
  simple: { amount: 1000, name: "Serverly — Basic server layout" },
  advanced: { amount: 2000, name: "Serverly — Advanced server layout" },
  professional: { amount: 5000, name: "Serverly — Professional (subscription & hands-on)" },
};

const GOAL_LABELS = {
  "full-server": "New template",
  aesthetic: "Style-first",
  both: "Structure + look",
  exploring: "Not sure yet (browse first)",
};

const SERVER_LABELS = {
  update: "Update current server (in progress—not available)",
  fresh: "New server template (new or reset)",
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
  coaching: "Coaching",
  private: "Private servers",
};

function includesForTier(tier, goal, serverMode) {
  const base = {
    simple: [
      "Full channel map",
      "Regular channel names",
      "Member, mod, admin roles",
      "Clean categories",
      "Text & voice",
      "On-time delivery",
    ],
    advanced: [
      "Everything in Basic",
      "50+ channels",
      "Custom channel names",
      "Rules channel blueprint",
      "High-traffic room presets",
      "One to two name patterns",
      "Announce & ticket lanes",
      "Creator, VIP, bot roles",
      "Voice & stage ideas",
      "Public-ready hierarchy",
      "Tier timeline delivery",
    ],
    professional: [
      "Everything in Advanced",
      "Subscription-based Discord bot setups",
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

function buildOrderEmail(meta, customerEmail, extras) {
  extras = extras || {};
  const checkoutSessionId = extras.checkoutSessionId || "";
  const stripeInvoiceUrl = extras.stripeInvoiceUrl || "";
  const tier = meta.tier || "simple";
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
  const metaDiscord = (meta.discord_template_url && String(meta.discord_template_url).trim()) || "";
  const instantUrl = (metaDiscord || digitalDeliveryUrl || "").trim();
  const isDiscordTemplate = !!metaDiscord;

  const lines = [
    "YOUR DIGITAL PRODUCT — Serverly",
    "",
    "Thank you for your purchase. Here is what you bought and how you get it.",
    "",
  ];

  if (instantUrl) {
    lines.push(
      "1) INSTANT ACCESS — your digital product",
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
    "This is the personalized server blueprint: channels, categories, roles, and setup notes based on your wizard answers.",
    "We deliver it to this email in line with your tier timeline unless we reach out separately.",
    "",
    `${orderPageSectionNum} ORDER PAGE (bookmark)`,
    thankYouPageUrl(checkoutSessionId),
    "",
    "Emails sent to " + customerEmail + ":",
    "• Stripe — payment receipt (enable under Dashboard → Settings → Customer emails if missing).",
    stripeInvoiceUrl
      ? "• Stripe — hosted invoice: " + stripeInvoiceUrl
      : "• Stripe — hosted invoice link when your account sends invoices for this Checkout session.",
    "• Serverly — this message is your order record and spec snapshot.",
    "",
    "Checkout reference: " + (checkoutSessionId || "(n/a)") + "",
    "",
    "---",
    "ORDER SNAPSHOT (what you selected)",
    "",
    `Package: ${tierName}`,
    `Delivery email: ${customerEmail}`,
    "",
  );
  if (meta.goal) lines.push(`Goal: ${GOAL_LABELS[meta.goal] || meta.goal}`);
  if (meta.layout_type) {
    lines.push(`Layout focus: ${LAYOUT_TYPE_LABELS[meta.layout_type] || meta.layout_type}`);
  }
  if (meta.serverMode) {
    const sm = effectiveServerMode(meta.serverMode);
    lines.push(`Server approach: ${SERVER_LABELS[sm] || sm}`);
  }
  if (meta.hasFollowers === "false") {
    lines.push("Followers: No established audience yet (following size skipped)");
  }
  if (meta.size) lines.push(`Following / reach: ${SIZE_LABELS[meta.size] || meta.size}`);
  if (meta.channelPatternLabel) lines.push(`Naming style preference: ${meta.channelPatternLabel}`);
  lines.push("", "---", "Included in this tier:", "");
  const inc = includesForTier(tier, meta.goal, effectiveServerMode(meta.serverMode));
  inc.forEach((x) => lines.push(`• ${x}`));
  lines.push("", "— Serverly");

  const text = lines.join("\n");

  let html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.55;color:#1e293b;max-width:40rem;margin:0;padding:1rem">';
  html += '<h1 style="font-size:1.25rem;margin:0 0 0.75rem">Your digital product — Serverly</h1>';
  html += "<p>Thank you for your purchase. Below is what you bought and how you get it.</p>";

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
    '<h2 style="font-size:1rem;margin:1.25rem 0 0.5rem">Custom Discord layout</h2><p style="margin:0 0 0.75rem">Your personalized server blueprint (channels, roles, notes) is produced from your wizard answers and delivered to <strong>' +
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
  html += "<dt style=\"font-weight:600;color:#64748b\">Package</dt><dd style=\"margin:0 0 0.5rem\">" + escapeHtml(tierName) + "</dd>";
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
      escapeHtml(SERVER_LABELS[sm] || sm) +
      "</dd>";
  }
  if (meta.hasFollowers === "false") {
    html +=
      '<dt style="font-weight:600;color:#64748b">Followers</dt><dd style="margin:0 0 0.5rem">No established audience yet</dd>';
  }
  if (meta.size) {
    html +=
      "<dt style=\"font-weight:600;color:#64748b\">Following / reach</dt><dd style=\"margin:0 0 0.5rem\">" +
      escapeHtml(SIZE_LABELS[meta.size] || meta.size) +
      "</dd>";
  }
  if (meta.channelPatternLabel) {
    html +=
      "<dt style=\"font-weight:600;color:#64748b\">Naming style</dt><dd style=\"margin:0 0 0.5rem\">" +
      escapeHtml(meta.channelPatternLabel) +
      "</dd>";
  }
  html += "</dl>";

  html += '<h2 style="font-size:1rem;margin:1rem 0 0.5rem">Included in this tier</h2><ul style="margin:0;padding-left:1.25rem">';
  inc.forEach((x) => {
    html += "<li>" + escapeHtml(x) + "</li>";
  });
  html += "</ul>";

  html += '<p style="margin:1.5rem 0 0;color:#64748b;font-size:0.9rem">— Serverly</p>';

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

async function sendOrderEmail(to, subject, text, html) {
  const tx = getTransporter();
  if (!tx) {
    console.warn("Email not configured (SMTP_HOST / EMAIL_FROM). Order text:\n", text);
    return;
  }
  const mail = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  };
  if (html) mail.html = html;
  if (process.env.EMAIL_BCC) mail.bcc = process.env.EMAIL_BCC;
  await tx.sendMail(mail);
}

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || originFromSiteUrl(clientUrl) || true,
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
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const meta = session.metadata || {};
      const email =
        session.customer_details?.email || session.customer_email || meta.customer_email || "";
      if (email) {
        try {
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
          const { text, html } = buildOrderEmail(meta, email, {
            checkoutSessionId: session.id,
            stripeInvoiceUrl,
          });
          await sendOrderEmail(email, "Your Serverly digital order — layout & delivery", text, html);
        } catch (e) {
          console.error("Send email failed:", e);
        }
      } else {
        console.warn("No email on completed session", session.id);
      }
    }

    res.json({ received: true });
  }
);

app.use(express.json());

app.get("/order-instant", async (req, res) => {
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id.trim() : "";
  if (!sessionId || !stripe) {
    return res.status(400).json({ error: "Missing session_id or Stripe not configured." });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const meta = session.metadata || {};
    let discordTemplateUrl = (meta.discord_template_url || "").toString().trim();
    if (!discordTemplateUrl) {
      discordTemplateUrl = resolveDiscordTemplateUrl({
        tier: meta.tier || "",
        layoutType: meta.layout_type || "",
        channelPattern: meta.channelPattern || "",
      });
    }
    return res.json({ discordTemplateUrl });
  } catch (e) {
    console.error("order-instant:", e.message);
    return res.status(400).json({ error: "Could not load checkout session." });
  }
});

app.post("/create-checkout-session", async (req, res) => {
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
    layoutType,
  } = req.body || {};

  if (!tier || !TIERS[tier]) {
    return res.status(400).json({ error: "Invalid or missing tier (simple or advanced)." });
  }

  if (tier === "professional") {
    return res.status(400).json({ error: "Professional tier is coming soon and is not available for checkout yet." });
  }

  const emailStr = typeof email === "string" ? email.trim() : "";
  if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    return res.status(400).json({ error: "Valid email is required." });
  }

  const ghPagesErr = githubPagesMissingProjectPathError();
  if (ghPagesErr) {
    console.error(ghPagesErr);
    return res.status(500).json({ error: ghPagesErr });
  }

  const t = TIERS[tier];
  const patLab = (channelPatternLabel || "").toString().slice(0, 450);
  const layoutTypeMeta = (layoutType || "").toString().slice(0, 450);
  const discordTemplateUrl = resolveDiscordTemplateUrl({
    tier,
    layoutType: layoutTypeMeta,
    channelPattern: (channelPattern || "").toString(),
  }).slice(0, 500);
  const hasFollowersMeta =
    hasFollowers === true || hasFollowers === "true"
      ? "true"
      : hasFollowers === false || hasFollowers === "false"
        ? "false"
        : "";

  try {
    const thankYouPage = `${clientUrl}/thank-you.html`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      customer_email: emailStr,
      invoice_creation: {
        enabled: true,
        invoice_data: {
          footer: `Next steps & layout guide: ${thankYouPage}`,
        },
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: t.amount,
            product_data: {
              name: t.name,
              description: "Discord server layout—channels, roles, flows & tier notes (implement like a Discord template)",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${thankYouPage}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/?checkout=cancel`,
      metadata: {
        tier,
        goal: goal || "",
        serverMode: effectiveServerMode(serverMode) || serverMode || "",
        hasFollowers: hasFollowersMeta,
        size: size || "",
        channelPattern: channelPattern || "",
        channelPatternLabel: patLab,
        layout_type: layoutTypeMeta,
        discord_template_url: discordTemplateUrl,
        customer_email: emailStr,
      },
    });

    return res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Stripe error" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  warnIfGithubPagesMissingRepoPath();
  console.log(`Checkout API listening on http://localhost:${port}`);
  console.log(`Stripe return / CORS site base: ${clientUrl}`);
});
