'use strict';
// Game content. Everything here is safe to edit — the app derives all progress from your log.

const STATS = {
  STR: { name: 'Physique',  short: 'PHY',  icon: 'dumbbell', color: '#e5484d', desc: 'Get leaner. Build shoulders and back.' },
  POS: { name: 'Posture',   short: 'POS',  icon: 'spine',    color: '#f08a24', desc: 'Stop carrying your face badly.' },
  AES: { name: 'Face',      short: 'FACE', icon: 'mirror',   color: '#1f9aa8', desc: 'Skin, teeth, hair. The basics, done daily.' },
  STY: { name: 'Style',     short: 'STY',  icon: 'shirt',    color: '#7c5cc4', desc: 'Fit beats brands. Every time.' },
  CHA: { name: 'Presence',  short: 'PRES', icon: 'speech',   color: '#d6457f', desc: 'Looks get attention. Presence decides what happens next.' },
  VIT: { name: 'Recovery',  short: 'REC',  icon: 'moon',     color: '#2f6fde', desc: 'Sleep is the cheapest looksmax there is.' },
};
const STAT_ORDER = ['STR', 'POS', 'AES', 'STY', 'CHA', 'VIT'];

// def: on by default in onboarding (kept small on purpose: easy early wins)
const HABITS = [
  { id: 'train',    stat: 'STR', xp: 25, def: true,  name: 'Strength session',            mini: '20 push-ups + 20 rows',       cue: 'After work, I go straight to the gym' },
  { id: 'protein',  stat: 'STR', xp: 15, def: false, name: 'Hit protein target',          mini: 'Protein with every meal',     cue: '' },
  { id: 'steps',    stat: 'STR', xp: 15, def: true,  name: '8,000+ steps',                mini: '10-minute walk',              cue: 'After lunch, I walk for 15 minutes' },
  { id: 'deficit',  stat: 'STR', xp: 15, def: false, name: 'Ate to plan (lean-out)',      mini: 'No liquid calories',          cue: '' },

  { id: 'posture',  stat: 'POS', xp: 15, def: true,  name: 'Posture circuit: face pulls, rear delts, rows', mini: '1 set of band pull-aparts', cue: 'After I train, I do the posture circuit' },
  { id: 'hang',     stat: 'POS', xp: 10, def: false, name: 'Dead hang, 60s total',        mini: 'One 20s hang',                cue: '' },
  { id: 'chintuck', stat: 'POS', xp: 10, def: false, name: 'Chin tucks ×15',              mini: '5 chin tucks',                cue: 'When I sit down at my desk, I do chin tucks' },
  { id: 'core',     stat: 'POS', xp: 10, def: false, name: 'Core + glutes (planks, bridges)', mini: '30s plank',               cue: '' },

  { id: 'skinam',   stat: 'AES', xp: 10, def: true,  name: 'AM skin: cleanse + SPF',      mini: 'SPF only',                    cue: 'After I brush my teeth, I apply SPF' },
  { id: 'skinpm',   stat: 'AES', xp: 10, def: false, name: 'PM skin: cleanse + moisturize', mini: 'Rinse face',                cue: '' },
  { id: 'teeth',    stat: 'AES', xp: 10, def: true,  name: 'Dental: brush 2× + floss',    mini: 'Floss once',                  cue: '' },
  { id: 'shower',   stat: 'AES', xp: 5,  def: true,  name: 'Shower',                      mini: 'Quick rinse',                 cue: '' },
  { id: 'water',    stat: 'AES', xp: 10, def: false, name: '2.5L water',                  mini: 'A glass right after waking',  cue: '' },
  { id: 'hair',     stat: 'AES', xp: 5,  def: false, name: 'Hair styled and groomed',     mini: 'Comb + product',              cue: '' },

  { id: 'fit',      stat: 'STY', xp: 10, def: true,  name: 'Dressed with intent (clean, fitted, simple)', mini: 'Clean, unwrinkled top', cue: '' },
  { id: 'prep',     stat: 'STY', xp: 5,  def: false, name: "Lay out tomorrow's outfit",   mini: 'Pick the shirt',              cue: '' },

  { id: 'eyes',     stat: 'CHA', xp: 15, def: true,  name: 'Eye contact with 3 people',   mini: 'Hold eye contact once',       cue: '' },
  { id: 'voice',    stat: 'CHA', xp: 10, def: false, name: 'Read aloud 3 min: slow and clear', mini: '1 minute out loud',      cue: '' },
  { id: 'listen',   stat: 'CHA', xp: 10, def: false, name: 'Listened more than I talked', mini: 'Asked one real question',     cue: '' },
  { id: 'calm',     stat: 'CHA', xp: 10, def: false, name: 'Calm body: no fidgeting, slow moves', mini: 'One check-in at lunch', cue: '' },

  { id: 'sleep',    stat: 'VIT', xp: 20, def: true,  name: 'Slept 7.5h+',                 mini: 'Slept 7h',                    cue: 'At 22:30, phone goes on the charger outside the bedroom' },
  { id: 'screens',  stat: 'VIT', xp: 10, def: false, name: 'Screens off 30 min before bed', mini: '10 minutes',                cue: '' },
  { id: 'sun',      stat: 'VIT', xp: 10, def: false, name: 'Morning sunlight, 10 min',    mini: '2 minutes outside',           cue: '' },

  // Upkeep: on a timer instead of daily (every = days). Shown as countdown rings, never break streaks.
  { id: 'trim',     stat: 'AES', xp: 15, def: true,  every: 7,  short: 'trim',    icon: 'razor',    name: 'Trim (beard / edges)' },
  { id: 'nails',    stat: 'AES', xp: 10, def: true,  every: 14, short: 'nails',   icon: 'nail',     name: 'Cut nails' },
  { id: 'haircut',  stat: 'AES', xp: 25, def: true,  every: 30, short: 'haircut', icon: 'scissors', name: 'Haircut' },
  { id: 'shoes',    stat: 'STY', xp: 20, def: true,  every: 30, short: 'shoes',   icon: 'shoe',     name: 'Clean shoes' },
  { id: 'room',     stat: 'STY', xp: 30, def: true,  every: 30, short: 'room',    icon: 'broom',    name: 'Deep-clean room' },
];

const QUESTS = [
  { id: 'q_photo',   stat: 'STR', xp: 30, name: 'Take a front + side progress photo' },
  { id: 'q_meal',    stat: 'STR', xp: 25, name: 'Cook one high-protein meal' },
  { id: 'q_steps',   stat: 'STR', xp: 30, name: '+5,000 bonus steps' },
  { id: 'q_wall',    stat: 'POS', xp: 25, name: 'Wall check: back flat against a wall for 2 min' },
  { id: 'q_reset',   stat: 'POS', xp: 25, name: 'Reset your posture 5 times today' },
  { id: 'q_mirror',  stat: 'POS', xp: 20, name: 'Side-profile mirror check: note one thing to fix' },
  { id: 'q_haircut', stat: 'AES', xp: 25, name: 'Book or plan your next haircut' },
  { id: 'q_mask',    stat: 'AES', xp: 20, name: 'Exfoliate or do a face mask' },
  { id: 'q_sugar',   stat: 'AES', xp: 30, name: 'No added sugar today' },
  { id: 'q_desk',    stat: 'STY', xp: 20, name: 'Clear your desk and nightstand' },
  { id: 'q_iron',    stat: 'STY', xp: 20, name: "Iron or steam tomorrow's outfit" },
  { id: 'q_purge',   stat: 'STY', xp: 30, name: 'Remove 3 badly fitting items from your wardrobe' },
  { id: 'q_record',  stat: 'CHA', xp: 30, name: 'Record yourself talking for 60s, then rewatch it' },
  { id: 'q_compl',   stat: 'CHA', xp: 25, name: 'Give someone a genuine compliment' },
  { id: 'q_new',     stat: 'CHA', xp: 35, name: 'Start a conversation with someone new' },
  { id: 'q_slow',    stat: 'CHA', xp: 25, name: 'Speak at 70% speed in one conversation' },
  { id: 'q_walk',    stat: 'VIT', xp: 25, name: '30-minute walk with no phone' },
  { id: 'q_bed',     stat: 'VIT', xp: 30, name: 'In bed by 23:00' },
  { id: 'q_cold',    stat: 'VIT', xp: 25, name: '60-second cold shower finish' },
];

const BOSSES = [
  { name: 'The Slouch',         stat: 'POS', lore: 'Forward head, round shoulders.' },
  { name: 'Soft Silhouette',    stat: 'STR', lore: 'Feeds on skipped sessions.' },
  { name: 'The Mumbler',        stat: 'CHA', lore: 'Fidgets. Mumbles. Overperforms.' },
  { name: 'Night Goblin',       stat: 'VIT', lore: 'Steals sleep, one scroll at a time.' },
  { name: 'Random Color Chaos', stat: 'STY', lore: 'Wrinkles and worn-out shoes.' },
  { name: 'Dull Skin Wraith',   stat: 'AES', lore: 'Skipped SPF. Forgot to floss.' },
];

// Short lines Xiaohei says when you poke him
const SAYINGS = [
  'never miss twice.', 'fit beats brands.', 'stand tall.', 'slow voice. calm moves.', 'sleep is free looksmax.',
  '½ still counts.', 'every rep is a vote.', 'shoulders back.', 'chin tuck. now.', "don't fidget.",
  'small daily > big rare.', 'clean shoes?', 'drink water.', 'eye contact.', 'lean out first.', 'just one more.',
];

const WISDOM = [
  'Fit beats brands. Every time.',
  'Before changing your face, stop carrying it badly.',
  'Looks get attention. Presence decides what happens next.',
  'Attractive presence feels controlled, not desperate.',
  'Better posture improves your whole silhouette.',
  'Never miss twice. One slip is an accident. Two is the start of a new habit.',
  'Every rep is a vote for who you are becoming.',
  'Sleep is the cheapest looksmax there is.',
  'Slow down when you speak. Calm comes across as confidence.',
  'Clean shoes, simple colors, good grooming. That covers most of style.',
  'Get leaner first. It shows your face and your frame.',
  "Don't fidget. Don't mumble. Don't overperform.",
  'Small and daily beats big and occasional.',
  'Shoulders and back build the frame. Train them.',
  'Motivation follows action, not the other way round.',
  'The minimum version on a bad day is what makes you unstoppable.',
];

const RANKS = [[1, 'NPC'], [3, 'Awakened'], [6, 'Initiate'], [10, 'Disciplined'], [15, 'Sharp'], [20, 'Magnetic'], [30, 'Elite'], [40, 'Apex'], [50, 'Legend']];

// Each completes the sentence "I am becoming someone who …"
const IDENTITIES = [
  'trains hard, stands tall and speaks with calm confidence',
  'takes care of my body, every single day',
  'keeps promises to myself',
  'looks sharp, sleeps well and moves with intent',
];

const ACHIEVEMENTS = [
  { id: 'first',    icon: 'sprout', name: 'First Rep',      desc: 'Complete your first habit',            test: c => c.comps >= 1 },
  { id: 'streak3',  icon: 'flame', name: 'Spark',          desc: '3-day streak',                         test: c => c.best >= 3 },
  { id: 'streak7',  icon: 'calendar', name: 'One Week Strong', desc: '7-day streak',                        test: c => c.best >= 7 },
  { id: 'streak30', icon: 'gem', name: 'Unbreakable',    desc: '30-day streak',                        test: c => c.best >= 30 },
  { id: 'streak100',icon: 'crown', name: 'Centenarian',    desc: '100-day streak',                       test: c => c.best >= 100 },
  { id: 'perfect',  icon: 'star', name: 'Flawless',       desc: 'Complete every active habit in a day', test: c => c.perfect },
  { id: 'boss',     icon: 'sword', name: 'Boss Slayer',    desc: 'Defeat a weekly boss',                 test: c => c.boss },
  { id: 'comeback', icon: 'loop', name: 'Never Twice',    desc: 'Bounce back right after a missed day',  test: c => c.comeback },
  { id: 'lvl5',     icon: 'up', name: 'Level 5',        desc: 'Reach overall level 5',                test: c => c.L >= 5 },
  { id: 'lvl10',    icon: 'up', name: 'Level 10',       desc: 'Reach overall level 10',               test: c => c.L >= 10 },
  { id: 'lvl25',    icon: 'trophy', name: 'Level 25',       desc: 'Reach overall level 25',               test: c => c.L >= 25 },
  { id: 'comp100',  icon: 'check', name: 'Centurion',      desc: '100 habit completions',                test: c => c.comps >= 100 },
  { id: 'comp500',  icon: 'trophy', name: 'Monument',       desc: '500 habit completions',                test: c => c.comps >= 500 },
  { id: 'rounded',  icon: 'hex', name: 'Well-Rounded',   desc: 'Every stat at level 3+',               test: c => c.slv.every(l => l >= 3) },
  { id: 'data',     icon: 'chart', name: 'Data Driven',    desc: 'Log body metrics on 7 days',           test: c => c.metrics >= 7 },
  { id: 'reflect',  icon: 'pen', name: 'Self-Aware',     desc: "Write 7 'one win' entries",            test: c => c.notes >= 7 },
];

const PRINCIPLES = [
  { t: 'Identity first', d: 'You tick habits as votes for who you are becoming, not as chores. Identity-based habits stick better than goal-based ones.' },
  { t: 'Minimum versions', d: 'Every habit has a ½ version. On bad days you still keep the chain, and showing up builds the habit even when the effort is small.' },
  { t: 'Implementation intentions', d: '"After I X, I will Y." Linking a habit to a specific cue roughly doubles follow-through in studies.' },
  { t: 'Never miss twice', d: 'Shields absorb a missed day, so one slip doesn\'t wipe your streak. That avoids the "I already blew it" spiral.' },
  { t: 'Variable rewards', d: 'Crits, daily chests and rotating side quests are unpredictable rewards. They hold attention far better than fixed ones.' },
  { t: 'Endowed progress', d: 'You start with bonus XP. People who feel they\'ve already started are much more likely to finish.' },
  { t: 'Fresh starts', d: 'Every Monday brings a new boss and a clean slate. New beginnings are natural moments to recommit.' },
  { t: 'Visible progress', d: 'Levels, a stat radar and a heatmap make slow physical change feel real every day.' },
];
