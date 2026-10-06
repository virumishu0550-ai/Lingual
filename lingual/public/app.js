// Shared by index.html (auto-injected by server) and every other page
const L = window.Lingual = {
  token: () => localStorage.getItem('lt'),
  user: () => JSON.parse(localStorage.getItem('lu') || 'null'),
  set(token, user) { if (token) localStorage.setItem('lt', token); localStorage.setItem('lu', JSON.stringify(user)); },
  logout() { localStorage.removeItem('lt'); localStorage.removeItem('lu'); location.reload(); },
  // Called automatically when the server says our token is expired/invalid (HTTP 401): log out and tell the user
  expire() {
    if (L.expiring) return; L.expiring = true;
    sessionStorage.setItem('lmsg', 'Your session expired. Please sign in again.');
    L.logout();
  },
  // Small message that fades away after a few seconds
  toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 5000);
  },
  // Escape text before putting it into innerHTML (user names are typed by users, so never trust them)
  esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  async api(url, opts = {}) {
    let r;
    const hadToken = !!L.token();
    try {
      r = await fetch(url, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...(L.token() ? { Authorization: 'Bearer ' + L.token() } : {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    } catch { throw new Error('Cannot reach the server. Is it running?'); }
    let data = {};
    try { data = await r.json(); } catch { /* not JSON */ }
    // 401 while signed in (not a wrong-password on the login form) = expired token -> auto logout
    if (r.status === 401 && hadToken && !/^\/api\/(login|signup)/.test(url)) { L.expire(); throw new Error(data.error || 'Please sign in again'); }
    if (!r.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  },
  // Fetch fresh stats for the signed-in user and save them in the browser
  refreshMe: () => L.api('/api/me').then(f => { L.set(null, f); return f; }),
  // "Daily goal" card (used on the learn page and the profile page)
  goalHTML(u) {
    const goal = u.dailyGoal || 50, xp = u.todayXp || 0, pct = Math.min(100, Math.round((xp / goal) * 100));
    return `<div class="goal"><div class="goal-top"><b>🎯 Daily goal</b><span>${xp} / ${goal} XP today</span></div>
      <div class="q-bar"><div style="width:${pct}%"></div></div>
      <small>${xp >= goal ? 'Goal reached today! 🎉' : (goal - xp) + ' XP to go – finish a quiz to earn XP'}</small></div>`;
  }
};

function openAuth(mode = 'login') {
  document.getElementById('auth-modal')?.remove();
  const m = document.createElement('div');
  m.id = 'auth-modal'; m.className = 'modal-bg';
  m.innerHTML = `<div class="modal"><button class="modal-x" aria-label="Close">&times;</button>
    <h2>${mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
    <p class="modal-sub">${mode === 'login' ? 'Sign in to save your streak and progress.' : 'Start learning a local language today.'}</p>
    ${mode === 'signup' ? '<input id="a-name" placeholder="Your name" maxlength="40">' : ''}
    <input id="a-email" type="email" placeholder="Email"><input id="a-pass" type="password" placeholder="Password (6+ characters)">
    <p class="modal-err" id="a-err"></p>
    <button class="btn-primary" id="a-go">${mode === 'login' ? 'Sign In' : 'Get Started'}</button>
    <p class="modal-switch">${mode === 'login' ? "New here? <a href='#' id='a-sw'>Create an account</a>" : "Have an account? <a href='#' id='a-sw'>Sign in</a>"}</p></div>`;
  document.body.appendChild(m);
  m.onclick = e => { if (e.target === m || e.target.className === 'modal-x') m.remove(); };
  m.querySelector('#a-sw').onclick = e => { e.preventDefault(); openAuth(mode === 'login' ? 'signup' : 'login'); };
  const err = m.querySelector('#a-err'), go = m.querySelector('#a-go');
  m.querySelector('input').focus();
  m.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); }));
  go.onclick = async () => {
    const body = { email: m.querySelector('#a-email').value.trim(), password: m.querySelector('#a-pass').value };
    if (mode === 'signup') body.name = m.querySelector('#a-name').value.trim();
    // check the form in the browser first, so the user gets instant feedback
    if (mode === 'signup' && !body.name) return (err.textContent = 'Please enter your name');
    if (!/^\S+@\S+\.\S+$/.test(body.email)) return (err.textContent = 'Please enter a valid email address');
    if (!body.password || (mode === 'signup' && body.password.length < 6)) return (err.textContent = mode === 'signup' ? 'Password must be at least 6 characters' : 'Please enter your password');
    err.textContent = ''; go.disabled = true; go.textContent = 'Please wait…';
    try {
      const d = await L.api('/api/' + mode, { method: 'POST', body });
      L.set(d.token, d.user); location.reload();
    } catch (e) { err.textContent = e.message; go.disabled = false; go.textContent = mode === 'login' ? 'Sign In' : 'Get Started'; }
  };
}
L.openAuth = openAuth;

function setupNav() {
  const box = document.querySelector('.nav-buttons');
  if (!box) return;
  const u = L.user();
  if (u && L.token()) {
    box.innerHTML = `<span class="nav-user">🔥 ${u.streak} · ⭐ ${u.xp} XP · ${L.esc(u.name.split(' ')[0])}</span><button class="sign-in" id="n-out">Log out</button>`;
    box.querySelector('#n-out').onclick = L.logout;
    L.api('/api/me').then(f => L.set(null, f)).catch(() => {});
  } else {
    box.querySelector('.sign-in').onclick = () => openAuth('login');
    box.querySelector('.get-started').onclick = () => openAuth('signup');
  }
}

// Adds Learn / Leaderboard / Profile links to the navbar.
// Your landing page has a .nav-links list, so we add to it; other pages get a small .page-links row.
function addNavLinks() {
  const links = [['Learn', 'learn.html'], ['Leaderboard', 'leaderboard.html']];
  if (L.user() && L.token()) links.push(['Certificates', 'certificate.html'], ['Profile', 'profile.html']);
  const here = location.pathname.split('/').pop();
  const bar = document.querySelector('.nav-links');
  if (bar) {
    const useLi = !!bar.querySelector('li') || bar.tagName === 'UL';
    links.forEach(([t, h]) => {
      const a = `<a href="${h}">${t}</a>`;
      (bar.querySelector('ul') || bar).insertAdjacentHTML('beforeend', useLi ? `<li>${a}</li>` : a);
    });
  } else {
    const buttons = document.querySelector('.nav-buttons');
    if (!buttons) return;
    const div = document.createElement('div');
    div.className = 'page-links';
    // Pricing / About live on the landing page (added by addInfoSections below)
    const all = [...links, ['Pricing', 'index.html#pricing'], ['About', 'index.html#about']];
    div.innerHTML = all.map(([t, h]) => `<a href="${h}" class="${here === h ? 'on' : ''}">${t}</a>`).join('');
    buttons.parentNode.insertBefore(div, buttons);
  }
}

function setupHome() {
  const grid = document.querySelector('.language-grid');
  if (!grid) return;
  // go('#a', '.b') scrolls to the first selector that exists on the page
  const go = (...sels) => sels.map(s => document.querySelector(s)).find(Boolean)?.scrollIntoView({ behavior: 'smooth' });
  document.querySelectorAll('.nav-links a').forEach(a => {
    // Pricing/About go to the sections added below; if they are missing, your original mapping is used
    const map = { Languages: ['.languages'], Courses: ['.features'], Pricing: ['#lingual-pricing', '.how-it-works'], About: ['#lingual-about', '.testimonials'] };
    const t = map[a.textContent.trim()];
    a.onclick = e => { e.preventDefault(); t ? go(...t) : window.scrollTo({ top: 0, behavior: 'smooth' }); };
  });
  document.querySelector('.start-learning')?.addEventListener('click', () => go('.languages'));
  document.querySelector('.explore')?.addEventListener('click', () => go('.features'));
  document.querySelector('.start-btn')?.addEventListener('click', () => (location.href = 'learn.html?lang=marathi'));
  document.querySelector('.explore-btn')?.addEventListener('click', () => go('.languages'));
  grid.innerHTML = '<p class="sub">Loading languages…</p>';
  L.api('/api/languages').then(langs => {
    fillAboutStats(langs);
    const p = (L.user() || {}).progress || {};
    grid.innerHTML = langs.map(l => `<a class="language-card" href="learn.html?lang=${l.id}">
      <div class="flag">${l.native}</div><h3>${l.name}</h3><p>${l.learners}</p>
      <span class="best">${p[l.id] != null ? 'Best score: ' + p[l.id] + '%' : 'Start lesson →'}</span></a>`).join('');
  }).catch(e => { grid.innerHTML = `<p class="err">${L.esc(e.message)}</p>`; });
  addLeaderboardTeaser(grid);
  addInfoSections();
  // links like index.html#pricing from the other pages
  const hashTarget = { '#pricing': '#lingual-pricing', '#about': '#lingual-about' }[location.hash];
  if (hashTarget) setTimeout(() => go(hashTarget), 100);
}

// A small "Top learners" section placed right after the languages section on the landing page
function addLeaderboardTeaser(grid) {
  const after = grid.closest('section');
  if (!after) return;
  const sec = document.createElement('section');
  sec.className = 'lb-teaser';
  sec.innerHTML = `<div class="lb-wrap"><h2>🏆 Top learners</h2><div class="lb-mini">Loading…</div>
    <a class="lb-more" href="leaderboard.html">See the full leaderboard →</a></div>`;
  after.after(sec);
  const box = sec.querySelector('.lb-mini');
  L.api('/api/leaderboard').then(rows => {
    const medal = r => ['🥇', '🥈', '🥉'][r - 1] || '#' + r;
    box.innerHTML = rows.length
      ? rows.slice(0, 5).map(r => `<div class="lb-row ${r.isMe ? 'me' : ''}"><span class="lb-rank">${medal(r.rank)}</span>
          <span class="lb-name">${L.esc(r.name)}</span><span class="lb-xp">⭐ ${r.xp} XP</span></div>`).join('')
      : '<p class="sub">No learners yet – be the first on the board!</p>';
  }).catch(e => { box.innerHTML = `<p class="err">${L.esc(e.message)}</p>`; });
}

// ---- Pricing + About sections for the landing page ----
// Pricing goes after your .how-it-works section, About after .testimonials. If those don't exist they are
// placed after the "Top learners" block instead. Styles (.info-sec, .plan ...) are at the end of extra.css.
function addInfoSections() {
  const place = (sec, ...anchors) => {
    const a = anchors.map(s => document.querySelector(s)).find(Boolean);
    a ? a.after(sec) : document.body.appendChild(sec);
  };
  const signedIn = !!(L.user() && L.token());

  const pricing = document.createElement('section');
  pricing.id = 'lingual-pricing'; pricing.className = 'info-sec';
  pricing.innerHTML = `<div class="info-wrap"><h2>Simple pricing</h2>
    <p class="sub">Learning a local language should be affordable. Start free – no card needed.</p>
    <div class="plan-grid">
      <div class="plan"><h3>Free</h3><div class="price">₹0 <small>forever</small></div>
        <ul><li>✅ All 6 languages and every lesson</li><li>✅ Quizzes, XP, streaks and leaderboard</li>
          <li>✅ Practice Speaking</li><li>✅ Printable certificates</li></ul>
        <button class="btn-primary" id="plan-free">${signedIn ? 'Go to lessons' : 'Start learning free'}</button></div>
      <div class="plan plan-plus"><span class="plan-badge">Coming soon</span><h3>Plus</h3><div class="price">₹199 <small>/ month</small></div>
        <ul><li>⭐ Everything in Free</li><li>⭐ Extra lessons (food, travel, family)</li>
          <li>⭐ Offline word packs</li><li>⭐ Priority support</li></ul>
        <input type="email" id="wl-email" placeholder="Your email" maxlength="100" value="${signedIn ? L.esc(L.user().email || '') : ''}">
        <button class="btn-ghost" id="wl-go">Join the waitlist</button><p class="wl-msg" id="wl-msg"></p></div>
    </div></div>`;
  place(pricing, '.how-it-works', '.lb-teaser');
  pricing.querySelector('#plan-free').onclick = () => (signedIn ? (location.href = 'learn.html') : openAuth('signup'));
  pricing.querySelector('#wl-go').onclick = async () => {
    const msg = pricing.querySelector('#wl-msg'), btn = pricing.querySelector('#wl-go');
    const email = pricing.querySelector('#wl-email').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg.className = 'wl-msg bad'; return (msg.textContent = 'Please enter a valid email address'); }
    btn.disabled = true; msg.className = 'wl-msg'; msg.textContent = 'Saving…';
    try { msg.textContent = (await L.api('/api/waitlist', { method: 'POST', body: { email } })).message; }
    catch (e) { msg.className = 'wl-msg bad'; msg.textContent = e.message; }
    btn.disabled = false;
  };

  const about = document.createElement('section');
  about.id = 'lingual-about'; about.className = 'info-sec alt';
  about.innerHTML = `<div class="info-wrap"><h2>About Lingual</h2>
    <p class="sub">Lingual helps people learn the languages of India – the ones spoken in their own neighbourhood, by their grandparents and their neighbours.</p>
    <div class="about-stats" id="about-stats"></div>
    <div class="about-grid">
      <div class="about-card"><b>🗣 Hear it, say it</b><span>Every word has audio, and Practice Speaking listens to you and tells you how close you were.</span></div>
      <div class="about-card"><b>🔥 Small daily steps</b><span>Short 5-question quizzes, XP, streaks and a daily goal keep you coming back.</span></div>
      <div class="about-card"><b>🎓 Proof of progress</b><span>Score 80%+ on every lesson of a language and download your certificate.</span></div>
    </div>
    <p><a class="btn-primary" href="learn.html" style="text-decoration:none;display:inline-block">Start learning</a></p></div>`;
  place(about, '.testimonials', '#lingual-pricing');
}
// Fills the numbers in the About section once /api/languages has loaded
function fillAboutStats(langs) {
  const box = document.getElementById('about-stats');
  if (!box) return;
  const lessons = langs.reduce((n, l) => n + l.lessons.length, 0);
  const words = langs.reduce((n, l) => n + l.lessons.reduce((m, x) => m + x.count, 0), 0);
  box.innerHTML = [[langs.length, 'languages'], [lessons, 'lessons'], [words, 'words & phrases']]
    .map(([n, t]) => `<div class="stat"><b>${n}</b><span>${t}</span></div>`).join('');
}

// Show the "session expired" message (set by Lingual.expire) after the page reloads
const lmsg = sessionStorage.getItem('lmsg');
if (lmsg) { sessionStorage.removeItem('lmsg'); L.toast(lmsg); }

setupNav(); setupHome(); addNavLinks();
