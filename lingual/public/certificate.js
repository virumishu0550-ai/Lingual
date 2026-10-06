// Certificate page.
//   certificate.html            -> list of all languages and which certificates you have earned
//   certificate.html?lang=hindi -> the printable certificate (only if you scored 80%+ on EVERY lesson of that language)
const root = document.getElementById('cert');
const esc = Lingual.esc;
const lang = new URLSearchParams(location.search).get('lang');

function showError(e, retry) {
  root.innerHTML = `<div class="quiz"><p class="err">${esc(e.message)}</p><button class="btn-primary" id="c-retry">Try again</button></div>`;
  document.getElementById('c-retry').onclick = retry;
}

async function init() {
  if (!Lingual.token()) {
    root.innerHTML = `<div class="quiz"><p class="sub">Please sign in to see your certificates.</p>
      <p><button class="btn-primary" id="c-in">Sign In</button></p></div>`;
    document.getElementById('c-in').onclick = () => Lingual.openAuth('login');
    return;
  }
  root.innerHTML = '<p class="sub">Loading…</p>';
  try { lang ? await showCertificate() : await showList(); }
  catch (e) { showError(e, init); }
}

// ---- list of every language with its certificate status ----
async function showList() {
  const [me, langs] = await Promise.all([Lingual.refreshMe(), Lingual.api('/api/languages')]);
  document.title = 'Certificates – Lingual';
  root.innerHTML = `<p class="sub">Score <b>80% or more on every lesson</b> of a language to earn its certificate.</p>
    <div class="prog-grid">${langs.map(l => {
      const lp = me.lessonProgress[l.id] || {};
      const done = l.lessons.filter(x => (lp[x.id] || 0) >= 80).length;
      const earned = done === l.lessons.length;
      return `<div class="lang-prog"><div class="goal-top"><b>${l.native} · ${l.name}</b><span>${done}/${l.lessons.length}</span></div>
        <div class="q-bar"><div style="width:${Math.round((done / l.lessons.length) * 100)}%"></div></div>
        <small>${earned ? '🎓 Certificate earned!' : done + ' of ' + l.lessons.length + ' lessons at 80%+'}</small>
        <div class="chips">${earned
          ? `<a class="chip done" href="certificate.html?lang=${l.id}">🎓 View certificate</a>`
          : `<a class="chip" href="learn.html?lang=${l.id}">Keep learning →</a>`}</div></div>`;
    }).join('')}</div>`;
}

// ---- one certificate ----
async function showCertificate() {
  let c;
  try { c = await Lingual.api('/api/certificate/' + encodeURIComponent(lang)); }
  catch (e) {
    // 403 = not earned yet: the server tells us which lessons are missing
    root.innerHTML = `<div class="quiz"><div class="q-word">🔒</div><p class="err">${esc(e.message)}</p>
      <p><a class="btn-primary" href="learn.html?lang=${esc(lang)}">Go to the lessons</a></p>
      <p><a href="certificate.html">← All certificates</a></p></div>`;
    return;
  }
  document.title = `${c.language} Certificate – Lingual`;
  const date = new Date(c.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  root.innerHTML = `<div class="cert-actions"><button class="btn-primary" id="c-print">🖨 Print / Save as PDF</button>
      <a class="btn-ghost" href="certificate.html">← All certificates</a></div>
    <div class="certificate"><div class="cert-border">
      <div class="cert-logo">🌐 Lingual</div>
      <div class="cert-title">Certificate of Achievement</div>
      <p>This is to certify that</p>
      <div class="cert-name">${esc(c.name)}</div>
      <p>has completed all ${c.lessons} lessons of</p>
      <div class="cert-lang">${esc(c.language)} · ${esc(c.native)}</div>
      <p>scoring 80% or more in every lesson.</p>
      <div class="cert-foot"><div><b>${esc(date)}</b><span>Date</span></div><div><b>${esc(c.code)}</b><span>Certificate ID</span></div></div>
    </div></div>`;
  document.getElementById('c-print').onclick = () => window.print();
}
init();
