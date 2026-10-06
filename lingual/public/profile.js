// Profile / dashboard: XP, streak, daily goal and a progress bar for every language
const root = document.getElementById('profile');
const esc = Lingual.esc;
let langs = [];

async function loadProfile() {
  if (!Lingual.token()) {
    root.innerHTML = `<div class="quiz"><p class="sub">Please sign in to see your profile and progress.</p>
      <p><button class="btn-primary" id="p-in">Sign In</button></p></div>`;
    document.getElementById('p-in').onclick = () => Lingual.openAuth('login');
    return;
  }
  root.innerHTML = '<p class="sub">Loading…</p>';
  try {
    const [me, list] = await Promise.all([Lingual.refreshMe(), Lingual.api('/api/languages')]);
    langs = list;
    render(me);
  } catch (e) {
    root.innerHTML = `<div class="quiz"><p class="err">${esc(e.message)}</p>
      <button class="btn-primary" id="p-retry">Try again</button> <button class="btn-ghost" id="p-out">Log out</button></div>`;
    document.getElementById('p-retry').onclick = loadProfile;
    document.getElementById('p-out').onclick = Lingual.logout;
  }
}

function render(me) {
  const level = Math.floor(me.xp / 100) + 1;           // a new level every 100 XP
  const intoLevel = me.xp % 100;
  let mastered = 0;                                      // lessons with 80%+ best score

  const cards = langs.map(l => {
    const lp = me.lessonProgress[l.id] || {};
    const pct = Math.round(l.lessons.reduce((sum, x) => sum + (lp[x.id] || 0), 0) / l.lessons.length);
    const done = l.lessons.filter(x => (lp[x.id] || 0) >= 80).length;
    mastered += done;
    const chips = l.lessons.map(x => {
      const best = lp[x.id];
      return `<a class="chip ${best >= 80 ? 'done' : ''}" href="learn.html?lang=${l.id}&lesson=${x.id}">${x.icon} ${x.title} · ${best != null ? best + '%' : '–'}</a>`;
    }).join('');
    return `<div class="lang-prog"><div class="goal-top"><b>${l.native} · ${l.name}</b><span>${pct}%</span></div>
      <div class="q-bar"><div style="width:${pct}%"></div></div>
      <small>${done} of ${l.lessons.length} lessons mastered (80%+)</small><div class="chips">${chips}</div>
      ${done === l.lessons.length ? `<div class="chips"><a class="chip done" href="certificate.html?lang=${l.id}">🎓 Get your certificate</a></div>` : ''}</div>`;
  }).join('');

  root.innerHTML = `
    <div class="prof-head"><div class="avatar">${esc(me.name.charAt(0).toUpperCase())}</div>
      <div><h2>${esc(me.name)}</h2><p class="sub">${esc(me.email)}</p></div></div>
    <div class="stat-grid">
      <div class="stat"><b>⭐ ${me.xp}</b><span>Total XP</span></div>
      <div class="stat"><b>🔥 ${me.streak}</b><span>Day streak</span></div>
      <div class="stat"><b>🎖 Level ${level}</b><span>${100 - intoLevel} XP to next</span></div>
      <div class="stat"><b>✅ ${mastered}</b><span>Lessons mastered</span></div>
    </div>
    ${Lingual.goalHTML(me)}
    <div class="goal-pick"><span class="sub">Change daily goal:</span>
      ${[20, 50, 100].map(g => `<button class="chip ${me.dailyGoal === g ? 'done' : ''}" data-goal="${g}">${g} XP</button>`).join('')}</div>
    <h2 class="sec-title">Progress by language</h2>
    <div class="prog-grid">${cards}</div>`;

  root.querySelectorAll('[data-goal]').forEach(b => b.onclick = async () => {
    try { render(await Lingual.api('/api/goal', { method: 'POST', body: { goal: Number(b.dataset.goal) } })); }
    catch (e) { alert(e.message); }
  });
}
loadProfile();
