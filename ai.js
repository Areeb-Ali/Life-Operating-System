/* =========================================================================
   Life Operating System — ai.js
   Real AI Coach. Sends YOUR data + YOUR philosophy to a free LLM API.
   The API key is stored ONLY in this browser (localStorage) — never committed.
   Supported free providers: Google Gemini (default), Groq, OpenRouter.
   ========================================================================= */
(() => {
  const CFG_KEY = "los_ai_config";
  const $ = (s, r = document) => r.querySelector(s);

  /* --------------------------- Providers ----------------------------- */
  // Groq is first → it becomes the default. Its free tier is the most reliable
  // (Gemini often returns "limit: 0" for new / non-US accounts).
  const PROVIDERS = {
    groq: {
      label: "Groq — recommended (free, fast)",
      defaultModel: "llama-3.3-70b-versatile",
      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "openai/gpt-oss-20b"],
      getUrl: "https://console.groq.com/keys",
      async call(cfg, system, history) {
        return openaiStyle("https://api.groq.com/openai/v1/chat/completions", cfg, system, history);
      },
    },
    openrouter: {
      label: "OpenRouter (free models)",
      defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
      models: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemini-2.0-flash-exp:free", "deepseek/deepseek-chat-v3-0324:free"],
      getUrl: "https://openrouter.ai/keys",
      async call(cfg, system, history) {
        return openaiStyle("https://openrouter.ai/api/v1/chat/completions", cfg, system, history);
      },
    },
    gemini: {
      label: "Google Gemini (needs billing in some regions)",
      defaultModel: "gemini-2.0-flash",
      models: ["gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"],
      getUrl: "https://aistudio.google.com/app/apikey",
      async call(cfg, system, history) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model || this.defaultModel}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
        const body = {
          systemInstruction: { parts: [{ text: system }] },
          contents: history.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { temperature: 0.7, maxOutputTokens: 900 },
        };
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`);
        return data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "(no reply)";
      },
    },
  };

  async function openaiStyle(url, cfg, system, history) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model || PROVIDERS[cfg.provider].defaultModel,
        messages: [{ role: "system", content: system }, ...history],
        temperature: 0.7, max_tokens: 900,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`);
    return data?.choices?.[0]?.message?.content || "(no reply)";
  }

  /* ----------------------------- Config ------------------------------ */
  const getCfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; } };
  const setCfg = (c) => localStorage.setItem(CFG_KEY, JSON.stringify(c));
  const hasKey = () => !!getCfg().apiKey;

  /* --------------------- System prompt (the contract) ---------------- */
  function systemPrompt() {
    const p = window.LOS?.philosophy || {};
    return `You are the user's personal life MANAGER inside their "Life Operating System" app — not just a cheerleader. You look at all their data and MAKE THE CALL: you tell them what to do right now, what to skip today, and why. Warm but decisive. Reply in the SAME language/style the user writes in (they often mix English with Roman Urdu/Hindi — match that naturally).

HOW A MANAGER TALKS (this is the whole point — do NOT just say "good job"):
- Give clear directives, not vague encouragement. Bad: "Great effort, keep going!" Good: "You have ~4 productive hours left. Exam is 46 days away. Skip Bots today. Do Chapter 5 first, then 30 min LinkedIn. Bots can wait."
- Every decision references the real numbers: hours left, exam countdown, today's score, the priority order.
- Make trade-offs explicitly: name what to DROP, not only what to add. It's fine to say "LinkedIn can wait", "skip Bots today", "no entertainment until ACCA is done".
- Lead with the decision, then one line of reasoning. Keep it short and directive. End with the single next action.
- You are still never harsh or shaming — a good manager is calm, confident, and on their side. Firm, not cruel.

THE USER (do not forget):
- Their #1 long-term priority is ${p.topPriorityLabel || "ACCA"} (accounting qualification). It outranks everything.
- ${p.accaBeatsMoney ? "Money and job matter, but must NEVER replace ACCA study. Their day-job pays only 25k PKR, so 2h/day on it is plenty — don't push more." : ""}
- ${p.overworksBots ? "They tend to OVERWORK on building bots because they genuinely enjoy it — gently keep it from crowding out ACCA and job-upgrade." : ""}
- ${p.wastesWhenTired ? "They usually waste time on Instagram when mentally TIRED, not lazy — treat scrolling as a rest signal, not a moral failing." : ""}
- LinkedIn here means POSTING and brand-building (funding for their bots, visibility for better jobs) — it is strategic high-leverage work, NOT feed-scrolling. Encourage a little of it; never lump it with wasted time.
- THE BIGGEST LEVER in their data is Entertainment: they average ~6h/day on Instagram/games while ACCA gets ~2h. Gently, without shame, keep steering ONE or TWO of those hours into ACCA — that single shift beats any other advice. Frame it as reclaiming time, never as a failing.
- Exercise and Family are FUEL, not competitors to ACCA. Protect a small daily floor of each (they energize the priorities); a day with some exercise/family is not "time lost".
- They feel guilty after wasting time.

HARD RULES:
- ${p.neverShame ? "NEVER shame, guilt-trip, or lecture the user. No 'you failed'. Be kind and specific." : ""}
- ${p.focusWeeklyAverage ? "Judge progress by WEEKLY AVERAGES improving, not one perfect day. Perfection is not the goal." : ""}
- If productivity was low BUT ACCA was done, tell them the day still counts as a SUCCESS.
- If ACCA has been skipped several days, gently remind them of the long-term goal — softly, once, no nagging.
- "Current Job" (their existing day-job) and "Job Upgrade" (hunting/applying/upskilling for a BETTER job) are TWO DIFFERENT things. NEVER merge or confuse them. LinkedIn networking is tracked separately too.
- Base every observation on the ACTUAL DATA given below. Reference real numbers. Never invent data or give generic advice.
- Keep replies concise and directive. Use short paragraphs or a few bullet points. End with ONE clear next action.

ACCA PLANNING (you manage toward finishing the qualification):
- The data has an ACCA section. If an exam is booked, plan around the countdown and get more insistent as it nears. If NO exam is booked (the user books one only after finishing the syllabus), plan around the FINISH-LINE PACE instead: compare their current ACCA hours/day to the hours/day needed to finish the ${''}2500h goal within their target years, and manage them toward that number.
- The user is on a specific paper (e.g. FBT). Chapters change almost daily — NEVER invent a chapter number ("finish Chapter 5") unless the user told you which chapter they're on. Say "today's [paper] chapter" or ask which chapter they're on.
- When the user asks "what should I do now?", give exactly ONE answer: the single next task, how long to spend on it, and one line of why (tie it to the finish-line pace / priority / score). No menus, no "you could do X or Y" — decide for them.

JOB GROWTH (they're a Product Manager):
- The data has their job role with 5 responsibility categories and target time-splits, this month's split, and recent job notes. When they ask what to do at their job, give 2-3 concrete tasks drawn from the category that is highest-weight AND under-served this month. Product Strategy (30%) and Product Execution (25%) matter most.
- Job-upgrade progress and doing the current job well are related but separate — growing in the current role also builds toward the 50k goal.

INCOME GOAL (50k/month by November):
- The data has an income plan. When money comes up, connect it to action: the RELIABLE path is the job upgrade to a 50k role, driven by their tracked Job-Upgrade hours — push that. Trading and bots are uncertain/long-term upside.
- You are NOT a financial advisor. Never recommend specific trades, position sizes, or investment strategy, and never promise trading profit. Treat all trading numbers as the user's own estimates and say so if asked.

ENTERTAINMENT AWARENESS (not punishment):
- Entertainment over its recommended limit costs Balance-Score points; the penalty is in the data. Mention it plainly as awareness ("YouTube 3h cost you −8 points today — recommended is 45 min"), never as a scolding. The point is a clear, factual mirror, then move on.

COACHING THEM TO A 70+ BALANCE SCORE (the user specifically asked for this):
- The data includes the full Life Balance Score model, today's per-category breakdown, and the exact point gaps.
- When they ask how to improve their score — or whenever the score is below 70 — give CONCRETE, numeric advice: name the categories with the biggest available points and say how many hours would earn them ("1 more hour of ACCA = about +6 points").
- Always steer them to the HIGHEST-PRIORITY gap first (ACCA is worth the most points), because that both raises the score and serves their real goal.
- Keep it realistic: suggest one or two changes, not a perfect day. A 70+ day should feel achievable, not punishing.

MOTIVATION VIA ACHIEVEMENTS (important — the user asked for this):
- An ACHIEVEMENTS section is included in the data. USE it to motivate. Celebrate what they've just unlocked by name.
- Point out the CLOSEST locked achievements and how little is left to earn them ("you're only X away from the 70-Day ACCA Streak — keep it alive today").
- Treat the ACCA study streak as precious: if it's alive, hype it up and protect it; if it broke, be gentle and rally them to start a fresh one. Never shame a broken streak.

Below is the user's real tracked data. Use it as the single source of truth.`;
  }

  /* ---------------------------- Memory ------------------------------- */
  // The manager REMEMBERS: chat history persists in this browser across reloads.
  const MEM_KEY = "los_ai_history";
  const loadHistory = () => { try { return JSON.parse(localStorage.getItem(MEM_KEY)) || []; } catch { return []; } };
  const saveHistory = () => { try { localStorage.setItem(MEM_KEY, JSON.stringify(history.slice(-60))); } catch {} };
  let history = loadHistory();   // {role, content} — remembered conversation

  function mount(container) {
    if (!container) return;
    const cfg = getCfg();
    if (!hasKey()) { renderSetup(container); return; }
    renderPanel(container, cfg);
  }

  function renderSetup(container, prefill = {}) {
    const cur = { ...getCfg(), ...prefill };
    const defProv = cur.provider || Object.keys(PROVIDERS)[0];
    const opts = Object.entries(PROVIDERS).map(([k, v]) =>
      `<option value="${k}" ${k===defProv?"selected":""}>${v.label}</option>`).join("");
    const modelOpts = (prov, sel) => (PROVIDERS[prov].models || [PROVIDERS[prov].defaultModel])
      .map(m => `<option value="${m}" ${m===sel?"selected":""}>${m}</option>`).join("");
    container.innerHTML = `
      <div class="card" style="border-color:rgba(108,140,255,.4)">
        <h3>✨ Turn on the real AI Coach (free)</h3>
        <div class="hint" style="font-size:13px;line-height:1.6;margin-bottom:14px">
          Paste a free API key below. It's saved <b>only in this browser</b> — never uploaded, never committed to GitHub.<br>
          <b>Use Groq</b> — its free tier just works. Gemini often returns <b>limit: 0</b> for new / non-US accounts
          (that's Google's restriction, not a bug here) and would need billing enabled.
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Provider</label>
            <select id="ai-provider">${opts}</select>
          </div>
          <div class="field">
            <label>Model</label>
            <select id="ai-model">${modelOpts(defProv, cur.model || PROVIDERS[defProv].defaultModel)}</select>
          </div>
          <div class="field field-full">
            <label>API Key</label>
            <input type="password" id="ai-key" placeholder="paste your key here" autocomplete="off" value="${cur.apiKey ? escapeHtml(cur.apiKey) : ""}" />
          </div>
          <div class="field field-full">
            <a id="ai-getkey" href="#" target="_blank" rel="noopener" class="hint" style="color:var(--accent)">→ Get a free key</a>
          </div>
          <div class="form-actions">
            <button class="btn" id="ai-save">Save & activate</button>
            ${hasKey() ? `<button class="btn secondary" id="ai-cancel">Cancel</button>` : ""}
          </div>
        </div>
      </div>`;
    const prov = $("#ai-provider", container);
    const modelSel = $("#ai-model", container);
    const link = $("#ai-getkey", container);
    const syncProv = () => {
      modelSel.innerHTML = modelOpts(prov.value, PROVIDERS[prov.value].defaultModel);
      link.href = PROVIDERS[prov.value].getUrl;
      link.textContent = "→ Get a free " + PROVIDERS[prov.value].label.split(" ")[0] + " key";
    };
    prov.onchange = syncProv;
    link.href = PROVIDERS[prov.value].getUrl;
    link.textContent = "→ Get a free " + PROVIDERS[prov.value].label.split(" ")[0] + " key";
    $("#ai-save", container).onclick = () => {
      const apiKey = $("#ai-key", container).value.trim();
      if (!apiKey) { flash(container, "Please paste a key first."); return; }
      setCfg({ provider: prov.value, apiKey, model: modelSel.value });
      mount(container);
    };
    if (hasKey()) $("#ai-cancel", container).onclick = () => mount(container);
  }

  function renderPanel(container, cfg) {
    container.innerHTML = `
      <div class="card" style="border-color:rgba(138,108,255,.4)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <h3 style="margin:0">🧠 AI Manager — ${PROVIDERS[cfg.provider]?.label || cfg.provider} · <span style="color:var(--muted);font-weight:400">${cfg.model || ""}</span></h3>
          <div style="display:flex;gap:8px">
            <button class="ghost-btn" id="ai-forget" style="font-size:11.5px">🧹 clear memory</button>
            <button class="ghost-btn" id="ai-settings" style="font-size:11.5px">⚙ key / model</button>
          </div>
        </div>
        <div class="hint" style="margin-bottom:14px">Sees your full history, exam countdown &amp; score — and remembers this conversation. It makes the call, not just cheers.</div>
        <button class="btn" id="ai-decide" style="width:100%;margin-bottom:12px;font-size:15px;padding:14px">⚡ What should I do now?</button>
        <div id="ai-chat" style="display:flex;flex-direction:column;gap:12px;margin-bottom:14px"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn secondary" id="ai-insight">🧭 Manage my day</button>
          <button class="btn secondary" id="ai-job">💼 Job tasks today</button>
          <button class="btn secondary" id="ai-score">🎯 How do I hit 70+?</button>
          <button class="btn secondary" id="ai-plan">📋 Plan my tomorrow</button>
        </div>
        <div class="field">
          <div style="display:flex;gap:10px">
            <input type="text" id="ai-input" placeholder="Ask your manager anything…" style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:11px 13px;font-size:14px" />
            <button class="btn" id="ai-send">Send</button>
          </div>
        </div>
      </div>`;

    const chat = $("#ai-chat", container);
    const renderChat = () => {
      chat.innerHTML = history.map(m => m.role === "user"
        ? `<div class="callout info" style="align-self:flex-end;max-width:85%;margin:0"><div class="ctext">${escapeHtml(m.content)}</div></div>`
        : `<div class="callout good" style="max-width:92%;margin:0"><div class="ci">🧭</div><div class="ctext">${mdLite(m.content)}</div></div>`
      ).join("");
      chat.scrollTop = chat.scrollHeight;
    };
    renderChat();

    async function ask(userMsg) {
      history.push({ role: "user", content: userMsg });
      renderChat();
      const loadingId = "load" + Date.now();
      chat.insertAdjacentHTML("beforeend",
        `<div class="callout" id="${loadingId}" style="max-width:92%;margin:0"><div class="ci">🧭</div><div class="ctext">thinking…</div></div>`);
      chat.scrollTop = chat.scrollHeight;
      try {
        const context = window.LOS.aiContext();
        const system = systemPrompt() + "\n\n===== DATA =====\n" + context;
        const reply = await PROVIDERS[cfg.provider].call(cfg, system, history);
        history.push({ role: "assistant", content: reply });
      } catch (e) {
        history.push({ role: "assistant", content: "⚠️ Couldn't reach the AI: " + e.message + "\n\n(Check your key in ⚙ key / model, or your internet.)" });
      }
      saveHistory();                 // remember across reloads
      $("#" + loadingId, container)?.remove();
      renderChat();
    }

    $("#ai-decide", container).onclick = () =>
      ask("Decision time — look at everything (hours left today, exam countdown, my priorities and today's score) and tell me EXACTLY ONE thing to do right now: what, for how long, and one line why. Decide for me — no options, no menu. Then what to skip.");
    $("#ai-insight", container).onclick = () =>
      ask("Manage my day. Look at my data and tell me what to prioritise now, what to drop today, and why — like my manager. Be decisive.");
    $("#ai-score", container).onclick = () =>
      ask("My Life Balance Score is below 70. Using my score breakdown, tell me exactly what to do to reach 70+ — which categories to add hours to, how many hours, and how many points each would earn. Keep it realistic for one day.");
    $("#ai-job", container).onclick = () =>
      ask("What should I do at my job today to grow as a Product Manager? Look at my job category balance this month, pick the highest-weight area that's under-served, and give me 2-3 concrete tasks for today.");
    $("#ai-plan", container).onclick = () =>
      ask("Plan my tomorrow around the ACCA exam. Put ACCA first, decide what to skip, keep it doable. Give me a simple priority list with time blocks.");
    $("#ai-send", container).onclick = () => {
      const v = $("#ai-input", container).value.trim(); if (!v) return;
      $("#ai-input", container).value = ""; ask(v);
    };
    $("#ai-input", container).addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); $("#ai-send", container).click(); }
    });
    $("#ai-settings", container).onclick = () => renderSetup(container);
    $("#ai-forget", container).onclick = () => {
      if (!history.length || confirm("Clear the manager's memory of this conversation? Your tracked data stays; only the chat is forgotten.")) {
        history = []; saveHistory(); renderChat();
      }
    };
  }

  /* ----------------------------- helpers ----------------------------- */
  const escapeHtml = (s) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const mdLite = (s) => escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/^[\-\*] (.+)$/gm, "• $1")
    .replace(/\n/g, "<br>");
  const flash = (c, msg) => { const t = document.createElement("div"); t.className = "hint"; t.style.color = "var(--red)"; t.textContent = msg; c.querySelector(".form-actions")?.appendChild(t); setTimeout(() => t.remove(), 2500); };

  /* ----------------------------- expose ------------------------------ */
  window.AICoach = { mount };
})();
