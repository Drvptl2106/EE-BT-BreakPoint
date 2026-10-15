/** rows: [{ day, isToday, taken, of, totalMin, hasActivity, anyOver }] */
export function historyHtml(rows) {
  return rows.map((r) => `
    <tr>
      <td>${r.day}${r.isToday ? ' (today)' : ''}</td>
      <td>${r.taken} of ${r.of}</td>
      <td class="cell-mins">${Math.round(r.totalMin)} min</td>
      <td>${!r.hasActivity
        ? '<span class="flag-none">no activity</span>'
        : r.anyOver
          ? '<span class="flag-badge">\u26a0 over</span>'
          : '<span style="color:var(--live);font-family:var(--font-mono);font-size:12px;">clean</span>'}</td>
    </tr>`).join('');
}
