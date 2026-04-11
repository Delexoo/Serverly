/**
 * Shared checkout / order-instant hardening (used by server.js and stripe-server/server.js).
 * Payment amount and completion are always enforced by Stripe; this layer reduces abuse and odd inputs.
 */

const ALLOWED_LAYOUT_TYPES = new Set([
  "content_creator",
  "business",
  "education",
  "startup",
  "private",
]);

const ALLOWED_CHANNEL_PATTERNS = new Set([
  "regular-text",
  "bar-divider",
  "flourish",
  "bold-column",
  "corner-brackets",
  "chevrons",
  "dot-separator",
  "em-dash",
  "sparkle-dot",
]);

function normalizeLayoutType(raw) {
  const s = String(raw || "").trim();
  return ALLOWED_LAYOUT_TYPES.has(s) ? s : "content_creator";
}

function normalizeChannelPattern(raw) {
  const s = String(raw || "").trim();
  return ALLOWED_CHANNEL_PATTERNS.has(s) ? s : "regular-text";
}

/**
 * Stripe Checkout Session ids are opaque strings; reject garbage before calling Stripe API.
 */
function isValidStripeCheckoutSessionId(id) {
  if (!id || typeof id !== "string") return false;
  const s = id.trim();
  if (s.length < 14 || s.length > 256) return false;
  return /^cs_[A-Za-z0-9_]+$/.test(s);
}

/** Strip control chars and angle brackets from user-supplied labels (metadata / email bodies). */
function sanitizeChannelPatternLabel(raw, maxLen) {
  const lim = maxLen == null ? 450 : maxLen;
  return String(raw || "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f<>]/g, "")
    .trim()
    .slice(0, lim);
}

/** Only return template URLs that are plain http(s) — never javascript:, data:, etc. */
function safePublicHttpUrl(raw) {
  const u = (raw || "").toString().trim();
  if (!u) return "";
  try {
    const p = new URL(u);
    if (p.protocol !== "https:" && p.protocol !== "http:") return "";
    return u;
  } catch {
    return "";
  }
}

function securityHeadersMiddleware(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "interest-cohort=()");
  next();
}

function strictBrowserOriginMiddleware(req, res, next) {
  const on =
    process.env.STRICT_BROWSER_ORIGIN === "1" || process.env.STRICT_BROWSER_ORIGIN === "true";
  if (!on) return next();
  if (req.method === "OPTIONS") return next();
  const origin = req.get("Origin");
  if (!origin || !/^https?:\/\//i.test(origin)) {
    return res.status(403).json({ error: "Forbidden." });
  }
  next();
}

module.exports = {
  ALLOWED_LAYOUT_TYPES,
  ALLOWED_CHANNEL_PATTERNS,
  normalizeLayoutType,
  normalizeChannelPattern,
  isValidStripeCheckoutSessionId,
  sanitizeChannelPatternLabel,
  safePublicHttpUrl,
  securityHeadersMiddleware,
  strictBrowserOriginMiddleware,
};
