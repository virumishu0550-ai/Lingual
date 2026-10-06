// Learn page: language tabs -> lesson picker -> word cards -> 5-question quiz
const params = new URLSearchParams(location.search);
let lang = params.get('lang') || 'marathi';
let lessonId = params.get('lesson');   // which lesson is open (basics, greetings, numbers, phrases)
let langs = [], detail = null;
const $ = id => document.getElementById(id);
const esc = Lingual.esc;

function speak(text, code) {
  if (!('speechSynthesis' in window)) return alert('Speech not supported in this browser');
  const u = new SpeechSynthesisUtterance(text); u.lang = code; u.rate = 0.85;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

// ---------- Practice Speaking (browser Web Speech API: SpeechRecognition) ----------
// Works in Chrome, Edge and Safari. Firefox has no SpeechRecognition, so we show a clear message there.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let session = null;   // the speaking attempt that is listening right now: { rec, btn, done }

// Makes two spellings comparable: lower case, no spaces/punctuation/danda (।), no zero-width characters, no accents
const clean = s => String(s).normalize('NFC').toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[\s\p{P}\p{S}]/gu, '');
const plain = s => clean(String(s).normalize('NFD').replace(/\p{M}/gu, ''));   // for romanized text: also drop accent marks

// Edit distance (how many letter changes turn a into b) -> similarity from 0 to 1
function similarity(a, b) {
  a = Array.from(a); b = Array.from(b);
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

// Speech engines often write numbers as digits ("2"), so accept the digit for the number words
const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

// Compare everything the browser thought it heard with the target word; keep the best match
function judge(heard, w) {
  let best = 0, shown = heard[0] || '';
  heard.forEach(h => {
    let sc = Math.max(similarity(clean(h), clean(w.native)), similarity(plain(h), plain(w.roman)));
    if (NUMBERS[w.english.toLowerCase()] && clean(h) === String(NUMBERS[w.english.toLowerCase()])) sc = 1;
    if (sc > best) { best = sc; shown = h; }
  });
  return { percent: Math.round(best * 100), shown };
}

function stopListening() { if (session) { session.done = true; session.rec.abort(); session = null; } }

function practice(btn, w) {
  const out = btn.closest('.word').querySelector('.sp-result');
  const same = session && session.btn === btn;
  stopListening();
  if (same) return;                                   // second tap on the same button = cancel
  const rec = new SR();
  rec.lang = detail.code; rec.maxAlternatives = 5; rec.interimResults = false; rec.continuous = false;
  const me = session = { rec, btn, done: false };
  const say = (cls, html) => { out.className = 'sp-result ' + cls; out.innerHTML = html; };
  btn.textContent = '🎤 Listening… tap to cancel'; btn.classList.add('live'); say('', '');

  rec.onresult = e => {
    me.done = true;
    const r = judge(Array.from(e.results[0]).map(x => x.transcript), w);
    if (r.percent >= 85) say('ok', `✅ Great! <b>${r.percent}%</b> match.`);
    else if (r.percent >= 60) say('mid', `👍 Almost there – <b>${r.percent}%</b>. I heard “${esc(r.shown)}”. Try again.`);
    else say('no', `🔁 Not quite – <b>${r.percent}%</b>. I heard “${esc(r.shown)}”. Tap 🔊 Listen, then try again.`);
  };
  rec.onerror = e => {
    if (me.done) return; me.done = true;
    const msg = {
      'not-allowed': 'Microphone is blocked. Click the 🔒 icon in the address bar, allow the microphone, and try again.',
      'service-not-allowed': 'Microphone is blocked. Click the 🔒 icon in the address bar, allow the microphone, and try again.',
      'no-speech': "I didn't hear anything. Tap 🎤 and speak a little louder.",
      'audio-capture': 'No microphone was found. Plug one in and try again.',
      'network': 'Speech recognition needs an internet connection.',
      'language-not-supported': `This browser can't recognise ${detail.name} speech. Try Chrome.`
    }[e.error] || 'Something went wrong with the microphone. Please try again.';
    say('no', '⚠ ' + esc(msg));
  };
  rec.onend = () => {
    btn.textContent = '🎤 Speak'; btn.classList.remove('live');
    if (session === me) session = null;
    if (!me.done) { me.done = true; say('no', "⚠ I didn't catch that. Please try again."); }
  };
  try { rec.start(); } catch { me.done = true; btn.textContent = '🎤 Speak'; btn.classList.remove('live'); session = null; say('no', '⚠ Could not start the microphone. Please try again.'); }
}

// One-line note shown above the word cards when speaking practice can't work in this browser
function speakNote() {
  if (!SR) return '<p class="note">🎤 <b>Practice Speaking</b> is not supported in this browser (Firefox does not have it). Please open Lingual in <b>Chrome, Edge or Safari</b>. Listening and quizzes still work here.</p>';
  if (!window.isSecureContext) return '<p class="note">🎤 Practice Speaking needs <b>https</b> or <b>localhost</b> to use the microphone.</p>';
  return '<p class="sub">Tap 🎤 Speak and say the word out loud – you will get instant feedback.</p>';
}

// Friendly error box with a retry button
function showError(e, retry) {
  $('view').innerHTML = `<div class="quiz"><p class="err">${esc(e.message)}</p><button class="btn-primary" id="retry">Try again</button></div>`;
  $('retry').onclick = retry;
}

// Daily goal indicator (needs a signed-in user)
function renderGoal(user) {
  $('goal').innerHTML = user ? Lingual.goalHTML(user) : '<p class="sub">🎯 Sign in to track your daily XP goal and streak.</p>';
}

async function init() {
  try {
    if (!langs.length) langs = await Lingual.api('/api/languages');
    if (!langs.find(l => l.id === lang)) lang = langs[0].id;
    $('tabs').innerHTML = langs.map(l => `<button class="tab ${l.id === lang ? 'on' : ''}" data-id="${l.id}">${l.name}</button>`).join('');
    $('tabs').onclick = e => {
      if (e.target.dataset.id) { lang = e.target.dataset.id; lessonId = null; init(); }
    };
    renderGoal(Lingual.token() ? await Lingual.refreshMe().catch(() => Lingual.user()) : null);
    await showLesson();
  } catch (e) { $('title').textContent = 'Oops'; showError(e, init); }
}

async function showLesson() {
  stopListening();
  $('view').innerHTML = '<p class="sub">Loading…</p>';
  try {
    detail = await Lingual.api('/api/languages/' + lang);
    const lesson = detail.lessons.find(x => x.id === lessonId) || detail.lessons[0];
    lessonId = lesson.id;
    history.replaceState(null, '', `?lang=${lang}&lesson=${lessonId}`);
    const best = ((Lingual.user() || {}).lessonProgress || {})[lang] || {};
    $('title').textContent = `${detail.name} · ${detail.native}`;
    $('view').innerHTML = `
      <div class="lessons">${detail.lessons.map(x => `<button class="lesson-btn ${x.id === lessonId ? 'on' : ''}" data-l="${x.id}">
        <span>${x.icon} ${x.title}</span><small>${best[x.id] != null ? 'Best ' + best[x.id] + '%' : x.words.length + ' words'}</small></button>`).join('')}</div>
      ${detail.lessons.every(x => best[x.id] >= 80) ? `<a class="cert-banner" href="certificate.html?lang=${lang}">🎓 You mastered every ${detail.name} lesson – get your certificate →</a>` : ''}
      <p class="sub">Tap 🔊 to hear each word, then take the quiz.</p>${speakNote()}
      <div class="words">${lesson.words.map((w, i) => `<div class="word"><div class="w-native">${w.native}</div>
        <div class="w-roman">${w.roman}</div><div class="w-en">${w.english}</div>
        <div class="w-actions"><button class="speak listen" data-i="${i}">🔊 Listen</button>
        <button class="speak say" data-i="${i}" ${SR && window.isSecureContext ? '' : 'disabled title="Not supported in this browser"'}>🎤 Speak</button></div>
        <div class="sp-result" aria-live="polite"></div></div>`).join('')}</div>
      <button class="btn-primary" id="startq">Start Quiz</button>`;
    $('view').querySelectorAll('.lesson-btn').forEach(b => b.onclick = () => { lessonId = b.dataset.l; showLesson(); });
    $('view').querySelectorAll('.listen').forEach(b => b.onclick = () => speak(lesson.words[b.dataset.i].native, detail.code));
    $('view').querySelectorAll('.say').forEach(b => b.onclick = () => practice(b, lesson.words[b.dataset.i]));
    $('startq').onclick = startQuiz;
  } catch (e) { showError(e, showLesson); }
}

async function startQuiz() {
  stopListening();
  let q;
  try { q = await Lingual.api(`/api/quiz/${lang}?lesson=${lessonId}`); }
  catch (e) { return showError(e, startQuiz); }
  const answers = []; let i = 0;
  const render = () => {
    if (i >= q.questions.length) return finish();
    const x = q.questions[i];
    $('view').innerHTML = `<div class="quiz"><p class="sub">Question ${i + 1} of ${q.questions.length}</p>
      <div class="q-bar"><div style="width:${(i / q.questions.length) * 100}%"></div></div>
      <div class="q-word ${x.native.length > 10 ? 'long' : ''}">${x.native}</div><div class="w-roman">${x.roman}</div>
      <div class="opts">${x.options.map(o => `<button class="opt">${o}</button>`).join('')}</div></div>`;
    $('view').querySelectorAll('.opt').forEach(b => b.onclick = () => { answers.push({ native: x.native, choice: b.textContent }); i++; render(); });
  };
  const finish = async () => {
    $('view').innerHTML = '<div class="quiz"><p class="sub">Checking your answers…</p></div>';
    let r;
    try { r = await Lingual.api(`/api/quiz/${lang}/submit`, { method: 'POST', body: { lesson: lessonId, answers } }); }
    catch (e) { return showError(e, finish); }
    if (r.user) { Lingual.set(null, r.user); renderGoal(r.user); }
    const idx = detail.lessons.findIndex(x => x.id === lessonId), next = detail.lessons[idx + 1];
    const mine = r.user ? (r.user.lessonProgress || {})[lang] || {} : {};
    const earned = r.user && detail.lessons.every(x => mine[x.id] >= 80);   // 80%+ on every lesson
    $('view').innerHTML = `<div class="quiz"><div class="q-word">${r.percent}%</div>
      <p class="sub">You got ${r.score} of ${r.total} right ${r.percent >= 80 ? '🎉' : '💪'}</p>
      ${r.results.map(x => `<p class="res ${x.correct ? 'ok' : 'no'}">${x.correct ? '✔' : '✘'} ${x.native} = ${x.answer}</p>`).join('')}
      ${r.user ? `<p class="sub">+${r.score * 10} XP · 🔥 ${r.user.streak} day streak</p>` : '<p class="sub">Sign in to save your progress and streak.</p>'}
      ${earned ? `<p><a class="btn-primary" href="certificate.html?lang=${lang}">🎓 Get your ${esc(detail.name)} certificate</a></p>` : ''}
      <button class="btn-primary" id="again">Try again</button> <button class="btn-ghost" id="back">Back to words</button>
      ${next ? `<button class="btn-ghost" id="next">Next: ${next.title} →</button>` : ''}</div>`;
    $('again').onclick = startQuiz; $('back').onclick = showLesson;
    if (next) $('next').onclick = () => { lessonId = next.id; showLesson(); };
  };
  render();
}
init();
