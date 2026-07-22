/* =========================================================================
   Life Operating System — CONFIG
   Change targets, priorities and coaching rules here without touching app.js
   ========================================================================= */
window.LOS_CONFIG = {

  // ---- The activities you track each day (hours) ----------------------
  // key must be unique. `productive:true` counts toward Productive Hours.
  activities: [
    { key: "study",      label: "Study (ACCA)",              productive: true,  icon: "📚" },
    { key: "job",        label: "Current Job (day job)",     productive: true,  icon: "💼" },
    { key: "jobUpgrade", label: "Job Upgrade (new-job hunt)",productive: true,  icon: "📈" },
    { key: "linkedin",   label: "LinkedIn (networking)",     productive: true,  icon: "🔗" },
    { key: "bots",       label: "Bot Building",              productive: true,  icon: "🤖" },
    { key: "reading",    label: "Book Reading",              productive: true,  icon: "📖" },
    { key: "exercise",   label: "Exercise",                  productive: true,  icon: "🏃" },
    { key: "family",     label: "Family Time",               productive: false, icon: "👨‍👩‍👧" },
  ],

  // ---- Entertainment (tracked separately, treated as "time waste") ----
  entertainment: [
    { key: "instagram", label: "Instagram",       icon: "📸" },
    { key: "games",     label: "Games",           icon: "🎮" },
    { key: "media",     label: "Netflix / YouTube", icon: "📺" },
  ],

  // ---- Your priority order (1 = most important) -----------------------
  // Highest priority first. Drives the priority check AND the balance score.
  priorities: ["study", "job", "bots", "jobUpgrade", "linkedin", "exercise", "reading", "family"],

  // ---- Daily targets (hours) used for goals & balance score ----------
  // A target is "what a full-marks day looks like" for that activity.
  targets: {
    study: 4,          // ACCA — your #1 priority
    job: 6,
    bots: 2,
    jobUpgrade: 1,
    linkedin: 0.5,
    exercise: 0.75,    // 45 min
    reading: 0.5,
    family: 1,
    entertainment: 2,  // max recommended total per day
    sleepMin: 8,
    sleepMax: 9,
  },

  // ---- Life Balance Score (out of 100) --------------------------------
  // Points follow your priority order: higher priority = more points.
  // Keys must match the activity keys above (plus sleep & mood). Must total 100.
  balanceWeights: {
    study:      25,   // 1. ACCA
    job:        18,   // 2. Current Job
    bots:       13,   // 3. Bots
    jobUpgrade: 10,   // 4. Job Upgrade
    linkedin:    7,   // 5. LinkedIn
    exercise:    6,   // 6. Exercise
    reading:     5,   // 7. Book Reading
    family:      4,   // 8. Family Time
    sleep:       7,   // health baseline
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
