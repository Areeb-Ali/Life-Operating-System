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
  // `rec` = recommended max hours/day. Going over costs Balance Score points
  // (awareness, not punishment). Entertainment never grows.
  entertainment: [
    { key: "instagram", label: "Instagram",         icon: "📸", rec: 0.5 },
    { key: "games",     label: "Games",             icon: "🎮", rec: 0.5 },
    { key: "media",     label: "Netflix / YouTube", icon: "📺", rec: 0.75 },
  ],
  entertainmentPenaltyPerHour: 3.5,   // Balance-Score points lost per hour over `rec`

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
