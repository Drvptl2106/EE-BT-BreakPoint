import { esc } from './dom.js';
import { displayName } from './selectors.js';

/** rows: [{ user, streak, todayOver }] */
export function leaderboardHtml(rows, config) {
  const ranked = [...rows].sort((a, b) => b.streak - a.streak || displayName(a.user).localeCompare(displayName(b.user)));
  return ranked.map(({ user, streak, todayOver }, i) => {
    const first = i === 0 && streak > 0;
    return `
      <div class="lb-row ${first ? 'lb-first' : ''}">
        <div class="lb-rank">${i + 1}</div>
        <div class="lb-name"><span class="avatar">${esc(user.initials)}</span>${esc(displayName(user))}</div>
        <div class="lb-today ${todayOver ? 'broken' : 'clean'}">${todayOver ? 'over today' : 'on track today'}</div>
        <div>
          <div class="lb-streak">${streak}</div>
          <div class="lb-streak-label">day streak</div>
        </div>
        ${first ? `<div class="lb-reward">\ud83c\udfc6 ${esc(config.rewardLabel)}</div>` : ''}
      </div>`;
  }).join('');
}
