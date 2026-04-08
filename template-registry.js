/**
 * Wizard selection → Discord server template URL.
 * URLs are never committed to the repo: set them as environment variables on Render (or your host).
 * Used only by the checkout API (Node), not bundled for the browser.
 */

/** Map "tier:layoutType:channelPattern" → process.env key name */
const TEMPLATE_ENV_KEYS = {
  /** Wizard card "Column" → data-pattern="bold-column" */
  "advanced:content_creator:bold-column": "CONTENT_CREATOR_COLUMN",
  /** Wizard card "Bar divider" → data-pattern="bar-divider" */
  "advanced:content_creator:bar-divider": "CONTENT_CREATOR_BAR_DIVIDER",
  /** Wizard card "Flourish wrap" → data-pattern="flourish" */
  "advanced:content_creator:flourish": "CONTENT_CREATOR_FLOURISH_WRAP",
  /** Wizard card "Corner brackets" → data-pattern="corner-brackets" */
  "advanced:content_creator:corner-brackets": "CONTENT_CREATOR_CORNER_BRACKETS",
  /** Wizard card "Chevrons" → data-pattern="chevrons" */
  "advanced:content_creator:chevrons": "CONTENT_CREATOR_CHEVRONS",
  /** Wizard card "Regular text" → data-pattern="regular-text" (Advanced or Basic) */
  "advanced:content_creator:regular-text": "CONTENT_CREATOR_REGULAR_TEXT",
  "simple:content_creator:regular-text": "CONTENT_CREATOR_REGULAR_TEXT",
};

function resolveDiscordTemplateUrl(fields) {
  const tier = (fields && fields.tier) || "";
  const layoutType = (fields && fields.layoutType) || "";
  const channelPattern = (fields && fields.channelPattern) || "";
  const composite = `${tier}:${layoutType}:${channelPattern}`;
  const envName = TEMPLATE_ENV_KEYS[composite];
  if (!envName) return "";
  const raw = process.env[envName];
  if (raw == null || String(raw).trim() === "") return "";
  return String(raw).trim().slice(0, 500);
}

module.exports = { resolveDiscordTemplateUrl };
