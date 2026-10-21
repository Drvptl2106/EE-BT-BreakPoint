// The pep talk next to the shift pie: shop-floor banter and nosy questions that change with the time of day and the shift.
// Pure text, no storage. Add your own freely; {left} becomes the time left in the shift. Keep it kind: we laugh with
// customers and ourselves, never at a real person.
import { durHM } from './core.js';

const BY_HOUR = [
  [0, 9, 'Early start', [
    'Quick poll: how many coffees before your first "have you tried turning it off and on again"? ☕',
    "Nobody is a morning person until their third customer. You're allowed to be quiet until then.",
    'First call of the day is always someone who has been "on hold since 1997". Brace yourself.',
    "Today's goal: one add-line before your coffee goes cold. Go.",
  ]],
  [9, 11, 'Morning push', [
    'How many add-lines so far? If it\'s zero, the next family of five is all yours 📱',
    'Scoreboard check: upgrades today? One counts. Two and you\'re officially allowed to be smug.',
    "Somewhere out there someone is still paying for a phone with a cracked screen and a 2019 contract. Go and find them.",
    'Customer: "I\'ll have to ask my partner." You: already have the partner on speaker.',
    "Who's winning the add-line race this morning? Asking for a leaderboard.",
  ]],
  [11, 13, 'Before lunch', [
    'One more add-line and you can eat lunch guilt-free. That\'s the rule. I made it up, but it\'s the rule.',
    'If they say "I\'m just looking", it\'s a no. If they say "how much is it with the watch"... it\'s a yes 👀',
    'Your stomach is now louder than the hold music. Nearly there.',
    'How many upgrades before lunch? Give me a number you\'d be happy to say out loud in the canteen.',
  ]],
  [13, 15, 'After lunch', [
    'The post-lunch hour, when every customer sounds like they\'re whispering from a cave. Headset up.',
    "How many add-lines since lunch? Food is fuel. Use it.",
    'Every complaint starts with "I just want". Every great call ends with "oh, is that all?" Be the second one.',
    'If you yawn on a call, just say you\'re "really excited about the new tariffs". Works every time. (It doesn\'t.)',
  ]],
  [15, 17, 'Afternoon', [
    'Afternoon tally: add-lines, upgrades, broadband. Two out of three and you\'ve earned the good biscuits 🍪',
    'Plot twist: the "quick question" customer is about to be your longest call of the day.',
    'At this time of day "no worries at all!" means "there are some worries".',
    'How many people have you made happy today? Upgrades count double.',
  ]],
  [17, 24, 'Evening', [
    'Late shift: every caller starts with "sorry to call so late". You\'re a legend and they know it.',
    'Close one more before home time and you\'re legally allowed to talk about it at dinner.',
    'How many add-lines did you get today? Round up. Nobody\'s checking. (I\'m checking.)',
  ]],
];
const ON_BREAK = [
  'On break. Do not think about add-lines. Okay, maybe one add-line.',
  "Phone face down. Yes, even your own. You've looked at enough phones today.",
  'Snack ranking: crisps > biscuits > the sad apple you brought to feel healthy. Choose wisely.',
  "If anyone asks, you're \"reviewing the customer journey\". From the sofa in the break room.",
];

/** Returns { kicker, text }. pct = how far through the shift (null = no end time yet, negative = not started). */
export function jokeFor(now, r, pct) {
  const tick = Math.floor(now / 300000);                       // a new line every 5 minutes
  if (r.active) return { kicker: 'On a break', text: ON_BREAK[tick % ON_BREAK.length] };
  if (pct === null) return { kicker: 'Set up your day', text: 'Add your end time. I need to know how long I\'m cheering for 📣' };
  if (pct < 0) return { kicker: 'Not started yet', text: 'Enjoy the last few minutes of not saying "bear with me".' };
  if (pct >= 100) return { kicker: 'Shift complete', text: 'Done! Go home, and do not answer your own phone in your customer voice.' };
  const hr = new Date(now).getHours(), [, , kicker, lines] = BY_HOUR.find(b => hr >= b[0] && hr < b[1]);
  const extra = pct >= 85 ? [`Only ${durHM((r.shiftEnd - now) / 1000)} to go. The last calls are where legends are made.`]
    : pct >= 45 && pct <= 55 ? ["Halfway! If this shift were a contract, you'd be due an upgrade."] : [];
  const pool = [...lines, ...extra];
  return { kicker, text: pool[tick % pool.length] };
}
