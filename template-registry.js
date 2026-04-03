/**
 * Wizard selection → Discord server template URL.
 * URLs are never committed to the repo: set them as environment variables on Render (or your host).
 * Used only by the checkout API (Node) — not bundled for the browser.
 */

/** Map "tier:layoutType:channelPattern" → process.env key name */
const TEMPLATE_ENV_KEYS = {
  /** Wizard card "Column" → data-pattern="bold-column" */
  "advanced:content_creator:bold-column": "CONTENT_CREATOR_COLUMN",
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
