/**
 * Wizard selection → Discord server template URL (process.env).
 *
 * Env var name rule: {LAYOUT}_{NAMING_STYLE}
 * - Layout comes from wizard layoutType (e.g. content_creator → CONTENT_CREATOR).
 * - Naming style comes from channelPattern slug (e.g. bar-divider → BAR_DIVIDER, flourish → FLOURISH_WRAP).
 *
 * Examples:
 *   content_creator + bar-divider  → CONTENT_CREATOR_BAR_DIVIDER
 *   content_creator + flourish     → CONTENT_CREATOR_FLOURISH_WRAP
 *   business + regular-text        → BUSINESS_REGULAR_TEXT
 *
 * Set the matching env var to your Discord template URL on the host (Render, etc.).
 */

/** Wizard layoutType → env name prefix */
const LAYOUT_TYPE_PREFIX = {
  content_creator: "CONTENT_CREATOR",
  business: "BUSINESS",
  education: "EDUCATION",
  startup: "STARTUP",
  private: "PRIVATE",
};

/**
 * Wizard channelPattern (data-demo-pattern / checkout body) → env name suffix.
 * Keeps legacy names (e.g. COLUMN, FLOURISH_WRAP) aligned with existing env keys.
 */
const CHANNEL_PATTERN_SUFFIX = {
  "regular-text": "REGULAR_TEXT",
  "bar-divider": "BAR_DIVIDER",
  flourish: "FLOURISH_WRAP",
  "bold-column": "COLUMN",
  "corner-brackets": "CORNER_BRACKETS",
  chevrons: "CHEVRONS",
  "dot-separator": "DOT_SEPARATOR",
  "em-dash": "EM_DASH", // UI: Fullwidth (emoji + fullwidth Latin, no separator)
  "sparkle-dot": "SPARKLE_DOT",
};

function layoutTypeToPrefix(layoutType) {
  const raw = (layoutType || "").toString().trim();
  if (!raw) return "";
  if (LAYOUT_TYPE_PREFIX[raw]) return LAYOUT_TYPE_PREFIX[raw];
  return raw
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w.toUpperCase())
    .join("_");
}

function channelPatternToSuffix(channelPattern) {
  const raw = (channelPattern || "").toString().trim();
  if (!raw) return "";
  if (CHANNEL_PATTERN_SUFFIX[raw]) return CHANNEL_PATTERN_SUFFIX[raw];
  return raw
    .split("-")
    .filter(Boolean)
    .map((w) => w.toUpperCase())
    .join("_");
}

/**
 * Public name for the env key (for logs, Stripe metadata, or ops docs).
 */
function getTemplateEnvKey(fields) {
  const layoutPrefix = layoutTypeToPrefix((fields && fields.layoutType) || "");
  const patternSuffix = channelPatternToSuffix((fields && fields.channelPattern) || "");
  if (!layoutPrefix || !patternSuffix) return "";
  return `${layoutPrefix}_${patternSuffix}`;
}

function resolveDiscordTemplateUrl(fields) {
  const envName = getTemplateEnvKey(fields);
  if (!envName) return "";
  const raw = process.env[envName];
  if (raw == null || String(raw).trim() === "") return "";
  return String(raw).trim().slice(0, 500);
}

module.exports = { resolveDiscordTemplateUrl, getTemplateEnvKey };
