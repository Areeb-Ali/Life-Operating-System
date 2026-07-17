# Life Operating System

A private, offline personal-life dashboard. It doesn't just track hours — it makes decisions:
it learns your patterns and coaches you toward your #1 priority (ACCA).

## How to open

Just **double-click `index.html`** — it opens in your browser. No install, no server, no login.
All data is saved in your browser on this device only (nothing goes to the internet).

## Sections

| Section | What it does |
|---|---|
| **Daily Input** | One quick fill each day: sleep, study, job, bots, reading, exercise, family, entertainment (Instagram/Games/Netflix), mood, energy, notes + a nightly reflection. |
| **Dashboard** | Today's productive hours, 7-day / 30-day rolling averages, per-activity averages, balance score, priority check, sparkline. |
| **AI Coach** | Pattern-based coaching learned from *your* history — not generic advice. Detects long sleeps, Instagram-guilt, bots-over-ACCA, weekly trends. Supportive, never shaming. |
| **Weekly Report** | Auto-written every week: avg productive hours, best/worst day, biggest improvement, biggest time waste, study/bot/entertainment %, sleep avg, overall score. |
| **Goals** | 7-day rolling average vs target, with "+X minutes/day needed". |
| **Achievements** | Progress-based (not streaks): 100/500h ACCA, 100h Bot, first 8h/10h day, 7-day avg above 6h, etc. |
| **History** | Every logged day in a table; delete any entry. |

## The coaching rules (built in)

- **ACCA is #1.** A day with ACCA done counts as a success, even if the rest was quiet.
- Money & bots matter, but **never replace ACCA**.
- Focus is on **weekly averages**, not one perfect day.
- **Never shames you.** Scrolling is treated as a tiredness signal, not laziness.
- If ACCA slips a few days, it *gently* points back to the long-term goal.

## Customising

Open `config.js` to change targets, priorities, balance-score weights, or coach thresholds —
no need to touch `app.js`.

## Backup

Use **Export data** in the sidebar to save a `.json` backup, and **Import data** to restore it
(e.g. moving to a new computer).
