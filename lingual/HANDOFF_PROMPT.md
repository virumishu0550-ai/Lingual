# Paste this to the next AI together with the zip

I'm building "Lingual", a class project: a local-language learning website (Marathi, Hindi, Tamil, Gujarati, Sanskrit, Bengali). I'm attaching the project zip. Read README.md first.

**Stack:** Node.js + Express backend (server.js), JSON-file storage (data/db.json), vanilla HTML/CSS/JS frontend in /public. Auth = bcryptjs + JWT. Beginner-friendly: keep it simple, no frameworks, no heavy tooling, readable comments. Run steps are ONLY `npm install` and `npm start`.

**IMPORTANT NOTE:** `public/index.html` and `public/lingual.css` in the zip are PLACEHOLDERS. My real landing page (indigo #4F46E5, Montserrat; navbar `.nav-links` with Languages/Courses/Pricing/About, sections `.languages`, `.features`, `.how-it-works`, `.testimonials`) is on my machine. Never overwrite or restyle those two files; the server auto-injects extra.css + app.js into index.html. All new code must work with my real page (check elements exist before using them) and must not rename/rewrite my existing CSS classes. New styles go only at the end of `public/extra.css`.

**Already done (everything planned so far):**
- Landing integration: signup/login modal (browser + server validation, Enter key), navbar user stats, language grid from /api/languages
- learn.html/learn.js: language tabs, lesson picker (4 lessons per language, 8 words each), word cards with 🔊 listen, 5-question quiz per lesson, next-lesson button, loading/error states, daily goal indicator
- Server: quiz scoring (capped, deduped), XP, daily streak, best score per language and per lesson (`user.lessonProgress[langId][lessonId]`), `user.dailyGoal`, `user.daily`, validation, JSON errors, `normalize()` migration, 10kb body limit
- Leaderboard page + landing teaser; Profile page (XP, streak, level, goal picker, progress bars, lesson chips, certificate link)
- **Step 4 done:** Practice Speaking in learn.js (SpeechRecognition, `similarity()` edit distance on native script + romanization, best of 5 alternatives, digit handling for number words, clear messages for Firefox / no https / mic errors)
- **Step 5 done:** certificate.html/js (list + printable single certificate with print CSS); server `GET /api/certificate/:id` (403 + missing lessons unless best >= 80% on ALL lessons; date stored in `user.certs[langId]`, awarded at quiz submit); Pricing + About sections injected by app.js `addInfoSections()` (Pricing after `.how-it-works`, About after `.testimonials`; fall back to after the Top-learners block; nav Pricing/About scroll to them, falling back to the original selectors); `POST /api/waitlist` (stored in `db.waitlist`)
- **Step 6 done:** 401/expired token -> `Lingual.expire()` auto-logout + toast (server returns 401 for any invalid token, even on optional-auth routes); mobile CSS; README updated
- app.js helpers: `Lingual.esc`, `Lingual.api`, `Lingual.refreshMe`, `Lingual.goalHTML`, `Lingual.openAuth`, `Lingual.toast`, `Lingual.expire`
- Tested: 20+ API checks (curl) and 22 DOM checks (jsdom, mocked SpeechRecognition) against a landing page with `.nav-links`, `.how-it-works`, `.testimonials`. NOT tested in a real browser or on the user's real index.html.

**Still to do (in this order):**
1. Ask me what broke or looked wrong when I ran it with my real landing page / real browser (Chrome mic, mobile view, print preview of the certificate) and fix only that.
2. Optional extras if I ask: more lessons in data/languages.json, a lesson-completion celebration, accessibility pass (focus states, aria labels).

**Rules:** Return full contents of every changed/new file. Final output must be a project I can run in VS Code with only `npm install && npm start`. Test the API/pages before delivering.

## STRICT RULES ABOUT LIMITS (MANDATORY – DO NOT SKIP)
1. **Before your usage/message limit runs out, you MUST give me a ZIP file** of the entire project containing everything you have completed so far (frontend + backend, all files, including every change you made; leave out node_modules). Do not wait until the last message. If you think the limit is close, stop new work and produce the ZIP immediately.
2. **Along with that ZIP, you MUST also give me a NEW handoff prompt** that I can paste into the next AI. It must include: what the project is, the stack, what is already done (including your work), what is still remaining (in order), and the same strict rules below.
3. **Every handoff prompt you write MUST itself contain these same strict rules**, so the chain continues: each AI must always deliver (a) a ZIP of the project so far and (b) a new handoff prompt, before its limit is hit.
4. Never end your final message without both the ZIP and the handoff prompt. Giving only one of them is not acceptable.
5. Keep the run steps simple: `npm install` and `npm start` only. Tell me which files you changed in each step.
