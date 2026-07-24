/* =========================================================================
   Life Operating System — app.js
   All logic: storage, calculations, AI coach, achievements, rendering.
   ========================================================================= */
(() => {
  const CFG = window.LOS_CONFIG;
  const KEY = "los_entries_v1";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ----------------------------- Storage ----------------------------- */
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  };
  const save = (data) => localStorage.setItem(KEY, JSON.stringify(data));
  let DB = load(); // { "2026-07-17": {entry}, ... }

  /* ----------------------------- Date utils -------------------------- */
  // All date math is done in UTC so it never drifts by a day across timezones.
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const fmtDate  = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB",
                    { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const dayName  = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const addDays  = (s, n) => { const [y,m,d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m-1, d)); dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0,10); };
  const round1   = (n) => Math.round(n * 10) / 10;
  const daysBetween = (a, b) => { const p = s => { const [y,m,d] = s.split("-").map(Number); return Date.UTC(y, m-1, d); };
    return Math.round((p(b) - p(a)) / 86400000); };
  const hm = (h) => {                       // 3.5 -> "3h 30m"
    const H = Math.floor(h); const M = Math.round((h - H) * 60);
    return M ? `${H}h ${M}m` : `${H}h`;
  };

  /* -------- Daily improvement: targets grow 1%/day (compounding) ------- */
  const growKeys = new Set(CFG.activities.map(a => a.key)); // only productive activities grow
  const growthStart = () => {
    const g = CFG.improvement;
    if (g && g.startDate && g.startDate !== "auto") return g.startDate;
    const rows = entArr();                      // "auto" → your first logged day
    return rows.length ? rows[0].date : todayStr();
  };
  const growthMultiplier = (dateStr) => {
    const g = CFG.improvement;
    if (!g || !g.enabled || !g.rate) return 1;
    const days = Math.max(0, daysBetween(growthStart(), dateStr || todayStr()));
    const units = g.period === "day" ? days : days / 7;   // default: per week
    let mult = Math.pow(1 + g.rate, units);
    if (g.maxMultiplier) mult = Math.min(mult, g.maxMultiplier);
    return mult;
  };
  const growthPeriodWord = () => (CFG.improvement?.period === "day" ? "day" : "week");

  /* -------- Weekend relax mode: lighter targets, no entertainment cut --- */
  const isWeekend = (dateStr) => {
    const w = CFG.weekend;
    if (!w || !w.enabled) return false;
    const day = new Date((dateStr || todayStr()) + "T00:00:00Z").getUTCDay();
    return (w.days || [0,6]).includes(day);
  };
  // Top priorities keep their full target even on weekends; the rest get lighter.
  const weekendKeepSet = () => new Set((CFG.priorities || []).slice(0, CFG.weekend?.keepTopPriorities ?? 0));
  const weekendFactor = (dateStr, key) => {
    if (!isWeekend(dateStr)) return 1;
    if (key && weekendKeepSet().has(key)) return 1;
    return CFG.weekend.targetFactor ?? 1;
  };
  // effective target for an activity on a given date (grows over time, lighter on
  // weekends; entertainment/sleep flat)
  const targetFor = (key, dateStr) => {
    const base = CFG.targets[key] || 0;
    return growKeys.has(key) ? base * growthMultiplier(dateStr) * weekendFactor(dateStr, key) : base;
  };

  /* ----------------------- Derived per-entry ------------------------- */
  const entArr  = () => Object.values(DB).sort((a,b) => a.date < b.date ? -1 : 1);
  const productiveHours = (e) => CFG.activities.filter(a => a.productive)
                                    .reduce((s,a) => s + (+e[a.key] || 0), 0);
  const entertainmentHours = (e) => CFG.entertainment
                                    .reduce((s,a) => s + (+(e.ent?.[a.key]) || 0), 0);

  // Entertainment awareness: points are lost ONLY when the day's TOTAL entertainment
  // goes over the overall daily cap — not per individual item.
  const entertainmentPenalty = (e) => {
    const per = CFG.entertainmentPenaltyPerHour || 0;
    const cap = CFG.targets.entertainment || 0;
    const used = entertainmentHours(e);
    // Weekends are relax days — no penalty if disabled for weekends.
    const relaxed = isWeekend(e.date) && CFG.weekend?.entertainmentPenalty === false;
    const over = relaxed ? 0 : Math.max(0, used - cap);
    return { total: round1(over * per), used: round1(used), cap, over: round1(over), relaxed };
  };

  // average of a numeric getter over the last N days that HAVE entries
  const avgOver = (getter, days) => {
    const start = addDays(todayStr(), -(days - 1));
    const rows = entArr().filter(e => e.date >= start && e.date <= todayStr());
    if (!rows.length) return 0;
    return rows.reduce((s,e) => s + getter(e), 0) / rows.length;
  };
  const avgAll = (getter) => {
    const rows = entArr(); if (!rows.length) return 0;
    return rows.reduce((s,e) => s + getter(e), 0) / rows.length;
  };
  const sumAll = (getter) => entArr().reduce((s,e) => s + getter(e), 0);

  /* ===================================================================
     LIFE BALANCE SCORE (out of 100)
     =================================================================== */
  // Generic over CFG.balanceWeights: every key is an activity key (scored against
  // its daily target), except `sleep` (optimal window) and `mood` (out of 10).
  // Because scores are computed live from the logged hours, changing the weights
  // in config.js automatically re-scores ALL past days too.
  const balanceBreakdown = (e) => {
    const W = CFG.balanceWeights, T = CFG.targets;
    const out = {};
    for (const [key, max] of Object.entries(W)) {
      if (key === "sleep") {
        const sl = +e.sleep || 0;
        if (sl >= T.sleepMin && sl <= T.sleepMax) out.sleep = round1(max);
        else { const dev = sl < T.sleepMin ? T.sleepMin - sl : sl - T.sleepMax;
               out.sleep = round1(Math.max(0, max * (1 - dev / 3))); }
      } else if (key === "mood") {
        out.mood = round1(((+e.mood || 0) / 10) * max);
      } else {
        const target = targetFor(key, e.date) || 1;
        out[key] = round1(Math.max(0, Math.min(1, (+e[key] || 0) / target)) * max);
      }
    }
    return out;
  };
  const balanceScore = (e) => {
    const positive = Object.values(balanceBreakdown(e)).reduce((a,b)=>a+b,0);
    return Math.max(0, positive - entertainmentPenalty(e).total);   // penalty = awareness
  };
  // label + max points for each balance component, in priority order
  const balanceParts = () => Object.entries(CFG.balanceWeights).map(([key, max]) => {
    const act = CFG.activities.find(a => a.key === key);
    return { key, max, label: act ? act.label : (key === "sleep" ? "Sleep" : "Mood") };
  });

  /* ===================================================================
     ACCA FINISH-LINE PROJECTION (2500h target, current pace)
     =================================================================== */
  const accaProjection = () => {
    const G = CFG.accaGoal || {};
    const accaAvg = avgAll(e => +e.study||0);      // per-day over all logged data
    const total   = sumAll(e => +e.study||0);
    const perYear = accaAvg * 365;
    const remaining = Math.max(0, (G.totalHours||0) - total);
    const yearsLeft = perYear > 0 ? remaining / perYear : Infinity;
    const requiredPerDay = (G.totalHours||0) / ((G.targetYears||1) * 365);
    let pace, paceCls;
    if (accaAvg <= 0)                        { pace = "No data yet"; paceCls = "flat"; }
    else if (yearsLeft <= G.targetYears)     { pace = "Excellent — ahead of target"; paceCls = "up"; }
    else if (yearsLeft <= G.targetYears*1.25){ pace = "On track"; paceCls = "up"; }
    else if (yearsLeft <= G.targetYears*1.6) { pace = "Slightly behind"; paceCls = "down"; }
    else                                     { pace = "Behind — needs a lift"; paceCls = "down"; }
    const daysToExam = G.examDate ? daysBetween(todayStr(), G.examDate) : null;
    return { ...G, accaAvg, total, perYear, remaining, yearsLeft, requiredPerDay, pace, paceCls, daysToExam };
  };

  /* ===================================================================
     PRIORITY CHECK  (uses CFG.priorities order)
     =================================================================== */
  const priorityCheck = (e) => {
    return CFG.priorities.map((key, i) => {
      const act = [...CFG.activities].find(a => a.key === key);
      const val = +e[key] || 0;
      const done = val > 0;
      // compare with the NEXT lower priority — higher priority should get >= time
      let status = "ok", note = "On track";
      if (!done) { status = "no"; note = "Not touched today"; }
      const lower = CFG.priorities[i+1];
      if (lower) {
        const lowerVal = +e[lower] || 0;
        const lowerAct = CFG.activities.find(a => a.key === lower);
        if (done && lowerVal > val) {
          status = "bad";
          note = `Less than ${lowerAct?.label} (${hm(lowerVal)})`;
        }
      }
      return { key, label: act?.label || key, icon: act?.icon || "•", val, status, note, rank: i+1 };
    });
  };

  /* ===================================================================
     AI COACH  — learns from the user's OWN history, never shames.
     Encodes the philosophy from CFG.
     =================================================================== */
  const coachMessages = () => {
    const out = [];               // {type:'good|warn|alert|info', title, text}
    const rows = entArr();
    const today = DB[todayStr()];
    const C = CFG.coach, T = CFG.targets;

    if (!rows.length) {
      out.push({ type:"info", icon:"👋", title:"Welcome to your Life OS",
        text:"Fill in today's entry and I'll start learning your patterns. I give advice based on <b>your</b> history — not generic tips." });
      return out;
    }

    /* --- 1. ACCA is the top priority: was it done today? ------------- */
    if (today) {
      const study = +today.study || 0;
      if (study > 0) {
        out.push({ type:"good", icon:"✅", title:"ACCA done today — that already makes today a success",
          text:`You logged ${hm(study)} of ACCA. Even if the rest of the day was quiet, your #1 priority moved forward. That's the win that matters.` });
      }
    }

    /* --- 2. ACCA skipped for several recent days -------------------- */
    const recent = rows.slice(-C.studyDropDays);
    if (recent.length >= C.studyDropDays && recent.every(e => (+e.study||0) === 0)) {
      out.push({ type:"alert", icon:"📚", title:`ACCA has slipped ${C.studyDropDays} days in a row`,
        text:`No shame here — life gets busy. But ACCA is your long-term goal, the one that outlasts any single job. Even 30 focused minutes tomorrow restarts the momentum. Want to make tomorrow a "study first" day?` });
    }

    /* --- 3. Sleep pattern learned from data ------------------------- */
    const bigSleep = rows.filter(e => (+e.sleep||0) > C.sleepHighWarn);
    if (bigSleep.length >= 2) {
      const pAfter = bigSleep.reduce((s,e)=>s+productiveHours(e),0)/bigSleep.length;
      const normal = rows.filter(e => (+e.sleep||0) >= T.sleepMin && (+e.sleep||0) <= T.sleepMax+1);
      const pNormal = normal.length ? normal.reduce((s,e)=>s+productiveHours(e),0)/normal.length : null;
      let txt = `On the ${bigSleep.length} days you slept over ${C.sleepHighWarn}h, your productive time averaged <b>${hm(pAfter)}</b>.`;
      if (pNormal && pNormal > pAfter) txt += ` On ${T.sleepMin}–${T.sleepMax}h nights it was <b>${hm(pNormal)}</b> — noticeably higher. Your body seems to run best around ${T.sleepMin}–${T.sleepMax} hours.`;
      out.push({ type:"warn", icon:"😴", title:"Watch the long sleeps", text: txt });
    }
    // today specific
    if (today && (+today.sleep||0) > C.sleepHighWarn) {
      out.push({ type:"warn", icon:"⏰", title:"You slept a lot today",
        text:`${hm(+today.sleep)} of sleep. Historically your productivity dips after ${C.sleepHighWarn}h. Aim for ${T.sleepMin}–${T.sleepMax}h tonight and see how tomorrow feels.` });
    }

    /* --- 4. Instagram / entertainment + tiredness ------------------- */
    if (today) {
      const ig = +(today.ent?.instagram) || 0;
      if (ig > C.instagramGuilt) {
        out.push({ type:"warn", icon:"📸", title:"Instagram ran long today",
          text:`${hm(ig)} on Instagram. You've told me you usually feel guilty past ${C.instagramGuilt}h — and it tends to happen when you're mentally tired, not lazy. That's a signal to rest properly, not to scroll. Tomorrow, try a real break instead.` });
      }
      const ent = entertainmentHours(today);
      if (ent > C.entertainmentWarn) {
        out.push({ type:"info", icon:"📺", title:"Entertainment above your line",
          text:`Total ${hm(ent)} today vs your ${hm(T.entertainment)} target. No guilt — just nudging the weekly average back down. One swapped hour into ACCA changes the whole week.` });
      }
    }
    // learned link: entertainment vs mood
    const highEnt = rows.filter(e => entertainmentHours(e) > C.entertainmentWarn && e.mood);
    if (highEnt.length >= 3) {
      const m = highEnt.reduce((s,e)=>s+(+e.mood||0),0)/highEnt.length;
      const lowEnt = rows.filter(e => entertainmentHours(e) <= T.entertainment && e.mood);
      const m2 = lowEnt.length ? lowEnt.reduce((s,e)=>s+(+e.mood||0),0)/lowEnt.length : null;
      if (m2 && m2 - m >= 0.8) {
        out.push({ type:"info", icon:"🔎", title:"A pattern in your data",
          text:`Your mood averages <b>${round1(m)}/10</b> on heavy-entertainment days vs <b>${round1(m2)}/10</b> on lighter ones. The scrolling isn't making the tiredness better. Worth remembering next time you reach for the phone.` });
      }
    }

    /* --- 5. Bots: user overworks because they enjoy it -------------- */
    if (today) {
      const bots = +today.bots || 0, study = +today.study || 0;
      if (bots > study && bots >= 2) {
        out.push({ type:"warn", icon:"🤖", title:"Bots beat ACCA today",
          text:`${hm(bots)} on bots vs ${hm(study)} on ACCA. Building bots is genuinely valuable and I know you love it — but it's priority #${CFG.priorities.indexOf("bots")+1}, and it's the thing most likely to quietly crowd out your #1. Keep the joy, just cap it so ACCA goes first tomorrow.` });
      }
    }
    const botAvg7 = avgOver(e => +e.bots||0, 7), studyAvg7 = avgOver(e => +e.study||0, 7);
    if (botAvg7 > studyAvg7 && rows.length >= 4) {
      out.push({ type:"alert", icon:"⚖️", title:"This week: bots are outpacing ACCA",
        text:`7-day averages — bots <b>${hm(botAvg7)}/day</b>, ACCA <b>${hm(studyAvg7)}/day</b>. Money and cool projects matter, but they should never replace ACCA. Let's flip these two around this week.` });
    }

    /* --- 6. Positive momentum on the weekly average ---------------- */
    const p7 = avgOver(productiveHours, 7), p30 = avgOver(productiveHours, 30);
    if (rows.length >= 5 && p7 > p30 && p30 > 0) {
      out.push({ type:"good", icon:"📈", title:"Your weekly average is climbing",
        text:`Last 7 days: <b>${hm(p7)}/day</b> vs 30-day <b>${hm(p30)}/day</b>. Progress isn't about one perfect day — it's this line going up. It is. Keep going.` });
    }

    /* --- 7. Study target coaching (gentle, weekly) ----------------- */
    if (rows.length >= 3) {
      const s7 = avgOver(e => +e.study||0, 7);
      if (s7 < T.study) {
        const need = (T.study - s7) * 60;
        out.push({ type:"info", icon:"🎯", title:"ACCA weekly nudge",
          text:`You're averaging ${hm(s7)}/day of ACCA against a ${hm(T.study)} target. That's just <b>+${Math.round(need)} min/day</b> — one focused session. Small, weekly, sustainable. No need to be perfect today.` });
      }
    }

    if (!out.length) {
      out.push({ type:"good", icon:"🌱", title:"Steady and balanced",
        text:"Nothing to flag today — your priorities and rest look balanced. Keep the weekly average steady." });
    }
    return out;
  };

  /* ===================================================================
     ACHIEVEMENTS
     =================================================================== */
  // longest run of consecutive calendar days where pred(entry) is true
  const longestStreak = (pred) => {
    const rows = entArr(); let best = 0, cur = 0, prev = null;
    for (const e of rows) {
      if (pred(e)) { cur = (prev && addDays(prev,1) === e.date) ? cur + 1 : 1; best = Math.max(best, cur); }
      else cur = 0;
      prev = e.date;
    }
    return best;
  };
  const consecutiveStudyDays = () => longestStreak(e => (+e.study||0) > 0);
  // ongoing streak: consecutive days (ending at the most recent entry) where pred holds
  const currentStreak = (pred) => {
    const rows = entArr(); if (!rows.length) return 0;
    let streak = 0, expected = rows[rows.length - 1].date;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].date !== expected || !pred(rows[i])) break;
      streak++; expected = addDays(expected, -1);
    }
    return streak;
  };

  const achievements = () => {
    const rows       = entArr();
    const totalACCA  = sumAll(e => +e.study||0);
    const totalBot   = sumAll(e => +e.bots||0);
    const totalUpg   = sumAll(e => +e.jobUpgrade||0);
    const totalRead  = sumAll(e => +e.reading||0);
    const totalExer  = sumAll(e => +e.exercise||0);
    const studyStreak = longestStreak(e => (+e.study||0) > 0);
    const exerStreak  = longestStreak(e => (+e.exercise||0) > 0);
    const moodStreak  = longestStreak(e => (+e.mood||0) >= 8);
    const lightEntStreak = longestStreak(e => entertainmentHours(e) <= CFG.targets.entertainment);
    const scoreStreak = longestStreak(e => balanceScore(e) >= 70);
    const bestDay    = Math.max(0, ...rows.map(productiveHours));
    const bestBal    = Math.max(0, ...rows.map(balanceScore));
    const avg7       = avgOver(productiveHours, 7);
    const avg30      = avgOver(productiveHours, 30);
    const days       = rows.length;

    const flag  = (emoji,name,cur,goal,unit,cat) => ({ emoji, name, cur: Math.min(cur,goal), goal, unit, cat, unlocked: cur >= goal });
    const once  = (emoji,name,ok,cat) => flag(emoji,name, ok?1:0, 1, "", cat);

    return [
      // 🔥 ACCA streaks — the core motivation ladder (includes the 70+ streak)
      flag("🔥","3-Day ACCA Streak",  studyStreak, 3,  "days","🔥 ACCA Streaks"),
      flag("🔥","7-Day ACCA Streak",  studyStreak, 7,  "days","🔥 ACCA Streaks"),
      flag("🔥","14-Day ACCA Streak", studyStreak, 14, "days","🔥 ACCA Streaks"),
      flag("📅","30-Day ACCA Streak", studyStreak, 30, "days","🔥 ACCA Streaks"),
      flag("🗓️","50-Day ACCA Streak", studyStreak, 50, "days","🔥 ACCA Streaks"),
      flag("👑","70-Day ACCA Streak", studyStreak, 70, "days","🔥 ACCA Streaks"),
      flag("💎","100-Day ACCA Streak",studyStreak, 100,"days","🔥 ACCA Streaks"),

      // 📚 ACCA hours
      flag("📗","25 Hours ACCA",   totalACCA, 25,  "h","📚 ACCA Hours"),
      flag("📘","50 Hours ACCA",   totalACCA, 50,  "h","📚 ACCA Hours"),
      flag("💯","100 Hours ACCA",  totalACCA, 100, "h","📚 ACCA Hours"),
      flag("📚","250 Hours ACCA",  totalACCA, 250, "h","📚 ACCA Hours"),
      flag("🎓","500 Hours ACCA",  totalACCA, 500, "h","📚 ACCA Hours"),
      flag("🏆","1000 Hours ACCA", totalACCA, 1000,"h","📚 ACCA Hours"),

      // 💼 Career (Job Upgrade kept separate from day job)
      flag("📈","10 Hours Job-Upgrade",  totalUpg, 10,  "h","💼 Career (Job Upgrade)"),
      flag("📈","25 Hours Job-Upgrade",  totalUpg, 25,  "h","💼 Career (Job Upgrade)"),
      flag("🚀","50 Hours Job-Upgrade",  totalUpg, 50,  "h","💼 Career (Job Upgrade)"),
      flag("🌠","100 Hours Job-Upgrade", totalUpg, 100, "h","💼 Career (Job Upgrade)"),

      // 🤖 Bots
      flag("🔧","25 Hours Bot",  totalBot, 25,  "h","🤖 Bots"),
      flag("🤖","100 Hours Bot", totalBot, 100, "h","🤖 Bots"),
      flag("🦾","250 Hours Bot", totalBot, 250, "h","🤖 Bots"),

      // 📖 Reading & Health
      flag("📖","10 Hours Reading",   totalRead, 10, "h","📖 Reading & Health"),
      flag("📕","50 Hours Reading",   totalRead, 50, "h","📖 Reading & Health"),
      flag("💪","7-Day Exercise Streak", exerStreak, 7, "days","📖 Reading & Health"),
      flag("🏃","25 Hours Exercise",  totalExer, 25, "h","📖 Reading & Health"),

      // ⚡ Big days
      once("⚡","First 8-Hour Day",  bestDay >= 8,  "⚡ Big Days"),
      once("🚀","First 10-Hour Day", bestDay >= 10, "⚡ Big Days"),
      once("🔥","First 12-Hour Day", bestDay >= 12, "⚡ Big Days"),
      once("⚖️","A 90+ Balance Day", bestBal >= 90, "⚡ Big Days"),

      // 🌟 Consistency & momentum
      flag("✅","7 Days Logged",   days, 7,   "days","🌟 Consistency"),
      flag("📓","30 Days Logged",  days, 30,  "days","🌟 Consistency"),
      flag("📚","100 Days Logged", days, 100, "days","🌟 Consistency"),
      once("🌟","7-Day Avg Above 6h", days>=7 && avg7 > 6,  "🌟 Consistency"),
      once("💫","7-Day Avg Above 8h", days>=7 && avg7 > 8,  "🌟 Consistency"),
      once("🌈","30-Day Avg Above 6h",days>=30 && avg30 > 6,"🌟 Consistency"),

      // 🎯 Balance-Score streaks — a 70+ Life Balance Score on consecutive days
      flag("🎯","70+ Score · 3 Days",  scoreStreak, 3,  "days","🎯 Score Streaks (70+/day)"),
      flag("🎯","70+ Score · 7 Days",  scoreStreak, 7,  "days","🎯 Score Streaks (70+/day)"),
      flag("🏅","70+ Score · 15 Days", scoreStreak, 15, "days","🎯 Score Streaks (70+/day)"),
      flag("🏆","70+ Score · 30 Days", scoreStreak, 30, "days","🎯 Score Streaks (70+/day)"),

      // 🧘 Balance & wellbeing
      flag("😄","7-Day Good-Mood Streak (8+)", moodStreak, 7, "days","🧘 Balance & Wellbeing"),
      flag("🧘","7 Days Low-Entertainment",   lightEntStreak, 7, "days","🧘 Balance & Wellbeing"),
    ];
  };

  /* ===================================================================
     RENDERING
     =================================================================== */
  const toast = (msg) => {
    const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.add("hidden"), 2200);
  };

  const statTile = (label, value, unit, icon, delta) => `
    <div class="card stat">
      <div class="icon">${icon}</div>
      <div class="label">${label}</div>
      <div class="value">${value}<small>${unit||""}</small></div>
      ${delta ? `<div class="delta ${delta.cls}">${delta.txt}</div>` : ""}
    </div>`;

  /* Balance-score breakdown: shows exactly where today's points came from and
     what is still on the table — this is what you need to reach 70+. */
  function balanceCard(e) {
    if (!e) return `<div class="card" style="grid-column:1/-1">
      <h3>⚖️ Life Balance Score</h3>
      <div class="empty">Log today to see your score breakdown.</div></div>`;
    const bd = balanceBreakdown(e), total = balanceScore(e);
    const parts = balanceParts().map(p => ({ ...p, got: bd[p.key] || 0 }));
    const missing = parts.filter(p => p.max - p.got >= 1)
      .sort((a,b) => (b.max-b.got) - (a.max-a.got));
    const cls = total >= 70 ? "green" : total >= 50 ? "amber" : "red";
    const pen = entertainmentPenalty(e);
    const awareness = pen.total > 0 ? `
      <div class="callout alert" style="margin-top:16px"><div class="ci">📺</div>
        <div class="ctext"><div class="ctitle">Entertainment cost you −${pen.total} points today</div>
          Total entertainment <b>${hm(pen.used)}</b> · daily cap <b>${hm(pen.cap)}</b> · over by ${hm(pen.over)} → <span class="down">−${pen.total}</span>
          <div class="sub">This isn't punishment — it's awareness. Only the total over your cap counts; the points are recoverable tomorrow.</div>
        </div></div>` : "";
    const relaxBadge = isWeekend(e.date)
      ? `<span class="pill g" style="margin-left:10px">🌴 Relax day · ACCA &amp; Job stay full, rest lighter</span>` : "";
    return `<div class="card" style="grid-column:1/-1">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">⚖️ Life Balance Score — where your points came from${relaxBadge}</h3>
        <div><span class="score-big">${Math.round(total)}</span><span style="color:var(--muted)">/100</span></div>
      </div>
      <div class="bar ${cls}" style="margin:10px 0 18px"><i style="width:${total}%"></i></div>
      <div class="mini-grid">
        ${parts.map(p => `
          <div class="mini">
            <div class="ml">${p.label}</div>
            <div class="mv">${p.got}<span style="font-size:12px;color:var(--muted)">/${p.max}</span></div>
            <div class="bar ${p.got>=p.max?'green':''}" style="margin-top:6px;height:5px"><i style="width:${(p.got/p.max)*100}%"></i></div>
          </div>`).join("")}
      </div>
      ${total < 70 ? `<div class="callout info" style="margin-top:16px"><div class="ci">🎯</div>
        <div class="ctext"><div class="ctitle">To reach 70+ you need ${Math.ceil(70-total)} more points</div>
        Biggest gaps today: ${missing.slice(0,3).map(p=>`<b>${p.label}</b> (+${round1(p.max-p.got)} available)`).join(", ")}.
        <div class="sub">Points follow your priority order — ACCA is worth the most, so an hour there moves the score more than anywhere else.</div></div></div>`
      : `<div class="callout good" style="margin-top:16px"><div class="ci">🏆</div>
        <div class="ctext"><div class="ctitle">70+ day — excellent</div>This is exactly the kind of day that builds your score streaks.</div></div>`}
      ${awareness}
    </div>`;
  }

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    const el = $("#view-dashboard");
    const rows = entArr();
    const today = DB[todayStr()];
    const p7 = avgOver(productiveHours,7), p30 = avgOver(productiveHours,30);
    const deltaTxt = (a,b) => b ? (a>=b
        ? {cls:"up",  txt:`▲ ${hm(a-b)} vs 30-day avg`}
        : {cls:"down",txt:`▼ ${hm(b-a)} vs 30-day avg`}) : null;

    // rolling-average hero (the "most important feature")
    const rolling = `
      <div class="card" style="grid-column:1/-1">
        <h3>⭐ Last 7 Days — Rolling Average (what actually matters)</h3>
        <div class="mini-grid">
          <div class="mini"><div class="ml">Productive</div><div class="mv">${hm(p7)}</div></div>
          <div class="mini"><div class="ml">Study (ACCA)</div><div class="mv">${hm(avgOver(e=>+e.study||0,7))}</div></div>
          <div class="mini"><div class="ml">Bots</div><div class="mv">${hm(avgOver(e=>+e.bots||0,7))}</div></div>
          <div class="mini"><div class="ml">Job</div><div class="mv">${hm(avgOver(e=>+e.job||0,7))}</div></div>
          <div class="mini"><div class="ml">Entertainment</div><div class="mv">${hm(avgOver(entertainmentHours,7))}</div></div>
          <div class="mini"><div class="ml">Sleep</div><div class="mv">${hm(avgOver(e=>+e.sleep||0,7))}</div></div>
        </div>
      </div>`;

    // sparkline of last 14 productive days
    const last14 = rows.slice(-14);
    const maxP = Math.max(4, ...last14.map(productiveHours));
    const spark = last14.length ? `
      <div class="card" style="grid-column:1/-1">
        <h3>Productive Hours — last ${last14.length} days</h3>
        <div class="spark">
          ${last14.map(e=>`<i style="height:${Math.max(4,(productiveHours(e)/maxP)*100)}%" title="${fmtDate(e.date)}: ${hm(productiveHours(e))}"></i>`).join("")}
        </div>
      </div>` : "";

    const balToday = today ? balanceScore(today) : 0;

    // ACCA banner — exam countdown if an exam is booked, else finish-line pace
    const proj = accaProjection();
    const paper = proj.currentPaper ? `Currently on <b>${proj.currentPaper}</b>` : "";
    let examBanner = "";
    if (proj.daysToExam != null && proj.daysToExam >= 0) {
      const dte = proj.daysToExam;
      examBanner = `
        <div class="callout ${dte<=30?'alert':dte<=60?'warn':'info'}" style="margin-bottom:18px">
          <div class="ci">🎓</div>
          <div class="ctext"><div class="ctitle">ACCA exam in ${dte} day${dte===1?'':'s'} · ${fmtDate(proj.examDate)}</div>
          ${paper}<div class="sub">Ask the manager below: “What should I do now?”</div></div>
        </div>`;
    } else if (proj.accaAvg > 0) {
      examBanner = `
        <div class="callout ${proj.paceCls==='up'?'good':'warn'}" style="margin-bottom:18px">
          <div class="ci">🎓</div>
          <div class="ctext"><div class="ctitle">ACCA finish-line · ${proj.pace}</div>
          ${paper}${paper?" · ":""}At ${hm(proj.accaAvg)}/day you finish in ~${isFinite(proj.yearsLeft)?proj.yearsLeft.toFixed(1):"—"} yrs (target ${proj.targetYears}). Need <b>${hm(proj.requiredPerDay)}/day</b>.
          <div class="sub">No exam booked yet — the manager plans by your pace. Ask: “What should I do now?”</div></div>
        </div>`;
    }

    el.innerHTML = `
      <div class="page-head">
        <div class="page-title">Dashboard</div>
        <div class="page-sub">${today ? "Today's entry is logged ✓" : "No entry yet for today — head to Daily Input"} · ${fmtDate(todayStr())}</div>
      </div>
      ${examBanner}
      <div class="grid cols-4">
        ${statTile("Today's Productive", today?hm(productiveHours(today)):"—", "", "⚡", null)}
        ${statTile("Last 7 Days Avg", hm(p7), "/day", "📊", deltaTxt(p7,p30))}
        ${statTile("Last 30 Days Avg", hm(p30), "/day", "🗓️", null)}
        ${statTile("Balance Score Today", today?Math.round(balToday):"—", today?"/100":"", "⚖️", null)}
      </div>
      <div class="grid cols-4" style="margin-top:16px">
        ${statTile("ACCA Avg (7d)", hm(avgOver(e=>+e.study||0,7)), "/day", "📚", null)}
        ${statTile("Job Avg (7d)", hm(avgOver(e=>+e.job||0,7)), "/day", "💼", null)}
        ${statTile("Bot Avg (7d)", hm(avgOver(e=>+e.bots||0,7)), "/day", "🤖", null)}
        ${statTile("Sleep Avg (7d)", hm(avgOver(e=>+e.sleep||0,7)), "/day", "😴", null)}
      </div>
      <div class="grid" style="margin-top:16px">${rolling}</div>
      <div class="grid" style="margin-top:16px">${balanceCard(today)}</div>

      <div class="grid cols-2" style="margin-top:16px">
        <div class="card">
          <h3>🎯 Today's Priority Check</h3>
          ${today ? priorityCheck(today).map(p=>`
            <div class="prio-row">
              <div class="prio-left">
                <div class="prio-rank">${p.rank}</div>
                <div>${p.icon} ${p.label}<div class="hint">${hm(p.val)} logged</div></div>
              </div>
              <span class="pill ${p.status==='ok'?'ok':p.status==='no'?'no':'bad'}">${p.status==='ok'?'✓ '+p.note:p.status==='no'?'○ '+p.note:'⚠ '+p.note}</span>
            </div>`).join("") : `<div class="empty">Log today to see your priority check.</div>`}
        </div>
        <div class="card">
          <h3>🧠 AI Manager</h3>
          ${(() => { const m = coachMessages()[0];
             return `<div class="callout ${m.type}"><div class="ci">${m.icon}</div>
               <div class="ctext"><div class="ctitle">${m.title}</div>${m.text}</div></div>
               <div style="display:flex;gap:10px;flex-wrap:wrap">
                 <button class="btn" onclick="LOS.askNow()">⚡ What should I do now?</button>
                 <button class="btn secondary" onclick="LOS.go('coach')">Open manager →</button>
               </div>`; })()}
        </div>
      </div>
      <div class="grid" style="margin-top:16px">${spark}</div>`;
  }

  /* ---------- Daily Input ---------- */
  // Hours + Minutes input pair. Stored internally as decimal hours.
  const splitHM = (v) => { const t = +v || 0; return { h: Math.floor(t), m: Math.round((t - Math.floor(t)) * 60) }; };
  const minOpts = (sel) => [0,5,10,15,20,25,30,35,40,45,50,55]
    .map(m => `<option value="${m}" ${m===sel?"selected":""}>${m} min</option>`).join("");
  const hmInput = (id, val) => { const { h, m } = splitHM(val);
    return `<div class="hm-wrap">
      <input type="number" min="0" max="24" id="${id}_h" value="${val!=null&&val!==""?h:""}" placeholder="0" /><span class="hm-x">h</span>
      <select id="${id}_m">${minOpts(m)}</select>
    </div>`; };

  function renderDaily() {
    const el = $("#view-daily");
    const d = DB[todayStr()] || {};
    const actFields = CFG.activities.map(a => `
      <div class="field">
        <label>${a.icon} ${a.label} <span class="hint" style="margin:0;color:var(--accent)">🎯 ${hm(targetFor(a.key, todayStr()))}</span></label>
        ${hmInput("f_"+a.key, d[a.key])}
      </div>`).join("");
    const entFields = CFG.entertainment.map(a => `
      <div class="field">
        <label>${a.icon} ${a.label}</label>
        ${hmInput("e_"+a.key, d.ent?.[a.key])}
      </div>`).join("");

    el.innerHTML = `
      <div class="page-head">
        <div class="page-title">Daily Input</div>
        <div class="page-sub">One quick fill each day. Everything below is optional — log what you can.${isWeekend(todayStr())?` <span style="color:var(--green)">🌴 Relax day — ACCA &amp; Job targets stay full, everything else is lighter, no entertainment penalty.</span>`:""}</div>
      </div>
      <div class="card">
        <div class="form-grid">
          <div class="field">
            <label>📆 Date</label>
            <input type="date" id="f_date" value="${todayStr()}" />
          </div>
          <div class="field">
            <label>😴 Sleep</label>
            ${hmInput("f_sleep", d.sleep)}
          </div>

          <div class="section-label">Productive & life activities — enter hours & minutes</div>
          ${actFields}

          <div class="section-label">Entertainment — hours & minutes</div>
          ${entFields}

          <div class="section-label">How you felt</div>
          <div class="field">
            <label>🙂 Mood (1–10)</label>
            <div class="range-wrap"><input type="range" min="1" max="10" id="f_mood" value="${d.mood??7}" oninput="this.nextElementSibling.textContent=this.value"><span class="range-val">${d.mood??7}</span></div>
          </div>
          <div class="field">
            <label>⚡ Energy (1–10)</label>
            <div class="range-wrap"><input type="range" min="1" max="10" id="f_energy" value="${d.energy??7}" oninput="this.nextElementSibling.textContent=this.value"><span class="range-val">${d.energy??7}</span></div>
          </div>
          <div class="field field-full">
            <label>📝 Notes</label>
            <textarea id="f_notes" placeholder="Anything about today...">${d.notes??""}</textarea>
          </div>

          <div class="section-label">🌙 Night Reflection (coach asks — answer if you like)</div>
          <div class="field field-full"><label>What made today successful?</label>
            <input type="text" id="r_win" value="${d.reflect?.win??""}" placeholder="One good thing"></div>
          <div class="field field-full"><label>What slowed you down today?</label>
            <input type="text" id="r_slow" value="${d.reflect?.slow??""}" placeholder="No judgement — just noticing"></div>
          <div class="field field-full"><label>One thing to improve tomorrow</label>
            <input type="text" id="r_next" value="${d.reflect?.next??""}" placeholder="Small and doable"></div>

          <div class="form-actions">
            <button class="btn" id="saveBtn">💾 Save today</button>
            <span class="hint">Data saves to this device only.</span>
          </div>
        </div>
      </div>`;

    // read an hours+minutes pair back into decimal hours
    const readHM = (id) => (+($("#"+id+"_h")?.value) || 0) + (+($("#"+id+"_m")?.value) || 0) / 60;

    $("#saveBtn").onclick = () => {
      const date = $("#f_date").value || todayStr();
      const entry = { date, sleep: readHM("f_sleep"),
        mood:+$("#f_mood").value, energy:+$("#f_energy").value,
        notes:$("#f_notes").value.trim(), ent:{},
        reflect:{ win:$("#r_win").value.trim(), slow:$("#r_slow").value.trim(), next:$("#r_next").value.trim() } };
      CFG.activities.forEach(a => entry[a.key] = readHM("f_"+a.key));
      CFG.entertainment.forEach(a => entry.ent[a.key] = readHM("e_"+a.key));
      DB[date] = entry; save(DB);
      toast("Saved ✓  Coach updated.");
      renderAll(); go("dashboard");
    };
  }

  /* ---------- Coach ---------- */
  function renderCoach() {
    const el = $("#view-coach");
    const msgs = coachMessages();
    el.innerHTML = `
      <div class="page-head">
        <div class="page-title">AI Coach</div>
        <div class="page-sub">Learned from your history. Supportive, never shaming — focused on your weekly averages, not one perfect day.</div>
      </div>
      <div id="ai-section"></div>
      <h3 style="color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:22px 0 12px">Instant pattern checks (offline)</h3>
      ${msgs.map(m=>`
        <div class="callout ${m.type}">
          <div class="ci">${m.icon}</div>
          <div class="ctext"><div class="ctitle">${m.title}</div>${m.text}</div>
        </div>`).join("")}
      <div class="card" style="margin-top:8px">
        <h3>My coaching principles</h3>
        <div class="hint" style="font-size:13px;line-height:1.7">
          • ACCA is your #1 — a day with ACCA done is a good day, even if everything else was quiet.<br>
          • Money & bots matter, but they never replace ACCA.<br>
          • I focus on improving your <b>weekly average</b>, not chasing a perfect day.<br>
          • I never shame you. Tiredness, not laziness, is usually behind the scrolling.<br>
          • If ACCA slips a few days, I'll gently point back to the long-term goal — that's it.
        </div>
      </div>`;
    if (window.AICoach) window.AICoach.mount($("#ai-section"));
  }

  /* ---------- Weekly Report ---------- */
  function weekWindow() {                       // most recent Mon..Sun containing data
    // last 7 days ending today
    const start = addDays(todayStr(), -6);
    return entArr().filter(e => e.date >= start && e.date <= todayStr());
  }
  function renderWeekly() {
    const el = $("#view-weekly");
    const week = weekWindow();
    if (!week.length) {
      el.innerHTML = `<div class="page-head"><div class="page-title">Weekly Report</div></div>
        <div class="empty">No data in the last 7 days yet. Log a few days and your Sunday report writes itself.</div>`;
      return;
    }
    const avgP = week.reduce((s,e)=>s+productiveHours(e),0)/week.length;
    const best = week.reduce((a,e)=> productiveHours(e)>productiveHours(a)?e:a);
    const worst= week.reduce((a,e)=> productiveHours(e)<productiveHours(a)?e:a);
    const totalStudy = week.reduce((s,e)=>s+(+e.study||0),0);
    const totalBot   = week.reduce((s,e)=>s+(+e.bots||0),0);
    const totalEnt   = week.reduce((s,e)=>s+entertainmentHours(e),0);
    const totalAll   = week.reduce((s,e)=>s+productiveHours(e)+entertainmentHours(e),0) || 1;
    const sleepAvg   = week.reduce((s,e)=>s+(+e.sleep||0),0)/week.length;
    const overall    = Math.round(week.reduce((s,e)=>s+balanceScore(e),0)/week.length);

    // biggest improvement vs previous week
    const prevStart = addDays(todayStr(), -13), prevEnd = addDays(todayStr(), -7);
    const prev = entArr().filter(e => e.date >= prevStart && e.date <= prevEnd);
    const prevP = prev.length ? prev.reduce((s,e)=>s+productiveHours(e),0)/prev.length : null;
    const improve = prevP!=null ? (avgP>=prevP
        ? `▲ Up ${hm(avgP-prevP)}/day vs last week — momentum is with you.`
        : `▼ Down ${hm(prevP-avgP)}/day vs last week — a reset week, not a failure.`)
      : "Not enough history yet to compare with last week.";

    const pct = (v) => Math.round((v/totalAll)*100);

    el.innerHTML = `
      <div class="page-head">
        <div class="page-title">Weekly Report</div>
        <div class="page-sub">${fmtDate(week[0].date)} → ${fmtDate(week.at(-1).date)} · auto-generated</div>
      </div>
      <div class="grid cols-4">
        ${statTile("Avg Productive", hm(avgP), "/day", "⚡")}
        ${statTile("Overall Score", overall, "/100", "⚖️")}
        ${statTile("Best Day", dayName(best.date).slice(0,3), " "+hm(productiveHours(best)), "🌟")}
        ${statTile("Worst Day", dayName(worst.date).slice(0,3), " "+hm(productiveHours(worst)), "🌧️")}
      </div>
      <div class="grid cols-2" style="margin-top:16px">
        <div class="card">
          <h3>This week in words</h3>
          <div class="callout good"><div class="ci">📈</div><div class="ctext"><div class="ctitle">Biggest improvement</div>${improve}</div></div>
          <div class="callout ${totalEnt>totalStudy?'warn':'info'}"><div class="ci">⌛</div><div class="ctext"><div class="ctitle">Biggest time waste</div>
            ${hm(totalEnt)} on entertainment this week ${totalEnt>totalStudy?`— more than the ${hm(totalStudy)} you gave ACCA. Worth rebalancing next week.`:`— nicely under your ACCA time. Good control.`}</div></div>
        </div>
        <div class="card">
          <h3>Where your week went</h3>
          <div class="mini" style="margin-bottom:10px"><div class="ml">Study (ACCA)</div>
            <div class="bar green"><i style="width:${pct(totalStudy)}%"></i></div><div class="hint">${pct(totalStudy)}% · ${hm(totalStudy)}</div></div>
          <div class="mini" style="margin-bottom:10px"><div class="ml">Bots</div>
            <div class="bar"><i style="width:${pct(totalBot)}%"></i></div><div class="hint">${pct(totalBot)}% · ${hm(totalBot)}</div></div>
          <div class="mini"><div class="ml">Entertainment</div>
            <div class="bar ${totalEnt>totalStudy?'red':'amber'}"><i style="width:${pct(totalEnt)}%"></i></div><div class="hint">${pct(totalEnt)}% · ${hm(totalEnt)}</div></div>
          <div class="hint" style="margin-top:12px">Sleep average: <b>${hm(sleepAvg)}</b></div>
        </div>
      </div>`;
  }

  /* ---------- Trends & Projection ---------- */
  // Bucket all entries into consecutive 7-day weeks from the first logged day.
  function weeklyBuckets() {
    const rows = entArr();
    if (!rows.length) return [];
    const start = rows[0].date;
    const buckets = {};
    for (const e of rows) {
      const wk = Math.floor(daysBetween(start, e.date) / 7);
      (buckets[wk] ||= []).push(e);
    }
    return Object.keys(buckets).map(Number).sort((a,b)=>a-b).map(wk => {
      const items = buckets[wk];
      const avgScore = items.reduce((s,e)=>s+balanceScore(e),0) / items.length;
      const acca = items.reduce((s,e)=>s+(+e.study||0),0);
      const prod = items.reduce((s,e)=>s+productiveHours(e),0);
      return { wk: wk+1, days: items.length, avgScore, acca, accaPerDay: acca/items.length, prodPerDay: prod/items.length,
               from: items[0].date, to: items[items.length-1].date };
    });
  }

  function renderTrends() {
    const el = $("#view-trends");
    const weeks = weeklyBuckets();
    const G = CFG.accaGoal;

    // ---- Future projection (ACCA) ----
    const proj = accaProjection();
    const { accaAvg, total: accaTotal, perYear, remaining, yearsLeft, requiredPerDay, pace, paceCls } = proj;

    if (!weeks.length) {
      el.innerHTML = `<div class="page-head"><div class="page-title">Trends &amp; Projection</div></div>
        <div class="empty">Log a few days and your weekly trend + ACCA projection will appear here.</div>`;
      return;
    }

    const maxScore = Math.max(70, ...weeks.map(w=>w.avgScore));
    const trendBars = weeks.map(w => `
      <div class="col" title="${fmtDate(w.from)} → ${fmtDate(w.to)} · ${w.days} day(s)">
        <em>${Math.round(w.avgScore)}</em>
        <i style="height:${Math.max(6,(w.avgScore/maxScore)*100)}%"></i>
        <span>Week ${w.wk}</span>
      </div>`).join("");
    const first = weeks[0].avgScore, last = weeks[weeks.length-1].avgScore;
    const trendDelta = weeks.length>1
      ? (last>=first ? `<span class="up">▲ Up ${Math.round(last-first)} points</span> since Week 1 — the line is climbing.`
                     : `<span class="down">▼ Down ${Math.round(first-last)} points</span> since Week 1 — a reset stretch, not a failure.`)
      : "Keep logging to see the trend build.";

    el.innerHTML = `
      <div class="page-head">
        <div class="page-title">Trends &amp; Projection</div>
        <div class="page-sub">Your Balance Score week by week, and where ACCA is heading at your current pace.${proj.currentPaper?` Currently on <b style="color:var(--accent)">${proj.currentPaper}</b>.`:""}${proj.examDate?"":" No exam booked yet — planning by pace."}</div>
      </div>

      <div class="card" style="grid-column:1/-1">
        <h3>📈 Monthly Trend — average Balance Score per week</h3>
        <div class="growthfig">${trendBars}</div>
        <div class="hint" style="margin-top:14px;font-size:13.5px">${trendDelta}</div>
      </div>

      <h3 style="color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:24px 0 12px">🎓 Future Projection — ACCA</h3>
      <div class="grid cols-4">
        ${statTile("Current ACCA Average", hm(accaAvg), "/day", "📚", null)}
        ${statTile("Projected per Year", Math.round(perYear), "h/year", "📅", null)}
        ${statTile("Hours Logged", Math.round(accaTotal), "h", "⏱️", null)}
        ${statTile("Current Pace", "", "", "🚀", {cls:paceCls, txt:pace})}
      </div>

      <div class="card" style="grid-column:1/-1;margin-top:16px">
        <h3>🎯 Finish line — ${G.totalHours}h target (incl. Foundations), in ${G.targetYears} years</h3>
        <div class="mini-grid">
          <div class="mini"><div class="ml">Finish in (at current pace)</div><div class="mv">${isFinite(yearsLeft)?yearsLeft.toFixed(1):"—"}<span style="font-size:12px;color:var(--muted)"> yrs</span></div></div>
          <div class="mini"><div class="ml">Your target</div><div class="mv">${G.targetYears}<span style="font-size:12px;color:var(--muted)"> yrs</span></div></div>
          <div class="mini"><div class="ml">Need per day to hit target</div><div class="mv">${hm(requiredPerDay)}</div></div>
          <div class="mini"><div class="ml">Remaining hours</div><div class="mv">${Math.round(remaining)}<span style="font-size:12px;color:var(--muted)">h</span></div></div>
        </div>
        ${(() => {
          if (accaAvg<=0) return `<div class="callout info" style="margin-top:16px"><div class="ci">📚</div><div class="ctext">Log some ACCA hours and I'll project your finish date.</div></div>`;
          const ahead = yearsLeft <= G.targetYears;
          const gap = requiredPerDay - accaAvg;
          return `<div class="callout ${ahead?'good':'warn'}" style="margin-top:16px"><div class="ci">${ahead?'🏆':'🎯'}</div>
            <div class="ctext"><div class="ctitle">${ahead?`On track to finish in ~${yearsLeft.toFixed(1)} years — ahead of your ${G.targetYears}-year goal`:`At this pace it's ~${yearsLeft.toFixed(1)} years`}</div>
            ${ahead
              ? `Keep the current ${hm(accaAvg)}/day and you beat the deadline. Even holding steady wins.`
              : `To finish in ${G.targetYears} years you need about <b>${hm(requiredPerDay)}/day</b> — that's just <b>+${hm(Math.max(0,gap))}/day</b> more than now. Small, weekly, sustainable.`}</div></div>`;
        })()}
        <div class="hint" style="margin-top:12px">Estimate assumes ~${G.totalHours} study hours across all ACCA papers including Foundations. You can change this in <span class="mono">config.js → accaGoal</span>.</div>
      </div>`;
  }

  /* ---------- Goals ---------- */
  function renderGoals() {
    const el = $("#view-goals");
    const goalRow = (label, cur, target, keepUnder=false) => {
      const hit = keepUnder ? cur <= target : cur >= target;
      const need = target - cur;
      const cls = hit ? "green" : (keepUnder ? "red" : (need > target*0.4 ? "red" : "amber"));
      const pctv = Math.min(100, (cur/target)*100);
      return `<div class="card">
        <h3>${label}</h3>
        <div class="grid cols-3" style="gap:10px">
          <div class="mini"><div class="ml">Current (7d avg)</div><div class="mv">${hm(cur)}<small style="font-size:12px;color:var(--muted)">/day</small></div></div>
          <div class="mini"><div class="ml">Today's target</div><div class="mv">${hm(target)}<small style="font-size:12px;color:var(--muted)">/day</small></div></div>
          <div class="mini"><div class="ml">${keepUnder?(hit?"Under":"Over"):(need>0?"Need":"Surplus")}</div><div class="mv ${hit?'up':''}">${keepUnder?(hit?'✓':`${Math.round(-need*60)}m`):(need>0?`+${Math.round(need*60)}m`:`✓`)}</div></div>
        </div>
        <div class="bar ${cls}"><i style="width:${pctv}%"></i></div>
        <div class="hint">${keepUnder ? (hit?"Nicely under your cap 💪":"Trim this back — the one number you don't want to grow.") : (hit?"Target reached — beat tomorrow's slightly higher one 💪":`Just ${Math.round(need*60)} more minutes a day gets you there.`)}</div>
      </div>`;
    };
    const mult = growthMultiplier(todayStr());
    const growthNote = CFG.improvement?.enabled
      ? `Every target below grows <b>+${(CFG.improvement.rate*100)}%/${growthPeriodWord()}</b> (compounding, since your first logged day). Today's targets are <b>${mult.toFixed(2)}×</b> the base${CFG.improvement.maxMultiplier && mult>=CFG.improvement.maxMultiplier?" (max reached)":""}. Entertainment never grows.`
      : "Based on your 7-day rolling averages.";
    const t = (k) => targetFor(k, todayStr());
    el.innerHTML = `
      <div class="page-head">
        <div class="page-title">Goals — 1% better every day</div>
        <div class="page-sub">${growthNote}</div>
      </div>
      <div class="grid cols-2">
        ${goalRow("📚 Study (ACCA)",  avgOver(e=>+e.study||0,7),      t("study"))}
        ${goalRow("💼 Current Job",   avgOver(e=>+e.job||0,7),        t("job"))}
        ${goalRow("📈 Job Upgrade",   avgOver(e=>+e.jobUpgrade||0,7), t("jobUpgrade"))}
        ${goalRow("🔗 LinkedIn",      avgOver(e=>+e.linkedin||0,7),   t("linkedin"))}
        ${goalRow("🤖 Bot Building",  avgOver(e=>+e.bots||0,7),       t("bots"))}
        ${goalRow("🏃 Exercise",      avgOver(e=>+e.exercise||0,7),   t("exercise"))}
        ${goalRow("📖 Book Reading",  avgOver(e=>+e.reading||0,7),    t("reading"))}
        ${goalRow("📺 Entertainment (keep under)", avgOver(entertainmentHours,7), CFG.targets.entertainment, true)}
      </div>`;
  }

  /* ---------- Achievements ---------- */
  function renderAchievements() {
    const el = $("#view-achievements");
    const list = achievements();
    const unlocked = list.filter(a=>a.unlocked).length;
    // group by category, preserving first-seen order
    const cats = [];
    list.forEach(a => { let g = cats.find(c => c.name === a.cat);
      if (!g) { g = { name: a.cat, items: [] }; cats.push(g); } g.items.push(a); });
    const card = (a) => `
      <div class="ach ${a.unlocked?'unlocked':''}">
        ${a.unlocked?'<div class="abadge">✓ done</div>':''}
        <div class="amoji">${a.emoji}</div>
        <div class="aname">${a.name}</div>
        <div class="aprog">${a.goal>1 ? `${round1(a.cur)} / ${a.goal}${a.unit}` : (a.unlocked?'Unlocked':'Locked')}</div>
        ${a.goal>1?`<div class="bar ${a.unlocked?'green':''}" style="margin-top:8px"><i style="width:${Math.min(100,(a.cur/a.goal)*100)}%"></i></div>`:''}
      </div>`;
    el.innerHTML = `
      <div class="page-head">
        <div class="page-title">Achievements</div>
        <div class="page-sub">${unlocked} of ${list.length} unlocked · progress over streaks — a missed day never resets your total hours. Your coach can see these and will cheer you on.</div>
      </div>
      ${cats.map(c => `
        <h3 style="color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:22px 0 12px">${c.name}
          <span style="color:var(--faint)">· ${c.items.filter(i=>i.unlocked).length}/${c.items.length}</span></h3>
        <div class="ach-grid">${c.items.map(card).join("")}</div>`).join("")}`;
  }

  /* ---------- History ---------- */
  function renderHistory() {
    const el = $("#view-history");
    const rows = entArr().slice().reverse();
    el.innerHTML = `
      <div class="page-head">
        <div class="page-title">History</div>
        <div class="page-sub">${rows.length} day(s) logged.</div>
      </div>
      <div class="card">
        ${rows.length ? `<table class="table">
          <thead><tr><th>Date</th><th>Prod.</th><th>ACCA</th><th>Job</th><th>Bots</th><th>Ent.</th><th>Sleep</th><th>Mood</th><th>Score</th><th></th></tr></thead>
          <tbody>
          ${rows.map(e=>`<tr>
            <td>${fmtDate(e.date)}</td>
            <td><b>${hm(productiveHours(e))}</b></td>
            <td>${hm(+e.study||0)}</td>
            <td>${hm(+e.job||0)}</td>
            <td>${hm(+e.bots||0)}</td>
            <td>${hm(entertainmentHours(e))}</td>
            <td>${hm(+e.sleep||0)}</td>
            <td>${e.mood||"—"}</td>
            <td>${Math.round(balanceScore(e))}</td>
            <td><span class="del" data-del="${e.date}">✕</span></td>
          </tr>`).join("")}
          </tbody></table>` : `<div class="empty">No entries yet.</div>`}
      </div>`;
    $$("[data-del]", el).forEach(b => b.onclick = () => {
      if (confirm("Delete entry for " + b.dataset.del + "?")) {
        delete DB[b.dataset.del]; save(DB); renderAll(); toast("Entry deleted");
      }
    });
  }

  /* ----------------------------- Router ------------------------------ */
  function renderAll() {
    renderDashboard(); renderCoach(); renderWeekly(); renderTrends();
    renderGoals(); renderAchievements(); renderHistory();
  }
  function go(view) {
    $$(".view").forEach(v => v.classList.add("hidden"));
    $("#view-"+view).classList.remove("hidden");
    $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view===view));
    if (view === "daily") renderDaily();
    window.scrollTo(0,0);
  }
  $$(".nav-btn").forEach(b => b.onclick = () => go(b.dataset.view));

  /* --------------------- Export / Import ----------------------------- */
  $("#exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(DB,null,2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `life-os-backup-${todayStr()}.json`; a.click();
    toast("Exported ✓");
  };
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => { try {
      const data = JSON.parse(r.result);
      if (!data || typeof data !== "object") { toast("Invalid file"); return; }
      const incoming = Object.keys(data).length;
      const existing = Object.keys(DB).length;
      // REPLACE by default (safe). Only offer merge when there is existing data.
      let mode = "replace";
      if (existing > 0) {
        mode = confirm(
          `Import ${incoming} day(s) from this file.\n\n` +
          `• OK  = REPLACE — wipe the current ${existing} day(s) and use only the file.\n` +
          `• Cancel = MERGE — keep current days and add/overwrite from the file.`
        ) ? "replace" : "merge";
      }
      DB = mode === "replace" ? { ...data } : { ...DB, ...data };
      save(DB); renderAll(); go("history");
      toast(`Imported ✓ (${mode})`);
    } catch { toast("Invalid file"); } };
    r.readAsText(file);
    ev.target.value = ""; // allow re-importing the same file
  };
  $("#resetBtn").onclick = () => {
    const n = Object.keys(DB).length;
    if (!n) { toast("No data to clear"); return; }
    if (confirm(`Delete ALL ${n} logged day(s) from this browser? This cannot be undone.\n\nTip: Export a backup first if unsure.`)) {
      DB = {}; save(DB); renderAll(); go("dashboard"); toast("All data cleared");
    }
  };

  /* --------- Build a compact context string for the real AI ---------- */
  function buildAIContext() {
    const rows = entArr();
    const today = DB[todayStr()];
    const line = (e) => `${e.date} (${dayName(e.date).slice(0,3)}): ACCA ${round1(+e.study||0)}h, CurrentJob(day-job) ${round1(+e.job||0)}h, JobUpgrade(new-job hunt) ${round1(+e.jobUpgrade||0)}h, LinkedIn ${round1(+e.linkedin||0)}h, Bots ${round1(+e.bots||0)}h, Reading ${round1(+e.reading||0)}h, Exercise ${round1(+e.exercise||0)}h, Instagram ${round1(+(e.ent?.instagram)||0)}h, Games ${round1(+(e.ent?.games)||0)}h, Netflix/YT ${round1(+(e.ent?.media)||0)}h, Sleep ${round1(+e.sleep||0)}h, Mood ${e.mood||"-"}/10, Energy ${e.energy||"-"}/10${e.notes?`, Note: "${e.notes}"`:""}`;
    // AI MEMORY: give the manager the FULL history (up to a year), not just 14 days.
    const recent = rows.slice(-365).map(line).join("\n");
    const avgs = `Rolling averages —
  Last 7 days: Productive ${round1(avgOver(productiveHours,7))}h/day, ACCA ${round1(avgOver(e=>+e.study||0,7))}h/day, Bots ${round1(avgOver(e=>+e.bots||0,7))}h/day, Job ${round1(avgOver(e=>+e.job||0,7))}h/day, Entertainment ${round1(avgOver(entertainmentHours,7))}h/day, Sleep ${round1(avgOver(e=>+e.sleep||0,7))}h/day.
  Last 30 days: Productive ${round1(avgOver(productiveHours,30))}h/day, ACCA ${round1(avgOver(e=>+e.study||0,30))}h/day.`;
    const totals = `Lifetime totals — ACCA ${round1(sumAll(e=>+e.study||0))}h, Bots ${round1(sumAll(e=>+e.bots||0))}h, days logged ${rows.length}.`;
    const ruleNotes = coachMessages().map(m => `- ${m.title}`).join("\n");
    const T = CFG.targets;

    // ---- Achievements summary for the coach to use as motivation ----
    const achs = achievements();
    const curStreak = currentStreak(e => (+e.study||0) > 0);
    const bestStreak = consecutiveStudyDays();
    const done = achs.filter(a => a.unlocked);
    const near = achs.filter(a => !a.unlocked)
      .map(a => ({ ...a, ratio: a.cur / a.goal }))
      .sort((x, y) => y.ratio - x.ratio).slice(0, 6);
    const achText = `ACCA study streak — ongoing/current: ${curStreak} day(s); best-ever: ${bestStreak} day(s). Unlocked ${done.length}/${achs.length} achievements.
Recently earned: ${done.slice(-5).map(a => a.name).join(", ") || "none yet"}.
CLOSEST locked achievements (encourage these): ${near.map(a => `${a.name} (${round1(a.cur)}/${a.goal}${a.unit})`).join("; ") || "all unlocked!"}.`;

    // ---- Balance-score model + today's breakdown, so the coach can advise on 70+ ----
    const partsMax = balanceParts().map(p => `${p.label} max ${p.max}`).join(", ");
    const scoreModel = `LIFE BALANCE SCORE MODEL (total 100, points follow priority order): ${partsMax}.
Each activity earns its full points when that day's hours reach its daily target (listed above); partial hours earn proportional points. Sleep earns full points inside ${T.sleepMin}-${T.sleepMax}h. Mood is scored out of 10.`;
    const todayScore = today ? (() => {
      const bd = balanceBreakdown(today), tot = balanceScore(today);
      const detail = balanceParts().map(p => `${p.label} ${bd[p.key]||0}/${p.max}`).join(", ");
      const gaps = balanceParts().map(p => ({ ...p, left: p.max - (bd[p.key]||0) }))
        .filter(p => p.left >= 1).sort((a,b) => b.left - a.left).slice(0,4)
        .map(p => `${p.label} (+${round1(p.left)} available)`).join(", ");
      return `TODAY'S SCORE: ${Math.round(tot)}/100 — ${detail}.
Biggest point gaps today: ${gaps || "none, near perfect"}. To hit 70 the user needs ${Math.max(0, Math.ceil(70 - tot))} more points.`;
    })() : "TODAY'S SCORE: not logged yet.";
    const scoreHistory = rows.slice(-10).map(e => `${e.date}: ${Math.round(balanceScore(e))}`).join(", ");

    // ---- ACCA plan: exam countdown if booked, else finish-line pace ----
    const proj = accaProjection();
    const paperLine = proj.currentPaper ? `The user is currently studying paper "${proj.currentPaper}". Chapters change almost every day, so do NOT invent chapter numbers — refer to "today's ${proj.currentPaper} chapter" or ask which chapter they're on.` : "";
    const examInfo = (proj.daysToExam != null && proj.daysToExam >= 0)
      ? `ACCA EXAM COUNTDOWN: ${proj.daysToExam} days until the booked exam (${proj.examDate}). ${paperLine} ${round1(proj.total)}h logged of ${proj.totalHours}h goal.`
      : `ACCA PLAN (no exam booked yet — the user books an exam only after finishing the syllabus, so plan by PACE, not a countdown): ${paperLine} At the current ${round1(proj.accaAvg)}h/day they finish the ${proj.totalHours}h qualification in ~${isFinite(proj.yearsLeft)?proj.yearsLeft.toFixed(1):"—"} years vs their ${proj.targetYears}-year target. To hit the target they need about ${round1(proj.requiredPerDay)}h/day of ACCA. Pace verdict: ${proj.pace}. ${round1(proj.total)}h logged so far. Use this finish-line as the thing to manage toward.`;
    // ---- Today's entertainment penalty (awareness) ----
    const penToday = today ? entertainmentPenalty(today) : null;
    const penInfo = penToday && penToday.total > 0
      ? `ENTERTAINMENT PENALTY TODAY: −${penToday.total} points, because TOTAL entertainment was ${penToday.used}h vs the ${penToday.cap}h daily cap (over by ${penToday.over}h). The penalty is on the total only, not any single app. Frame this as awareness, never punishment.`
      : "";

    const weekendInfo = isWeekend(todayStr())
      ? `\nTODAY IS A WEEKEND / RELAX DAY: targets for lower priorities are lighter (×${CFG.weekend.targetFactor}) and there is NO entertainment penalty. BUT the top ${CFG.weekend.keepTopPriorities} priorities (ACCA and Current Job) keep their FULL targets — those two still matter today. So: keep ACCA and Job on track, but be relaxed and encouraging about everything else; let them rest and recharge.`
      : "";
    const tt = (k) => round1(targetFor(k, todayStr()));
    const gInfo = CFG.improvement?.enabled
      ? `\nIMPROVEMENT RULE: every productive target grows +${CFG.improvement.rate*100}% per ${growthPeriodWord()} (compounding, since their first logged day), whether or not it was met. Today's targets are ${growthMultiplier(todayStr()).toFixed(2)}× the base. Entertainment never grows. Celebrate that the bar rises a little each ${growthPeriodWord()}; keep suggestions realistic for the CURRENT (grown) target.`
      : "";
    return `${examInfo ? examInfo + "\n\n" : ""}${penInfo ? penInfo + "\n\n" : ""}USER'S TARGETS FOR TODAY (already grown to today's level): ACCA ${tt("study")}h (top priority), CurrentJob ${tt("job")}h, JobUpgrade ${tt("jobUpgrade")}h, LinkedIn ${tt("linkedin")}h, Bots ${tt("bots")}h, Exercise ${tt("exercise")}h, Reading ${tt("reading")}h, Family ${tt("family")}h, Entertainment under ${T.entertainment}h, Sleep ${T.sleepMin}-${T.sleepMax}h.
PRIORITY ORDER (1=highest): ${CFG.priorities.join(" > ")}.${gInfo}${weekendInfo}

${scoreModel}
${todayScore}
Recent daily scores: ${scoreHistory || "none"}.
IMPORTANT — these are DIFFERENT and must never be merged: "Current Job" = the existing day-job the user already has (priority #2). "Job Upgrade" = time spent hunting/applying/interviewing/upskilling for a BETTER job (priority #3). "LinkedIn" = networking, tracked separately.

${totals}
${avgs}

ACHIEVEMENTS:
${achText}

RECENT DAYS (most recent last):
${recent || "No data logged yet."}

RULE-ENGINE FLAGS FOR TODAY:
${ruleNotes || "none"}

TODAY IS: ${todayStr()} (${dayName(todayStr())})${today ? "" : " — NOT logged yet."}`;
  }

  const PHILOSOPHY = CFG.philosophy;

  /* ----------------------------- Boot -------------------------------- */
  const askNow = () => { go("coach"); setTimeout(() => document.querySelector("#ai-decide")?.click(), 120); };
  window.LOS = { go, aiContext: buildAIContext, philosophy: PHILOSOPHY, refreshCoach: renderCoach, askNow };
  window.dispatchEvent(new Event("los-ready"));
  renderAll();
  go("dashboard");
})();
