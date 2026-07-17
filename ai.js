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
  const PROVIDERS = {
    gemini: {
      label: "Google Gemini (free)",
      defaultModel: "gemini-2.0-flash",
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
    groq: {
      label: "Groq (free, very fast)",
      defaultModel: "llama-3.3-70b-versatile",
      getUrl: "https://console.groq.com/keys",
      async call(cfg, system, history) {
        return openaiStyle("https://api.groq.com/openai/v1/chat/completions", cfg, system, history);
      },
    },
    openrouter: {
      label: "OpenRouter (free models)",
      defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
      getUrl: "https://openrouter.ai/keys",
      async call(cfg, system, history) {
        return openaiStyle("https://openrouter.ai/api/v1/chat/completions", cfg, system, history);
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
    return `You are the user's personal life coach inside their "Life Operating System" app.
You speak like a warm, supportive friend and mentor — NOT a strict teacher. Reply in the SAME language/style the user writes in (they often mix English with Roman Urdu/Hindi — match that naturally).

THE USER (do not forget):
- Their #1 long-term priority is ${p.topPriorityLabel || "ACCA"} (accounting qualification). It outranks everything.
- ${p.accaBeatsMoney ? "Money and job matter, but must NEVER replace ACCA study." : ""}
- ${p.overworksBots ? "They tend to OVERWORK on building bots because they genuinely enjoy it — gently keep it from crowding out ACCA." : ""}
- ${p.wastesWhenTired ? "They usually waste time on Instagram when mentally TIRED, not lazy — treat scrolling as a rest signal, not a moral failing." : ""}
- They feel guilty after wasting time.

HARD RULES:
- ${p.neverShame ? "NEVER shame, guilt-trip, or lecture the user. No 'you failed'. Be kind and specific." : ""}
- ${p.focusWeeklyAverage ? "Judge progress by WEEKLY AVERAGES improving, not one perfect day. Perfection is not the goal." : ""}
- If productivity was low BUT ACCA was done, tell them the day still counts as a SUCCESS.
- If ACCA has been skipped several days, gently remind them of the long-term goal — softly, once, no nagging.
- Base every observation on the ACTUAL DATA given below. Reference real numbers. Never invent data or give generic advice.
- Keep replies concise and warm. Use short paragraphs or a few bullet points. End with ONE small, doable next step.

Below is the user's real tracked data. Use it as the single source of truth.`;
  }

  /* ---------------------------- Rendering ---------------------------- */
  let history = [];   // {role, content} — conversation memory (session only)

  function mount(container) {
    if (!container) return;
    const cfg = getCfg();
    if (!hasKey()) { renderSetup(container); return; }
    renderPanel(container, cfg);
  }

  function renderSetup(container) {
    const opts = Object.entries(PROVIDERS).map(([k, v]) =>
      `<option value="${k}">${v.label}</option>`).join("");
    container.innerHTML = `
      <div class="card" style="border-color:rgba(108,140,255,.4)">
        <h3>✨ Turn on the real AI Coach (free)</h3>
        <div class="hint" style="font-size:13px;line-height:1.6;margin-bottom:14px">
          Paste a free API key below. It's saved <b>only in this browser</b> — never uploaded, never committed to GitHub.
          Recommended: <b>Google Gemini</b> — free, generous limits, no card needed.
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Provider</label>
            <select id="ai-provider">${opts}</select>
          </div>
          <div class="field">
            <label>API Key</label>
            <input type="password" id="ai-key" placeholder="paste your key here" autocomplete="off" />
          </div>
          <div class="field field-full">
            <a id="ai-getkey" href="#" target="_blank" rel="noopener" class="hint" style="color:var(--accent)">→ Get a free key</a>
          </div>
          <div class="form-actions">
            <button class="btn" id="ai-save">Save & activate</button>
          </div>
        </div>
      </div>`;
    const prov = $("#ai-provider", container);
    const link = $("#ai-getkey", container);
    const syncLink = () => { link.href = PROVIDERS[prov.value].getUrl;
      link.textContent = "→ Get a free " + PROVIDERS[prov.value].label.split(" ")[0] + " key"; };
    prov.onchange = syncLink; syncLink();
    $("#ai-save", container).onclick = () => {
      const apiKey = $("#ai-key", container).value.trim();
      if (!apiKey) { flash(container, "Please paste a key first."); return; }
      setCfg({ provider: prov.value, apiKey, model: PROVIDERS[prov.value].defaultModel });
      history = [];
      mount(container);
    };
  }

  function renderPanel(container, cfg) {
    container.innerHTML = `
      <div class="card" style="border-color:rgba(138,108,255,.4)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <h3 style="margin:0">✨ Real AI Coach — ${PROVIDERS[cfg.provider]?.label || cfg.provider}</h3>
          <button class="ghost-btn" id="ai-settings" style="font-size:11.5px">⚙ change key</button>
        </div>
        <div class="hint" style="margin-bottom:14px">Uses your last 14 days + averages. Ask anything, or get a full read on where you stand.</div>
        <div id="ai-chat" style="display:flex;flex-direction:column;gap:12px;margin-bottom:14px"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn" id="ai-insight">🧠 Coach me on today</button>
          <button class="btn secondary" id="ai-plan">📋 Plan my tomorrow</button>
        </div>
        <div class="field">
          <div style="display:flex;gap:10px">
            <input type="text" id="ai-input" placeholder="Ask your coach anything…" style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:11px 13px;font-size:14px" />
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
        history.push({ role: "assistant", content: "⚠️ Couldn't reach the AI: " + e.message + "\n\n(Check your API key in ⚙ change key, or your internet.)" });
      }
      $("#" + loadingId, container)?.remove();
      renderChat();
    }

    $("#ai-insight", container).onclick = () =>
      ask("Look at my recent data and coach me on today. Where do I stand on ACCA vs everything else? Be honest but kind.");
    $("#ai-plan", container).onclick = () =>
      ask("Based on my patterns, plan a realistic tomorrow for me — put ACCA first, keep it doable. Give me a simple hour-by-hour or priority list.");
    $("#ai-send", container).onclick = () => {
      const v = $("#ai-input", container).value.trim(); if (!v) return;
      $("#ai-input", container).value = ""; ask(v);
    };
    $("#ai-input", container).addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); $("#ai-send", container).click(); }
    });
    $("#ai-settings", container).onclick = () => {
      if (confirm("Remove the saved API key from this browser?")) {
        localStorage.removeItem(CFG_KEY); history = []; mount(container);
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
