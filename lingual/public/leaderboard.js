// Leaderboard page: shows /api/leaderboard
const board = document.getElementById('board');
const medal = r => ['🥇', '🥈', '🥉'][r - 1] || '#' + r;

async function loadBoard() {
  board.innerHTML = '<p class="sub">Loading…</p>';
  try {
    const rows = await Lingual.api('/api/leaderboard');
    if (!rows.length) {
      board.innerHTML = '<div class="quiz"><p class="sub">No learners yet. Sign up, take a quiz and be the first on the board! 🚀</p></div>';
      return;
    }
    let html = '', prev = 0;
    rows.forEach(r => {
      if (r.rank > prev + 1) html += '<div class="lb-gap">⋯</div>'; // your row, far below the top 10
      html += `<div class="lb-row ${r.isMe ? 'me' : ''}">
        <span class="lb-rank">${medal(r.rank)}</span>
        <span class="lb-name">${Lingual.esc(r.name)}${r.isMe ? ' <em>(you)</em>' : ''}</span>
        <span class="lb-streak">🔥 ${r.streak}</span><span class="lb-xp">⭐ ${r.xp} XP</span></div>`;
      prev = r.rank;
    });
    if (!Lingual.token()) html += '<p class="sub">Sign in to see where you rank.</p>';
    board.innerHTML = `<div class="lb">${html}</div>`;
  } catch (e) {
    board.innerHTML = `<p class="err">${Lingual.esc(e.message)}</p>`;
  }
}
document.getElementById('refresh').onclick = loadBoard;
loadBoard();
