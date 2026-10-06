// Lingual backend: Express + JSON-file storage + bcrypt/JWT auth
const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'lingual-class-project-secret';
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const PUBLIC = path.join(__dirname, 'public');
const QUIZ_SIZE = 5;            // questions per quiz
const GOAL_CHOICES = [20, 50, 100]; // allowed daily XP goals
const PASS_MARK = 80;       // best score (%) needed on EVERY lesson of a language to earn its certificate

// Each language has several lessons; each lesson is a list of [native, roman, english] words.
const LANGS = require('./data/languages.json').map(l => ({
  ...l,
  lessons: l.lessons.map(ls => ({
    ...ls,
    words: ls.words.map(([native, roman, english]) => ({ native, roman, english }))
  }))
}));
const findLang = id => LANGS.find(l => l.id === id);
const findLesson = (lang, id) => lang.lessons.find(x => x.id === (id || lang.lessons[0].id));

// ---- tiny JSON "database" ----
// normalize() gives older user records any fields added in later versions.
function normalize(u) {
  u.progress = u.progress || {};            // { languageId: best % across its lessons }
  u.lessonProgress = u.lessonProgress || {}; // { languageId: { lessonId: best % } }
  for (const id in u.progress)               // old accounts only had per-language scores = "basics"
    if (!u.lessonProgress[id]) u.lessonProgress[id] = { basics: u.progress[id] };
  u.dailyGoal = u.dailyGoal || 50;
  u.daily = u.daily || { date: null, xp: 0 }; // XP earned on one calendar day
  u.certs = u.certs || {};                    // { languageId: 'YYYY-MM-DD' the certificate was earned }
  return u;
}
const loadDB = () => {
  try { const d = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); d.users = (d.users || []).map(normalize); return d; }
  catch { return { users: [] }; }
};
const saveDB = d => fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2));
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
const today = (offset = 0) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);

app.use(express.json({ limit: '10kb' })); // small limit: nobody needs to send more than this

// Serves index.html and auto-adds extra.css + app.js (so your original HTML needs no edits)
app.get(['/', '/index.html'], (req, res) => {
  let html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  if (!html.includes('app.js'))
    html = html.replace('</body>', '<link rel="stylesheet" href="extra.css"><script src="app.js"></script></body>');
  res.type('html').send(html);
});
app.use(express.static(PUBLIC));

// ---- auth helpers ----
const publicUser = u => ({
  name: u.name, email: u.email, xp: u.xp, streak: u.streak,
  progress: u.progress, lessonProgress: u.lessonProgress,
  dailyGoal: u.dailyGoal, certs: u.certs, todayXp: u.daily.date === today() ? u.daily.xp : 0
});
function auth(required) {
  return (req, res, next) => {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    if (!t) return required ? res.status(401).json({ error: 'Please sign in first' }) : next();
    // a token was sent: if it is expired/invalid say so (otherwise quiz progress would silently not be saved)
    try { req.userEmail = jwt.verify(t, SECRET).email; } catch { return res.status(401).json({ error: 'Your session expired. Please sign in again.' }); }
    next();
  };
}
const sign = u => jwt.sign({ email: u.email }, SECRET, { expiresIn: '7d' });

app.post('/api/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanName = String(name || '').trim();
  const mail = String(email || '').trim().toLowerCase();
  if (!cleanName || cleanName.length > 40) return res.status(400).json({ error: 'Please enter your name (max 40 characters)' });
  if (!/^\S+@\S+\.\S+$/.test(mail)) return res.status(400).json({ error: 'Please enter a valid email address' });
  if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const db = loadDB();
  if (db.users.find(u => u.email === mail)) return res.status(409).json({ error: 'Email already registered' });
  const user = normalize({ name: cleanName, email: mail, hash: bcrypt.hashSync(password, 8), xp: 0, streak: 0, lastActive: null });
  db.users.push(user); saveDB(db);
  res.json({ token: sign(user), user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = loadDB().users.find(u => u.email === String(email || '').trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ''), user.hash)) return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get('/api/me', auth(true), (req, res) => {
  const user = loadDB().users.find(u => u.email === req.userEmail);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json(publicUser(user));
});

// Change the daily XP goal (20, 50 or 100)
app.post('/api/goal', auth(true), (req, res) => {
  const goal = Number((req.body || {}).goal);
  if (!GOAL_CHOICES.includes(goal)) return res.status(400).json({ error: 'Goal must be one of: ' + GOAL_CHOICES.join(', ') });
  const db = loadDB();
  const u = db.users.find(x => x.email === req.userEmail);
  if (!u) return res.status(401).json({ error: 'User not found' });
  u.dailyGoal = goal; saveDB(db);
  res.json(publicUser(u));
});

// ---- languages & lessons ----
// List view: no words, just lesson titles/counts (used by the home grid, tabs and profile page)
app.get('/api/languages', (req, res) =>
  res.json(LANGS.map(({ id, name, native, learners, code, lessons }) => ({
    id, name, native, learners, code,
    lessons: lessons.map(x => ({ id: x.id, title: x.title, icon: x.icon, count: x.words.length }))
  }))));

// Full view: includes every lesson with its words
app.get('/api/languages/:id', (req, res) => {
  const l = findLang(req.params.id);
  l ? res.json(l) : res.status(404).json({ error: 'Language not found' });
});

// ---- quiz: 5 questions, 4 options each, taken from ONE lesson (?lesson=numbers) ----
app.get('/api/quiz/:id', (req, res) => {
  const l = findLang(req.params.id);
  if (!l) return res.status(404).json({ error: 'Language not found' });
  const lesson = findLesson(l, req.query.lesson);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const everyWord = l.lessons.flatMap(x => x.words);
  const questions = shuffle(lesson.words).slice(0, QUIZ_SIZE).map(w => {
    // wrong answers: prefer words from the same lesson, fall back to the whole language
    const wrong = [...new Set([...shuffle(lesson.words), ...shuffle(everyWord)].map(x => x.english))]
      .filter(e => e !== w.english).slice(0, 3);
    return { native: w.native, roman: w.roman, options: shuffle([w.english, ...wrong]) };
  });
  res.json({ language: l.name, lesson: lesson.id, questions });
});

app.post('/api/quiz/:id/submit', auth(false), (req, res) => {
  const l = findLang(req.params.id);
  if (!l) return res.status(404).json({ error: 'Language not found' });
  const body = req.body || {};
  const lesson = findLesson(l, body.lesson);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  // validation: at most QUIZ_SIZE answers, each word only counted once (stops XP farming)
  const seen = new Set();
  const answers = (Array.isArray(body.answers) ? body.answers : []).slice(0, QUIZ_SIZE)
    .filter(a => a && typeof a.native === 'string' && typeof a.choice === 'string' && !seen.has(a.native) && seen.add(a.native));
  if (!answers.length) return res.status(400).json({ error: 'No answers were sent' });
  const results = answers.map(a => {
    const w = lesson.words.find(x => x.native === a.native);
    return { native: a.native, correct: !!w && w.english === a.choice, answer: w ? w.english : '' };
  });
  const score = results.filter(r => r.correct).length;
  const percent = Math.round((score / results.length) * 100);
  let user = null;
  if (req.userEmail) {
    const db = loadDB();
    const u = db.users.find(x => x.email === req.userEmail);
    if (u) {
      // best score for this lesson, and the best across the language (shown on the home cards)
      const lp = u.lessonProgress[l.id] = u.lessonProgress[l.id] || {};
      lp[lesson.id] = Math.max(lp[lesson.id] || 0, percent);
      u.progress[l.id] = Math.max(...Object.values(lp));
      awardCert(u, l);
      u.xp += score * 10;
      // today's XP (for the daily-goal indicator); starts again from 0 on a new day
      if (u.daily.date !== today()) u.daily = { date: today(), xp: 0 };
      u.daily.xp += score * 10;
      // streak
      if (u.lastActive !== today()) u.streak = u.lastActive === today(1) ? u.streak + 1 : 1;
      u.lastActive = today();
      saveDB(db); user = publicUser(u);
    }
  }
  res.json({ score, total: results.length, percent, results, user });
});

// ---- certificates: earned when EVERY lesson of a language has a best score >= PASS_MARK ----
const missingLessons = (u, l) => l.lessons.filter(x => ((u.lessonProgress[l.id] || {})[x.id] || 0) < PASS_MARK);
// remembers the day the certificate was first earned (the date on the certificate never changes later)
function awardCert(u, l) { if (!missingLessons(u, l).length && !u.certs[l.id]) u.certs[l.id] = today(); }

app.get('/api/certificate/:id', auth(true), (req, res) => {
  const l = findLang(req.params.id);
  if (!l) return res.status(404).json({ error: 'Language not found' });
  const db = loadDB();
  const u = db.users.find(x => x.email === req.userEmail);
  if (!u) return res.status(401).json({ error: 'User not found' });
  const missing = missingLessons(u, l);
  if (missing.length)
    return res.status(403).json({ error: `Score ${PASS_MARK}% or more on every lesson first. Still to do: ${missing.map(x => x.title).join(', ')}`, missing: missing.map(x => x.title) });
  if (!u.certs[l.id]) { awardCert(u, l); saveDB(db); }   // old accounts that qualified before certificates existed
  const code = 'LNG-' + crypto.createHash('sha1').update(u.email + ':' + l.id).digest('hex').slice(0, 8).toUpperCase();
  res.json({ name: u.name, language: l.name, native: l.native, date: u.certs[l.id], code, lessons: l.lessons.length });
});

// ---- pricing page: "Join the waitlist" for the (not yet built) Plus plan. Just saves the email ----
app.post('/api/waitlist', (req, res) => {
  const mail = String((req.body || {}).email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(mail) || mail.length > 100) return res.status(400).json({ error: 'Please enter a valid email address' });
  const db = loadDB();
  db.waitlist = db.waitlist || [];
  if (db.waitlist.length >= 1000) return res.status(429).json({ error: 'The waitlist is full for now' });
  if (!db.waitlist.some(w => w.email === mail)) { db.waitlist.push({ email: mail, date: today() }); saveDB(db); }
  res.json({ ok: true, message: "You're on the list! We'll email you when Plus launches." });
});

// ---- leaderboard: top 10 by XP. If you're signed in and not in the top 10, your own row is added at the end ----
app.get('/api/leaderboard', auth(false), (req, res) => {
  const ranked = loadDB().users
    .sort((a, b) => b.xp - a.xp || b.streak - a.streak || a.name.localeCompare(b.name))
    .map((u, i) => ({ rank: i + 1, name: u.name, xp: u.xp, streak: u.streak, isMe: u.email === req.userEmail }));
  const rows = ranked.slice(0, 10);
  const me = ranked.find(r => r.isMe);
  if (me && me.rank > 10) rows.push(me);
  res.json(rows);
});

// ---- friendly JSON errors instead of HTML error pages ----
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: 'Bad request' }));

app.listen(PORT, () => console.log(`Lingual running → http://localhost:${PORT}`));
