// The pep talk next to the shift pie: shop-floor banter and nosy questions that change with the time of day and the shift.
// Pure text, no storage. Add your own freely; {left} becomes the time left in the shift. Keep it kind: we laugh with
// customers and ourselves, never at a real person.
import { durHM, hhmm } from './core.js?v=b142b5df5f';

const BY_HOUR = [
  [0, 9, 'Early start', [
    'Quick poll: how many coffees before your first "have you tried turning it off and on again"?',
    "Nobody is a morning person until their third customer. You're allowed to be quiet until then.",
    'First call of the day is always someone who has been "on hold since 1997". Brace yourself.',
    "Today's goal: one add-line before your coffee goes cold. Go.",
    'Reminder: discounts are not free samples. Don\'t give money away like you own the company',
    'Morning question: what\'s your household value looking like? Be honest, I won\'t tell the team lead.',
  ]],
  [9, 11, 'Morning push', [
    'How many add-lines so far? If it\'s zero, the next family of five is all yours',
    'Scoreboard check: upgrades today? One counts. Two and you\'re officially allowed to be smug.',
    "Somewhere out there someone is still paying for a phone with a cracked screen and a 2019 contract. Go and find them.",
    'Customer: "I\'ll have to ask my partner." You: already have the partner on speaker.',
    "Who's winning the add-line race this morning? Asking for a leaderboard.",
    'How many TVs have you sold today? If the answer is zero, someone\'s still watching on a 2014 laptop. Go and save them',
    'Before you offer that discount: would you pay for it out of your own pocket? Thought not. Hold the line',
    'Household value check: one phone is a sale. Phone, broadband, TV and the kids\' SIMs is a masterpiece.',
  ]],
  [11, 13, 'Before lunch', [
    'One more add-line and you can eat lunch guilt-free. That\'s the rule. I made it up, but it\'s the rule.',
    'If they say "I\'m just looking", it\'s a no. If they say "how much is it with the watch"... it\'s a yes',
    'Your stomach is now louder than the hold music. Nearly there.',
    'You are not Father Christmas. Stop handing out free months',
    'Pre-lunch TV count? One more and you can watch something on it tonight, guilt-free.',
    'How many upgrades before lunch? Give me a number you\'d be happy to say out loud in the canteen.',
  ]],
  [13, 15, 'After lunch', [
    'The post-lunch hour, when every customer sounds like they\'re whispering from a cave. Headset up.',
    "How many add-lines since lunch? Food is fuel. Use it.",
    'Every complaint starts with "I just want". Every great call ends with "oh, is that all?" Be the second one.',
    'If you yawn on a call, just say you\'re "really excited about the new tariffs". Works every time. (It doesn\'t.)',
    'Every unnecessary discount is a biscuit taken from the team tin. Protect the biscuits',
    'Household value since lunch? Turn "just the phone" into "the whole house". You\'ve got this.',
    'How many TVs so far? Somebody\'s sofa is waiting for an upgrade',
  ]],
  [15, 17, 'Afternoon', [
    'Afternoon tally: add-lines, upgrades, broadband. Two out of three and you\'ve earned the good biscuits',
    'Plot twist: the "quick question" customer is about to be your longest call of the day.',
    'At this time of day "no worries at all!" means "there are some worries".',
    'How many people have you made happy today? Upgrades count double.',
    'Customer asked for a discount? Give them value, not money. Your margin says thank you.',
    'TV tally for the day? Big screens count as two. (They don\'t. But they feel like it.)',
    'Household value check: are you selling a phone, or are you looking after the whole family? Big difference.',
  ]],
  [17, 24, 'Evening', [
    'Late shift: every caller starts with "sorry to call so late". You\'re a legend and they know it.',
    'Close one more before home time and you\'re legally allowed to talk about it at dinner.',
    'How many add-lines did you get today? Round up. Nobody\'s checking. (I\'m checking.)',
    'Final question: how much household value did you bring in today? Say it out loud. Feels good, doesn\'t it?',
    'Last calls of the day are not a clearance sale. Keep your discounts in your pocket',
  ]],
];
// Any time of day: the stuff everyone on the floor recognises. Mixed into every hour's lines.
const ANY_TIME = [
  'That customer who says "I\'m not being funny, but..." is about to be very not funny. Smile anyway.',
  'Your "I completely understand" voice is now better than your real voice. Your mum noticed.',
  'Every caller who "only has one quick question" has four. Count them. Win the bet with yourself.',
  'Yes, you said "bear with me" eleven times on that last call. No, nobody else counted. (I did.)',
  'Fun fact: "I\'ve been with you for 20 years" is said by roughly every customer. Some of them even mean it.',
  'You\'ve explained what a router is to three people today. You are basically a teacher. Without the holidays.',
  'Someone just asked if the internet is "down everywhere or just in the kitchen". Breathe.',
  'If the hold music is stuck in your head, it\'s stuck in everyone\'s. Hum it. Spread the misery.',
  'The team lead is walking about. Look busy. Actually, just be busy. Easier.',
  'You\'re one "can I speak to your manager" away from a promotion. Take it as a compliment.',
  'Customer: "I don\'t want anything else." Also customer, 4 minutes later: "...how much is the watch?"',
  'Drink some water. Your voice is your tool and right now it sounds like a squeaky gate.',
  'If you mute yourself to sigh, remember to unmute. Ask anyone who has learned that the hard way.',
  'You\'ve said "lovely" so many times today it has lost all meaning. Lovely.',
  'Somebody\'s nan is about to call to ask about "the Facebook". Be the hero she deserves.',
  'Your chair has a dent in the shape of you now. That\'s commitment. Or a sign to stand up and stretch.',
  'Hot desk rule: if you didn\'t bring the mug, don\'t drink from the mug. We all know whose mug it is.',
  'Reminder that "I\'ll just pop you on a quick hold" has never once been quick.',
  'Your break is not a suggestion and lunch is not a myth. Use them. Then come back on time, legend.',
  'Somewhere a customer is reading their full postcode one letter at a time. Patience is a superpower.',
];
const ON_BREAK = [
  'On break. Do not think about add-lines. Okay, maybe one add-line.',
  "Phone face down. Yes, even your own. You've looked at enough phones today.",
  'Snack ranking: crisps > biscuits > the sad apple you brought to feel healthy. Choose wisely.',
  "If anyone asks, you're \"reviewing the customer journey\". From the sofa in the break room.",
  'Do not, under any circumstances, check how many calls are waiting. Ignorance is bliss.',
  'The kettle queue is part of your break. Small talk counts as self-care.',
  'This is your time. The customers will still be confused when you get back. Promise.',
];

// A different starting point every time the page opens, so a fresh visit gets a fresh line.
const SEED = Math.floor(Math.random() * 1000);

/** Returns { kicker, text }. pct = how far through the shift (null = no end time yet, negative = not started). */
export function jokeFor(now, r, pct) {
  const tick = Math.floor(now / 300000) + SEED;                // a new line every 5 minutes (and on every visit)
  if (r.active) return { kicker: 'On a break', text: ON_BREAK[tick % ON_BREAK.length] };
  if (pct === null) return { kicker: 'Set up your day', text: 'Add your end time. I need to know how long I\'m cheering for' };
  if (pct < 0) return { kicker: 'Not started yet', text: 'Enjoy the last few minutes of not saying "bear with me".' };
  if (pct >= 100) return { kicker: 'Shift complete', text: 'Done! Go home, and do not answer your own phone in your customer voice.' };
  const hr = new Date(now).getHours(), [, , kicker, lines] = BY_HOUR.find(b => hr >= b[0] && hr < b[1]);
  const extra = pct >= 85 ? [`Only ${durHM((r.shiftEnd - now) / 1000)} to go. The last calls are where legends are made.`]
    : pct >= 45 && pct <= 55 ? ["Halfway! If this shift were a contract, you'd be due an upgrade."] : [];
  const pool = [...lines, ...ANY_TIME, ...extra];
  return { kicker, text: pool[tick % pool.length] };
}

/** The Professional view's version of the pep talk: a plain status line instead of a joke. spare = break seconds left today. */
export function proNote(now, r, pct, spare) {
  if (r.active) return { kicker: 'On a break', text: 'Your break timer is running. Press "I\'m back" when you return.' };
  if (pct === null) return { kicker: 'Set up your day', text: 'Add your shift end time to see your shift progress.' };
  if (pct < 0) return { kicker: 'Not started yet', text: `Your shift starts at ${hhmm(r.shiftStart)}.` };
  if (pct >= 100) return { kicker: 'Shift complete', text: 'Your shift is complete. On a shared computer, remember to sign out.' };
  return { kicker: 'Today', text: `${durHM((r.shiftEnd - now) / 1000)} of your shift left · ${Math.round(spare / 60)} min of break time left today.` };
}
