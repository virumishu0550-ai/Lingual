# Lingual – Local Language Learner (Frontend + Backend)

Stack: Node.js + Express, JSON file storage (no database to install), vanilla HTML/CSS/JS.

## Run it (VS Code terminal)
1. **Copy your original files** into `public/` and overwrite the placeholders:
   - your `index.html`  → `public/index.html`
   - your `lingual.css` → `public/lingual.css`
   (No edits needed. The server auto-injects `extra.css` + `app.js` into your index.html.)
2. `npm install`
3. `npm start`
4. Open http://localhost:3000

Needs Node.js 18+ (check with `node -v`). Stop the server with Ctrl+C.

## What works
- Sign up / log in (bcrypt-hashed passwords, JWT token) with input validation
- 6 languages (Marathi, Hindi, Tamil, Gujarati, Sanskrit, Bengali) loaded from the API into your language grid
- **4 lessons per language** (Basics, Greetings, Numbers 1–8, Useful Phrases) with a **lesson picker** on `learn.html`
- Word cards with romanization + 🔊 pronunciation (browser speech), then a 5-question quiz per lesson
- Quiz scoring on the server → XP, daily streak, best score per lesson and per language
- **Daily goal** indicator (20 / 50 / 100 XP, change it on the profile page)
- **Leaderboard** page (`leaderboard.html`) + a "Top learners" teaser on the landing page
- **Profile / dashboard** (`profile.html`): XP, streak, level, daily goal, progress bar per language with lesson chips
- Navbar links (Learn · Leaderboard · Certificates · Profile) are added automatically by `app.js`
- **Practice Speaking** 🎤 on every word card (Web Speech API). Say the word, get a % match and feedback. Works in Chrome, Edge and Safari; Firefox shows a clear "not supported" message (listening + quizzes still work). Needs a microphone and `localhost`/https.
- **Certificates** (`certificate.html`): earned when your best score is 80%+ on EVERY lesson of a language. Printable (🖨 button → Save as PDF), shows your name, date and a certificate ID. `certificate.html` lists all languages; `certificate.html?lang=hindi` shows one.
- **Pricing + About** sections are added to the landing page by `app.js` (Pricing after `.how-it-works`, About after `.testimonials`). The navbar Pricing/About links scroll to them (falling back to your original sections if they're missing). The Plus plan has a working "Join the waitlist" form.
- **Polish:** expired/invalid login token → automatic logout with a message; form validation in the browser and on the server; loading + error (with retry) states on every page; mobile layouts; small request-size limit

## API
| Method | Route | Purpose |
|---|---|---|
| POST | /api/signup, /api/login | auth (returns token) |
| GET | /api/me | profile + stats (token) |
| POST | /api/goal | set daily XP goal: 20, 50 or 100 (token) |
| GET | /api/languages | languages with lesson titles (no words) |
| GET | /api/languages/:id | one language with every lesson + words |
| GET | /api/quiz/:id?lesson=numbers | random 5-question quiz from one lesson |
| POST | /api/quiz/:id/submit | body `{lesson, answers}`; scores, saves progress if logged in |
| GET | /api/leaderboard | top 10 by XP (+ your own row if you're lower) |
| GET | /api/certificate/:id | your certificate data (token); 403 + missing lessons if not earned yet |
| POST | /api/waitlist | body `{email}`; saves the email for the Plus plan waitlist |

An expired or invalid token always gives HTTP 401, and the browser logs the user out automatically.

## Files
`server.js` (all backend) · `data/languages.json` (languages → lessons → words, add more here) · `data/db.json` (users, auto-saved) · `public/app.js` (shared: login, navbar, 401 handling, Pricing/About sections, home wiring) · `public/learn.html|js` (lessons/quiz/speaking practice) · `public/leaderboard.html|js` · `public/profile.html|js` · `public/certificate.html|js` · `public/extra.css` (styles for all backend features)

## Adding a lesson
In `data/languages.json`, add an object to a language's `lessons` array:
`{"id":"food","title":"Food","icon":"🍛","words":[["native","Roman","English"], ...]}` – use 5+ words with different English meanings.

## Notes
- Speech recognition sends audio to the browser vendor's service (Google in Chrome), so it needs internet.
- Data lives in `data/db.json` (users + the Plus waitlist). Delete the file's contents back to `{"users":[]}` to reset.
- Optionally set a real secret before sharing the site: `JWT_SECRET=something-long npm start`.
