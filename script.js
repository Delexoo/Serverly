(function () {
  var pages = document.querySelectorAll(".wizard-page");
  var FLOW_PAGE_ORDER = [0, 4, 1, 2, 3, 5, 6];
  var totalSteps = FLOW_PAGE_ORDER.length || pages.length || 7;
  var backBtn = document.getElementById("wizard-back");
  var progressLabel = document.getElementById("progress-label");
  var progressFill = document.getElementById("progress-fill");
  var homeBtn = document.getElementById("wizard-home");
  var summaryEl = document.getElementById("wizard-summary");
  var summaryCheckoutCta = document.getElementById("summary-checkout-cta");
  var drawer = document.getElementById("mobile-drawer");
  var backdrop = document.getElementById("drawer-backdrop");
  var navToggle = document.querySelector(".nav-toggle");
  var header = document.querySelector(".site-header");

  var state = {
    step: 0,
    serverMode: null,
    layoutType: null,
    packageTier: null,
    channelPattern: null,
    channelPatternLabel: null,
    checkoutReady: false,
  };

  var patternPickLabelEl = document.getElementById("pattern-pick-label");
  var styleTierNoteEl = document.getElementById("style-tier-note");
  var patternSelectButtons = document.querySelectorAll(".pattern-select[data-pattern]");
  var checkoutPanel = document.getElementById("checkout-panel");
  var checkoutFlash = document.getElementById("checkout-flash");
  var checkoutTierLabel = document.getElementById("checkout-tier-label");
  var checkoutAmount = document.getElementById("checkout-amount");
  var checkoutApiNote = document.getElementById("checkout-api-note");
  var checkoutTierWarning = document.getElementById("checkout-tier-warning");
  var checkoutEmailInp = document.getElementById("checkout-email");
  var checkoutSubmit = document.getElementById("checkout-submit");
  var flashCheckoutTimer = null;

  var SERVER_MODE_LABELS = {
    update: "Update current server (in progress—not available)",
    fresh: "New server template (new or reset server)",
  };

  var LAYOUT_TYPE_LABELS = {
    content_creator: "Content creator",
    business: "Businesses",
    education: "Education",
    startup: "Startup workspace",
    coaching: "Coaching",
    private: "Private servers",
  };

  function normalizeServerMode(mode) {
    if (mode === "update") return "fresh";
    return mode;
  }

  var PACKAGE_LABELS = {
    simple: "Basic",
    advanced: "Advanced",
    professional: "Professional",
  };

  var PACKAGE_PRICE_HINTS = {
    simple: "$1",
    advanced: "$20",
    professional: "$50",
  };

  var TIER_TITLES = {
    simple: "Basic — gets the job done",
    advanced: "Advanced — Basic + presets & polish",
    professional: "Professional — subscription care (coming soon)",
  };

  /** Naming styles for Advanced summary demo (matches wizard style step). */
  var DEMO_PATTERN_OPTIONS = [
    { id: "regular-text", label: "Regular text" },
    { id: "bar-divider", label: "Bar divider" },
    { id: "flourish", label: "Flourish wrap" },
    { id: "bold-column", label: "Column" },
    { id: "corner-brackets", label: "Corner brackets" },
    { id: "chevrons", label: "Chevrons" },
    { id: "dot-separator", label: "Dot separator" },
    { id: "em-dash", label: "Em dash" },
    { id: "sparkle-dot", label: "Sparkle dot" },
  ];

  function serverModeNote(mode) {
    var m = normalizeServerMode(mode);
    if (m === "fresh")
      return "You’ll receive a full server layout for a new or reset server. Live server tune-ups are in progress and not bookable yet.";
    return "";
  }

  function tierLeadNote(tier) {
    if (tier === "advanced")
      return "Advanced adds presets, patterns, VIP roles, and announce/ticket lanes.";
    return "";
  }

  function includesForTier(tier, serverMode) {
    var base = {
      simple: [
        "Full functional Discord layout",
        "Regular channel names",
        "Basic roles",
        "Basic text & voice setup",
      ],
      advanced: [
        "Everything in Basic",
        "50+ channels",
        "Custom channel names",
        "Growth-focused channel architecture",
        "Advanced role hierarchy and permissions map",
        "Announcement, ticket, and conversion lanes",
        "VIP/private room strategy",
        "Layout fit for your niche",
        "Monetization-ready server flow ideas",
        "Priority polish and delivery",
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
    var list = base[tier] || base.simple;
    if (normalizeServerMode(serverMode) === "fresh") {
      list = list.slice();
      list.push("Delivered as an implementable layout (template-style + notes)");
    }
    return list;
  }

  function syncPackagePickUI() {
    document.querySelectorAll("[data-package-tier]").forEach(function (b) {
      var card = b.closest(".price-card");
      if (!card) return;
      var t = b.getAttribute("data-package-tier");
      card.classList.toggle("is-picked", !!state.packageTier && t === state.packageTier);
    });
  }

  function flowPosForPage(pageIdx) {
    var i = FLOW_PAGE_ORDER.indexOf(pageIdx);
    return i >= 0 ? i : 0;
  }

  function pageForFlowPos(pos) {
    if (pos < 0 || pos >= FLOW_PAGE_ORDER.length) return null;
    return FLOW_PAGE_ORDER[pos];
  }

  function syncPatternTierGate() {
    var simple = state.packageTier === "simple";
    patternSelectButtons.forEach(function (btn) {
      var id = btn.getAttribute("data-pattern");
      var locked = simple && id !== "regular-text";
      btn.classList.toggle("pattern-select--locked", locked);
      btn.setAttribute("aria-disabled", locked ? "true" : "false");
    });
    if (styleTierNoteEl) {
      styleTierNoteEl.textContent = simple
        ? "Basic includes Regular text only. Other styles are visible but available in Advanced ($20)."
        : "Advanced unlocks all channel naming styles.";
    }
  }

  function setStep(n) {
    if (n < 0 || n >= pages.length) return;
    var prevStep = state.step;
    var lastIdx = pages.length - 1;
    state.step = n;
    if (prevStep === lastIdx && n !== lastIdx) {
      state.checkoutReady = false;
    }
    pages.forEach(function (page, i) {
      page.classList.toggle("is-active", i === n);
    });
    var flowPos = flowPosForPage(n);
    if (backBtn) backBtn.hidden = flowPos === 0;
    if (progressLabel) progressLabel.textContent = "Step " + (flowPos + 1) + " of " + totalSteps;
    if (progressFill) {
      progressFill.style.width = ((flowPos + 1) / totalSteps) * 100 + "%";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (n === 5) renderSummary();
    if (n === 3) syncPatternSelectionUI();
    if (n === 3) syncPatternTierGate();
    if (n === 4) syncPackagePickUI();
    if (n === 5) {
      syncPackagePickUI();
      syncPatternSelectionUI();
      syncPatternTierGate();
    }
    if (n === 6) {
      state.checkoutReady = true;
      if (!state.packageTier) {
        state.packageTier = "advanced";
      }
      syncCheckoutPanel();
    }
    closeDrawer();
  }

  function syncPatternSelectionUI() {
    patternSelectButtons.forEach(function (btn) {
      var id = btn.getAttribute("data-pattern");
      var on = state.channelPattern && id === state.channelPattern;
      btn.classList.toggle("is-selected", !!on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (patternPickLabelEl) {
      patternPickLabelEl.textContent = state.channelPatternLabel || "none selected (optional)";
    }
  }

  function nextStep() {
    var flowPos = flowPosForPage(state.step);
    var nextPage = pageForFlowPos(flowPos + 1);
    if (typeof nextPage === "number") setStep(nextPage);
  }

  function prevStep() {
    var flowPos = flowPosForPage(state.step);
    var prevPage = pageForFlowPos(flowPos - 1);
    if (typeof prevPage === "number") setStep(prevPage);
  }

  function escapeHtml(s) {
    if (s == null || s === "") return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Full server layout: categories and channels (single source for summary list + Discord demo). Total: 58 channels — order matches product spec. */
  var CHANNEL_TREE = [
    {
      title: "New !",
      locked: false,
      channels: [
        { name: "Welcome", voice: false, locked: false },
        { name: "Rule", voice: false, locked: false },
        { name: "Roles", voice: false, locked: false },
      ],
    },
    {
      title: "Information",
      locked: false,
      channels: [
        { name: "Announcements", voice: false, locked: false },
        { name: "Giveaway", voice: false, locked: false },
        { name: "Pick-Your-Role", voice: false, locked: false },
        { name: "Polls", voice: false, locked: false },
        { name: "Links", voice: false, locked: false },
        { name: "New-Posts", voice: false, locked: false },
        { name: "Partnerships", voice: false, locked: false },
      ],
    },
    {
      title: "General",
      locked: false,
      channels: [
        { name: "General", voice: false, locked: false },
        { name: "Off-Topic", voice: false, locked: false },
        { name: "Game-Chat", voice: false, locked: false },
        { name: "Clips", voice: false, locked: false },
        { name: "Tech", voice: false, locked: false },
        { name: "Art", voice: false, locked: false },
        { name: "Questions", voice: false, locked: false },
        { name: "Feedback", voice: false, locked: false },
      ],
    },
    {
      title: "BOT",
      locked: false,
      channels: [
        { name: "Bots", voice: false, locked: false },
        { name: "CMD", voice: false, locked: false },
      ],
    },
    {
      title: "Voice Chat",
      locked: false,
      channels: [
        { name: "Lounge", voice: true, locked: false },
        { name: "Duo #1", voice: true, locked: false },
        { name: "Duo #2", voice: true, locked: false },
        { name: "Squad #1", voice: true, locked: false },
        { name: "Squad #2", voice: true, locked: false },
        { name: "Crew Lounge", voice: true, locked: false },
        { name: "Music", voice: true, locked: false },
        { name: "Stream", voice: true, locked: false },
        { name: "AFK", voice: true, locked: false },
      ],
    },
    {
      title: "Advisory",
      locked: true,
      channels: [
        { name: "Restricted-Users", voice: false, locked: true },
        { name: "Muted-Users", voice: false, locked: true },
        { name: "Jugement VC", voice: true, locked: true },
      ],
    },
    {
      title: "Staff",
      locked: true,
      channels: [
        { name: "Admin", voice: false, locked: true },
        { name: "Server-Ideas", voice: false, locked: true },
        { name: "Staff-Information", voice: false, locked: true },
        { name: "Test-Bot", voice: false, locked: true },
        { name: "Bye-Bye", voice: false, locked: true },
        { name: "Staff VC", voice: true, locked: true },
        { name: "Recording", voice: true, locked: true },
        { name: "Streaming", voice: true, locked: true },
        { name: "Friends", voice: true, locked: true },
      ],
    },
    {
      title: "Extra Channels",
      locked: true,
      channels: [
        { name: "Self-Promote", voice: false, locked: true },
        { name: "Content-Ideas", voice: false, locked: true },
        { name: "Brand-Deals", voice: false, locked: true },
        { name: "Tools-and-Apps", voice: false, locked: true },
        { name: "Creator-Events", voice: false, locked: true },
        { name: "Monthly-Highlights", voice: false, locked: true },
        { name: "Thumbnail-Contests", voice: false, locked: true },
        { name: "Editing-Room", voice: false, locked: true },
        { name: "Live-Feedback", voice: false, locked: true },
        { name: "Hire-Me", voice: false, locked: true },
        { name: "Team-Up", voice: false, locked: true },
        { name: "Appeals", voice: false, locked: true },
        { name: "Coffee-Chat", voice: false, locked: true },
        { name: "Watch-Party", voice: false, locked: true },
        { name: "Support-VC", voice: false, locked: true },
        { name: "Creator Lounge", voice: true, locked: true },
        { name: "Production Room", voice: true, locked: true },
      ],
    },
  ];

  function demoEmojiForName(name) {
    var m = {
      Welcome: "😄",
      Rule: "📜",
      Roles: "🎭",
      Announcements: "📢",
      Giveaway: "🎉",
      "Pick-Your-Role": "🎯",
      Polls: "❓",
      Links: "🔗",
      "New-Posts": "📰",
      Partnerships: "🤝",
      General: "💬",
      "Off-Topic": "🔍",
      "Game-Chat": "✅",
      Clips: "📷",
      Tech: "📱",
      Art: "🎨",
      Questions: "❔",
      Feedback: "📣",
      Bots: "🤖",
      CMD: "💻",
      "Tools-and-Apps": "🧰",
      "Creator-Events": "🥳",
      "Monthly-Highlights": "🏆",
      "Thumbnail-Contests": "🎨",
      "Editing-Room": "🎬",
      "Live-Feedback": "🔴",
      "Hire-Me": "💼",
      "Team-Up": "🤝",
      Appeals: "⚖️",
      "Coffee-Chat": "☕",
      "Watch-Party": "📽️",
      "Support-VC": "🛠️",
      "Creator Lounge": "🎙️",
      "Production Room": "🎬",
      Lounge: "🗨️",
      "Duo #1": "🎧",
      "Duo #2": "🎧",
      "Squad #1": "👥",
      "Squad #2": "👥",
      "Crew Lounge": "🎭",
      Music: "🎵",
      Stream: "📺",
      AFK: "💤",
      "Restricted-Users": "🔻",
      "Muted-Users": "🚫",
      "Jugement VC": "🔨",
      Admin: "👑",
      "Server-Ideas": "⛔",
      "Staff-Information": "❗",
      "Test-Bot": "🤖",
      "Bye-Bye": "😟",
      "Staff VC": "🎤",
      Recording: "⏺️",
      Streaming: "📹",
      Friends: "👥",
      "Self-Promote": "📣",
      "Content-Ideas": "🗨️",
      "Brand-Deals": "💼",
    };
    return m[name] || "📌";
  }

  function toMathBoldText(input) {
    if (!input) return "";
    return String(input).replace(/[A-Za-z0-9]/g, function (ch) {
      var code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d400 + (code - 65));
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d41a + (code - 97));
      if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ce + (code - 48));
      return ch;
    });
  }

  function formatChannelDemoLabel(patternId, rawName, isVoice, laneIndex) {
    var n = rawName;
    var e = demoEmojiForName(n);
    var lower = n.toLowerCase();
    if (!patternId) {
      return e + " | " + n;
    }
    switch (patternId) {
      case "regular-text":
        return String(n)
          .toLowerCase()
          .replace(/\s+/g, "-");
      case "bar-divider":
        return toMathBoldText(e + " ┊ " + n);
      case "flourish":
        return toMathBoldText("✦" + n + "✦");
      case "bold-column":
        return e + " ┃ " + n;
      case "corner-brackets":
        return toMathBoldText("【" + e + "】" + lower);
      case "chevrons":
        return toMathBoldText("《" + e + "》" + lower);
      case "dot-separator":
        return toMathBoldText(e + "·" + lower.replace(/\s+/g, ""));
      case "em-dash":
        return toMathBoldText(e + " — " + lower);
      case "sparkle-dot":
        return toMathBoldText("✧・" + lower.replace(/\s+/g, ""));
      default:
        return toMathBoldText(isVoice ? n : e + " | " + n);
    }
  }

  function findDefaultDemoChannel() {
    var i;
    var j;
    for (i = 0; i < CHANNEL_TREE.length; i++) {
      if (CHANNEL_TREE[i].title !== "General") continue;
      for (j = 0; j < CHANNEL_TREE[i].channels.length; j++) {
        var ch = CHANNEL_TREE[i].channels[j];
        if (!ch.voice && !ch.locked) return ch;
      }
    }
    for (i = 0; i < CHANNEL_TREE.length; i++) {
      for (j = 0; j < CHANNEL_TREE[i].channels.length; j++) {
        var c = CHANNEL_TREE[i].channels[j];
        if (!c.voice && !c.locked) return c;
      }
    }
    return CHANNEL_TREE[0] && CHANNEL_TREE[0].channels[0] ? CHANNEL_TREE[0].channels[0] : { name: "general", voice: false, locked: false };
  }

  /** Each style: Information + General (text) + Voice Chat (voice), 3 channels each. */
  var PATTERN_PREVIEW_DATA = {
    "regular-text": {
      info: ["announcements", "giveaway", "pick-your-role"],
      general: ["the-yard", "off-topic", "game-chat"],
      voice: ["lounge", "music", "afk"],
    },
    "bar-divider": {
      info: ["📢 ┊ Announcements", "📋 ┊ Rule", "🔗 ┊ Links"],
      general: ["💬 ┊ General", "🎬 ┊ Clips", "🎨 ┊ Art"],
      voice: ["🎮 ┊ Lounge", "🎵 ┊ Music", "🛋 ┊ AFK"],
    },
    flourish: {
      info: ["✦𝐈𝐧𝐟𝐨✦", "✦𝐑𝐮𝐥𝐞✦", "✦𝐋𝐢𝐧𝐤𝐬✦"],
      general: ["✦𝐆𝐞𝐧𝐞𝐫𝐚𝐥✦", "✦𝐂𝐥𝐢𝐩𝐬✦", "✦𝐀𝐫𝐭✦"],
      voice: ["✦𝐋𝐨𝐛𝐛𝐲✦", "✦𝐌𝐮𝐬𝐢𝐜✦", "✦𝐀𝐅𝐊✦"],
    },
    "bold-column": {
      info: ["📢 ┃ News", "📋 ┃ Rule", "🔗 ┃ Links"],
      general: ["💬 ┃ General", "🎬 ┃ Clips", "🎨 ┃ Art"],
      voice: ["🎮 ┃ Lounge", "🎵 ┃ Music", "🛋 ┃ AFK"],
    },
    "corner-brackets": {
      info: ["【📢】announcements", "【📋】rule", "【🔗】links"],
      general: ["【💬】general", "【🎬】clips", "【🎨】art"],
      voice: ["【🎮】lounge", "【🎵】music", "【🛋】afk"],
    },
    chevrons: {
      info: ["《📢》announcements", "《📋》rule", "《🔗》links"],
      general: ["《💬》general", "《🎬》clips", "《🎨》art"],
      voice: ["《🎮》lounge", "《🎵》music", "《🛋》afk"],
    },
    "dot-separator": {
      info: ["📢·announcements", "📋·rule", "🔗·links"],
      general: ["💬·general", "🎬·clips", "🎨·art"],
      voice: ["🎮·lounge", "🎵·music", "🛋·afk"],
    },
    "em-dash": {
      info: ["📢 — alerts", "📋 — rule", "🔗 — links"],
      general: ["💬 — chat", "🎬 — clips", "🎨 — art"],
      voice: ["🎮 — lounge", "🎵 — music", "🛋 — afk"],
    },
    "sparkle-dot": {
      info: ["✧・announcements", "✧・rule", "✧・links"],
      general: ["✧・general", "✧・lounge", "✧・gaming"],
      voice: ["✧・lobby", "✧・music", "✧・afk"],
    },
  };

  function buildPatternSidebarHtml(patternId) {
    var data = PATTERN_PREVIEW_DATA[patternId];
    if (!data) return "";
    var regularTextMode = patternId === "regular-text";
    function categoryBlock(title, labels, voice) {
      var rows = "";
      for (var i = 0; i < labels.length; i++) {
        var t = labels[i];
        if (regularTextMode) {
          rows +=
            '<div class="disc-ch-row"><span class="disc-ch-text">' +
            escapeHtml(t) +
            "</span></div>";
          continue;
        }
        if (voice) {
          rows +=
            '<div class="disc-ch-row disc-ch-row-voice"><span class="disc-voice-icon" aria-hidden="true">🔊</span><span class="disc-ch-text">' +
            escapeHtml(t) +
            "</span></div>";
        } else {
          rows +=
            '<div class="disc-ch-row"><span class="disc-hash">#</span><span class="disc-ch-text">' +
            escapeHtml(t) +
            "</span></div>";
        }
      }
      return (
        '<div class="disc-category">' +
        '<div class="disc-category-head"><span class="disc-chevron" aria-hidden="true">▼</span><span class="disc-category-title">' +
        escapeHtml(title) +
        "</span></div>" +
        '<div class="disc-channel-list' +
        (regularTextMode ? " disc-channel-list--discord-regular" : " mono") +
        '" dir="ltr">' +
        rows +
        "</div></div>"
      );
    }
    return (
      categoryBlock("Information", data.info, false) +
      categoryBlock("General", data.general, false) +
      categoryBlock("Voice Chat", data.voice, true)
    );
  }

  function renderPatternStylePreviews() {
    patternSelectButtons.forEach(function (btn) {
      var id = btn.getAttribute("data-pattern");
      var mock = btn.querySelector(".sidebar-mock-pattern");
      if (!id || !mock) return;
      mock.innerHTML = buildPatternSidebarHtml(id);
    });
  }

  function slugToLabel(slug) {
    if (!slug) return "";
    return String(slug)
      .split("-")
      .filter(Boolean)
      .map(function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(" ");
  }

  function patternLabelFromButton(btn) {
    var id = btn.getAttribute("data-pattern") || "";
    var attr = btn.getAttribute("data-pattern-label");
    if (attr != null && String(attr).trim() !== "") return String(attr).trim();
    var el = btn.querySelector(".style-label");
    if (el && el.textContent && String(el.textContent).trim() !== "") return el.textContent.trim();
    return slugToLabel(id);
  }

  function summaryPatternDisplay() {
    if (state.channelPatternLabel && String(state.channelPatternLabel).trim() !== "")
      return String(state.channelPatternLabel).trim();
    if (state.channelPattern) return slugToLabel(state.channelPattern);
    return "";
  }

  var DEMO_PROFILES = [
    { name: "Taylor Swift", seed: "taylor-swift-demo" },
    { name: "Beyoncé", seed: "beyonce-demo" },
    { name: "Drake", seed: "drake-demo" },
    { name: "Rihanna", seed: "rihanna-demo" },
    { name: "The Weeknd", seed: "weeknd-demo" },
    { name: "Bad Bunny", seed: "badbunny-demo" },
    { name: "Ariana Grande", seed: "ariana-demo" },
    { name: "Zendaya", seed: "zendaya-demo" },
    { name: "Chris Hemsworth", seed: "chris-hems-demo" },
    { name: "Leonardo DiCaprio", seed: "leo-demo" },
    { name: "Jennifer Lopez", seed: "jlo-demo" },
    { name: "Dwayne Johnson", seed: "rock-demo" },
    { name: "Billie Eilish", seed: "billie-eilish-demo" },
    { name: "Dua Lipa", seed: "dua-lipa-demo" },
    { name: "Ed Sheeran", seed: "ed-sheeran-demo" },
    { name: "Bruno Mars", seed: "bruno-mars-demo" },
    { name: "Selena Gomez", seed: "selena-gomez-demo" },
    { name: "Miley Cyrus", seed: "miley-cyrus-demo" },
    { name: "Shakira", seed: "shakira-demo" },
    { name: "Lady Gaga", seed: "lady-gaga-demo" },
    { name: "Post Malone", seed: "post-malone-demo" },
    { name: "Travis Scott", seed: "travis-scott-demo" },
    { name: "SZA", seed: "sza-demo" },
    { name: "Doja Cat", seed: "doja-cat-demo" },
    { name: "Olivia Rodrigo", seed: "olivia-rodrigo-demo" },
    { name: "Kanye West", seed: "kanye-west-demo" },
    { name: "Kendrick Lamar", seed: "kendrick-lamar-demo" },
    { name: "Eminem", seed: "eminem-demo" },
    { name: "Travis Kelce", seed: "travis-kelce-demo" },
    { name: "LeBron James", seed: "lebron-james-demo" },
    { name: "Cristiano Ronaldo", seed: "cr7-demo" },
    { name: "Lionel Messi", seed: "messi-demo" },
    { name: "Serena Williams", seed: "serena-williams-demo" },
    { name: "Stephen Curry", seed: "stephen-curry-demo" },
    { name: "Tom Holland", seed: "tom-holland-demo" },
    { name: "Margot Robbie", seed: "margot-robbie-demo" },
    { name: "Scarlett Johansson", seed: "scarlett-johansson-demo" },
    { name: "Keanu Reeves", seed: "keanu-reeves-demo" },
    { name: "Ryan Reynolds", seed: "ryan-reynolds-demo" },
    { name: "Will Smith", seed: "will-smith-demo" },
    { name: "Emma Stone", seed: "emma-stone-demo" },
    { name: "Pedro Pascal", seed: "pedro-pascal-demo" },
    { name: "Timothée Chalamet", seed: "timothee-chalamet-demo" },
    { name: "Kim Kardashian", seed: "kim-kardashian-demo" },
    { name: "Kylie Jenner", seed: "kylie-jenner-demo" },
    { name: "MrBeast", seed: "mrbeast-demo" },
    { name: "Logan Paul", seed: "logan-paul-demo" },
    { name: "Neymar Jr", seed: "neymar-demo" },
    { name: "Virat Kohli", seed: "virat-kohli-demo" },
    { name: "Angelina Jolie", seed: "angelina-jolie-demo" },
    { name: "Robert Downey Jr", seed: "rdj-demo" },
    { name: "Megan Thee Stallion", seed: "meg-thee-stallion-demo" },
    { name: "Ice Spice", seed: "ice-spice-demo" },
    { name: "Sydney Sweeney", seed: "sydney-sweeney-demo" },
  ];

  /** Pairs shown as member list section titles (replaces former Idle / Do Not Disturb labels). */
  var DEMO_ROLE_SECTION_PAIRS = [
    ["Moderators", "VIP"],
    ["Hosts", "Creators"],
    ["Coaches", "Partners"],
    ["Staff", "Artists"],
    ["Analysts", "Producers"],
  ];

  function demoShuffle(arr) {
    var a = arr.slice();
    var i;
    for (i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  /** Discord client default avatars (colored circles + logo) — index 0..5 from CDN. */
  function demoDiscordDefaultAvatarIndex(seed) {
    var s = String(seed || "0");
    var h = 0;
    var i;
    for (i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 6;
  }

  function demoAvatarUrl(seed) {
    var idx = demoDiscordDefaultAvatarIndex(seed);
    return "https://cdn.discordapp.com/embed/avatars/" + idx + ".png";
  }

  function demoStatusHtml(status) {
    var titles = {
      online: "Online",
      idle: "Idle",
      dnd: "Do Not Disturb",
      offline: "Offline",
      invisible: "Invisible",
      streaming: "Streaming",
    };
    var t = titles[status] || titles.offline;
    return (
      '<span class="discord-demo-status discord-demo-status--' +
      status +
      '" title="' +
      escapeHtml(t) +
      '" aria-hidden="true"></span>'
    );
  }

  function buildDemoUserRoster() {
    var shuffled = demoShuffle(DEMO_PROFILES);
    var rest = shuffled.slice(0, 14);
    var cycle = [
      "online",
      "idle",
      "dnd",
      "streaming",
      "offline",
      "online",
      "idle",
      "dnd",
      "streaming",
      "offline",
      "online",
      "idle",
      "dnd",
      "streaming",
    ];
    var members = rest.map(function (p, i) {
      return {
        name: p.name,
        seed: p.seed + "-m" + i,
        status: cycle[i % cycle.length],
      };
    });
    return {
      self: { name: "You", seed: "you-self", status: "online" },
      members: members,
    };
  }

  function buildDemoUserbarHtml(roster) {
    return (
      '<div class="discord-demo-userbar" aria-hidden="true">' +
      '<div class="discord-demo-avatar-wrap">' +
      '<img class="discord-demo-user-av discord-demo-user-av--img" src="' +
      escapeHtml(demoAvatarUrl(roster.self.seed)) +
      '" alt="" width="32" height="32" loading="eager" decoding="async" />' +
      demoStatusHtml("online") +
      "</div>" +
      '<span class="discord-demo-user-meta">' +
      "You" +
      '<span class="discord-demo-user-sub">' +
      escapeHtml("Online") +
      "</span></span></div>"
    );
  }

  function buildDemoRailHtml() {
    return (
      '<div class="discord-demo-rail" aria-hidden="true">' +
      '<span class="discord-demo-rail-icon discord-demo-rail-icon--active" title="This server"></span>' +
      "</div>"
    );
  }

  function buildDemoMembersPanelHtml(roster) {
    var selfRow = {
      name: roster.self.name,
      seed: roster.self.seed,
      status: "online",
      isYou: true,
    };
    var all = [selfRow].concat(roster.members);
    var order = ["online", "streaming", "idle", "dnd", "offline"];
    var rolePair = DEMO_ROLE_SECTION_PAIRS[Math.floor(Math.random() * DEMO_ROLE_SECTION_PAIRS.length)];
    var labels = {
      online: "Online",
      streaming: "Streaming",
      idle: rolePair[0],
      dnd: rolePair[1],
      offline: "Offline",
    };
    var out = "";
    var oi;
    for (oi = 0; oi < order.length; oi++) {
      var key = order[oi];
      var users = [];
      var ui;
      for (ui = 0; ui < all.length; ui++) {
        if (key === "offline") {
          if (all[ui].status === "offline" || all[ui].status === "invisible") {
            users.push(all[ui]);
          }
        } else if (all[ui].status === key) {
          users.push(all[ui]);
        }
      }
      if (!users.length) continue;
      out +=
        '<div class="discord-demo-members-section">' +
        '<div class="discord-demo-members-head">' +
        escapeHtml(labels[key]) +
        " — " +
        users.length +
        "</div>";
      for (ui = 0; ui < users.length; ui++) {
        var u = users[ui];
        var rowCls = "discord-demo-member-row" + (key === "offline" ? " discord-demo-member-row--offline" : "");
        var badgeStatus = u.status;
        out +=
          '<div class="' +
          rowCls +
          '">' +
          '<div class="discord-demo-avatar-wrap discord-demo-avatar-wrap--sm">' +
          '<img class="discord-demo-user-av discord-demo-user-av--sm discord-demo-user-av--img" src="' +
          escapeHtml(demoAvatarUrl(u.seed)) +
          '" alt="" width="32" height="32" loading="eager" decoding="async" />' +
          demoStatusHtml(badgeStatus) +
          "</div>" +
          '<span class="discord-demo-member-name">' +
          (u.isYou
            ? '<span class="discord-demo-you-strong">You</span>'
            : escapeHtml(u.name)) +
          "</span></div>";
      }
      out += "</div>";
    }
    return '<div class="discord-demo-members-scroll">' + out + "</div>";
  }

  function buildDemoPatternSwitcherHtml(activePatternId) {
    var active = activePatternId || "regular-text";
    var i;
    var out =
      '<div class="demo-pattern-switcher" role="group" aria-label="Preview channel naming style">' +
      '<span class="demo-pattern-switcher-label">Naming style</span>' +
      '<div class="demo-pattern-switcher-chips">';
    for (i = 0; i < DEMO_PATTERN_OPTIONS.length; i++) {
      var o = DEMO_PATTERN_OPTIONS[i];
      var isOn = active === o.id;
      out +=
        '<button type="button" class="demo-pattern-chip' +
        (isOn ? " demo-pattern-chip--active" : "") +
        '" data-demo-pattern-btn="' +
        escapeHtml(o.id) +
        '" data-demo-pattern-label="' +
        escapeHtml(o.label) +
        '" aria-pressed="' +
        (isOn ? "true" : "false") +
        '">' +
        escapeHtml(o.label) +
        "</button>";
    }
    out += "</div></div>";
    return out;
  }

  function buildDiscordDemoHtml(patternId, displayLabel, packageTier) {
    var lab =
      displayLabel && String(displayLabel).trim()
        ? displayLabel.trim()
        : patternId
          ? slugToLabel(patternId)
          : "";
    var hasPattern = !!patternId;
    var lead = hasPattern
      ? '<p class="preview-disclaimer summary-preview-bundle-lead">This is a demo preview of what you are purchasing. Style selected: <strong>' +
        escapeHtml(lab) +
        "</strong>.</p>"
      : '<p class="preview-disclaimer summary-preview-bundle-lead">This is a demo preview of what you are purchasing.</p>';
    var patternBar = "";
    if (packageTier === "advanced") {
      patternBar = buildDemoPatternSwitcherHtml(patternId || "regular-text");
    }

    var defCh = findDefaultDemoChannel();
    var regularTextMode = patternId === "regular-text";
    var laneCounter = 0;
    var defLaneIndex = 0;
    var catHtml = "";
    var ci;
    for (ci = 0; ci < CHANNEL_TREE.length; ci++) {
      var cat = CHANNEL_TREE[ci];
      var rowsHtml = "";
      var j;
      for (j = 0; j < cat.channels.length; j++) {
        var ch = cat.channels[j];
        var isDef =
          defCh &&
          ch.name === defCh.name &&
          ch.voice === defCh.voice &&
          ch.locked === defCh.locked;
        if (isDef) defLaneIndex = laneCounter;
        var defCls = isDef ? " discord-demo-ch--default is-active" : "";
        var label = formatChannelDemoLabel(patternId, ch.name, ch.voice, laneCounter);
        laneCounter += 1;
        var vCls = ch.voice ? " discord-demo-ch--voice" : "";
        var lk = ch.locked ? "true" : "false";
        rowsHtml +=
          '<div class="discord-demo-ch' +
          defCls +
          vCls +
          '" data-name="' +
          escapeHtml(ch.name) +
          '" data-voice="' +
          (ch.voice ? "true" : "false") +
          '" data-locked="' +
          lk +
          '" tabindex="-1" role="listitem">' +
          (regularTextMode
            ? ""
            : ch.voice
              ? '<span class="discord-demo-ch-icon" aria-hidden="true">🔊</span>'
              : '<span class="discord-demo-ch-hash">#</span>') +
          '<span class="discord-demo-ch-label">' +
          escapeHtml(label) +
          "</span></div>";
      }
      catHtml +=
        '<div class="discord-demo-cat' +
        (cat.locked ? " discord-demo-cat--locked" : "") +
        '">' +
        '<div class="discord-demo-cat-head" role="button" tabindex="0" aria-expanded="true" aria-label="' +
        escapeHtml("Toggle " + cat.title + " category") +
        '"><span class="discord-demo-cat-chev" aria-hidden="true">▼</span><span class="discord-demo-cat-title">' +
        escapeHtml(cat.title) +
        "</span></div>" +
        '<div class="discord-demo-cat-channels" role="list">' +
        rowsHtml +
        "</div></div>";
    }

    var defLabel = formatChannelDemoLabel(patternId, defCh.name, defCh.voice, defLaneIndex);
    var defText = regularTextMode ? defLabel : defCh.voice ? defLabel : "# " + defLabel;
    var defHeader = defText;
    var defWelcome = "Welcome to " + defText + "!";
    var defSub = "This is the start of the " + defText + " channel.";
    var defMsg = "Message " + defText;

    var demoRoster = buildDemoUserRoster();

    return (
      '<div class="summary-preview-combined">' +
      '<h4 class="outcome-h outcome-h--preview-bundle">Demo</h4>' +
      patternBar +
      lead +
      '<div class="discord-demo" data-demo-pattern="' +
      escapeHtml(patternId || "") +
      '" role="region" aria-label="Discord-style layout preview">' +
      buildDemoRailHtml() +
      '<div class="discord-demo-sidebar">' +
      '<div class="discord-demo-sidebar-top">' +
      '<div class="discord-demo-server-name">Your server <span class="discord-demo-chev">▼</span></div>' +
      "</div>" +
      '<div class="discord-demo-channel-scroll" tabindex="0">' +
      '<div class="discord-demo-nav-static">' +
      '<div class="discord-demo-nav-row">Events</div>' +
      '<div class="discord-demo-nav-row">Server Boosts</div>' +
      "</div>" +
      catHtml +
      "</div>" +
      buildDemoUserbarHtml(demoRoster) +
      "</div>" +
      '<div class="discord-demo-main">' +
      '<div class="discord-demo-main-toolbar">' +
      '<span class="discord-demo-main-channel" data-demo-main-header>' +
      escapeHtml(defHeader) +
      "</span>" +
      "</div>" +
      '<div class="discord-demo-main-body">' +
      '<div class="discord-demo-welcome" data-demo-welcome>' +
      '<h2 class="discord-demo-welcome-title" data-demo-welcome-title>' +
      escapeHtml(defWelcome) +
      "</h2>" +
      '<p class="discord-demo-welcome-sub" data-demo-welcome-sub>' +
      escapeHtml(defSub) +
      "</p>" +
      "</div>" +
      '<div class="discord-demo-messages" data-demo-messages aria-live="polite"></div>' +
      "</div>" +
      '<div class="discord-demo-inputbar">' +
      '<input type="text" class="discord-demo-input" data-demo-msg-input maxlength="500" autocomplete="off" spellcheck="false" placeholder="' +
      escapeHtml(defMsg) +
      '" aria-label="Demo message box (press Enter to send)" />' +
      "</div>" +
      "</div>" +
      '<div class="discord-demo-members" aria-hidden="true">' +
      buildDemoMembersPanelHtml(demoRoster) +
      "</div></div></div>"
    );
  }

  function initDiscordDemoPreview(container) {
    if (!container) return;
    var demo = container.querySelector(".discord-demo");
    if (!demo) return;
    var patternId = demo.getAttribute("data-demo-pattern") || "";
    var scrollEl = demo.querySelector(".discord-demo-channel-scroll");
    var mainHeader = demo.querySelector("[data-demo-main-header]");
    var welcomeTitle = demo.querySelector("[data-demo-welcome-title]");
    var welcomeSub = demo.querySelector("[data-demo-welcome-sub]");
    var msgInput = demo.querySelector("[data-demo-msg-input]");
    var msgList = demo.querySelector("[data-demo-messages]");
    var welcomeWrap = demo.querySelector("[data-demo-welcome]");
    var defaultRow = demo.querySelector(".discord-demo-ch--default");
    if (!scrollEl || !mainHeader || !welcomeTitle || !welcomeSub) return;

    var laneMap = {};
    var idx = 0;
    var rows = demo.querySelectorAll(".discord-demo-ch");
    var r;
    for (r = 0; r < rows.length; r++) {
      laneMap[rows[r].getAttribute("data-name") || ""] = idx++;
    }

    function updateFromRow(row) {
      var name = row.getAttribute("data-name") || "";
      var voice = row.getAttribute("data-voice") === "true";
      var regularTextMode = patternId === "regular-text";
      var li = laneMap[name];
      if (typeof li !== "number") li = 0;
      var label = formatChannelDemoLabel(patternId, name, voice, li);
      var shownLabel = regularTextMode ? label : voice ? label : "# " + label;
      var headerText = shownLabel;
      var welcome = "Welcome to " + shownLabel + "!";
      var sub = "This is the start of the " + shownLabel + " channel.";
      var msg = "Message " + shownLabel;
      mainHeader.textContent = headerText;
      welcomeTitle.textContent = welcome;
      welcomeSub.textContent = sub;
      if (msgInput) msgInput.placeholder = msg;
      var k;
      for (k = 0; k < rows.length; k++) {
        rows[k].classList.remove("is-active");
      }
      row.classList.add("is-active");
    }

    function resetDefault() {
      if (defaultRow) updateFromRow(defaultRow);
    }

    for (r = 0; r < rows.length; r++) {
      rows[r].addEventListener("mouseenter", function () {
        updateFromRow(this);
      });
    }

    demo.querySelectorAll(".discord-demo-cat").forEach(function (catEl) {
      var head = catEl.querySelector(".discord-demo-cat-head");
      if (!head) return;
      function toggleCat() {
        var collapsed = catEl.classList.toggle("discord-demo-cat--collapsed");
        head.setAttribute("aria-expanded", collapsed ? "false" : "true");
      }
      head.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleCat();
      });
      head.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleCat();
        }
      });
    });

    scrollEl.addEventListener("mouseleave", function () {
      resetDefault();
    });

    var checkoutDemoReply =
      "We know you like this template. If you want us to process it, use the checkout button below.";

    function sendDemoMessage() {
      if (!msgInput || !msgList) return;
      var raw = msgInput.value.trim();
      if (!raw) return;
      msgInput.value = "";
      var userRow =
        '<div class="discord-demo-msg discord-demo-msg--user">' +
        '<span class="discord-demo-msg-bubble">' +
        escapeHtml(raw) +
        "</span>" +
        '<img class="discord-demo-msg-avatar discord-demo-msg-avatar--img" src="' +
        escapeHtml(demoAvatarUrl("you-self")) +
        '" alt="" width="24" height="24" loading="lazy" decoding="async" />' +
        "</div>";
      msgList.insertAdjacentHTML("beforeend", userRow);
      if (welcomeWrap) welcomeWrap.classList.add("discord-demo-welcome--faded");
      msgList.scrollTop = msgList.scrollHeight;
      var reply = checkoutDemoReply;
      setTimeout(function () {
        var botRow =
          '<div class="discord-demo-msg discord-demo-msg--bot">' +
          '<img class="discord-demo-msg-avatar discord-demo-msg-avatar--img" src="' +
          escapeHtml(demoAvatarUrl("serverly-bot-reply")) +
          '" alt="" width="24" height="24" loading="lazy" decoding="async" />' +
          '<span class="discord-demo-msg-bubble discord-demo-msg-bubble--bot">' +
          escapeHtml(reply) +
          "</span></div>";
        msgList.insertAdjacentHTML("beforeend", botRow);
        msgList.scrollTop = msgList.scrollHeight;
      }, 380);
    }

    if (msgInput) {
      msgInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          sendDemoMessage();
        }
      });
    }
  }

  function getCheckoutApiBase() {
    if (typeof window === "undefined" || !window.STRIPE_CHECKOUT_API) return "";
    var s = String(window.STRIPE_CHECKOUT_API).trim();
    if (!s) return "";
    return s.replace(/\/$/, "");
  }

  function flashCheckout(message, kind) {
    if (!checkoutFlash) return;
    checkoutFlash.hidden = false;
    checkoutFlash.textContent = message;
    checkoutFlash.className = "checkout-flash checkout-flash--" + (kind || "info");
    if (flashCheckoutTimer) clearTimeout(flashCheckoutTimer);
    if (kind === "success") return;
    flashCheckoutTimer = setTimeout(function () {
      checkoutFlash.hidden = true;
    }, kind === "error" ? 8000 : 5000);
  }

  function hasSummaryContent() {
    return !!(
      state.serverMode ||
      state.layoutType ||
      state.packageTier ||
      state.channelPattern
    );
  }

  function syncCheckoutPanel() {
    if (!checkoutPanel) return;
    var hasAny = hasSummaryContent();
    if (!hasAny) {
      checkoutPanel.hidden = true;
      checkoutPanel.classList.remove("checkout-panel--revealed");
      if (checkoutSubmit) checkoutSubmit.disabled = true;
      return;
    }
    var api = getCheckoutApiBase();
    if (checkoutApiNote) checkoutApiNote.hidden = !!api;
    if (checkoutTierWarning) checkoutTierWarning.hidden = !!state.packageTier;
    var tier = state.packageTier;
    if (checkoutTierLabel) {
      checkoutTierLabel.textContent =
        tier && PACKAGE_LABELS[tier]
          ? PACKAGE_LABELS[tier] + " package"
          : "Pick a tier in step 2";
    }
    if (checkoutAmount) {
      checkoutAmount.textContent =
        tier && PACKAGE_PRICE_HINTS[tier] ? PACKAGE_PRICE_HINTS[tier] + " USD" : "—";
    }
    if (checkoutSubmit) {
      checkoutSubmit.disabled = !tier || !api;
    }
    var show = !!state.checkoutReady;
    checkoutPanel.hidden = !show;
    checkoutPanel.classList.toggle("checkout-panel--revealed", show);
  }

  function renderSummary() {
    if (!summaryEl) return;
    var tier = state.packageTier || "simple";
    var hasAny = hasSummaryContent();

    if (!hasAny) {
      summaryEl.innerHTML =
        '<p class="summary-placeholder">Go through the steps above to generate your recap and preview.</p>';
      if (summaryCheckoutCta) summaryCheckoutCta.hidden = true;
      syncCheckoutPanel();
      return;
    }

    if (state.packageTier === "advanced" && !state.channelPattern) {
      state.channelPattern = "regular-text";
      state.channelPatternLabel = "Regular text";
    }

    var styleLabel = summaryPatternDisplay();

    var incomplete = !state.packageTier
      ? '<p class="summary-disclaimer">You haven’t chosen a package tier yet—go back to step 2 to pick <strong>Basic</strong> or <strong>Advanced</strong>.</p>'
      : "";

    var html =
      incomplete +
      buildDiscordDemoHtml(state.channelPattern, styleLabel, state.packageTier);

    summaryEl.innerHTML = html;
    if (summaryCheckoutCta) summaryCheckoutCta.hidden = false;
    syncCheckoutPanel();
    requestAnimationFrame(function () {
      initDiscordDemoPreview(summaryEl);
    });
  }

  function resetWizard() {
    state.serverMode = null;
    state.layoutType = null;
    state.packageTier = null;
    state.channelPattern = null;
    state.channelPatternLabel = null;
    state.checkoutReady = false;
    document.querySelectorAll(".price-card.is-picked").forEach(function (card) {
      card.classList.remove("is-picked");
    });
    syncPatternSelectionUI();
    setStep(0);
  }

  document.querySelectorAll("[data-wizard-next]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      nextStep();
    });
  });

  if (backBtn) backBtn.addEventListener("click", prevStep);

  if (homeBtn) {
    homeBtn.addEventListener("click", function () {
      resetWizard();
    });
  }

  document.querySelectorAll("[data-choice-key]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-choice-key");
      var val = btn.getAttribute("data-choice-value");
      if (key === "serverMode") {
        state.serverMode = val;
        nextStep();
        return;
      }
      if (key === "layoutType") {
        state.layoutType = val;
        nextStep();
        return;
      }
    });
  });

  patternSelectButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-pattern");
      if (state.packageTier === "simple" && id !== "regular-text") {
        state.packageTier = "advanced";
        syncPackagePickUI();
        setStep(4);
        return;
      }
      var lab = patternLabelFromButton(btn);
      if (state.channelPattern === id) {
        state.channelPattern = null;
        state.channelPatternLabel = null;
        syncPatternSelectionUI();
      } else {
        state.channelPattern = id;
        state.channelPatternLabel = lab;
        syncPatternSelectionUI();
        nextStep();
      }
    });
  });

  document.querySelectorAll("[data-package-tier]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      var t = btn.getAttribute("data-package-tier");
      if (!t || t === "professional") return;
      state.packageTier = t;
      if (t === "simple") {
        state.channelPattern = "regular-text";
        state.channelPatternLabel = "Regular text";
      }
      document.querySelectorAll("[data-package-tier]").forEach(function (b) {
        var card = b.closest(".price-card");
        if (card) card.classList.remove("is-picked");
      });
      var picked = btn.closest(".price-card");
      if (picked) picked.classList.add("is-picked");
      syncPatternTierGate();
      nextStep();
    });
  });

  if (checkoutSubmit) {
    checkoutSubmit.addEventListener("click", function () {
      var api = getCheckoutApiBase();
      if (!state.packageTier) {
        state.packageTier = "advanced";
      }
      if (!api) {
        flashCheckout("Checkout API is not configured yet. Add STRIPE_CHECKOUT_API and try again.", "error");
        return;
      }
      var email = checkoutEmailInp && checkoutEmailInp.value ? checkoutEmailInp.value.trim() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        flashCheckout("Enter a valid email so we can send your order copy.", "error");
        if (checkoutEmailInp) checkoutEmailInp.focus();
        return;
      }
      checkoutSubmit.disabled = true;
      flashCheckout("Redirecting to secure Stripe Checkout…", "info");
      fetch(api + "/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: state.packageTier,
          email: email,
          serverMode: normalizeServerMode(state.serverMode) || state.serverMode || "",
          layoutType: state.layoutType,
          channelPattern: state.channelPattern,
          channelPatternLabel: state.channelPatternLabel,
        }),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) throw new Error(data.error || r.statusText || "Request failed");
            return data;
          });
        })
        .then(function (data) {
          if (data.url) {
            try {
              sessionStorage.setItem(
                "discordStudioWizard",
                JSON.stringify({
                  checkoutEmail: email,
                  serverMode: normalizeServerMode(state.serverMode) || state.serverMode || "",
                  layoutType: state.layoutType,
                  packageTier: state.packageTier,
                  channelPattern: state.channelPattern,
                  channelPatternLabel: state.channelPatternLabel,
                })
              );
            } catch (e) {}
            window.location.href = data.url;
            return;
          }
          throw new Error("No checkout URL returned");
        })
        .catch(function (err) {
          flashCheckout(err.message || "Checkout failed. Check the API URL and try again.", "error");
          checkoutSubmit.disabled = false;
        });
    });
  }

  function openDrawer() {
    if (!drawer || !backdrop) return;
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "true");
  }

  function closeDrawer() {
    if (!drawer || !backdrop) return;
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    if (header) header.classList.remove("nav-open");
  }

  if (navToggle) {
    navToggle.addEventListener("click", function () {
      if (drawer && drawer.classList.contains("is-open")) closeDrawer();
      else openDrawer();
    });
  }

  if (backdrop) backdrop.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  document.querySelectorAll("[data-goto-step]").forEach(function (link) {
    link.addEventListener("click", function () {
      var stepFlow = parseInt(link.getAttribute("data-goto-step"), 10);
      if (isNaN(stepFlow)) return;
      var page = pageForFlowPos(stepFlow);
      if (typeof page === "number") setStep(page);
    });
  });

  var summaryOpenCheckoutBtn = document.getElementById("summary-open-checkout");
  if (summaryOpenCheckoutBtn) {
    summaryOpenCheckoutBtn.addEventListener("click", function () {
      if (!state.packageTier) {
        state.packageTier = "advanced";
        syncPackagePickUI();
        setStep(4);
        flashCheckout("Nice choice. Advanced ($20) is preselected so you can review and continue.", "info");
        return;
      }
      state.checkoutReady = true;
      setStep(6);
    });
  }

  if (summaryEl) {
    summaryEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-demo-pattern-btn]");
      if (!btn || !summaryEl.contains(btn)) return;
      if (state.packageTier !== "advanced") return;
      e.preventDefault();
      var id = btn.getAttribute("data-demo-pattern-btn");
      if (!id) return;
      var labAttr = btn.getAttribute("data-demo-pattern-label");
      state.channelPattern = id;
      state.channelPatternLabel =
        labAttr && String(labAttr).trim() !== "" ? String(labAttr).trim() : slugToLabel(id);
      syncPatternSelectionUI();
      renderSummary();
    });
  }

  renderPatternStylePreviews();
  setStep(0);

  (function handleCheckoutReturn() {
    var q = new URLSearchParams(window.location.search);
    var c = q.get("checkout");
    if (c === "success") {
      var sid = q.get("session_id");
      var dest = "thank-you.html" + (sid ? "?session_id=" + encodeURIComponent(sid) : "");
      window.location.replace(dest);
      return;
    }
    if (c === "cancel") {
      try {
        var raw = sessionStorage.getItem("discordStudioWizard");
        if (raw) {
          var saved = JSON.parse(raw);
          if (saved && typeof saved === "object") {
            state.serverMode = saved.serverMode
              ? normalizeServerMode(saved.serverMode) || saved.serverMode
              : null;
            state.layoutType = saved.layoutType || null;
            state.packageTier =
              saved.packageTier === "professional" ? null : saved.packageTier || null;
            state.channelPattern = saved.channelPattern || null;
            state.channelPatternLabel = saved.channelPatternLabel || null;
          }
        }
      } catch (e2) {}
      state.checkoutReady = true;
      setStep(6);
      flashCheckout("Checkout was canceled. You can pay from the summary whenever you’re ready.", "error");
      window.history.replaceState({}, "", window.location.pathname);
    }
  })();

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.06 }
    );
    document.querySelectorAll("#step-finish .steps, #step-finish .feature-chips").forEach(function (el) {
      el.classList.add("reveal");
      observer.observe(el);
    });
  }
})();
