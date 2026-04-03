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

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const clientUrl = (process.env.CLIENT_URL || "http://localhost:5500").replace(/\/$/, "");
const port = parseInt(process.env.PORT || "3000", 10);

if (!stripeSecret) {
  console.warn("Warning: STRIPE_SECRET_KEY is not set.");
}

const stripe = stripeSecret ? Stripe(stripeSecret) : null;

const TIERS = {
  simple: { amount: 100, name: "Serverly — Simple server layout" },
  advanced: { amount: 2000, name: "Serverly — Advanced server layout" },
  professional: { amount: 5000, name: "Serverly — Professional server layout" },
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

function includesForTier(tier, goal, serverMode) {
  const base = {
    simple: [
      "Full channel map",
      "Wizard-matched names",
      "Member, mod, admin roles",
      "Clean categories",
      "Text & voice",
      "Welcome & rules spots",
      "Plain setup notes",
      "On-time delivery",
    ],
    advanced: [
      "Everything in Simple",
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
      "Staff vs public maps",
      "VIP & paid-access flows",
      "Events & bot mapping",
      "Full consistency pass",
      "Timeline TBD",
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

function buildOrderEmailText(meta, customerEmail) {
  const tier = meta.tier || "simple";
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
  const lines = [
    "Thank you for your order!",
    "",
    "Here is a copy of what you selected (same as your on-site summary).",
    "We’ll deliver your full server layout on the timeline for your tier.",
    "",
    "---",
    `Package: ${tierName}`,
    `Email: ${customerEmail}`,
    "",
  ];
  if (meta.goal) lines.push(`Goal: ${GOAL_LABELS[meta.goal] || meta.goal}`);
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
  return lines.join("\n");
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

async function sendOrderEmail(to, subject, text) {
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
  if (process.env.EMAIL_BCC) mail.bcc = process.env.EMAIL_BCC;
  await tx.sendMail(mail);
}

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || clientUrl || true,
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
          const body = buildOrderEmailText(meta, email);
          await sendOrderEmail(email, "Your Serverly order summary", body);
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

  const t = TIERS[tier];
  const patLab = (channelPatternLabel || "").toString().slice(0, 450);
  const hasFollowersMeta =
    hasFollowers === true || hasFollowers === "true"
      ? "true"
      : hasFollowers === false || hasFollowers === "false"
        ? "false"
        : "";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      customer_email: emailStr,
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
      success_url: `${clientUrl}/?checkout=success`,
      cancel_url: `${clientUrl}/?checkout=cancel`,
      metadata: {
        tier,
        goal: goal || "",
        serverMode: effectiveServerMode(serverMode) || serverMode || "",
        hasFollowers: hasFollowersMeta,
        size: size || "",
        channelPattern: channelPattern || "",
        channelPatternLabel: patLab,
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
  console.log(`Checkout API listening on http://localhost:${port}`);
  console.log(`CLIENT_URL (redirects): ${clientUrl}`);
});
