/**
 * Wizard selection → Discord server template URL (process.env).
 *
 * Env var name rule: {LAYOUT}_{NAMING_STYLE}
 * - Layout: e.g. private → PRIVATE_SERVER, startup → STARTUP_WORKSPACE (matches Keys-Templates.txt).
 * - Pattern: internal slug (e.g. dot-separator) → STAR_SEPARATOR (UI label: Star Separator).
 *
 * Examples:
 *   private + regular-text       → PRIVATE_SERVER_REGULAR_TEXT
 *   business + dot-separator     → BUSINESS_STAR_SEPARATOR
 *   startup + sparkle-dot        → STARTUP_WORKSPACE_WHITE_BRACKETS
 *
 * Set the matching env var on the host (Render, etc.). See Keys-Templates.txt for the full matrix.
 */

/** Wizard layoutType → env name prefix */
const LAYOUT_TYPE_PREFIX = {
  content_creator: "CONTENT_CREATOR",
  business: "BUSINESS",
  education: "EDUCATION",
  startup: "STARTUP_WORKSPACE",
  private: "PRIVATE_SERVER",
};

/**
 * Wizard channelPattern (data-demo-pattern / checkout body) → env name suffix.
 * Internal ids stay stable (e.g. dot-separator); suffix matches deployment env keys.
 */
const CHANNEL_PATTERN_SUFFIX = {
  "regular-text": "REGULAR_TEXT",
  "bar-divider": "BAR_DIVIDER",
  flourish: "FLOURISH_WRAP",
  "bold-column": "COLUMN",
  "corner-brackets": "CORNER_BRACKETS",
  chevrons: "CHEVRONS",
  "dot-separator": "STAR_SEPARATOR",
  "em-dash": "FULLWIDTH",
  "sparkle-dot": "WHITE_BRACKETS",
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
  const keys = [envName];
  /* Keys file historically used singular BRACKET for startup only */
  if (envName === "STARTUP_WORKSPACE_WHITE_BRACKETS") {
    keys.push("STARTUP_WORKSPACE_WHITE_BRACKET");
  }
  for (let i = 0; i < keys.length; i++) {
    const raw = process.env[keys[i]];
    if (raw != null && String(raw).trim() !== "") {
      return String(raw).trim().slice(0, 500);
    }
  }
  return "";
}

module.exports = { resolveDiscordTemplateUrl, getTemplateEnvKey };
