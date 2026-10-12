# Lifemax

A gamified self-improvement tracker for looksmaxxing and lifemaxxing, built as an installable phone app (PWA).

You get XP for every habit you complete, level up six stats, keep streaks going and beat a boss each week. Meanwhile **Xiaohei** (小黑), a small deadpan ink creature, waters a plant that grows as you level up.

**Live:** https://lifemax-sepia.vercel.app

---

## How it plays

| | |
|---|---|
| **6 stats** | Physique · Posture · Face · Style · Presence · Recovery. Each habit you complete adds XP to one of them and to your overall level. |
| **The plant** | It gets taller as your level rises. It droops until you hit your daily minimum, then blooms. On a perfect day it gets extra flowers. |
| **Daily minimum** | Complete N habits (3 by default) to keep your 🔥 streak alive and open a chest with random bonus XP. |
| **½ versions** | Every daily habit has a tiny fallback version. On a bad day you can still keep the chain going. |
| **Shields** | You earn one for every 7-day streak (max 3). Each one covers a missed day. |
| **Upkeep** | Habits on a timer, like a haircut every month, a trim every week, nails every 2 weeks, clean shoes and a clean room monthly. They show as countdown rings and never break your streak. |
| **Weekly boss** | A new monster appears every Monday. Habits in its weak stat do damage, and beating it is worth +150 XP. |
| **Side quests** | Three new quests every day. |
| **Crits** | Each habit has a 12% chance of earning double XP. |
| **Stamps** | 16 achievements to unlock. |
| **Body** | Log weight, waist, sleep and energy to see trend lines, plus a daily "one win" journal. |
| **Stats** | A stat radar chart, a 12-week heatmap, and insights such as your weakest stat, how sleep affects your habits, and your best and worst weekdays. |

## The psychology behind it

These are the techniques the design uses on purpose. The **Me → Why it works** screen explains them in the app too.

- **Identity-based habits:** you pick "I am becoming someone who…" during setup. Each habit you tick counts as a vote for that person.
- **Minimum versions:** showing up matters more than how big the effort is, so the ½ option protects your streak on hard days.
- **Implementation intentions:** each habit can have a cue like "After I X, I will Y", which makes you much more likely to follow through.
- **Never miss twice:** shields and comeback nudges stop the "I already blew it" spiral.
- **Variable rewards:** crits, chests and rotating quests are unpredictable, which keeps them interesting.
- **Endowed progress:** you start with +50 XP, so you're already partway to level 2.
- **Fresh starts:** every Monday brings a new boss and a clean slate.
- **Visible progress:** the plant, the stat radar and the heatmap make slow physical change feel real.

## Install on your phone

- **iPhone:** open the link in **Safari**, then tap Share → **Add to Home Screen**. Always use the app from the home-screen icon, because it keeps separate storage from the Safari tab.
- **Android:** open the link in Chrome, then tap ⋮ → **Install app**.

It runs full-screen and works offline.

## Your data

- Everything is saved **on your device only**, in browser `localStorage`. There's no account, no server and no tracking.
- App updates keep your data, as long as the web address stays the same.
- Deleting the home-screen app, or clearing the browser's site data, **erases your progress**. Use **Me → Export** now and then to save a backup file, and **Import** to restore it on any device.

## Make it yours

All game content lives in [`data.js`](data.js). You can edit it freely:

- `HABITS`: daily habits (e.g. AM and PM brushing are separate) (`mini` is the ½ version) and upkeep habits (`every: <days>`)
- `QUESTS`, `BOSSES`, `WISDOM`, `SAYINGS` (Xiaohei's lines), `RANKS`, `ACHIEVEMENTS`

You can also add your own habits, daily or on a timer, from inside the app under **Me → New habit**.

## Project structure

No framework and no build step, just static files.

```
index.html            app shell + shared SVG filters (ink wobble, hatching)
data.js               game content: stats, habits, quests, bosses, achievements
art.js                hand-drawn SVG art: Xiaohei, plant, pot, bosses, icons, scenes
app.js                state, XP/levels, streaks, bonuses, views, events
styles.css            paper-and-ink styling + animations
sw.js                 service worker (offline cache)
manifest.webmanifest  PWA manifest
icons/                app icons
vercel.json           cache headers so updates land quickly
```

All progress is **derived from the daily log**: XP, levels, streaks and shields are recalculated rather than stored. Undoing a habit is always exact, and old saves stay compatible. When the save format changes, upgrades go in `migrate()` in `app.js`.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Deploy

```bash
npx vercel@latest deploy --prod
```

**Bump `CACHE` in `sw.js` whenever you change a file**, so installed copies pick up the new version. Always deploy to the same Vercel project, because a new web address would start everyone's data from zero.

## Credits

- The habit list comes from a looksmaxxing thread by [@PowerBruteHQ](https://x.com/PowerBruteHQ): get leaner, train posture and neck, dress for your proportions, work on your presence.
- The art style is inspired by [ian-xiaohei-illustrations](https://github.com/helloianneo/ian-xiaohei-illustrations). Its pure white paper, wobbly ink and sparse red/orange/blue notes, along with Xiaohei, are redrawn here as live SVG.
- The handwriting font is [Caveat](https://fonts.google.com/specimen/Caveat).
