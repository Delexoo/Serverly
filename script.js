(function () {
  var pages = document.querySelectorAll(".wizard-page");
  var FLOW_PAGE_ORDER = [0, 1, 2, 3];
  /** Progress labels: 0 welcome, 1 server, 2 layout, 3 choose channel name style, 4 checkout (after a style chip). */
  var totalSteps = 5;
  var backBtn = document.getElementById("wizard-back");
  var progressLabel = document.getElementById("progress-label");
  var progressFill = document.getElementById("progress-fill");
  var homeBtn = document.getElementById("wizard-home");
  var summaryEl = document.getElementById("wizard-summary");
  var checkoutStickyBar = document.getElementById("checkout-sticky-bar");
  var stickyBarShowTimer = null;
  var STICKY_BAR_REVEAL_MS = 480;

  /** Voice channel icon (SVG) — reliable across platforms vs. speaker emoji */
  var DEMO_VOICE_CHANNEL_SVG =
    '<svg class="demo-voice-channel-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';

  var state = {
    step: 0,
    serverMode: null,
    layoutType: null,
    packageTier: null,
    channelPattern: null,
    channelPatternLabel: null,
    /** Lane index (string) → edited label text for Custom pattern demo sidebar */
    channelCustomByLane: {},
    /** True after user picks a naming style chip on the finish step (unlocks email/Stripe bar). */
    namingPatternUserChosen: false,
  };

  var patternPickLabelEl = document.getElementById("pattern-pick-label");
  var styleTierNoteEl = document.getElementById("style-tier-note");
  var patternSelectButtons = document.querySelectorAll(".pattern-select[data-pattern]");
  /** Single product: full layout at $20 (Stripe/metadata tier key remains "advanced"). */
  var PRODUCT_TIER_KEY = "advanced";
  var checkoutFlash = document.getElementById("checkout-flash");
  var flashCheckoutTimer = null;

  var SERVER_MODE_LABELS = {
    update: "Fix my current server (coming soon, not available)",
    fresh: "New server template (new or reset server)",
  };

  var LAYOUT_TYPE_LABELS = {
    content_creator: "Content creator",
    business: "Businesses",
    education: "Education",
    startup: "Startup workspace",
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
    { id: "regular-text", label: "Regular Text" },
    { id: "bar-divider", label: "Bar Divider" },
    { id: "sparkle-dot", label: "White Brackets" },
    { id: "bold-column", label: "Column" },
    { id: "chevrons", label: "Chevrons" },
    { id: "corner-brackets", label: "Corner Brackets" },
    { id: "dot-separator", label: "Dot Separator" },
    { id: "flourish", label: "Flourish Wrap" },
    { id: "em-dash", label: "Fullwidth" },
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

  function syncPackagePickUI() {}

  function flowPosForPage(pageIdx) {
    var i = FLOW_PAGE_ORDER.indexOf(pageIdx);
    return i >= 0 ? i : 0;
  }

  function pageForFlowPos(pos) {
    if (pos < 0 || pos >= FLOW_PAGE_ORDER.length) return null;
    return FLOW_PAGE_ORDER[pos];
  }

  /** Finish screen splits into step 3 (choose channel name style) and step 4 (after a style chip → checkout). */
  function effectiveProgressFlowPos() {
    var base = flowPosForPage(state.step);
    if (state.step === 3) {
      if (state.namingPatternUserChosen) return 4;
      return 3;
    }
    return base;
  }

  function syncFinishStepHeadline() {
    var h = document.querySelector("#step-finish .wizard-question");
    if (!h || state.step !== 3) return;
    if (!hasSummaryContent()) {
      h.textContent = "Choose a channel style.";
      return;
    }
    if (isCheckoutStickyBarUnlocked()) {
      h.textContent = "Checkout.";
      return;
    }
    h.textContent = "Choose a channel style.";
  }

  function syncWizardProgress() {
    var fp = effectiveProgressFlowPos();
    if (progressLabel) progressLabel.textContent = "Step " + fp + " of " + totalSteps;
    if (progressFill) {
      var fillDenom = totalSteps - 1;
      progressFill.style.width =
        fillDenom <= 0 ? "100%" : (fp / fillDenom) * 100 + "%";
    }
    var finishHint = document.querySelector("#step-finish .wizard-step-hint-mono");
    if (finishHint && state.step === 3) {
      finishHint.textContent = "Step " + fp + " of " + totalSteps;
    }
    syncFinishStepHeadline();
  }

  function syncPatternTierGate() {
    patternSelectButtons.forEach(function (btn) {
      btn.classList.remove("pattern-select--locked");
      btn.setAttribute("aria-disabled", "false");
    });
  }

  function setStep(n) {
    if (n < 0 || n >= pages.length) return;
    state.step = n;
    pages.forEach(function (page, i) {
      page.classList.toggle("is-active", i === n);
    });
    /* Show Back from wizard page 1 onward (after landing); landing is page 0. */
    if (backBtn) {
      if (state.step < 1) {
        backBtn.hidden = true;
        backBtn.setAttribute("hidden", "");
      } else {
        backBtn.hidden = false;
        backBtn.removeAttribute("hidden");
      }
    }
    syncWizardProgress();
    if (document.body.classList.contains("wizard-app")) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (n === 3) {
      state.packageTier = PRODUCT_TIER_KEY;
      renderSummary();
      syncPatternSelectionUI();
      syncPatternTierGate();
    }
    syncHeroValueRotator(n);
    syncFinishCheckoutUi();
    if (n === 2) renderLayoutChannelPreviewIfNeeded();
    var issueBubbleMount = document.getElementById("issue-speech-bubble-mount");
    if (issueBubbleMount) {
      issueBubbleMount.removeAttribute("hidden");
      issueBubbleMount.setAttribute("aria-hidden", "false");
    }
  }

  /** Welcome hero: vertical slide + smooth viewport height (paused off welcome). */
  var HERO_VALUE_ROTATOR_LINES = [
    { k: "Monetize", v: "paid-access ready channels and roles." },
    { k: "Growth", v: "scalable structure without chaos." },
    { k: "Simple", v: "one price — $20 at checkout." },
    { k: "Optimal", v: "layouts tuned for engagement." },
    { k: "Easy", v: "quick flow on the website with a live demo." },
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

  /** Per-layout trees from layout-channel-trees.js (window.SERVERLY_LAYOUT_CHANNEL_TREES). */
  function getChannelTree(layoutType) {
    var trees =
      typeof window !== "undefined" && window.SERVERLY_LAYOUT_CHANNEL_TREES
        ? window.SERVERLY_LAYOUT_CHANNEL_TREES
        : null;
    if (!trees || !trees.content_creator) return [];
    var key = layoutType && trees[layoutType] ? layoutType : "content_creator";
    return trees[key] || trees.content_creator;
  }

  function totalDemoChannelCount(tree) {
    var n = 0;
    var i;
    var t = tree || getChannelTree("content_creator");
    for (i = 0; i < t.length; i++) {
      n += t[i].channels.length;
    }
    return n;
  }

  /** Channel name → sidebar emoji (layout demos, bar-divider, etc.). Keys: exact + lowercase slugs. */
  var CHANNEL_DEMO_EMOJI = {
    welcome: "👋",
    Welcome: "👋",
    rules: "📜",
    Rules: "📜",
    roles: "🎭",
    Roles: "🎭",
    announcements: "📢",
    Announcements: "📢",
    giveaway: "🎉",
    Giveaway: "🎉",
    "pick-your-role": "🎯",
    "Pick-Your-Role": "🎯",
    polls: "📊",
    Polls: "📊",
    links: "🔗",
    Links: "🔗",
    "new-posts": "📰",
    "New-Posts": "📰",
    partnerships: "🤝",
    Partnerships: "🤝",
    general: "💬",
    General: "💬",
    "off-topic": "💭",
    "Off-Topic": "💭",
    "gamer-chat": "🎮",
    "Game-Chat": "🎮",
    clips: "🎬",
    Clips: "🎬",
    tech: "💻",
    Tech: "💻",
    art: "🎨",
    Art: "🎨",
    questions: "❓",
    Questions: "❓",
    feedback: "💬",
    Feedback: "💬",
    bots: "🤖",
    Bots: "🤖",
    bot: "🤖",
    cmd: "⌨️",
    CMD: "⌨️",
    forum: "🗂️",
    Lounge: "🛋️",
    lounge: "🛋️",
    "Duo #1": "🎧",
    "Duo #2": "🎧",
    "Squad #1": "👥",
    "Squad #2": "👥",
    "Crew Lounge": "🎭",
    Music: "🎵",
    music: "🎵",
    Stream: "📺",
    stream: "📺",
    AFK: "💤",
    afk: "💤",
    "restricted-users": "🔒",
    "Restricted-Users": "🔒",
    "muted-users": "🔇",
    "Muted-Users": "🔇",
    "Judgement VC": "⚖️",
    "Jugement VC": "⚖️",
    admin: "👑",
    Admin: "👑",
    "server-ideas": "💡",
    "Server-Ideas": "💡",
    "staff-information": "📑",
    "Staff-Information": "📑",
    "test-bot": "🧪",
    "Test-Bot": "🧪",
    "bye-bye": "👋",
    "Bye-Bye": "👋",
    "Staff VC": "🎙️",
    Recording: "⏺️",
    Streaming: "📡",
    Friends: "👫",
    "self-promote": "📣",
    "Self-Promote": "📣",
    "content-ideas": "💡",
    "Content-Ideas": "💡",
    "brand-deals": "🤝",
    "Brand-Deals": "🤝",
    "tools-and-apps": "🧰",
    "Tools-and-Apps": "🧰",
    "creator-events": "📅",
    "Creator-Events": "📅",
    "monthly-highlights": "⭐",
    "Monthly-Highlights": "⭐",
    "thumbnail-contents": "🖼️",
    "Thumbnail-Contests": "🖼️",
    "editing-room": "✂️",
    "Editing-Room": "✂️",
    "live-feedback": "📣",
    "Live-Feedback": "📣",
    "hire-me": "💼",
    "Hire-Me": "💼",
    "team-up": "🤝",
    "Team-Up": "🤝",
    appeals: "⚖️",
    Appeals: "⚖️",
    appeal: "⚖️",
    "coffee-chat": "☕",
    "Coffee-Chat": "☕",
    "watch-party": "🍿",
    "Watch-Party": "🍿",
    "support-vc": "🎧",
    "Support-VC": "🎧",
    memes: "😂",
    fanart: "🖌️",
    level: "📈",
    counting: "🔢",
    subscriber: "⭐",
    highlights: "✨",
    gallery: "🖼️",
    pets: "🐾",
    management: "📊",
    "irl-photos": "📷",
    "our-socials": "📱",
    "social-media": "📲",
    website: "🌐",
    faq: "❔",
    ticket: "🎫",
    application: "📝",
    apply: "📝",
    "Creator Lounge": "🎙️",
    "Production Room": "🎬",
    logs: "📜",
    assets: "📁",
    commands: "⌨️",
    "Admin VC": "🎙️",
    verification: "✅",
    "weekly-updates": "📅",
    resources: "📚",
    "business-chat": "💼",
    suggestions: "💡",
    specifications: "📋",
    docs: "📄",
    Meeting: "🤝",
    meeting: "🤝",
    help: "🆘",
    "bot-chat-1": "🤖",
    "bot-chat-2": "🤖",
    "move-in": "📦",
    "bot voice 1": "🎙️",
    "bot voice 2": "🎙️",
    assign: "📌",
    Class: "🎓",
    science: "🔬",
    technology: "💻",
    engineering: "⚙️",
    mathematics: "🔢",
    finance: "💵",
    marketing: "📣",
    entrepreneurship: "🚀",
    "visual-arts": "🖼️",
    "performing-arts": "🎭",
    media: "📰",
    "graphic-design": "🎨",
    history: "📜",
    literature: "📖",
    philosophy: "🤔",
    "social-studies": "🌍",
    english: "📘",
    "foreign-languages": "🌐",
    linguistics: "🔤",
    nursing: "💉",
    biology: "🧬",
    psychology: "🧠",
    "public-health": "🏥",
    programming: "💻",
    IT: "🖥️",
    it: "🖥️",
    cybersecurity: "🔐",
    AI: "🤖",
    ai: "🤖",
    teaching: "🍎",
    "child-development": "👶",
    "education-leadership": "📋",
    law: "⚖️",
    criminology: "🔍",
    "international-relations": "🌐",
    "public-policy": "🏛️",
    kinesiology: "🏃",
    coaching: "🏅",
    "sports-management": "⚽",
    theater: "🎭",
    dance: "💃",
    "film-production": "🎥",
    interior: "🏠",
    landscape: "🌳",
    industrial: "🏭",
    "urban-planning": "🗺️",
    journalism: "📰",
    film: "🎬",
    broadcasting: "📻",
    blueprints: "📐",
    documentation: "📄",
    "launch-announcements": "🚀",
    "event-calendar": "📅",
    "dev-console": "🖥️",
    "company-handbook": "📘",
    "Executive Room": "🚪",
    brainstorming: "💡",
    planning: "📅",
    prototypes: "🧪",
    testing: "✅",
    "Coffee Corner": "☕",
    "founders-and-leadership": "👔",
    "legal-and-compliance": "⚖️",
    "finance-and-accounting": "🧾",
    ui: "🖼️",
    "brand-identity": "🎨",
    branding: "✨",
    seo: "📈",
    ads: "📢",
    community: "👥",
    analytics: "📊",
    sales: "💰",
    support: "🛟",
    retention: "🔄",
    investors: "💵",
    budgeting: "📒",
    revenue: "📈",
    forecasting: "📉",
    goals: "🎯",
    research: "🔬",
    competition: "🏁",
    risk: "⚠️",
    devops: "⚙️",
    security: "🔐",
    automation: "🤖",
    bugs: "🐛",
    instructions: "📋",
    tutorials: "📚",
    "product-info": "📦",
    "sales-tips": "💡",
    collabs: "🤝",
    "mindset-tips": "🧠",
    "growth-strategies": "📈",
    "marketing-zone": "📣",
    "working-room": "💼",
    "server-planning": "🗺️",
    "start-here": "👋",
    "my-project": "📁",
    "project-feedback": "💬",
    "client-work": "🤝",
    "live-events": "🎟️",
    "moderation-logs": "🛡️",
    guidelines: "📜",
    events: "🎉",
    prices: "💲",
    "clock-in-out": "⏰",
    inventory: "📦",
    discussion: "💬",
    "Game Night": "🎮",
    edits: "✂️",
    "server-ideas": "💡",
    tools: "🧰",
    "plot-ideas": "💡",
    "irl-stuff": "🌍",
    updates: "🔔",
    "Private VC": "🔒",
    orientation: "🧭",
  };

  function demoEmojiHeuristic(lower) {
    if (!lower) return "📌";
    if ((/\bvc\b/.test(lower) || lower.indexOf("voice") >= 0) && (lower.indexOf(" ") >= 0 || lower.indexOf("-") >= 0))
      return "🎙️";
    if (lower.indexOf("ticket") >= 0) return "🎫";
    if (lower.indexOf("faq") >= 0 || lower === "help") return "❔";
    if (lower.indexOf("log") >= 0 && lower.indexOf("catalog") < 0) return "📜";
    if (lower.indexOf("admin") >= 0) return "👑";
    if (lower.indexOf("bot") >= 0) return "🤖";
    if (lower.indexOf("meet") >= 0) return "🤝";
    if (lower.indexOf("music") >= 0) return "🎵";
    if (lower.indexOf("stream") >= 0 || lower.indexOf("broadcast") >= 0) return "📺";
    if (lower.indexOf("video") >= 0 || lower.indexOf("film") >= 0) return "🎬";
    if (lower.indexOf("photo") >= 0 || lower.indexOf("gallery") >= 0) return "📷";
    if (lower.indexOf("legal") >= 0 || lower.indexOf("law") >= 0) return "⚖️";
    if (lower.indexOf("finance") >= 0 || lower.indexOf("revenue") >= 0 || lower.indexOf("budget") >= 0)
      return "💰";
    if (lower.indexOf("market") >= 0 || lower.indexOf("seo") >= 0 || lower.indexOf("ads") >= 0)
      return "📣";
    if (lower.indexOf("design") >= 0 || lower.indexOf("brand") >= 0 || lower === "ui") return "🎨";
    if (lower.indexOf("code") >= 0 || lower.indexOf("dev") >= 0 || lower.indexOf("program") >= 0)
      return "💻";
    if (lower.indexOf("security") >= 0 || lower.indexOf("cyber") >= 0) return "🔐";
    if (lower.indexOf("bug") >= 0) return "🐛";
    if (lower.indexOf("event") >= 0 || lower.indexOf("calendar") >= 0) return "📅";
    if (lower.indexOf("welcome") >= 0) return "👋";
    if (lower.indexOf("rule") >= 0) return "📜";
    if (lower.indexOf("poll") >= 0) return "📊";
    if (lower.indexOf("forum") >= 0 || lower.indexOf("discussion") >= 0) return "💬";
    if (lower.indexOf("wiki") >= 0 || lower.indexOf("doc") >= 0) return "📄";
    if (lower.indexOf("coffee") >= 0) return "☕";
    if (lower.indexOf("pet") >= 0) return "🐾";
    if (lower.indexOf("meme") >= 0) return "😂";
    if (lower.indexOf("social") >= 0 || lower.indexOf("website") >= 0) return "🌐";
    if (lower.indexOf("apply") >= 0 || lower.indexOf("application") >= 0) return "📝";
    if (lower.indexOf("lounge") >= 0) return "🛋️";
    if (lower.indexOf("afk") >= 0) return "💤";
    if (lower.indexOf("class") >= 0 || lower.indexOf("teach") >= 0) return "🎓";
    if (lower.indexOf("science") >= 0 || lower.indexOf("biology") >= 0) return "🔬";
    if (lower.indexOf("math") >= 0) return "🔢";
    if (lower.indexOf("sport") >= 0 || lower.indexOf("coach") >= 0) return "⚽";
    return "📌";
  }

  function demoEmojiForName(name) {
    if (name == null || name === "") return "📌";
    var s = String(name).trim();
    var m = CHANNEL_DEMO_EMOJI;
    if (m[s]) return m[s];
    var lower = s.toLowerCase();
    if (m[lower]) return m[lower];
    if (s.indexOf("-") >= 0) {
      var tc = s.split("-").map(function (p) {
        return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p;
      }).join("-");
      if (m[tc]) return m[tc];
    }
    if (s.length) {
      var t = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      if (m[t]) return m[t];
    }
    return demoEmojiHeuristic(lower);
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

  /** Mathematical Bold Italic (e.g. 【👋】𝑾𝒆𝒍𝒄𝒐𝒎𝒆) for Corner brackets */
  function toMathBoldItalic(input) {
    if (!input) return "";
    return String(input).replace(/[A-Za-z0-9]/g, function (ch) {
      var code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d468 + (code - 65));
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d482 + (code - 97));
      if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ce + (code - 48));
      return ch;
    });
  }

  /** Regional indicator letters (e.g. 《📢》🇦🇳🇳🇴🇺🇳🇨🇪🇲🇪🇳🇹🇸) for Chevrons */
  function toRegionalIndicatorLetters(input) {
    if (!input) return "";
    return String(input).replace(/[A-Za-z]/g, function (ch) {
      var code = ch.toUpperCase().charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1f1e6 + (code - 65));
      return ch;
    });
  }

  /** Greek/Cyrillic homoglyphs for dot separator (e.g. 📢⭑¢σηтєηт-ι∂єαѕ) */
  var DOT_SEPARATOR_LETTERS = {
    a: "\u03b1",
    b: "\u0432",
    c: "\u00a2",
    d: "\u2202",
    e: "\u0454",
    f: "\u0192",
    g: "\u0261",
    h: "\u04bb",
    i: "\u03b9",
    j: "\u03f3",
    k: "\u03ba",
    l: "\u2113",
    m: "\u043c",
    n: "\u03b7",
    o: "\u03c3",
    p: "\u0440",
    q: "\u024b",
    r: "\u044f",
    s: "\u0455",
    t: "\u0442",
    u: "\u03c5",
    v: "\u03bd",
    w: "\u0475",
    x: "\u0445",
    y: "\u0443",
    z: "\u01b6",
  };

  function toDotSeparatorStylish(input) {
    if (!input) return "";
    return String(input).replace(/[A-Za-z]/g, function (ch) {
      var mapped = DOT_SEPARATOR_LETTERS[ch.toLowerCase()];
      return mapped || ch;
    });
  }

  /** Fullwidth Latin lowercase & digits (e.g. 👋ｗｅｌｃｏｍｅ; pattern id em-dash) */
  function toFullwidthLatinLower(input) {
    if (!input) return "";
    return String(input).replace(/[A-Za-z0-9]/g, function (ch) {
      var code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) code += 32;
      if (code >= 97 && code <= 122) return String.fromCodePoint(0xff41 + (code - 97));
      if (code >= 48 && code <= 57) return String.fromCodePoint(0xff10 + (code - 48));
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

  /** Title-case each hyphen segment (e.g. pick your role → Pick-Your-Role) */
  function toTitleHyphenatedName(rawName) {
    return String(rawName)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .split("-")
      .map(function (part) {
        return part ? part.charAt(0).toUpperCase() + part.slice(1) : part;
      })
      .join("-");
  }

  function formatChannelDemoLabel(patternId, rawName, isVoice, laneIndex) {
    var n = rawName;
    var e = demoEmojiForName(n);
    var compact = String(n).replace(/\s+/g, "");
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
        return e + "┃" + toMathBoldText(n);
      case "corner-brackets":
        return "【" + e + "】" + toMathBoldItalic(n);
      case "chevrons":
        return "《" + e + "》" + toRegionalIndicatorLetters(n);
      case "dot-separator":
        return (
          e +
          "\u2b51" +
          toDotSeparatorStylish(
            String(n)
              .toLowerCase()
              .replace(/\s+/g, "-")
          )
        );
      case "em-dash": {
        var emSeg = String(n)
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/#/g, "\uff03");
        return e + toFullwidthLatinLower(emSeg);
      }
      case "sparkle-dot":
        return "\u300e" + e + "\u300f" + toMathBoldText(toTitleHyphenatedName(n));
      default:
        return toMathBoldText(isVoice ? n : e + " | " + n);
    }
  }

  function findDefaultDemoChannel(tree) {
    var t = tree || getChannelTree("content_creator");
    if (!t || !t.length) return { name: "general", voice: false, locked: false };
    var i;
    var j;
    var ch;
    var c;
    for (i = 0; i < t.length; i++) {
      if (t[i].title !== "General") continue;
      for (j = 0; j < t[i].channels.length; j++) {
        ch = t[i].channels[j];
        if (!ch.voice && !ch.locked) return ch;
      }
    }
    for (i = 0; i < t.length; i++) {
      for (j = 0; j < t[i].channels.length; j++) {
        c = t[i].channels[j];
        if (!c.voice && !c.locked) return c;
      }
    }
    return t[0] && t[0].channels[0] ? t[0].channels[0] : { name: "general", voice: false, locked: false };
  }

  /** Style-step mini previews (aligned with content creator naming). */
  function makePatternPreviewBlock(patternId) {
    function lab(name, voice) {
      return formatChannelDemoLabel(patternId, name, voice, 0);
    }
    return {
      newSection: [lab("welcome", false), lab("rules", false), lab("roles", false)],
      information: [lab("announcements", false), lab("giveaway", false), lab("pick-your-role", false)],
      generalText: [lab("general", false), lab("off-topic", false), lab("gamer-chat", false)],
      voice: [lab("Lounge", true), lab("Music", true), lab("AFK", true)],
    };
  }

  var PATTERN_PREVIEW_DATA = {
    "regular-text": makePatternPreviewBlock("regular-text"),
    "bar-divider": makePatternPreviewBlock("bar-divider"),
    "sparkle-dot": makePatternPreviewBlock("sparkle-dot"),
    "bold-column": makePatternPreviewBlock("bold-column"),
    chevrons: makePatternPreviewBlock("chevrons"),
    "corner-brackets": makePatternPreviewBlock("corner-brackets"),
    "dot-separator": makePatternPreviewBlock("dot-separator"),
    flourish: makePatternPreviewBlock("flourish"),
    "em-dash": makePatternPreviewBlock("em-dash"),
  };

  /** Global lane index (same order as summary Discord demo) for a channel by category title + name. */
  function globalLaneIndexForChannel(tree, categoryTitle, channelName, expectVoice) {
    var lane = 0;
    var t = tree || getChannelTree("content_creator");
    var ci, cj, cat, ch;
    for (ci = 0; ci < t.length; ci++) {
      cat = t[ci];
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

  /** Style-step sidebar mock: Discord-like categories (New !, Information, General, Voice Chat). */
  function buildPatternSidebarHtml(patternId) {
    var data = PATTERN_PREVIEW_DATA[patternId];
    if (!data) return "";
    var regularTextMode = patternId === "regular-text";
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
            '<div class="disc-ch-row disc-ch-row-voice pattern-mock-pill"><span class="disc-voice-icon" aria-hidden="true">' +
            DEMO_VOICE_CHANNEL_SVG +
            '</span><span class="disc-ch-text">' +
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
      categoryBlock("New", data.newSection, false) +
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
    return id ? slugToLabel(id) : "Regular Text";
  }

  function defaultLaneDisplay(patternId, channelName, isVoice, lane) {
    return formatChannelDemoLabel(patternId, channelName, isVoice, lane);
  }

  function summaryChannelTreeForTier(packageTier, layoutType) {
    var tree = getChannelTree(layoutType || state.layoutType || "content_creator");
    if (packageTier === "simple") {
      return tree.filter(function (cat) {
        return cat.title !== "Extra" && cat.title !== "Extra Channels";
      });
    }
    return tree;
  }

  function previewHasDeviations(patternId, layoutType) {
    if (!patternId) return false;
    var tree = getChannelTree(layoutType || state.layoutType || "content_creator");
    var lane = 0;
    var ci, cj, cat, ch, def, stored, st;
    for (ci = 0; ci < tree.length; ci++) {
      cat = tree[ci];
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
    if (!state.channelPattern) {
      state.channelPatternLabel = null;
      return;
    }
    var id = state.channelPattern;
    var base = patternBaseLabelFromId(id);
    state.channelPatternLabel = previewHasDeviations(id, state.layoutType)
      ? base + " · preview customized"
      : base;
  }

  function buildChannelPreviewBlob(patternId, packageTier, layoutType) {
    var pid = patternId || "regular-text";
    var tree = summaryChannelTreeForTier(packageTier || state.packageTier, layoutType || state.layoutType);
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
      var on = state.namingPatternUserChosen && cid === state.channelPattern;
      chip.classList.toggle("demo-pattern-chip--active", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    });
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

  /** Decorative bottom tab bar (Discord mobile chrome; shown on all viewports). */
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

  function buildDemoPatternSwitcherHtml() {
    var i;
    var groupLabel = "Channel name style — choose one to update the preview";
    var legendId = "demo-pattern-legend";
    var out =
      '<div class="demo-pattern-switcher demo-pattern-switcher--compact" role="group" aria-labelledby="' +
      legendId +
      '" aria-label="' +
      escapeHtml(groupLabel) +
      '">' +
      '<div class="demo-pattern-switcher-head demo-pattern-switcher-head--minimal">' +
      '<span class="demo-pattern-switcher-label" id="' +
      legendId +
      '">Channel name style</span>' +
      "</div>" +
      '<div class="demo-pattern-switcher-chips">';
    for (i = 0; i < DEMO_PATTERN_OPTIONS.length; i++) {
      var o = DEMO_PATTERN_OPTIONS[i];
      var isOn = state.namingPatternUserChosen && state.channelPattern === o.id;
      var applyHint = "Preview: " + o.label;
      out +=
        '<button type="button" class="demo-pattern-chip' +
        (isOn ? " demo-pattern-chip--active" : "") +
        '" data-demo-pattern-btn="' +
        escapeHtml(o.id) +
        '" data-demo-pattern-label="' +
        escapeHtml(o.label) +
        '" aria-pressed="' +
        (isOn ? "true" : "false") +
        '" title="' +
        escapeHtml(applyHint) +
        '">' +
        '<span class="demo-pattern-chip-text">' +
        escapeHtml(o.label) +
        "</span></button>";
    }
    out += "</div></div>";
    return out;
  }

  /** Full channel tree as a simple list (layout step previews). */
  function buildLayoutPreviewListHtml(patternId, tree) {
    var lane = 0;
    var parts = [];
    var ci, cj, cat, ch, label;
    for (ci = 0; ci < tree.length; ci++) {
      cat = tree[ci];
      parts.push(
        '<section class="layout-preview-cat" aria-label="' +
        escapeHtml(cat.title) +
        '">' +
        '<h4 class="layout-preview-cat-title">' +
        escapeHtml(cat.title) +
        '</h4>' +
        '<ul class="layout-preview-channels">'
      );
      for (cj = 0; cj < cat.channels.length; cj++) {
        ch = cat.channels[cj];
        label = defaultLaneDisplay(patternId, ch.name, ch.voice, lane);
        lane += 1;
        parts.push(
          '<li class="layout-preview-ch' +
          (ch.voice ? " layout-preview-ch--voice" : "") +
          '">' +
          (ch.voice
            ? '<span class="layout-preview-ch-ico" aria-hidden="true">' + DEMO_VOICE_CHANNEL_SVG + "</span>"
            : '<span class="layout-preview-ch-ico layout-preview-ch-ico--hash" aria-hidden="true">#</span>') +
          '<span class="layout-preview-ch-name">' +
          escapeHtml(label) +
          "</span></li>"
        );
      }
      parts.push("</ul></section>");
    }
    return '<div class="layout-preview-list">' + parts.join("") + "</div>";
  }

  function buildDiscordCategoryRowsHtml(tree, patternId) {
    var defCh = findDefaultDemoChannel(tree);
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
        var ariaCur = isDef ? ' aria-current="true"' : "";
        var label = defaultLaneDisplay(patternId, ch.name, ch.voice, laneCounter);
        var labelInner = escapeHtml(label);
        var laneIdxAttr = String(laneCounter);
        laneCounter += 1;
        var vCls = ch.voice ? " discord-demo-ch--voice" : "";
        var lk = ch.locked ? "true" : "false";
        rowsHtml +=
          '<div class="discord-demo-ch' +
          defCls +
          vCls +
          '" data-lane-index="' +
          escapeHtml(laneIdxAttr) +
          '" data-name="' +
          escapeHtml(ch.name) +
          '" data-voice="' +
          (ch.voice ? "true" : "false") +
          '" data-locked="' +
          lk +
          '" tabindex="-1" role="listitem"' +
          ariaCur +
          ">" +
          (ch.voice
            ? '<span class="discord-demo-ch-icon" aria-hidden="true">' + DEMO_VOICE_CHANNEL_SVG + "</span>"
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
    return { catHtml: catHtml, defCh: defCh, defLaneIndex: defLaneIndex };
  }

  /**
   * Discord mock: server rail + channel list + mobile-style tab bar (all viewports). No chat / members / user strip.
   */
  function buildDiscordDemoInnerHtml(patternId, tree, options) {
    options = options || {};
    var demoExtraClass = options.demoExtraClass ? " " + options.demoExtraClass : "";
    var serverLabel = options.serverLabel != null ? String(options.serverLabel) : "Your server";
    var aria =
      options.ariaLabel != null ? String(options.ariaLabel) : "Discord-style layout preview";
    var rowsPack = buildDiscordCategoryRowsHtml(tree, patternId || "");
    var catHtml = rowsPack.catHtml;
    return (
      '<div class="discord-demo' +
      demoExtraClass +
      '" data-demo-pattern="' +
      escapeHtml(patternId || "") +
      '" role="region" aria-label="' +
      escapeHtml(aria) +
      '">' +
      buildDemoRailHtml() +
      '<div class="discord-demo-sidebar">' +
      '<div class="discord-demo-sidebar-top">' +
      '<div class="discord-demo-server-name">' +
      escapeHtml(serverLabel) +
      ' <span class="discord-demo-chev">▼</span></div>' +
      "</div>" +
      '<div class="discord-demo-channel-scroll" tabindex="0">' +
      '<div class="discord-demo-nav-static">' +
      '<div class="discord-demo-nav-row discord-demo-nav-row--mock-link" data-demo-nav-mock="1" role="presentation" tabindex="-1">Events</div>' +
      '<div class="discord-demo-nav-row discord-demo-nav-row--mock-link" data-demo-nav-mock="1" role="presentation" tabindex="-1">Server Boosts</div>' +
      "</div>" +
      catHtml +
      "</div>" +
      "</div>" +
      buildDemoMobileTabbarHtml() +
      "</div>"
    );
  }

  function buildDiscordDemoHtml(patternId, displayLabel, packageTier, layoutType) {
    var tree = summaryChannelTreeForTier(packageTier, layoutType);
    var renderPattern = patternId || "regular-text";
    var lab =
      displayLabel && String(displayLabel).trim()
        ? displayLabel.trim()
        : patternId
          ? slugToLabel(patternId)
          : "";
    var hasPatternChoice = state.namingPatternUserChosen && !!patternId;
    var lead = hasPatternChoice
      ? '<p class="preview-disclaimer summary-preview-bundle-lead">You are purchasing · <strong data-summary-selected-style>' +
        escapeHtml(lab) +
        "</strong></p>"
      : '<p class="preview-disclaimer summary-preview-bundle-lead">Pick a <strong>channel name style</strong> above — try them out in the preview.</p>';
    var patternBar = buildDemoPatternSwitcherHtml();
    var inner = buildDiscordDemoInnerHtml(renderPattern, tree, {
      serverLabel: "Your server",
      ariaLabel: "Discord-style layout preview",
    });
    return (
      '<div class="summary-preview-combined">' +
      '<div class="summary-preview-heading">' +
      '<h4 class="outcome-h outcome-h--preview-bundle">Preview</h4>' +
      "</div>" +
      patternBar +
      lead +
      inner +
      "</div>"
    );
  }

  var LAYOUT_PREVIEW_ENTRIES = [
    {
      id: "private",
      tabLabel: "Private",
      title: "Private servers",
      tagline: "Member gates, VIP lanes, and trusted access",
    },
    {
      id: "business",
      tabLabel: "Business",
      title: "Businesses",
      tagline: "Client lanes, support flow, and clean handoffs",
    },
    {
      id: "education",
      tabLabel: "Education",
      title: "Education",
      tagline: "Classes, resources, Q&A, and discussion rhythm",
    },
    {
      id: "startup",
      tabLabel: "Startup",
      title: "Startup workspace",
      tagline: "Ship fast: ops, standups, and execution channels",
    },
    {
      id: "content_creator",
      tabLabel: "Creator",
      title: "Content creator",
      tagline: "Loops, clips, announcements—broadcast-ready structure",
    },
  ];

  function activateLayoutPreviewTab(root, layoutId) {
    if (!root || !layoutId) return;
    root.querySelectorAll(".layout-preview-tab").forEach(function (t) {
      var on = t.getAttribute("data-layout-id") === layoutId;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.setAttribute("tabindex", on ? "0" : "-1");
    });
    root.querySelectorAll(".layout-preview-panel").forEach(function (p) {
      var on = p.getAttribute("data-layout-panel") === layoutId;
      p.classList.toggle("is-active", on);
      if (on) p.removeAttribute("hidden");
      else p.setAttribute("hidden", "");
    });
  }

  function renderLayoutChannelPreviewIfNeeded() {
    var mount = document.getElementById("layout-examples-mount");
    if (!mount || mount.getAttribute("data-layout-preview-rendered") === "1") return;
    mount.setAttribute("data-layout-preview-rendered", "1");
    var patternId = "regular-text";
    var tier = PRODUCT_TIER_KEY;
    var i;
    var entry;
    var tree;
    var listHtml;
    var tabsHtml = [];
    var panelsHtml = [];
    var preferred = LAYOUT_PREVIEW_ENTRIES[0].id;
    for (i = 0; i < LAYOUT_PREVIEW_ENTRIES.length; i++) {
      if (LAYOUT_PREVIEW_ENTRIES[i].id === state.layoutType) {
        preferred = state.layoutType;
        break;
      }
    }

    for (i = 0; i < LAYOUT_PREVIEW_ENTRIES.length; i++) {
      entry = LAYOUT_PREVIEW_ENTRIES[i];
      tree = summaryChannelTreeForTier(tier, entry.id);
      listHtml = buildLayoutPreviewListHtml(patternId, tree);
      var isSel = entry.id === preferred;
      var exampleId = "layout-example-" + entry.id;
      var tabId = "layout-tab-" + entry.id;
      tabsHtml.push(
        '<button type="button" class="layout-preview-tab' +
        (isSel ? " is-active" : "") +
        '" role="tab" id="' +
        escapeHtml(tabId) +
        '" data-layout-id="' +
        escapeHtml(entry.id) +
        '" aria-selected="' +
        (isSel ? "true" : "false") +
        '" aria-controls="' +
        escapeHtml(exampleId) +
        '" tabindex="' +
        (isSel ? "0" : "-1") +
        '">' +
        escapeHtml(entry.tabLabel) +
        "</button>"
      );
      panelsHtml.push(
        '<div class="layout-preview-panel' +
        (isSel ? " is-active" : "") +
        '" role="tabpanel" id="' +
        escapeHtml(exampleId) +
        '" data-layout-panel="' +
        escapeHtml(entry.id) +
        '" aria-labelledby="' +
        escapeHtml(tabId) +
        '"' +
        (isSel ? "" : " hidden") +
        ">" +
        '<div class="layout-preview-panel-inner">' +
        '<div class="layout-preview-panel-head">' +
        '<div class="layout-preview-panel-copy">' +
        '<p class="layout-preview-title">' +
        escapeHtml(entry.title) +
        "</p>" +
        '<p class="layout-preview-tagline">' +
        escapeHtml(entry.tagline) +
        "</p>" +
        "</div>" +
        '<button type="button" class="btn btn-outline btn-sm layout-preview-choose" data-choice-key="layoutType" data-choice-value="' +
        escapeHtml(entry.id) +
        '">Use this layout</button>' +
        "</div>" +
        '<div class="layout-preview-list-scroll">' +
        listHtml +
        "</div>" +
        "</div>" +
        "</div>"
      );
    }

    mount.innerHTML =
      '<div class="layout-preview reveal" data-layout-preview-root>' +
      '<div class="layout-preview-tabs" role="tablist" aria-label="Preview channels by layout">' +
      tabsHtml.join("") +
      "</div>" +
      '<div class="layout-preview-panels">' +
      panelsHtml.join("") +
      "</div>" +
      "</div>";

    var root = mount.querySelector("[data-layout-preview-root]");
    if (root) {
      root.querySelectorAll(".layout-preview-tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
          var lid = tab.getAttribute("data-layout-id");
          activateLayoutPreviewTab(root, lid);
        });
      });
      var tablist = root.querySelector(".layout-preview-tabs");
      if (tablist) {
        tablist.addEventListener("keydown", function (e) {
          var tabs = [].slice.call(root.querySelectorAll(".layout-preview-tab"));
          var ix = tabs.indexOf(document.activeElement);
          if (ix < 0) return;
          var nextIx = ix;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            nextIx = (ix + 1) % tabs.length;
            e.preventDefault();
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            nextIx = (ix - 1 + tabs.length) % tabs.length;
            e.preventDefault();
          } else if (e.key === "Home") {
            nextIx = 0;
            e.preventDefault();
          } else if (e.key === "End") {
            nextIx = tabs.length - 1;
            e.preventDefault();
          }
          if (nextIx !== ix) {
            var lid = tabs[nextIx].getAttribute("data-layout-id");
            activateLayoutPreviewTab(root, lid);
            tabs[nextIx].focus();
          }
        });
      }
    }

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && root) {
      var obs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              e.target.classList.add("visible");
              e.target.classList.add("is-in");
              obs.unobserve(e.target);
            }
          });
        },
        { rootMargin: "0px 0px -5% 0px", threshold: 0.06 }
      );
      obs.observe(root);
    } else if (root) {
      root.classList.add("visible");
      root.classList.add("is-in");
    }
  }

  function initDiscordDemoPreview(container) {
    if (!container) return;
    var demo = container.querySelector(".discord-demo");
    if (!demo) return;
    var scrollEl = demo.querySelector(".discord-demo-channel-scroll");
    if (!scrollEl) return;

    var rows = demo.querySelectorAll(".discord-demo-ch");
    var r;

    function updateFromRow(row) {
      var k;
      for (k = 0; k < rows.length; k++) {
        rows[k].classList.remove("is-active");
        rows[k].removeAttribute("aria-current");
      }
      row.classList.add("is-active");
      row.setAttribute("aria-current", "true");
    }

    for (r = 0; r < rows.length; r++) {
      rows[r].addEventListener("click", function () {
        updateFromRow(this);
      });
    }

    demo.querySelectorAll("[data-demo-nav-mock]").forEach(function (mockNav) {
      mockNav.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
    });

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
  }

  function getCheckoutApiBase() {
    if (typeof window === "undefined" || !window.STRIPE_CHECKOUT_API) return "";
    var s = String(window.STRIPE_CHECKOUT_API).trim();
    if (!s) return "";
    return s.replace(/\/$/, "");
  }

  function formatCheckoutFetchError(err) {
    var raw = err && err.message ? String(err.message) : "";
    var isNetFail =
      raw === "Failed to fetch" ||
      raw === "Load failed" ||
      (err && err.name === "TypeError" && /fetch|Failed to load|network/i.test(raw));
    if (!isNetFail) return raw || "Checkout failed. Check the API URL and try again.";

    var loc = typeof window !== "undefined" && window.location ? window.location : null;
    if (loc && loc.protocol === "file:") {
      return (
        "Could not reach checkout from a local file (file://). Your real Stripe API must allow this: set CORS_ALLOW_NULL_ORIGIN=true on the checkout API (e.g. Render environment variables), save, redeploy, then try again. " +
        "Browsers send Origin: null for file pages; the API only accepts that when that flag is on. For production traffic, prefer hosting the wizard on https:// and using CORS_ORIGIN instead."
      );
    }
    var base =
      "Could not reach checkout (often CORS). Add your page’s exact origin to CORS_ORIGIN on the checkout API (Render), or use http://localhost with a dev port the API already allows.";
    if (loc && /^https?:$/i.test(loc.protocol)) {
      base += " Your origin: " + loc.origin + " — paste that into CORS_ORIGIN if it’s missing.";
    }
    return base;
  }

  function flashCheckout(message, kind, persist) {
    if (!checkoutFlash) return;
    checkoutFlash.hidden = false;
    checkoutFlash.textContent = message;
    checkoutFlash.className =
      "checkout-flash summary-card checkout-flash--" + (kind || "info");
    if (flashCheckoutTimer) clearTimeout(flashCheckoutTimer);
    if (kind === "success" || persist) return;
    flashCheckoutTimer = setTimeout(function () {
      checkoutFlash.hidden = true;
    }, kind === "error" ? 8000 : 5000);
  }

  function hasSummaryContent() {
    return !!(state.serverMode && state.layoutType);
  }

  /** Email + Stripe bar: only after user clicks a channel name style chip on the finish step. */
  function isCheckoutStickyBarUnlocked() {
    return state.namingPatternUserChosen;
  }

  function updateFinishStepLead() {
    var el = document.getElementById("finish-step-lead");
    if (!el) return;
    if (!hasSummaryContent()) {
      el.textContent = "Complete the steps above for your recap and demo.";
      return;
    }
    if (isCheckoutStickyBarUnlocked()) {
      el.innerHTML =
        '<span class="finish-step-lead-status finish-step-lead-status--done">Style applied.</span> Enter your email in the bar below, then use <strong>Pay on Stripe</strong>.';
      return;
    }
    el.innerHTML =
      'Choose a <strong>channel name style</strong> in the preview section below to load your layout. Selecting a style unlocks checkout. You can click channels in the sidebar to explore how your server is organized.';
  }

  function isValidCheckoutEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
  }

  function syncSummaryOpenCheckoutBtn() {
    var btn = document.getElementById("summary-open-checkout");
    if (!btn) return;
    var api = getCheckoutApiBase();
    var emailInp = document.getElementById("sticky-checkout-email");
    var emailOk = emailInp && isValidCheckoutEmail(emailInp.value);
    var barReady =
      state.step === 3 && hasSummaryContent() && isCheckoutStickyBarUnlocked();
    btn.disabled = !barReady || !api || !emailOk;
  }

  function syncCheckoutStickyHint() {
    var hint = document.getElementById("checkout-sticky-hint");
    if (!hint) return;
    var shouldShow = state.step === 3 && hasSummaryContent() && isCheckoutStickyBarUnlocked();
    if (!shouldShow) {
      hint.setAttribute("hidden", "");
      hint.setAttribute("aria-hidden", "true");
      return;
    }
    hint.removeAttribute("hidden");
    hint.setAttribute("aria-hidden", "false");
  }

  function syncStickyCheckoutBar() {
    if (!checkoutStickyBar) return;
    if (stickyBarShowTimer != null) {
      clearTimeout(stickyBarShowTimer);
      stickyBarShowTimer = null;
    }
    var shouldShow = state.step === 3 && hasSummaryContent() && isCheckoutStickyBarUnlocked();
    if (!shouldShow) {
      checkoutStickyBar.classList.remove("checkout-sticky-bar--visible");
      document.body.classList.remove("checkout-sticky-bar-open");
      checkoutStickyBar.setAttribute("aria-hidden", "true");
      checkoutStickyBar.setAttribute("hidden", "");
      syncCheckoutStickyHint();
      syncSummaryOpenCheckoutBtn();
      return;
    }
    checkoutStickyBar.removeAttribute("hidden");
    checkoutStickyBar.setAttribute("aria-hidden", "false");
    document.body.classList.add("checkout-sticky-bar-open");
    syncCheckoutStickyHint();
    syncSummaryOpenCheckoutBtn();
    stickyBarShowTimer = setTimeout(function () {
      stickyBarShowTimer = null;
      if (
        checkoutStickyBar &&
        state.step === 3 &&
        hasSummaryContent() &&
        isCheckoutStickyBarUnlocked()
      ) {
        checkoutStickyBar.classList.add("checkout-sticky-bar--visible");
      }
    }, STICKY_BAR_REVEAL_MS);
  }

  function syncFinishCheckoutUi() {
    updateFinishStepLead();
    syncStickyCheckoutBar();
    syncSummaryOpenCheckoutBtn();
  }

  /** Legacy sessions may still have pattern "custom"; product no longer offers it. */
  function coerceChannelPatternAwayFromLegacyCustom() {
    if (state.channelPattern === "custom") {
      state.channelPattern = null;
      state.channelPatternLabel = null;
      state.namingPatternUserChosen = false;
    }
  }

  function renderSummary() {
    if (!summaryEl) return;
    state.packageTier = PRODUCT_TIER_KEY;
    var tier = PRODUCT_TIER_KEY;
    var hasAny = hasSummaryContent();

    if (!hasAny) {
      summaryEl.innerHTML =
        '<p class="summary-placeholder">Complete server setup and layout type above to open the live preview and naming styles.</p>';
      if (state.step === 3) syncWizardProgress();
      syncFinishCheckoutUi();
      return;
    }

    coerceChannelPatternAwayFromLegacyCustom();

    syncNamingLabelFromPreview();
    var styleLabel = summaryPatternDisplay();

    var html = buildDiscordDemoHtml(state.channelPattern, styleLabel, tier, state.layoutType);

    summaryEl.innerHTML = html;
    if (state.step === 3) syncWizardProgress();
    syncFinishCheckoutUi();
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
    state.channelCustomByLane = {};
    state.namingPatternUserChosen = false;
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

  function handleWizardChoiceClick(btn) {
    if (
      !btn ||
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
      if (state.layoutType !== val) {
        state.channelCustomByLane = {};
        state.namingPatternUserChosen = false;
        state.channelPattern = null;
        state.channelPatternLabel = null;
      }
      state.layoutType = val;
      nextStep();
      return;
    }
  }

  var wizardPagesRoot = document.getElementById("wizard-pages");
  if (wizardPagesRoot) {
    wizardPagesRoot.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-choice-key]");
      if (!btn || !wizardPagesRoot.contains(btn)) return;
      handleWizardChoiceClick(btn);
    });
  }

  function startStripeCheckout() {
    var api = getCheckoutApiBase();
    var summaryBtn = document.getElementById("summary-open-checkout");
    var emailInp = document.getElementById("sticky-checkout-email");
    var email = emailInp && emailInp.value ? emailInp.value.trim() : "";
    state.packageTier = PRODUCT_TIER_KEY;
    if (!api) {
      flashCheckout("Checkout API is not configured yet. Add STRIPE_CHECKOUT_API and try again.", "error");
      return;
    }
    if (!isValidCheckoutEmail(email)) {
      flashCheckout("Enter a valid email for receipts and delivery.", "error");
      if (emailInp) emailInp.focus();
      return;
    }
    if (summaryBtn) {
      summaryBtn.disabled = true;
      summaryBtn.setAttribute("aria-busy", "true");
      if (!summaryBtn.getAttribute("data-default-label")) {
        summaryBtn.setAttribute("data-default-label", summaryBtn.textContent.trim());
      }
      summaryBtn.textContent = "Redirecting to Stripe…";
    }
    flashCheckout("Redirecting to Stripe…", "info", true);
    coerceChannelPatternAwayFromLegacyCustom();
    var patId = state.channelPattern || "regular-text";
    var patLab =
      (state.channelPatternLabel && String(state.channelPatternLabel).trim()) ||
      patternBaseLabelFromId(patId);
    var previewChunks = chunkPreviewForMetadata(
      buildChannelPreviewBlob(patId, state.packageTier, state.layoutType)
    );
    fetch(api + "/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier: PRODUCT_TIER_KEY,
        email: email,
        serverMode: normalizeServerMode(state.serverMode) || state.serverMode || "",
        layoutType: state.layoutType,
        channelPattern: patId,
        channelPatternLabel: patLab,
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
                  channelPattern: patId,
                  channelPatternLabel: patLab,
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
        flashCheckout(formatCheckoutFetchError(err), "error");
        if (summaryBtn) {
          summaryBtn.removeAttribute("aria-busy");
          summaryBtn.textContent =
            summaryBtn.getAttribute("data-default-label") || "Pay on Stripe";
        }
        syncSummaryOpenCheckoutBtn();
      });
  }

  var summaryOpenCheckoutBtn = document.getElementById("summary-open-checkout");
  if (summaryOpenCheckoutBtn) {
    summaryOpenCheckoutBtn.addEventListener("click", function () {
      state.packageTier = PRODUCT_TIER_KEY;
      startStripeCheckout();
    });
  }

  var stickyCheckoutEmail = document.getElementById("sticky-checkout-email");
  if (stickyCheckoutEmail) {
    stickyCheckoutEmail.addEventListener("input", syncSummaryOpenCheckoutBtn);
    stickyCheckoutEmail.addEventListener("blur", syncSummaryOpenCheckoutBtn);
  }

  if (summaryEl) {
    summaryEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-demo-pattern-btn]");
      if (!btn || !summaryEl.contains(btn)) return;
      var id = btn.getAttribute("data-demo-pattern-btn");
      var labAttr = btn.getAttribute("data-demo-pattern-label");
      e.preventDefault();
      if (!id) return;
      state.packageTier = PRODUCT_TIER_KEY;
      if (state.channelPattern !== id) state.channelCustomByLane = {};
      state.channelPattern = id;
      state.channelPatternLabel =
        labAttr && String(labAttr).trim() !== "" ? String(labAttr).trim() : slugToLabel(id);
      state.namingPatternUserChosen = true;
      syncPatternSelectionUI();
      renderSummary();
    });
  }

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
            state.packageTier = PRODUCT_TIER_KEY;
            state.channelPattern = saved.channelPattern || null;
            state.channelPatternLabel = saved.channelPatternLabel || null;
            coerceChannelPatternAwayFromLegacyCustom();
            state.namingPatternUserChosen = !!state.channelPattern;
            if (saved.checkoutEmail && typeof saved.checkoutEmail === "string") {
              var em = document.getElementById("sticky-checkout-email");
              if (em) em.value = saved.checkoutEmail;
            }
          }
        }
      } catch (e2) {}
      state.packageTier = PRODUCT_TIER_KEY;
      setStep(3);
      flashCheckout(
        "Checkout was canceled. Enter your email in the bar below and use Pay on Stripe when you’re ready.",
        "error"
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
  })();

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            entry.target.classList.add("is-in");
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
    document.querySelectorAll(".faq-item, .welcome-section-below, .section-alt-wizard").forEach(function (el) {
      el.classList.add("reveal");
      observer.observe(el);
    });
  }
})();
