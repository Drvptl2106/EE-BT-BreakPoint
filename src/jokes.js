// The cheerful one-liners on the agent page. Pure text, no storage.
import { durHM } from './core.js';

const BUCKETS = [
  [0,10,["Shift started, {left} to go. Coffee first, panic never ☕","Fresh shift energy! {left} left and you've basically already won 💪","The day's only just begun. Best time to look busy is right now 😄"]],
  [10,25,["Warming up nicely. {left} to go and you're making it look easy 😎","Almost a quarter down. Time flies when you're having… a shift 😅"]],
  [25,40,["A quarter done! Only the other three quarters to go 🙃","You've cracked 25%. It's all downhill from here (it isn't, but it sounds nice) ⛷️"]],
  [40,50,["Nearly halfway! Hold on to that thought 🚀","Almost 50%. The halfway point has entered the chat 👀"]],
  [50,60,["Halfway there, hurray! 🎉 {left} left and the hard part's behind you","Over half done. You can see the other side of the hill now ⛰️"]],
  [60,75,["More than half done, {left} left. You've got this 💪","Three quarters is nearly the end. Mathematically no, emotionally yes 😌"]],
  [75,90,["Only {left} left. Smell that? That's freedom 🌅","Final stretch! {left} to go and you're flying ✈️"]],
  [90,100,["{left} left. Look busy, think sofa 🛋️","Nearly there. Don't stop now, the finish line can see you 🏁"]],
  [100,1e9,["Shift complete. Go home, you absolute legend 🏠","That's a wrap! Please leave your headset at the door 🎤"]],
];
const TOD = [
  [0,10,"Morning brain is still loading… please wait ⏳"],
  [10,12,"Mid-morning. Peak productivity and prime biscuit o'clock 🍪"],
  [12,14,"Lunchtime vibes. Your lunch slot is waiting 🥪"],
  [14,16,"Post-lunch slump detected. Tea is a recognised treatment 🫖"],
  [16,18,"Home time is in sight. Don't look at the clock, it's looking back 👀"],
  [18,24,"Late shift hero. The kettle salutes you 🫡"],
];

/** pct = how far through the shift (null = no end time yet, negative = not started). */
export function jokeFor(now, r, pct) {
  if (r.active) return ["Enjoy it. The kettle won't boil itself 🫖","Phones down, shoulders down 😌","Break time. Technically a legal requirement to relax 😉"][Math.floor(now / 60000) % 3];
  if (pct === null) return "Add your end time and I'll start cheering you on properly 📣";
  if (pct < 0) return "Your shift hasn't started yet. Enjoy the calm before the calls 😌";
  const bucket = BUCKETS.find(b => pct >= b[0] && pct < b[1]);
  const hr = new Date(now).getHours();
  const tod = TOD.find(t => hr >= t[0] && hr < t[1]);
  const pool = [...bucket[2], ...(pct < 100 && tod ? [tod[2]] : [])];
  return pool[Math.floor(now / 600000) % pool.length].replace('{left}', durHM((r.shiftEnd - now) / 1000));
}
