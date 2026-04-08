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
    /** Lane index (string) → edited label text for Custom pattern demo sidebar */
    channelCustomByLane: {},
  };

  var patternPickLabelEl = document.getElementById("pattern-pick-label");
  var styleTierNoteEl = document.getElementById("style-tier-note");
  var patternSelectButtons = document.querySelectorAll(".pattern-select[data-pattern]");
  var patternCustomCard = document.getElementById("pattern-custom-card");
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
    update: "Update current server (in progress, not available)",
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
    simple: "$10",
    advanced: "$20",
    professional: "$50",
  };

  var TIER_TITLES = {
    simple: "Basic: gets the job done",
    advanced: "Advanced: Basic + presets & polish",
    professional: "Professional: hands-on care (coming soon)",
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
    { id: "custom", label: "Custom" },
  ];

  function serverModeNote(mode) {
    var m = normalizeServerMode(mode);
    if (m === "fresh")
      return "You’ll receive a full server layout for a new or reset server. Live server tune-ups are in progress and not bookable yet.";
    return "";
  }

  function tierLeadNote(tier) {
    if (tier === "advanced")
      return "Advanced adds presets, patterns, and deeper layout polish.";
    return "";
  }

  function includesForTier(tier, serverMode) {
    var base = {
      simple: [
        "Full functional Discord layout",
        "41+ channels",
        "Regular channel names",
        "Basic roles",
        "Basic text & voice setup",
      ],
      advanced: [
        "Everything in Basic",
        "55+ channels",
        "Custom channel names",
        "Growth-focused channel architecture",
        "Advanced role hierarchy and permissions map",
        "Layout fit for your niche",
        "Monetization-ready server flow ideas",
        "Extra channels",
      ],
      professional: [
        "Everything in Advanced",
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
    if (document.body.classList.contains("wizard-app")) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (n === 5) renderSummary();
    if (n === 3) {
      renderPatternStylePreviews();
      syncPatternSelectionUI();
      syncPatternTierGate();
    }
    if (n === 4) syncPackagePickUI();
    if (n === 5) {
      syncPackagePickUI();
      syncPatternSelectionUI();
      syncPatternTierGate();
      updateFinishStepLead();
    }
    if (n === 6) {
      state.checkoutReady = true;
      if (!state.packageTier) {
        state.packageTier = "advanced";
      }
      syncCheckoutPanel();
    }
    closeDrawer();
    syncHeroValueRotator(n);
  }

  /** Welcome hero: vertical slide + smooth viewport height (paused off welcome). */
  var HERO_VALUE_ROTATOR_LINES = [
    { k: "Monetize", v: "paid-access ready channels and roles." },
    { k: "Growth", v: "scalable structure without chaos." },
    { k: "Affordable", v: "pricing starts at $10." },
    { k: "Optimal", v: "layouts tuned for engagement." },
    { k: "Easy", v: "quick wizard with live demo." },
  ];
  var heroRotatorTimeoutId = null;
  var heroRotatorIndex = 0;
  var HERO_ROTATOR_DISPLAY_MS = 2800;

  function heroRotatorLineHtml(i) {
    var row = HERO_VALUE_ROTATOR_LINES[i];
    if (!row) return "";
    return (
      "<strong>" +
      escapeHtml(row.k) +
      ":</strong> " +
      escapeHtml(row.v)
    );
  }

  function clearHeroRotator() {
    if (heroRotatorTimeoutId != null) {
      clearTimeout(heroRotatorTimeoutId);
      heroRotatorTimeoutId = null;
    }
  }

  function syncHeroValueRotator(pageIndex) {
    var viewport = document.getElementById("hero-value-rotator-viewport");
    var track = document.getElementById("hero-value-rotator-track");
    var root = document.getElementById("hero-value-rotator");
    if (!viewport || !track || !root) return;

    if (pageIndex !== 0) {
      clearHeroRotator();
      track.innerHTML = "";
      track.className = "hero-value-rotator-track";
      track.style.transform = "";
      viewport.style.height = "";
      root.classList.remove("hero-value-rotator--ready", "hero-value-rotator--reduced-motion");
      return;
    }

    clearHeroRotator();
    root.classList.remove("hero-value-rotator--ready");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.add("hero-value-rotator--reduced-motion");
    } else {
      root.classList.remove("hero-value-rotator--reduced-motion");
    }
    track.className = "hero-value-rotator-track";
    track.innerHTML = "";
    track.style.transform = "";

    var n = HERO_VALUE_ROTATOR_LINES.length;
    var i;
    for (i = 0; i < n; i++) {
      var slide = document.createElement("p");
      slide.className = "hero-value-rotator-slide";
      slide.innerHTML = heroRotatorLineHtml(i);
      track.appendChild(slide);
    }

    var slides = track.querySelectorAll(".hero-value-rotator-slide");
    var heights = [];
    var positions = [];
    var cum = 0;
    for (i = 0; i < slides.length; i++) {
      positions.push(cum);
      heights.push(slides[i].offsetHeight);
      cum += slides[i].offsetHeight;
    }

    function scheduleAdvance() {
      clearHeroRotator();
      heroRotatorTimeoutId = setTimeout(advance, HERO_ROTATOR_DISPLAY_MS);
    }

    function advance() {
      if (state.step !== 0) return;
      var next = (heroRotatorIndex + 1) % n;
      viewport.style.height = Math.ceil(heights[next]) + "px";
      track.style.transform =
        "translate3d(0, -" + positions[next] + "px, 0)";
      heroRotatorIndex = next;
      scheduleAdvance();
    }

    heroRotatorIndex = 0;
    viewport.style.height = Math.ceil(heights[0]) + "px";
    track.style.transform = "translate3d(0, 0, 0)";

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        for (i = 0; i < slides.length; i++) {
          heights[i] = slides[i].offsetHeight;
        }
        cum = 0;
        for (i = 0; i < slides.length; i++) {
          positions[i] = cum;
          cum += heights[i];
        }
        viewport.style.height = Math.ceil(heights[0]) + "px";
        track.style.transform = "translate3d(0, 0, 0)";
        root.classList.add("hero-value-rotator--ready");
        scheduleAdvance();
      });
    });
  }

  function syncPatternSelectionUI() {
    patternSelectButtons.forEach(function (btn) {
      var id = btn.getAttribute("data-pattern");
      var on = state.channelPattern && id === state.channelPattern;
      btn.classList.toggle("is-selected", !!on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (patternCustomCard) {
      patternCustomCard.classList.toggle("is-selected", state.channelPattern === "custom");
    }
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

  /** Full server layout: categories and channels (single source for summary list + Discord demo). Total: 58 channels; order matches product spec. */
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

  function totalDemoChannelCount() {
    var n = 0;
    var i;
    for (i = 0; i < CHANNEL_TREE.length; i++) {
      n += CHANNEL_TREE[i].channels.length;
    }
    return n;
  }

  function demoEmojiForName(name) {
    var m = {
      Welcome: "👋",
      Rule: "📋",
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

  /** Mathematical Sans-Serif Bold Italic (e.g. ✦𝖜𝖊𝖑𝖈𝖔𝖒𝖊✦) for Flourish wrap */
  function toMathSansSerifBoldItalic(input) {
    if (!input) return "";
    return String(input).replace(/[A-Za-z0-9]/g, function (ch) {
      var code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d56c + (code - 65));
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d586 + (code - 97));
      if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ec + (code - 48));
      return ch;
    });
  }

  function flourishWrapLabel(inner) {
    return "✦" + toMathSansSerifBoldItalic(inner) + "✦";
  }

  /** Mathematical Monospace (e.g. 👋┊𝚆𝚎𝚕𝚌𝚘𝚖𝚎) for Bar divider */
  function toMathMonospace(input) {
    if (!input) return "";
    return String(input).replace(/[A-Za-z0-9]/g, function (ch) {
      var code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d670 + (code - 65));
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d68a + (code - 97));
      if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7f6 + (code - 48));
      return ch;
    });
  }

  function barDividerLabel(rawName) {
    return demoEmojiForName(rawName) + "┊" + toMathMonospace(rawName);
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
        return barDividerLabel(n);
      case "flourish":
        return flourishWrapLabel(n);
      case "bold-column":
        return e + " ┃ " + n;
      case "corner-brackets":
        return toMathBoldText("【" + e + "】" + lower);
      case "chevrons":
        return toMathBoldText("《" + e + "》" + lower);
      case "dot-separator":
        return toMathBoldText(e + "·" + lower.replace(/\s+/g, ""));
      case "em-dash":
        return toMathBoldText(e + " - " + lower);
      case "sparkle-dot":
        return toMathBoldText("✧・" + lower.replace(/\s+/g, ""));
      case "custom":
        return String(n)
          .toLowerCase()
          .replace(/\s+/g, "-");
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

  /** Labels for style-step mini previews: New !, Information, General, Voice Chat (matches CHANNEL_TREE). */
  function makePatternPreviewBlock(patternId) {
    function lab(name, voice) {
      return formatChannelDemoLabel(patternId, name, voice, 0);
    }
    return {
      newSection: [lab("Welcome", false), lab("Rule", false), lab("Roles", false)],
      information: [lab("Announcements", false), lab("Giveaway", false), lab("Pick-Your-Role", false)],
      generalText: [lab("General", false), lab("Off-Topic", false), lab("Game-Chat", false)],
      voice: [lab("Lounge", true), lab("Music", true), lab("AFK", true)],
    };
  }

  var PATTERN_PREVIEW_DATA = {
    "regular-text": makePatternPreviewBlock("regular-text"),
    "bar-divider": makePatternPreviewBlock("bar-divider"),
    flourish: makePatternPreviewBlock("flourish"),
    "bold-column": makePatternPreviewBlock("bold-column"),
    "corner-brackets": makePatternPreviewBlock("corner-brackets"),
    chevrons: makePatternPreviewBlock("chevrons"),
    "dot-separator": makePatternPreviewBlock("dot-separator"),
    "em-dash": makePatternPreviewBlock("em-dash"),
    "sparkle-dot": makePatternPreviewBlock("sparkle-dot"),
    custom: makePatternPreviewBlock("custom"),
  };

  /** Global lane index (same order as summary Discord demo) for a channel by category title + name. */
  function globalLaneIndexForChannel(categoryTitle, channelName, expectVoice) {
    var lane = 0;
    var ci, cj, cat, ch;
    for (ci = 0; ci < CHANNEL_TREE.length; ci++) {
      cat = CHANNEL_TREE[ci];
      if (cat.title !== categoryTitle) {
        lane += cat.channels.length;
        continue;
      }
      for (cj = 0; cj < cat.channels.length; cj++) {
        ch = cat.channels[cj];
        if (ch.name === channelName && !!ch.voice === !!expectVoice) return lane;
        lane += 1;
      }
    }
    return null;
  }

  /** Custom card mini-preview: categories + channels (Discord-like), inputs keyed by demo lane. */
  function buildCustomPatternSidebarEditableHtml() {
    var d = PATTERN_PREVIEW_DATA.custom;
    var groups = [
      {
        title: "New !",
        voice: false,
        items: [
          { name: "Welcome", def: d.newSection[0] },
          { name: "Rule", def: d.newSection[1] },
          { name: "Roles", def: d.newSection[2] },
        ],
      },
      {
        title: "Information",
        voice: false,
        items: [
          { name: "Announcements", def: d.information[0] },
          { name: "Giveaway", def: d.information[1] },
          { name: "Pick-Your-Role", def: d.information[2] },
        ],
      },
      {
        title: "General",
        voice: false,
        items: [
          { name: "General", def: d.generalText[0] },
          { name: "Off-Topic", def: d.generalText[1] },
          { name: "Game-Chat", def: d.generalText[2] },
        ],
      },
      {
        title: "Voice Chat",
        voice: true,
        items: [
          { name: "Lounge", def: d.voice[0] },
          { name: "Music", def: d.voice[1] },
          { name: "AFK", def: d.voice[2] },
        ],
      },
    ];
    var gi, gr, ii, it, rows;
    rows =
      '<div class="disc-channel-list disc-channel-list--discord-regular pattern-mock-channel-list pattern-mock-channel-list--rows" dir="ltr">';
    for (gi = 0; gi < groups.length; gi++) {
      gr = groups[gi];
      rows += '<div class="disc-category">';
      rows +=
        '<div class="disc-category-head pattern-mock-category-head" role="presentation">' +
        '<span class="disc-chevron" aria-hidden="true">▼</span>' +
        '<span class="disc-category-title">' +
        escapeHtml(gr.title) +
        "</span>" +
        '<span class="disc-category-add" aria-hidden="true">+</span>' +
        "</div>";
      rows += '<div class="disc-channel-list">';
      for (ii = 0; ii < gr.items.length; ii++) {
        it = gr.items[ii];
        rows += gr.voice
          ? '<div class="disc-ch-row disc-ch-row-voice pattern-mock-pill"><span class="disc-voice-icon" aria-hidden="true">🔊</span><span class="disc-ch-text">' +
            escapeHtml(it.def) +
            "</span></div>"
          : '<div class="disc-ch-row pattern-mock-pill"><span class="disc-hash">#</span><span class="disc-ch-text">' +
            escapeHtml(it.def) +
            "</span></div>";
      }
      rows += "</div></div>";
    }
    rows += "</div>";
    return rows;
  }

  /** Style-step sidebar mock: Discord-like categories (New !, Information, General, Voice Chat). */
  function buildPatternSidebarHtml(patternId) {
    var data = PATTERN_PREVIEW_DATA[patternId];
    if (!data) return "";
    var regularTextMode = patternId === "regular-text" || patternId === "custom";
    var listCls =
      "disc-channel-list pattern-mock-channel-list pattern-mock-channel-list--rows" +
      (regularTextMode
        ? " disc-channel-list--discord-regular"
        : patternId === "flourish"
          ? " pattern-mock-channel-list--flourish"
          : patternId === "bar-divider"
            ? " pattern-mock-channel-list--bar-divider"
            : " mono");
    function channelRows(items, isVoice) {
      var h = '<div class="disc-channel-list">';
      var i, t;
      for (i = 0; i < items.length; i++) {
        t = items[i];
        if (isVoice) {
          h +=
            '<div class="disc-ch-row disc-ch-row-voice pattern-mock-pill"><span class="disc-voice-icon" aria-hidden="true">🔊</span><span class="disc-ch-text">' +
            escapeHtml(t) +
            "</span></div>";
        } else {
          h +=
            '<div class="disc-ch-row pattern-mock-pill"><span class="disc-hash">#</span><span class="disc-ch-text">' +
            escapeHtml(t) +
            "</span></div>";
        }
      }
      h += "</div>";
      return h;
    }
    function categoryBlock(title, items, isVoice) {
      return (
        '<div class="disc-category">' +
        '<div class="disc-category-head pattern-mock-category-head" role="presentation">' +
        '<span class="disc-chevron" aria-hidden="true">▼</span>' +
        '<span class="disc-category-title">' +
        escapeHtml(title) +
        "</span>" +
        '<span class="disc-category-add" aria-hidden="true">+</span>' +
        "</div>" +
        channelRows(items, isVoice) +
        "</div>"
      );
    }
    return (
      '<div class="' +
      listCls +
      '" dir="ltr">' +
      categoryBlock("New !", data.newSection, false) +
      categoryBlock("Information", data.information, false) +
      categoryBlock("General", data.generalText, false) +
      categoryBlock("Voice Chat", data.voice, true) +
      "</div>"
    );
  }

  function renderPatternStylePreviews() {
    patternSelectButtons.forEach(function (btn) {
      var id = btn.getAttribute("data-pattern");
      var mock = btn.querySelector(".sidebar-mock-pattern");
      if (!id || !mock) return;
      mock.innerHTML = buildPatternSidebarHtml(id);
    });
    var customMock = document.querySelector("#pattern-custom-card .pattern-custom-soon-mock");
    if (customMock) customMock.innerHTML = buildCustomPatternSidebarEditableHtml();
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

  function patternBaseLabelFromId(id) {
    var i, o;
    for (i = 0; i < DEMO_PATTERN_OPTIONS.length; i++) {
      o = DEMO_PATTERN_OPTIONS[i];
      if (o.id === id) return o.label;
    }
    return id ? slugToLabel(id) : "Regular text";
  }

  function defaultLaneDisplay(patternId, channelName, isVoice, lane) {
    return formatChannelDemoLabel(patternId, channelName, isVoice, lane);
  }

  function summaryChannelTreeForTier(packageTier) {
    if (packageTier === "simple") {
      return CHANNEL_TREE.filter(function (cat) {
        return cat.title !== "Extra Channels";
      });
    }
    return CHANNEL_TREE;
  }

  function previewHasDeviations(patternId) {
    if (!patternId) return false;
    var lane = 0;
    var ci, cj, cat, ch, def, stored, st;
    for (ci = 0; ci < CHANNEL_TREE.length; ci++) {
      cat = CHANNEL_TREE[ci];
      for (cj = 0; cj < cat.channels.length; cj++) {
        ch = cat.channels[cj];
        def = defaultLaneDisplay(patternId, ch.name, ch.voice, lane);
        stored = state.channelCustomByLane[String(lane)];
        st = stored != null ? String(stored).trim() : "";
        if (st !== "" && st !== def) return true;
        lane += 1;
      }
    }
    return false;
  }

  function syncNamingLabelFromPreview() {
    var id = state.channelPattern || "regular-text";
    var prev = String(state.channelPatternLabel || "");
    if (id === "custom" && /^Custom (?:\u2014|-) /.test(prev)) {
      if (!previewHasDeviations(id)) return;
      state.channelPatternLabel = prev + " · preview customized";
      return;
    }
    var base = patternBaseLabelFromId(id);
    state.channelPatternLabel = previewHasDeviations(id) ? base + " · preview customized" : base;
  }

  function buildChannelPreviewBlob(patternId, packageTier) {
    var pid = patternId || "regular-text";
    var tree = summaryChannelTreeForTier(packageTier || state.packageTier);
    var lane = 0;
    var lines = [];
    var ci, cj, cat, ch, def, stored, shown;
    for (ci = 0; ci < tree.length; ci++) {
      cat = tree[ci];
      for (cj = 0; cj < cat.channels.length; cj++) {
        ch = cat.channels[cj];
        def = defaultLaneDisplay(pid, ch.name, ch.voice, lane);
        stored = state.channelCustomByLane[String(lane)];
        shown = stored != null && String(stored).trim() !== "" ? String(stored).trim() : def;
        lines.push(ch.name + "\t" + shown);
        lane += 1;
      }
    }
    return lines.join("\n");
  }

  function chunkPreviewForMetadata(blob, maxChunk) {
    maxChunk = maxChunk || 480;
    if (!blob) return [];
    var out = [];
    var i = 0;
    while (i < blob.length) {
      var end = Math.min(i + maxChunk, blob.length);
      if (end < blob.length) {
        var nl = blob.lastIndexOf("\n", end - 1);
        if (nl >= i + Math.floor(maxChunk * 0.5)) end = nl + 1;
      }
      out.push(blob.slice(i, end));
      i = end;
    }
    return out.slice(0, 12);
  }

  function updateSummaryDemoNamingUi(container) {
    if (!container) return;
    syncNamingLabelFromPreview();
    var strong = container.querySelector("[data-summary-selected-style]");
    if (strong) strong.textContent = summaryPatternDisplay();
    container.querySelectorAll("[data-demo-pattern-btn]").forEach(function (chip) {
      var cid = chip.getAttribute("data-demo-pattern-btn");
      var on = cid === (state.channelPattern || "regular-text");
      chip.classList.toggle("demo-pattern-chip--active", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    });
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

  /** Discord client default avatars (colored circles + logo); index 0..5 from CDN. */
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
      '<span class="discord-demo-rail-dm" title="Direct Messages"></span>' +
      '<span class="discord-demo-rail-item discord-demo-rail-item--active">' +
      '<span class="discord-demo-rail-pill" aria-hidden="true"></span>' +
      '<span class="discord-demo-rail-icon discord-demo-rail-icon--active" title="This server"></span>' +
      "</span>" +
      '<span class="discord-demo-rail-item">' +
      '<span class="discord-demo-rail-icon discord-demo-rail-icon--alt" title="Server"></span>' +
      '<span class="discord-demo-rail-badge">10</span>' +
      "</span>" +
      '<span class="discord-demo-rail-item">' +
      '<span class="discord-demo-rail-icon" title="Server"></span>' +
      '<span class="discord-demo-rail-badge">31</span>' +
      "</span>" +
      '<span class="discord-demo-rail-item">' +
      '<span class="discord-demo-rail-icon discord-demo-rail-icon--alt2" title="Server"></span>' +
      '<span class="discord-demo-rail-badge">1</span>' +
      "</span>" +
      "</div>"
    );
  }

  /** Decorative mobile-only tab bar (CSS shows only under max-width breakpoint). */
  function buildDemoMobileTabbarHtml() {
    var homeSvg =
      '<svg class="discord-demo-tabbar-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"/></svg>';
    var bellSvg =
      '<svg class="discord-demo-tabbar-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';
    var youSvg =
      '<svg class="discord-demo-tabbar-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    return (
      '<nav class="discord-demo-tabbar" aria-hidden="true">' +
      '<button type="button" class="discord-demo-tabbar-item" tabindex="-1">' +
      '<span class="discord-demo-tabbar-icon-wrap">' +
      homeSvg +
      '<span class="discord-demo-tabbar-badge">460</span></span>' +
      '<span class="discord-demo-tabbar-label">Home</span>' +
      "</button>" +
      '<button type="button" class="discord-demo-tabbar-item" tabindex="-1">' +
      '<span class="discord-demo-tabbar-icon-wrap">' +
      bellSvg +
      '<span class="discord-demo-tabbar-badge discord-demo-tabbar-badge--sm">4</span></span>' +
      '<span class="discord-demo-tabbar-label">Notifications</span>' +
      "</button>" +
      '<button type="button" class="discord-demo-tabbar-item" tabindex="-1">' +
      '<span class="discord-demo-tabbar-icon-wrap discord-demo-tabbar-icon-wrap--you">' +
      youSvg +
      "</span>" +
      '<span class="discord-demo-tabbar-label">You</span>' +
      "</button>" +
      "</nav>"
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
        ", " +
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

  function buildDemoPatternSwitcherHtml(activePatternId, basicTierLocked) {
    var active = basicTierLocked ? "regular-text" : activePatternId || "regular-text";
    var i;
    var groupLabel = basicTierLocked
      ? "Preview channel naming style (Basic includes Regular text only; other presets unlock with Advanced)"
      : "Preview channel naming style";
    var out =
      '<div class="demo-pattern-switcher' +
      (basicTierLocked ? " demo-pattern-switcher--basic" : "") +
      '" role="group" aria-label="' +
      escapeHtml(groupLabel) +
      '">' +
      '<span class="demo-pattern-switcher-label">Naming style</span>' +
      '<div class="demo-pattern-switcher-chips">';
    for (i = 0; i < DEMO_PATTERN_OPTIONS.length; i++) {
      var o = DEMO_PATTERN_OPTIONS[i];
      var isOn = active === o.id;
      var isLocked = !!basicTierLocked && o.id !== "regular-text";
      out +=
        '<button type="button" class="demo-pattern-chip' +
        (isOn ? " demo-pattern-chip--active" : "") +
        (isLocked ? " demo-pattern-chip--locked" : "") +
        '" data-demo-pattern-btn="' +
        escapeHtml(o.id) +
        '" data-demo-pattern-label="' +
        escapeHtml(o.label) +
        '" aria-pressed="' +
        (isOn ? "true" : "false") +
        '"' +
        (isLocked
          ? ' aria-disabled="true" title="Try other naming styles with Advanced ($20)."'
          : "") +
        ">" +
        escapeHtml(o.label) +
        "</button>";
    }
    out += "</div>";
    if (basicTierLocked) {
      out +=
        '<p class="demo-pattern-switcher-upsell">Try other preset naming styles with <strong>Advanced</strong> ($20).</p>';
    }
    out += "</div>";
    return out;
  }

  function buildDiscordDemoHtml(patternId, displayLabel, packageTier) {
    var tree = summaryChannelTreeForTier(packageTier);
    var lab =
      displayLabel && String(displayLabel).trim()
        ? displayLabel.trim()
        : patternId
          ? slugToLabel(patternId)
          : "";
    var hasPattern = !!patternId;
    var lead = hasPattern
      ? '<p class="preview-disclaimer summary-preview-bundle-lead">This is a demo preview of what you are purchasing. Naming style: <strong data-summary-selected-style>' +
        escapeHtml(lab) +
        "</strong>.</p>"
      : '<p class="preview-disclaimer summary-preview-bundle-lead">This is a demo preview of what you are purchasing.</p>';
    if (hasPattern) {
      lead +=
        '<p class="summary-custom-demo-hint summary-demo-edit-hint">Channel names are shown as part of your selected style preview.</p>';
      if (packageTier === "simple") {
        lead +=
          '<p class="summary-custom-demo-hint">Basic preview includes core channels only (41+). The Extra Channels category is Advanced.</p>';
      }
    }
    var patternBar = "";
    if (packageTier === "advanced" || packageTier === "simple") {
      patternBar = buildDemoPatternSwitcherHtml(patternId || "regular-text", packageTier === "simple");
    }

    var defCh = findDefaultDemoChannel();
    var laneCounter = 0;
    var defLaneIndex = 0;
    var catHtml = "";
    var ci;
    for (ci = 0; ci < tree.length; ci++) {
      var cat = tree[ci];
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
        var label = defaultLaneDisplay(patternId, ch.name, ch.voice, laneCounter);
        var labelInner = escapeHtml(label);
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
          (ch.voice
            ? '<span class="discord-demo-ch-icon" aria-hidden="true">🔊</span>'
            : '<span class="discord-demo-ch-hash">#</span>') +
          '<span class="discord-demo-ch-label">' +
          labelInner +
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

    var defLabel = defaultLaneDisplay(patternId, defCh.name, defCh.voice, defLaneIndex);
    var defText = defCh.voice ? defLabel : "# " + defLabel;
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
      "</div>" +
      buildDemoMobileTabbarHtml() +
      "</div></div>"
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
      var li = laneMap[name];
      if (typeof li !== "number") li = 0;
      var rawLabel = row.querySelector(".discord-demo-ch-label");
      var label = rawLabel ? rawLabel.textContent || "" : formatChannelDemoLabel(patternId, name, voice, li);
      var shownLabel = voice ? label : "# " + label;
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

  function updateFinishStepLead() {
    var el = document.getElementById("finish-step-lead");
    if (!el) return;
    if (!hasSummaryContent()) {
      el.textContent =
        "Finish the steps above to see your channel count, layout, and a Discord-style preview.";
      return;
    }
    var nCh = totalDemoChannelCount();
    var layoutName =
      state.layoutType && LAYOUT_TYPE_LABELS[state.layoutType]
        ? LAYOUT_TYPE_LABELS[state.layoutType]
        : null;
    var layoutPhrase = layoutName
      ? "the <strong>" + escapeHtml(layoutName) + "</strong> layout"
      : "the <strong>layout you chose</strong> in this wizard";
    el.innerHTML =
      "You’re getting <strong>" +
      nCh +
      " channels</strong> with " +
      layoutPhrase +
      ". <strong>View the demo below</strong> to see what you’re getting. It’s a preview, not your live server. Use <strong>Edit</strong> on any step to change something, then <strong>Continue to checkout</strong>.";
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
        tier && PACKAGE_PRICE_HINTS[tier] ? PACKAGE_PRICE_HINTS[tier] + " USD" : "-";
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
    if (state.packageTier === "simple" && state.channelPattern !== "regular-text") {
      state.channelPattern = "regular-text";
      state.channelPatternLabel = "Regular text";
    }

    syncNamingLabelFromPreview();
    var styleLabel = summaryPatternDisplay();

    var incomplete = !state.packageTier
      ? '<p class="summary-disclaimer">You haven’t chosen a package tier yet. Go back to step 2 to pick <strong>Basic</strong> or <strong>Advanced</strong>.</p>'
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
    state.channelCustomByLane = {};
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
      if (
        btn.disabled ||
        btn.classList.contains("choice-card--disabled") ||
        btn.getAttribute("aria-disabled") === "true"
      )
        return;
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
        state.channelCustomByLane = {};
        syncPatternSelectionUI();
      } else {
        if (state.channelPattern !== id) state.channelCustomByLane = {};
        state.channelPattern = id;
        state.channelPatternLabel = lab;
        syncPatternSelectionUI();
        nextStep();
      }
    });
  });

  if (patternCustomCard) {
    patternCustomCard.addEventListener("click", function (e) {
      state.channelPattern = "custom";
      if (!/^Custom (?:\u2014|-) /.test(String(state.channelPatternLabel || ""))) {
        state.channelPatternLabel = "Custom";
      }
      syncPatternSelectionUI();
    });
  }

  document.querySelectorAll("[data-package-tier]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      var t = btn.getAttribute("data-package-tier");
      if (!t || t === "professional") return;
      state.packageTier = t;
      if (t === "simple") {
        state.channelPattern = "regular-text";
        state.channelPatternLabel = "Regular text";
        state.channelCustomByLane = {};
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
      syncNamingLabelFromPreview();
      var previewChunks = chunkPreviewForMetadata(buildChannelPreviewBlob(state.channelPattern, state.packageTier));
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
          channelPreviewChunks: previewChunks,
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
                  channelPreviewChunks: previewChunks,
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
      var id = btn.getAttribute("data-demo-pattern-btn");
      var labAttr = btn.getAttribute("data-demo-pattern-label");
      if (state.packageTier === "simple") {
        e.preventDefault();
        if (!id || id === "regular-text") return;
        flashCheckout(
          "Only Regular text is included in Basic. Pick Advanced in step 2 to unlock other naming styles.",
          "info"
        );
        return;
      }
      if (state.packageTier !== "advanced") return;
      e.preventDefault();
      if (!id) return;
      if (state.channelPattern !== id) state.channelCustomByLane = {};
      if (id === "custom") {
        var prevAdv = String(state.channelPatternLabel || "");
        var chipAdv =
          labAttr && String(labAttr).trim() !== "" ? String(labAttr).trim() : slugToLabel(id);
        state.channelPattern = "custom";
        state.channelPatternLabel = /^Custom (?:\u2014|-) /.test(prevAdv) ? prevAdv : chipAdv;
      } else {
        state.channelPattern = id;
        state.channelPatternLabel =
          labAttr && String(labAttr).trim() !== "" ? String(labAttr).trim() : slugToLabel(id);
      }
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
