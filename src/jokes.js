// The pep talk next to the shift pie: sales-floor motivation that changes with the time of day and the shift.
// Pure text, no storage. Change or add lines freely; {left} becomes the time left in the shift.
import { durHM } from './core.js';

const BY_HOUR = [
  [0, 9, 'Early start', ["Early calls are the warm-up. Smile, it carries down the line 📞", "First coffee, first customer, first win. In that order ☕", "Fresh day, fresh pipeline. Who's getting the first upgrade? 🚀"]],
  [9, 11, 'Morning push', ["Peak calling hours. Every 'no' gets you closer to a 'yes' 💪", "Customers are awake and so are you. Go and make someone's day 📱", "Listen first, offer second. That's where the best deals hide 🎧"]],
  [11, 13, 'Before lunch', ["Strong morning? Make it a stronger finish before lunch 🔥", "One more great conversation, then a well-earned lunch 🥪", "Ask one more question than you think you need. It pays 🙋"]],
  [13, 15, 'After lunch', ["Post-lunch slump? Not on your watch. Energy up, headset on ⚡", "Afternoon reset: new call, new chance, clean slate 🔄", "The best closers are the ones who keep their energy after lunch 💡"]],
  [15, 17, 'Afternoon', ["Home straight. A great afternoon turns a good day into a great one 🏃", "Check your numbers, pick your target, go and get it 🎯", "Stay curious with every customer. It's the secret sauce 🧂"]],
  [17, 24, 'Evening', ["Evening heroes close the day strong 🌙", "The last calls count just as much as the first. Finish proud 🏁", "Late shift legend. The team sees you 🫡"]],
];
const ON_BREAK = ["Phones down, shoulders down. You've earned this 😌", "Recharge properly. Your next call will thank you 🔋", "Breathe, stretch, hydrate. Back soon, back better 💧"];

/** Returns { kicker, text }. pct = how far through the shift (null = no end time yet, negative = not started). */
export function jokeFor(now, r, pct) {
  const tick = Math.floor(now / 300000);                       // a new line every 5 minutes
  if (r.active) return { kicker: 'On a break', text: ON_BREAK[tick % ON_BREAK.length] };
  if (pct === null) return { kicker: 'Set up your day', text: "Add your end time and I'll keep you company all shift 📣" };
  if (pct < 0) return { kicker: 'Not started yet', text: 'Calm before the calls. Get your head in the game 🎧' };
  if (pct >= 100) return { kicker: 'Shift complete', text: "That's a wrap. Great shift, go and enjoy your evening 🏠" };
  const hr = new Date(now).getHours(), [, , kicker, lines] = BY_HOUR.find(b => hr >= b[0] && hr < b[1]);
  const extra = pct >= 85 ? [`Only ${durHM((r.shiftEnd - now) / 1000)} to go. Finish like you started 🏁`]
    : pct >= 45 && pct <= 55 ? ['Halfway there! The second half is where targets are won 🎯'] : [];
  const pool = [...lines, ...extra];
  return { kicker, text: pool[tick % pool.length] };
}
