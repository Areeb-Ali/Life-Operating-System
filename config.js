/* =========================================================================
   Life Operating System — CONFIG
   Change targets, priorities and coaching rules here without touching app.js
   ========================================================================= */
window.LOS_CONFIG = {

  // ---- The activities you track each day (hours) ----------------------
  // key must be unique. `productive:true` counts toward Productive Hours.
  activities: [
    { key: "study",      label: "Study (ACCA)",               productive: true,  icon: "📚" },
    { key: "job",        label: "Current Job (day job)",      productive: true,  icon: "💼" },
    { key: "jobUpgrade", label: "Job Upgrade (new-job hunt)", productive: true,  icon: "📈" },
    { key: "linkedin",   label: "LinkedIn (posting & brand)", productive: true,  icon: "🔗" },
    { key: "bots",       label: "Bot Building",               productive: true,  icon: "🤖" },
    { key: "exercise",   label: "Exercise",                   productive: true,  icon: "🏃" },
    { key: "reading",    label: "Book Reading",               productive: true,  icon: "📖" },
    { key: "family",     label: "Family Time",                productive: false, icon: "👨‍👩‍👧" },
  ],

  // ---- Entertainment (tracked separately, treated as "time waste") ----
  // Penalty applies ONLY to the day's TOTAL entertainment over the overall cap
  // (targets.entertainment) — not per app. Awareness, not punishment. Never grows.
  entertainment: [
    { key: "instagram", label: "Instagram",         icon: "📸" },
    { key: "games",     label: "Games",             icon: "🎮" },
    { key: "media",     label: "Netflix / YouTube", icon: "📺" },
  ],
  entertainmentPenaltyPerHour: 3.5,   // Balance-Score points lost per hour of TOTAL over the cap

  // ---- Your priority order (1 = most important) -----------------------
  // Highest priority first. Drives the priority check AND the balance score.
  // LinkedIn sits high on purpose: it is POSTING/brand-building (funding for bots,
  // visibility for jobs) — high leverage for very little time. It is not scrolling.
  priorities: ["study", "job", "jobUpgrade", "linkedin", "bots", "exercise", "reading", "family"],

  // ---- Daily targets (hours) used for goals & balance score ----------
  // A target is "what a full-marks day looks like" for that activity.
  // Kept REALISTIC on purpose: an unreachable target makes the score demotivating.
  targets: {
    study: 4,          // ACCA — your #1 priority
    job: 2,            // 25k PKR job — 2h is all it deserves, not 6h
    jobUpgrade: 1,
    linkedin: 0.5,     // 30 min of posting/engaging, not feed-scrolling
    bots: 2,
    exercise: 0.5,     // 30 min FLOOR — fuel for everything above, never zero
    reading: 0.33,     // 20 min
    family: 1,
    entertainment: 2,  // max recommended total per day
    sleepMin: 8,
    sleepMax: 9,
  },

  // ---- Weekend relax mode ---------------------------------------------
  // Saturday & Sunday are for recharging. Targets shrink (so full points come
  // easily) and the entertainment penalty is switched off (points never cut).
  weekend: {
    enabled: true,
    days: [0, 6],            // 0 = Sunday, 6 = Saturday
    targetFactor: 0.5,       // weekend targets = half of the weekday target...
    keepTopPriorities: 2,    // ...EXCEPT the top 2 priorities (ACCA & Current Job)
                             // which stay at full target even on weekends.
    entertainmentPenalty: false,  // false = no entertainment penalty on weekends
  },

  // ---- Daily improvement: targets grow a little every day -------------
  // Each day your target for every PRODUCTIVE activity is 1% higher than the
  // day before — whether or not you hit yesterday's. Small, compounding growth.
  // Entertainment and sleep never grow (you don't want to increase those).
  improvement: {
    enabled: true,
    rate: 0.01,          // +1% each PERIOD, compounding
    period: "week",      // "week" or "day"
    startDate: "auto",   // "auto" = your very first logged day (grows from day one of your data)
    maxMultiplier: 2.5,  // guardrail: a target never grows past 2.5x its base.
                         // At 1%/week the cap is reached in ~92 weeks. null = grow forever.
  },

  // ---- ACCA finish-line goal (drives the Future Projection) -----------
  // ---- Your job role: Product Manager (for daily job guidance + appraisal) ----
  // The AI suggests daily tasks from these categories, and you log what you did
  // per category so you have a record for your performance appraisal.
  jobRole: {
    enabled: true,
    title: "Product Manager — crypto app",
    categories: [
      { key: "strategy",   label: "Product Strategy",       weight: 30, icon: "🧭",
        tasks: ["Competitor research", "Crypto market trends", "User feedback analysis", "New feature ideas", "Decide what NOT to build"] },
      { key: "execution",  label: "Product Execution",      weight: 25, icon: "🛠️",
        tasks: ["Write feature requirements", "Answer developer questions", "Discuss backend logic", "Feature testing", "Identify bugs", "Release planning"] },
      { key: "ux",         label: "User Experience",        weight: 15, icon: "🎨",
        tasks: ["Improve UI", "Review the user journey", "Improve onboarding", "Remove friction"] },
      { key: "growth",     label: "Growth & Marketing",     weight: 15, icon: "📣",
        tasks: ["ASO ideas", "Review marketing content", "Keywords", "Feature announcements", "Retention ideas"] },
      { key: "innovation", label: "Innovation & Research",  weight: 15, icon: "🔬",
        tasks: ["AI research", "Crypto research", "New products", "Automation ideas", "Spot market gaps"] },
    ],
  },

  // ---- Income goal: 50k PKR/month by November ------------------------
  // NOTE: this is a personal planning tool, not financial advice. Trading
  // figures are the user's own estimates; profits are never guaranteed.
  incomeGoal: {
    enabled: true,
    currency: "PKR",
    target: 50000,            // monthly income target
    current: 25000,           // current monthly income (the day job)
    deadline: "2026-11-01",   // want to reach the target by November
    usdToPkr: 278,            // approx rate (update as needed)
    paths: [
      { key: "job", label: "Current Job", icon: "💼", now: 25000, plan: 25000,
        reliability: "stable", feeds: "job",
        note: "Your steady base. Keep it, don't over-invest time — 2h/day is enough for a 25k job." },
      { key: "jobUpgrade", label: "Job Upgrade → 50k role", icon: "📈", now: 0, plan: 50000,
        reliability: "primary · most reliable", feeds: "jobUpgrade",
        note: "A 50k salary role is normal in your field. This path ALONE hits the target and replaces the 25k job. Powered by your tracked Job-Upgrade hours: applications, interviews, skills." },
      { key: "trading", label: "Trading — GOAT funded $2500", icon: "📊", now: 0, plan: 27800,
        reliability: "uncertain · not guaranteed",
        note: "Your estimate: ~4%/mo on $2500 = $100 ≈ 27,800 PKR (before any prop-firm profit split). Low time (swing setups, ~1 trade/week); realistically ramps from ~3 months out. This is a plan, NOT financial advice — trading profit is never guaranteed." },
      { key: "bots", label: "Bots — sell / services", icon: "🤖", now: 0, plan: 0,
        reliability: "long-term upside", feeds: "bots",
        note: "Future income (sell products/services) AND they make your trading more effective. Not counted in the November target — treat as bonus upside. Powered by your tracked Bot hours." },
    ],
  },

  accaGoal: {
    totalHours: 2500,    // total study hours to finish ACCA incl. Foundations — the real target
    targetYears: 2.5,    // you want to be done in 2.5 years — the manager plans around THIS
    currentPaper: "FBT", // the paper you're studying now (changes every few weeks, not daily)
    examDate: null,      // leave null until you actually BOOK an exam. While null, the manager
                         // plans by your finish-line pace instead of a countdown.
  },

  // ---- Life Balance Score (out of 100) --------------------------------
  // Points follow your priority order: higher priority = more points.
  // Keys must match the activity keys above (plus sleep & mood). Must total 100.
  balanceWeights: {
    study:      25,   // 1. ACCA
    job:        15,   // 2. Current Job
    jobUpgrade: 12,   // 3. Job Upgrade
    linkedin:   10,   // 4. LinkedIn (posting/brand)
    bots:        9,   // 5. Bots
    exercise:    7,   // 6. Exercise
    reading:     5,   // 7. Book Reading
    family:      4,   // 8. Family Time
    sleep:       8,   // health baseline
    mood:        5,   // how the day actually felt
  },

  // ---- Thresholds the AI Coach reacts to ------------------------------
  coach: {
    sleepHighWarn: 10,      // sleeping more than this = warning
    instagramGuilt: 3,      // Instagram over this many hours = guilt pattern
    studyDropDays: 3,       // ACCA missed this many recent days = gentle reminder
    entertainmentWarn: 3,   // total entertainment over this = notice
    goodDayNeedsStudy: true // "if ACCA done, day counts as a success"
  },

  // ---- Coaching philosophy (drives the tone of every message) ---------
  // These are YOUR rules. The coach never breaks them.
  philosophy: {
    topPriorityLabel: "ACCA",
    neverShame: true,
    focusWeeklyAverage: true,
    accaBeatsMoney: true,
    overworksBots: true,
    wastesWhenTired: true,
  },
};
