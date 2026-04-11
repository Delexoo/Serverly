/**
 * Per-layout channel trees for the wizard demo + Stripe preview metadata.
 * Aligned with channels.txt (project root). Loaded before script.js.
 * Exposed as window.SERVERLY_LAYOUT_CHANNEL_TREES
 */
(function (w) {
  "use strict";
  function c(name, voice, locked) {
    return { name: name, voice: !!voice, locked: !!locked };
  }

  function splitCsv(s) {
    return s
      .split(",")
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
  }

  function csvToChannels(s, voice, locked) {
    voice = !!voice;
    locked = locked != null ? !!locked : false;
    return splitCsv(s).map(function (n) {
      return c(n, voice, locked);
    });
  }

  /** Content creator — Extra Channels (category) in channels.txt */
  var CREATOR_EXTRA = [
    c("forum", false, true),
    c("self-promote", false, true),
    c("content-ideas", false, true),
    c("brand-deals", false, true),
    c("tools-and-apps", false, true),
    c("creator-events", false, true),
    c("monthly-highlights", false, true),
    c("thumbnail-contents", false, true),
    c("editing-room", false, true),
    c("live-feedback", false, true),
    c("hire-me", false, true),
    c("team-up", false, true),
    c("appeals", false, true),
    c("coffee-chat", false, true),
    c("watch-party", false, true),
    c("support-vc", true, true),
    c("memes", false, true),
    c("fanart", false, true),
    c("level", false, true),
    c("counting", false, true),
    c("subscriber", false, true),
    c("highlights", false, true),
    c("gallery", false, true),
    c("pets", false, true),
    c("management", false, true),
    c("irl-photos", false, true),
    c("our-socials", false, true),
    c("social-media", false, true),
    c("website", false, true),
    c("faq", false, true),
    c("ticket", false, true),
    c("application", false, true),
    c("appeal", false, true),
    c("Creator Lounge", true, true),
    c("Production Room", true, true),
  ];

  var BUSINESS_EXTRAS = csvToChannels(
    "forum,application,instructions,tutorials,product-info,sales-tips,collabs,mindset-tips,growth-strategies,marketing-zone,working-room,server-planning,social-media,our-socials,website,start-here,my-project,project-feedback,client-work,event-calendar,live-events,moderation-logs,community,irl-photos,management,guidelines,events,prices,clock-in-out,inventory,memes,discussion",
    false,
    false
  );

  var STARTUP_EXTRAS = csvToChannels(
    "forum,application,instructions,tutorials,product-info,sales-tips,collabs,mindset-tips,growth-strategies,orientation,marketing-zone,working-room,server-planning,social-media,our-socials,website,start-here,my-project,project-feedback,client-work,event-calendar,live-events,moderation-logs,community,irl-photos,management,guidelines,events,prices,clock-in-out,inventory,memes,discussion",
    false,
    false
  );

  var EDU_EXTRAS = csvToChannels(
    "forum,polls,rules,application,instructions,tutorials,collabs,working-room,website,start-here,event-calendar,live-events,moderation-logs,community,irl-photos,management,inventory,guidelines,events,memes,prices,discussion",
    false,
    false
  );

  w.SERVERLY_LAYOUT_CHANNEL_TREES = {
    content_creator: [
      {
        title: "New",
        locked: false,
        channels: [c("welcome", false, false), c("rules", false, false), c("roles", false, false)],
      },
      {
        title: "Information",
        locked: false,
        channels: [
          c("announcements", false, false),
          c("giveaway", false, false),
          c("pick-your-role", false, false),
          c("polls", false, false),
          c("links", false, false),
          c("new-posts", false, false),
          c("partnerships", false, false),
        ],
      },
      {
        title: "General",
        locked: false,
        channels: [
          c("general", false, false),
          c("off-topic", false, false),
          c("gamer-chat", false, false),
          c("clips", false, false),
          c("tech", false, false),
          c("art", false, false),
          c("questions", false, false),
          c("feedback", false, false),
        ],
      },
      { title: "BOT", locked: false, channels: [c("bots", false, false), c("cmd", false, false)] },
      {
        title: "Voice Chat",
        locked: false,
        channels: [
          c("Lounge", true, false),
          c("Duo #1", true, false),
          c("Duo #2", true, false),
          c("Squad #1", true, false),
          c("Squad #2", true, false),
          c("Crew Lounge", true, false),
          c("Music", true, false),
          c("Stream", true, false),
          c("AFK", true, false),
        ],
      },
      {
        title: "Advisory",
        locked: true,
        channels: [
          c("restricted-users", false, true),
          c("muted-users", false, true),
          c("Judgement VC", true, true),
        ],
      },
      {
        title: "Staff",
        locked: true,
        channels: [
          c("admin", false, true),
          c("server-ideas", false, true),
          c("staff-information", false, true),
          c("test-bot", false, true),
          c("bye-bye", false, true),
          c("Staff VC", true, true),
          c("Recording", true, true),
          c("Streaming", true, true),
          c("Friends", true, true),
        ],
      },
      { title: "Extra Channels", locked: true, channels: CREATOR_EXTRA },
    ],

    business: [
      {
        title: "Staff Only",
        locked: true,
        channels: [
          c("lounge", false, true),
          c("logs", false, true),
          c("assets", false, true),
          c("commands", false, true),
          c("Admin VC", true, true),
        ],
      },
      {
        title: "Information",
        locked: false,
        channels: [
          c("verification", false, false),
          c("welcome", false, false),
          c("announcements", false, false),
          c("weekly-updates", false, false),
          c("polls", false, false),
          c("rules", false, false),
          c("resources", false, false),
        ],
      },
      {
        title: "Network",
        locked: false,
        channels: [
          c("general", false, false),
          c("business-chat", false, false),
          c("media", false, false),
          c("off-topic", false, false),
          c("suggestions", false, false),
          c("specifications", false, false),
          c("docs", false, false),
        ],
      },
      {
        title: "Voice Chat",
        locked: false,
        channels: [c("General", true, false), c("Meeting", true, false), c("AFK", true, false)],
      },
      {
        title: "Support",
        locked: false,
        channels: [c("ticket", false, false), c("apply", false, false), c("faq", false, false), c("help", false, false)],
      },
      {
        title: "Bots",
        locked: false,
        channels: [
          c("bot", false, false),
          c("bot-chat-1", false, false),
          c("bot-chat-2", false, false),
          c("move-in", false, false),
          c("bot voice 1", true, false),
          c("bot voice 2", true, false),
        ],
      },
      { title: "Extras", locked: false, channels: BUSINESS_EXTRAS },
    ],

    education: [
      {
        title: "Staff Only",
        locked: true,
        channels: [
          c("lounge", false, true),
          c("logs", false, true),
          c("assets", false, true),
          c("commands", false, true),
          c("Admin VC", true, true),
        ],
      },
      {
        title: "Information",
        locked: false,
        channels: [
          c("welcome", false, false),
          c("announcements", false, false),
          c("resources", false, false),
          c("help", false, false),
        ],
      },
      {
        title: "Lounge",
        locked: false,
        channels: [
          c("general", false, false),
          c("memes", false, false),
          c("media", false, false),
          c("off-topic", false, false),
          c("assign", false, false),
        ],
      },
      {
        title: "Voice Chat",
        locked: false,
        channels: [c("General", true, false), c("Class", true, false), c("AFK", true, false)],
      },
      {
        title: "STEM",
        locked: false,
        channels: [
          c("science", false, false),
          c("technology", false, false),
          c("engineering", false, false),
          c("mathematics", false, false),
        ],
      },
      {
        title: "Business",
        locked: false,
        channels: [
          c("finance", false, false),
          c("marketing", false, false),
          c("management", false, false),
          c("entrepreneurship", false, false),
        ],
      },
      {
        title: "Arts & Design",
        locked: false,
        channels: [
          c("visual-arts", false, false),
          c("performing-arts", false, false),
          c("media", false, false),
          c("graphic-design", false, false),
        ],
      },
      {
        title: "Humanities",
        locked: false,
        channels: [
          c("history", false, false),
          c("literature", false, false),
          c("philosophy", false, false),
          c("social-studies", false, false),
        ],
      },
      {
        title: "Language",
        locked: false,
        channels: [c("english", false, false), c("foreign-languages", false, false), c("linguistics", false, false)],
      },
      {
        title: "Health & Medicine",
        locked: false,
        channels: [
          c("nursing", false, false),
          c("biology", false, false),
          c("psychology", false, false),
          c("public-health", false, false),
        ],
      },
      {
        title: "Computer Science",
        locked: false,
        channels: [
          c("programming", false, false),
          c("IT", false, false),
          c("cybersecurity", false, false),
          c("AI", false, false),
        ],
      },
      {
        title: "Education",
        locked: false,
        channels: [
          c("teaching", false, false),
          c("child-development", false, false),
          c("education-leadership", false, false),
        ],
      },
      {
        title: "Law & Political Science",
        locked: false,
        channels: [
          c("law", false, false),
          c("criminology", false, false),
          c("international-relations", false, false),
          c("public-policy", false, false),
        ],
      },
      {
        title: "Sports & Physical Education",
        locked: false,
        channels: [c("kinesiology", false, false), c("coaching", false, false), c("sports-management", false, false)],
      },
      {
        title: "Performing Arts",
        locked: false,
        channels: [c("music", false, false), c("theater", false, false), c("dance", false, false), c("film-production", false, false)],
      },
      {
        title: "Architecture & Design",
        locked: false,
        channels: [
          c("interior", false, false),
          c("landscape", false, false),
          c("industrial", false, false),
          c("urban-planning", false, false),
        ],
      },
      {
        title: "Media & Communication",
        locked: false,
        channels: [c("journalism", false, false), c("film", false, false), c("broadcasting", false, false)],
      },
      { title: "Extras", locked: false, channels: EDU_EXTRAS },
    ],

    startup: [
      {
        title: "Headquarters",
        locked: false,
        channels: [
          c("lounge", false, false),
          c("blueprints", false, false),
          c("documentation", false, false),
          c("launch-announcements", false, false),
          c("event-calendar", false, false),
          c("dev-console", false, false),
          c("polls", false, false),
          c("resources", false, false),
          c("company-handbook", false, false),
          c("Executive Room", true, false),
        ],
      },
      {
        title: "Collaboration Zone",
        locked: false,
        channels: [
          c("brainstorming", false, false),
          c("planning", false, false),
          c("suggestions", false, false),
          c("prototypes", false, false),
          c("testing", false, false),
          c("feedback", false, false),
          c("General", false, false),
          c("Coffee Corner", true, false),
          c("Meeting", true, false),
          c("AFK", true, false),
        ],
      },
      {
        title: "Core Operations",
        locked: false,
        channels: [
          c("founders-and-leadership", false, false),
          c("legal-and-compliance", false, false),
          c("finance-and-accounting", false, false),
        ],
      },
      {
        title: "Design & Branding",
        locked: false,
        channels: [c("ui", false, false), c("brand-identity", false, false), c("branding", false, false)],
      },
      {
        title: "Marketing & Growth",
        locked: false,
        channels: [
          c("social-media", false, false),
          c("seo", false, false),
          c("ads", false, false),
          c("community", false, false),
          c("analytics", false, false),
        ],
      },
      {
        title: "Sales & Customer",
        locked: false,
        channels: [
          c("sales", false, false),
          c("support", false, false),
          c("partnerships", false, false),
          c("retention", false, false),
        ],
      },
      {
        title: "Funding & Investment",
        locked: false,
        channels: [
          c("investors", false, false),
          c("budgeting", false, false),
          c("revenue", false, false),
          c("forecasting", false, false),
        ],
      },
      {
        title: "Planning & Strategy",
        locked: false,
        channels: [c("goals", false, false), c("research", false, false), c("competition", false, false), c("risk", false, false)],
      },
      {
        title: "Tech Infrastructure",
        locked: false,
        channels: [c("devops", false, false), c("security", false, false), c("automation", false, false), c("bugs", false, false)],
      },
      { title: "Extras", locked: false, channels: STARTUP_EXTRAS },
    ],

    private: [
      {
        title: "Important",
        locked: false,
        channels: [
          c("welcome", false, false),
          c("announcements", false, false),
          c("rules", false, false),
          c("polls", false, false),
          c("resources", false, false),
        ],
      },
      {
        title: "General",
        locked: false,
        channels: [
          c("general", false, false),
          c("off-topic", false, false),
          c("memes", false, false),
          c("art", false, false),
          c("media", false, false),
          c("edits", false, false),
          c("feedback", false, false),
          c("cmd", false, false),
        ],
      },
      {
        title: "Voice Chat",
        locked: false,
        channels: [
          c("Lounge", true, false),
          c("Game Night", true, false),
          c("Duo #1", true, false),
          c("Duo #2", true, false),
          c("Squad #1", true, false),
          c("Squad #2", true, false),
          c("Crew Lounge", true, false),
          c("Stream", true, false),
          c("Music", true, false),
          c("AFK", true, false),
        ],
      },
      {
        title: "Extra Channels",
        locked: true,
        channels: [
          c("server-ideas", false, true),
          c("giveaway", false, true),
          c("links", false, true),
          c("partnerships", false, true),
          c("muted-users", false, true),
          c("bye-bye", false, true),
          c("tools-and-apps", false, true),
          c("monthly-highlights", false, true),
          c("editing-room", false, true),
          c("live-feedback", false, true),
          c("logs", false, true),
          c("admin", false, true),
          c("team-up", false, true),
          c("appeals", false, true),
          c("coffee-chat", false, true),
          c("watch-party", false, true),
          c("plot-ideas", false, true),
          c("irl-stuff", false, true),
          c("updates", false, true),
          c("questions", false, true),
          c("suggestions", false, true),
        ],
      },
      {
        title: "Private",
        locked: true,
        channels: [c("Private VC", true, true), c("Judgement VC", true, true)],
      },
    ],
  };
})(typeof window !== "undefined" ? window : this);
