// Builds src/graphics-data.js: a curated, open-licensed graphics library for the Elements panel.
//
//   node tools/build-graphics.mjs            (downloads the icon sets with `npm pack` into a temp folder)
//   node tools/build-graphics.mjs <dir>      (uses <dir>/<set>/package/icons.json that were already unpacked)
//
// Sets used (all free for commercial use):
//   Fluent Emoji (3D + flat), Fluent UI Color icons  – MIT, Microsoft
//   Tabler Icons                                       – MIT
//   Simple Icons (brand logos)                         – CC0 (logos remain trademarks of their owners)
//   Streamline Freehand Color, Streamline Kameleon     – CC BY 4.0, Streamline (credit shown in the app)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decorItems, pixelItems } from './decor.mjs';

const SETS = ['fluent-emoji', 'fluent-emoji-flat', 'fluent-color', 'tabler', 'simple-icons', 'streamline-freehand-color', 'streamline-kameleon-color', 'streamline-stickies-color'];
let dir = process.argv[2];
if (!dir) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lai-gfx-'));
  for (const s of SETS) {
    const tgz = execFileSync('npm', ['pack', `@iconify-json/${s}`, '--silent'], { cwd: dir }).toString().trim().split('\n').pop();
    fs.mkdirSync(path.join(dir, s), { recursive: true });
    execFileSync('tar', ['xzf', tgz, '-C', s], { cwd: dir });
  }
}
const load = (s) => JSON.parse(fs.readFileSync(path.join(dir, s, 'package', 'icons.json'), 'utf8'));
const data = Object.fromEntries(SETS.map((s) => [s, load(s)]));
const missing = [];
const pick = (set, names) => names.filter((n) => { const ok = !!data[set].icons[n]; if (!ok) missing.push(`${set}:${n}`); return ok; });
const words = (s) => s.split(/[\s,]+/).filter(Boolean);
/** Interleave names by their first word so a row shows variety (book, calendar, chart … instead of chart, chart, chart). */
const roundRobin = (names) => {
  const groups = new Map();
  for (const n of names) { const k = n.split('-')[0]; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); }
  const lists = [...groups.values()], out = [];
  for (let i = 0; out.length < names.length; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
};

// ---------------------------------------------------------------- Thai search words for English icon-name tokens
const TH = {
  flower: 'ดอกไม้', blossom: 'ดอกไม้ บาน', rose: 'กุหลาบ', tulip: 'ทิวลิป', sunflower: 'ทานตะวัน', lotus: 'บัว', tree: 'ต้นไม้', plant: 'ต้นไม้ พืช', leaf: 'ใบไม้', cactus: 'กระบองเพชร', mushroom: 'เห็ด', clover: 'ใบโคลเวอร์',
  cat: 'แมว', dog: 'หมา สุนัข', rabbit: 'กระต่าย', bear: 'หมี', panda: 'แพนด้า', tiger: 'เสือ', lion: 'สิงโต', monkey: 'ลิง', fox: 'จิ้งจอก', unicorn: 'ยูนิคอร์น', pig: 'หมู', cow: 'วัว', chick: 'ลูกเจี๊ยบ', penguin: 'เพนกวิน', bird: 'นก', owl: 'นกฮูก', frog: 'กบ', turtle: 'เต่า', fish: 'ปลา', dolphin: 'โลมา', whale: 'วาฬ', butterfly: 'ผีเสื้อ', bee: 'ผึ้ง', elephant: 'ช้าง', giraffe: 'ยีราฟ', horse: 'ม้า', duck: 'เป็ด', octopus: 'ปลาหมึก', koala: 'โคอาล่า', hamster: 'แฮมสเตอร์', paw: 'อุ้งเท้า',
  cake: 'เค้ก', coffee: 'กาแฟ', tea: 'ชา', pizza: 'พิซซ่า', burger: 'เบอร์เกอร์', hamburger: 'เบอร์เกอร์', rice: 'ข้าว', noodle: 'ก๋วยเตี๋ยว', bowl: 'ชาม', strawberry: 'สตรอว์เบอร์รี', watermelon: 'แตงโม', mango: 'มะม่วง', banana: 'กล้วย', grapes: 'องุ่น', apple: 'แอปเปิล', cherries: 'เชอร์รี', lemon: 'มะนาว', pineapple: 'สับปะรด', coconut: 'มะพร้าว', ice: 'ไอศกรีม น้ำแข็ง', cream: 'ไอศกรีม', cookie: 'คุกกี้', doughnut: 'โดนัท', drink: 'เครื่องดื่ม', juice: 'น้ำผลไม้', milk: 'นม', food: 'อาหาร',
  book: 'หนังสือ', books: 'หนังสือ', pencil: 'ดินสอ', pen: 'ปากกา', memo: 'บันทึก โน้ต', calendar: 'ปฏิทิน', clipboard: 'คลิปบอร์ด', laptop: 'โน้ตบุ๊ก คอมพิวเตอร์', computer: 'คอมพิวเตอร์', graduation: 'รับปริญญา จบการศึกษา', school: 'โรงเรียน', backpack: 'กระเป๋านักเรียน', abacus: 'ลูกคิด', microscope: 'กล้องจุลทรรศน์', globe: 'ลูกโลก', ruler: 'ไม้บรรทัด', scissors: 'กรรไกร', briefcase: 'กระเป๋าเอกสาร ธุรกิจ', chart: 'กราฟ แผนภูมิ', bar: 'กราฟแท่ง', envelope: 'จดหมาย ซอง', mail: 'จดหมาย อีเมล', bell: 'กระดิ่ง', bulb: 'หลอดไฟ ไอเดีย', lightbulb: 'หลอดไฟ ไอเดีย', trophy: 'ถ้วยรางวัล', medal: 'เหรียญรางวัล', money: 'เงิน', coin: 'เหรียญ เงิน', calculator: 'เครื่องคิดเลข', document: 'เอกสาร', report: 'รายงาน', presentation: 'นำเสนอ', teacher: 'ครู', student: 'นักเรียน', study: 'เรียน', learning: 'เรียนรู้', reading: 'อ่าน', science: 'วิทยาศาสตร์', math: 'คณิตศาสตร์', office: 'สำนักงาน', business: 'ธุรกิจ', people: 'คน กลุ่ม ทีม', person: 'คน', team: 'ทีม', user: 'ผู้ใช้ คน', meeting: 'ประชุม', idea: 'ไอเดีย', target: 'เป้าหมาย', rocket: 'จรวด', search: 'ค้นหา', clock: 'นาฬิกา เวลา', alarm: 'นาฬิกาปลุก', phone: 'โทรศัพท์', camera: 'กล้อง', megaphone: 'โทรโข่ง ประกาศ', loudspeaker: 'ประกาศ', gift: 'ของขวัญ', balloon: 'ลูกโป่ง', party: 'ปาร์ตี้ งานเลี้ยง', confetti: 'คอนเฟตติ ฉลอง', christmas: 'คริสต์มาส', fireworks: 'พลุ', lantern: 'โคม', crown: 'มงกุฎ', sparkles: 'ประกาย วิบวับ', star: 'ดาว', heart: 'หัวใจ รัก', love: 'รัก', ribbon: 'ริบบิ้น', birthday: 'วันเกิด',
  airplane: 'เครื่องบิน', car: 'รถยนต์', bus: 'รถบัส', train: 'รถไฟ', ship: 'เรือ', boat: 'เรือ', bicycle: 'จักรยาน', beach: 'ชายหาด ทะเล', mountain: 'ภูเขา', camping: 'แคมป์', tent: 'เต็นท์', map: 'แผนที่', compass: 'เข็มทิศ', luggage: 'กระเป๋าเดินทาง', travel: 'เดินทาง ท่องเที่ยว', island: 'เกาะ',
  sun: 'พระอาทิตย์', moon: 'พระจันทร์', cloud: 'เมฆ', rain: 'ฝน', snowflake: 'หิมะ', rainbow: 'รุ้ง', fire: 'ไฟ', droplet: 'หยดน้ำ', water: 'น้ำ', wave: 'คลื่น', volcano: 'ภูเขาไฟ', earth: 'โลก', planet: 'ดาวเคราะห์', comet: 'ดาวหาง', weather: 'สภาพอากาศ', umbrella: 'ร่ม', zap: 'สายฟ้า',
  soccer: 'ฟุตบอล', basketball: 'บาสเกตบอล', volleyball: 'วอลเลย์บอล', tennis: 'เทนนิส', badminton: 'แบดมินตัน', running: 'วิ่ง', swimming: 'ว่ายน้ำ', sport: 'กีฬา', football: 'ฟุตบอล',
  smile: 'ยิ้ม', smiling: 'ยิ้ม', face: 'หน้า อีโมจิ', grinning: 'ยิ้ม', laughing: 'หัวเราะ', thumbs: 'ยกนิ้ว', clapping: 'ปรบมือ', waving: 'โบกมือ', hand: 'มือ', ok: 'โอเค', check: 'ถูก เครื่องหมายถูก', cross: 'ผิด กากบาท', warning: 'คำเตือน', question: 'คำถาม', exclamation: 'ตกใจ',
  aries: 'ราศีเมษ', taurus: 'ราศีพฤษภ', gemini: 'ราศีเมถุน', cancer: 'ราศีกรกฎ', leo: 'ราศีสิงห์', virgo: 'ราศีกันย์', libra: 'ราศีตุล', scorpio: 'ราศีพิจิก', sagittarius: 'ราศีธนู', capricorn: 'ราศีมังกร', aquarius: 'ราศีกุมภ์', pisces: 'ราศีมีน', ophiuchus: 'ราศีคนแบกงู',
  home: 'บ้าน', house: 'บ้าน', building: 'อาคาร ตึก', shop: 'ร้าน', store: 'ร้านค้า', cart: 'รถเข็น ช้อปปิ้ง', shopping: 'ช้อปปิ้ง', bag: 'กระเป๋า ถุง', location: 'ตำแหน่ง', pin: 'หมุด', link: 'ลิงก์', settings: 'ตั้งค่า', lock: 'กุญแจ ล็อก', key: 'กุญแจ', shield: 'โล่ ปลอดภัย', music: 'เพลง ดนตรี', video: 'วิดีโอ', image: 'รูปภาพ', photo: 'รูปภาพ', health: 'สุขภาพ', medical: 'การแพทย์', doctor: 'หมอ', heartbeat: 'ชีพจร', leaf2: 'ใบไม้',
};
const thaiOf = (name) => [...new Set(name.split('-').flatMap((t) => (TH[t] ? words(TH[t]) : [])))].join(' ');

// ---------------------------------------------------------------- collections
const collections = [];
const add = (meta, set, names, { size } = {}) => {
  const src = data[set];
  const w = src.width || 16, h = src.height || 16;
  const items = names.map((n) => {
    const ic = src.icons[n];
    return [n, ic.body, ic.width || w, ic.height || h, thaiOf(n)];
  });
  collections.push({ ...meta, set, items });
};
const FLUENT = { license: 'MIT', credit: 'Fluent Emoji © Microsoft (MIT)' };
const flat = (k, title, names) => add({ k, title, kind: 'color', ...FLUENT }, 'fluent-emoji-flat', pick('fluent-emoji-flat', names));

flat('plants', 'ดอกไม้และต้นไม้', ['cherry-blossom', 'blossom', 'rose', 'tulip', 'sunflower', 'hibiscus', 'white-flower', 'lotus', 'bouquet', 'wilted-flower', 'rosette', 'seedling', 'potted-plant', 'herb', 'four-leaf-clover', 'shamrock', 'maple-leaf', 'fallen-leaf', 'leaf-fluttering-in-wind', 'leafy-green', 'evergreen-tree', 'deciduous-tree', 'palm-tree', 'cactus', 'mushroom', 'brown-mushroom', 'tanabata-tree', 'christmas-tree', 'sheaf-of-rice', 'ear-of-corn', 'hyacinth', 'coral', 'nest-with-eggs', 'empty-nest', 'wood', 'rock']);
flat('animals', 'สัตว์น่ารัก', ['cat-face', 'cat', 'dog-face', 'dog', 'rabbit-face', 'bear', 'panda', 'koala', 'tiger-face', 'lion', 'monkey-face', 'fox', 'unicorn', 'pig-face', 'cow-face', 'hatching-chick', 'baby-chick', 'penguin', 'bird', 'owl', 'frog', 'turtle', 'tropical-fish', 'dolphin', 'spouting-whale', 'butterfly', 'honeybee', 'lady-beetle', 'elephant', 'giraffe', 'hamster', 'mouse-face', 'horse-face', 'duck', 'octopus', 'snail', 'hedgehog', 'sloth', 'otter', 'flamingo', 'parrot', 'peacock', 'swan', 'crab', 'shark', 'paw-prints', 'dragon-face', 't-rex', 'sauropod', 'chicken', 'rooster', 'water-buffalo', 'zebra', 'snake', 'goat', 'ram', 'ox', 'scorpion']);
flat('food', 'อาหารและเครื่องดื่ม', ['hot-beverage', 'teacup-without-handle', 'bubble-tea', 'cup-with-straw', 'tropical-drink', 'beverage-box', 'glass-of-milk', 'shortcake', 'birthday-cake', 'cupcake', 'doughnut', 'cookie', 'soft-ice-cream', 'shaved-ice', 'ice-cream', 'lollipop', 'candy', 'chocolate-bar', 'custard', 'croissant', 'bread', 'pancakes', 'waffle', 'pizza', 'hamburger', 'french-fries', 'hot-dog', 'taco', 'sandwich', 'cooked-rice', 'curry-rice', 'steaming-bowl', 'spaghetti', 'sushi', 'bento-box', 'rice-ball', 'dumpling', 'fried-shrimp', 'cooking', 'green-salad', 'strawberry', 'watermelon', 'mango', 'banana', 'grapes', 'red-apple', 'cherries', 'lemon', 'pineapple', 'coconut', 'peach', 'tangerine', 'kiwi-fruit', 'avocado', 'carrot', 'hot-pepper', 'broccoli', 'egg']);
flat('school', 'การเรียนและสำนักงาน', ['books', 'open-book', 'closed-book', 'notebook', 'ledger', 'pencil', 'black-nib', 'memo', 'spiral-notepad', 'spiral-calendar', 'calendar', 'clipboard', 'laptop', 'desktop-computer', 'graduation-cap', 'school', 'backpack', 'abacus', 'microscope', 'telescope', 'test-tube', 'dna', 'globe-showing-asia-australia', 'straight-ruler', 'triangular-ruler', 'scissors', 'paperclip', 'pushpin', 'round-pushpin', 'bar-chart', 'chart-increasing', 'chart-decreasing', 'briefcase', 'envelope', 'e-mail', 'bell', 'light-bulb', 'magnifying-glass-tilted-left', 'trophy', 'sports-medal', '1st-place-medal', '2nd-place-medal', '3rd-place-medal', 'file-folder', 'card-index-dividers', 'page-facing-up', 'bookmark-tabs', 'crayon', 'paintbrush', 'artist-palette', 'alarm-clock', 'hourglass-not-done', 'megaphone', 'loudspeaker', 'money-bag', 'coin', 'credit-card', 'teacher', 'student', 'woman-teacher', 'man-teacher', 'woman-student', 'man-student', 'woman-scientist', 'man-office-worker', 'woman-office-worker']);
flat('party', 'งานฉลองและเทศกาล', ['party-popper', 'confetti-ball', 'balloon', 'wrapped-gift', 'birthday-cake', 'christmas-tree', 'santa-claus', 'snowman', 'jack-o-lantern', 'ghost', 'fireworks', 'sparkler', 'sparkles', 'ribbon', 'reminder-ribbon', 'red-envelope', 'red-paper-lantern', 'crown', 'gem-stone', 'star', 'glowing-star', 'dizzy', 'red-heart', 'sparkling-heart', 'heart-with-ribbon', 'two-hearts', 'love-letter', 'kiss-mark', 'clinking-glasses', 'bottle-with-popping-cork', 'party-hat', 'piñata', 'pinata', 'mirror-ball', 'admission-tickets', 'ticket', 'carp-streamer', 'wind-chime', 'moon-viewing-ceremony', 'pine-decoration', 'japanese-dolls', 'diya-lamp', 'firecracker', 'magic-wand', 'teddy-bear']);
flat('travel', 'เดินทางและท่องเที่ยว', ['airplane', 'small-airplane', 'automobile', 'bus', 'tram', 'high-speed-train', 'ship', 'sailboat', 'speedboat', 'bicycle', 'motor-scooter', 'beach-with-umbrella', 'desert-island', 'snow-capped-mountain', 'mountain', 'camping', 'tent', 'world-map', 'compass', 'luggage', 'statue-of-liberty', 'sunrise', 'sunrise-over-mountains', 'cityscape', 'house', 'house-with-garden', 'hotel', 'ferris-wheel', 'roller-coaster', 'carousel-horse', 'rocket', 'flying-saucer', 'hot-air-balloon', 'kick-scooter', 'fuel-pump', 'round-pushpin', 'camera', 'camera-with-flash', 'sunglasses', 'passport-control', 'umbrella-on-ground', 'national-park', 'stadium', 'classical-building', 'hindu-temple', 'pagoda', 'shinto-shrine']);
flat('zodiac', 'ราศีและดวงดาว', ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces', 'ophiuchus', 'crescent-moon', 'full-moon', 'first-quarter-moon-face', 'sun-with-face', 'star', 'glowing-star', 'shooting-star', 'comet', 'ringed-planet', 'milky-way', 'crystal-ball', 'dizzy', 'sparkles', 'telescope', 'night-with-stars', 'new-moon-face', 'full-moon-face']);
flat('weather', 'ธรรมชาติและอากาศ', ['sun', 'sun-behind-cloud', 'sun-behind-small-cloud', 'cloud', 'cloud-with-rain', 'cloud-with-lightning-and-rain', 'cloud-with-snow', 'snowflake', 'rainbow', 'fire', 'droplet', 'water-wave', 'volcano', 'globe-showing-americas', 'globe-showing-europe-africa', 'tornado', 'fog', 'umbrella-with-rain-drops', 'high-voltage', 'thermometer', 'wind-face', 'cyclone', 'leaf-fluttering-in-wind', 'mountain', 'desert', 'national-park', 'herb', 'rock']);
flat('sports', 'กีฬาและงานอดิเรก', ['soccer-ball', 'basketball', 'volleyball', 'american-football', 'baseball', 'tennis', 'badminton', 'ping-pong', 'bowling', 'golf', 'flag-in-hole', 'ice-skate', 'skis', 'skateboard', 'roller-skate', 'goal-net', 'boxing-glove', 'martial-arts-uniform', 'trophy', 'sports-medal', 'military-medal', 'video-game', 'joystick', 'game-die', 'puzzle-piece', 'chess-pawn', 'guitar', 'musical-keyboard', 'trumpet', 'violin', 'drum', 'headphone', 'microphone', 'musical-notes', 'artist-palette', 'framed-picture', 'yarn', 'kite', 'fishing-pole', 'running-shoe', 'person-running', 'person-swimming', 'person-biking', 'person-lifting-weights']);
flat('faces', 'อีโมจิและท่าทาง', ['grinning-face', 'grinning-face-with-big-eyes', 'beaming-face-with-smiling-eyes', 'face-with-tears-of-joy', 'smiling-face-with-halo', 'smiling-face-with-hearts', 'smiling-face-with-heart-eyes', 'star-struck', 'face-blowing-a-kiss', 'winking-face', 'smiling-face-with-sunglasses', 'partying-face', 'thinking-face', 'face-with-monocle', 'nerd-face', 'hugging-face', 'shushing-face', 'sleeping-face', 'astonished-face', 'pleading-face', 'crying-face', 'loudly-crying-face', 'angry-face', 'exploding-head', 'zany-face', 'cowboy-hat-face', 'clown-face', 'alien', 'robot', 'ghost', 'smiling-face-with-open-hands', 'saluting-face', 'melting-face', 'thumbs-up', 'thumbs-down', 'clapping-hands', 'waving-hand', 'ok-hand', 'victory-hand', 'folded-hands', 'raising-hands', 'flexed-biceps', 'writing-hand', 'backhand-index-pointing-right', 'index-pointing-up', 'call-me-hand', 'love-you-gesture', 'handshake', 'heart-hands', 'check-mark-button', 'cross-mark', 'hundred-points', 'warning', 'red-question-mark', 'red-exclamation-mark', 'light-bulb', 'speech-balloon', 'thought-balloon', 'collision', 'eyes']);

// 3D-style (gradients + soft shadows): a hand-picked showcase
add({ k: '3d', title: 'สติกเกอร์ 3 มิติ', kind: 'color', ...FLUENT }, 'fluent-emoji', pick('fluent-emoji', ['star', 'glowing-star', 'sparkles', 'red-heart', 'fire', 'rocket', 'trophy', 'crown', 'gem-stone', 'wrapped-gift', 'balloon', 'party-popper', 'light-bulb', 'books', 'graduation-cap', 'money-bag', 'chart-increasing', 'megaphone', 'bell', 'alarm-clock', 'laptop', 'mobile-phone', 'camera', 'rainbow', 'sun', 'cloud', 'snowflake', 'four-leaf-clover', 'cherry-blossom', 'cat-face', 'dog-face', 'panda', 'unicorn', 'smiling-face-with-heart-eyes', 'thumbs-up', 'hundred-points', 'check-mark-button', 'cross-mark', 'direct-hit', 'puzzle-piece', 'shopping-bags', 'globe-showing-asia-australia', 'thought-balloon', 'speech-balloon', 'magnifying-glass-tilted-left', 'calendar', 'pushpin', 'heart-with-ribbon', 'soccer-ball', 'teddy-bear']));

// cartoon people (Fluent Emoji flat, default skin tone)
add({ k: 'people', title: 'ผู้คนการ์ตูน', kind: 'color', ...FLUENT }, 'fluent-emoji-flat', pick('fluent-emoji-flat', ['woman-technologist', 'man-technologist', 'woman-office-worker', 'man-office-worker', 'woman-teacher', 'man-teacher', 'woman-student', 'man-student', 'woman-raising-hand', 'man-raising-hand', 'woman-tipping-hand', 'man-tipping-hand', 'woman-gesturing-ok', 'man-gesturing-ok', 'woman-gesturing-no', 'man-gesturing-no', 'woman-bowing', 'man-bowing', 'woman-shrugging', 'man-shrugging', 'woman-facepalming', 'man-facepalming', 'woman-scientist', 'man-scientist', 'woman-health-worker', 'man-health-worker', 'woman-cook', 'man-cook', 'woman-artist', 'man-artist', 'woman-singer', 'man-singer', 'woman-farmer', 'man-farmer', 'woman-mechanic', 'man-mechanic', 'woman-walking', 'man-walking', 'woman-running', 'man-running', 'girl', 'boy', 'woman', 'man', 'older-woman', 'older-man', 'baby', 'family', 'people-holding-hands', 'woman-and-man-holding-hands', 'person-raising-hand', 'person-tipping-hand', 'detective', 'ninja', 'superhero', 'astronaut']).map((n) => n));
// cartoon stickers (Streamline Stickies Color)
add({ k: 'stickies', title: 'สติกเกอร์การ์ตูน', kind: 'color', license: 'CC BY 4.0', credit: 'Streamline Stickies Color – streamlinehq.com (CC BY 4.0)' }, 'streamline-stickies-color',
  Object.keys(data['streamline-stickies-color'].icons).filter((n) => !/-duo$/.test(n)));
// our own: retro pixel icons (colour) and slide decorations (single colour, recolourable)
collections.push({ k: 'pixel', title: 'ไอคอนพิกเซลย้อนยุค', kind: 'color', license: 'CC0', credit: 'Lai Studio (วาดเอง ใช้ได้อิสระ)', set: 'lai', items: pixelItems() });
collections.push({ k: 'decor', title: 'ลายตกแต่งงานนำเสนอ', kind: 'mono', mode: 'fill', license: 'CC0', credit: 'Lai Studio (วาดเอง ใช้ได้อิสระ)', set: 'lai', items: decorItems() });

// business / education illustration icons: Fluent UI Color, the largest size of each
{
  const ic = data['fluent-color'].icons;
  const best = new Map();
  for (const n of Object.keys(ic)) {
    const m = n.match(/^(.*)-(\d+)$/);
    if (!m) continue;
    const [, base, sz] = m;
    if (/^(add|agents|bot|apps|approvals|code|scan|options|content-view|arrow|dismiss|error|fast-forward|circle-multiple|layer-diagonal|number-symbol|text-edit|wifi-warning|cloud-dismiss|image-off|calendar-cancel|search-visual|slide-text)/.test(base)) continue;
    if (!best.has(base) || +sz > best.get(base)[1]) best.set(base, [n, +sz]);
  }
  add({ k: 'business', title: 'ไอคอนสีธุรกิจและการศึกษา', kind: 'color', license: 'MIT', credit: 'Fluent UI System Color Icons © Microsoft (MIT)' }, 'fluent-color', roundRobin([...best.values()].map((x) => x[0])));
}

// hand-drawn (Streamline Freehand Color)
{
  const names = Object.keys(data['streamline-freehand-color'].icons);
  const want = /^(school|study|learning|reading|business|office|presentation|calendar|money|cash|shopping|travel|food|drink|nature|weather|sport|party|love|gift|science|computer|laptop|mobile|phone|camera|music|art|design|award|trophy|book|mail|email|chat|messages|conversation|user|team|people|ecology|plant|pets|animal|health|medical|time|alarm|hourglass|light|idea|search|target|rocket|flag|map|location|vacation|beach|camping|holiday|christmas|halloween|cake|baby|family|hobby|graph|data|analytics|charts|report|task|notes|edit|pencil|tools|home|house|car|transportation|airplane|startup|smiley|emoji|hand|gesture)/;
  const perPrefix = new Map();
  const chosen = names.filter((n) => {
    if (!want.test(n)) return false;
    const p = n.split('-')[0];
    const c = perPrefix.get(p) || 0;
    if (c >= 10) return false;
    perPrefix.set(p, c + 1);
    return true;
  });
  add({ k: 'hand', title: 'ภาพวาดลายมือ', kind: 'color', license: 'CC BY 4.0', credit: 'Streamline Freehand Color – streamlinehq.com (CC BY 4.0)' }, 'streamline-freehand-color', roundRobin(chosen).slice(0, 260));
}

// round illustration icons (Streamline Kameleon Color)
add({ k: 'kameleon', title: 'ภาพประกอบวงกลม', kind: 'color', license: 'CC BY 4.0', credit: 'Streamline Kameleon Color – streamlinehq.com (CC BY 4.0)' }, 'streamline-kameleon-color',
  Object.keys(data['streamline-kameleon-color'].icons).filter((n) => !/-(duo|pop)$/.test(n)));

// line icons (Tabler): recolourable
{
  const T = Object.keys(data.tabler.icons).filter((n) => !/-(off|filled)$/.test(n) && !/^(brand-|letter-|number-|circle-letter|square-letter|square-number|circle-number|arrow-(bar|big|badge|guide|loop|wave|move|merge|ramp|rotary|fork|iteration|autofit|curve)|text-|align-|layout-|table-|forms|sql|regex|api|code|terminal|git|binary|brackets|braces|math-)/.test(n));
  const groups = {
    'ไอคอนติดต่อและข้อมูล': /^(phone|mail|map-pin|world|home|building|clock|calendar|user|users|id|address-book|message|brand-|at|link|location|share|send)/,
    'ไอคอนการศึกษาและงาน': /^(school|book|books|notebook|pencil|pen|ruler|backpack|certificate|award|trophy|medal|chart|presentation|report|file|folder|clipboard|briefcase|bulb|target|calculator|abacus|microscope|flask|atom|math|abc|list)/,
    'ไอคอนทั่วไป': /^(heart|star|check|x$|plus|minus|alert|info|help|search|settings|lock|key|shield|bell|gift|shopping|cart|truck|coin|cash|credit|wallet|discount|tag|camera|photo|video|music|microphone|headphones|wifi|device|leaf|plant|sun|moon|cloud|droplet|flame|snowflake|bike|car|bus|plane|ship|coffee|pizza|cake|tools|hammer|paint|palette|brush|sparkles|confetti|balloon|thumb|mood|hand|paw|dog|cat|fish|tree|flower)/,
  };
  for (const [title, re] of Object.entries(groups)) {
    const names = T.filter((n) => re.test(n)).slice(0, 140);
    add({ k: 'tabler-' + Object.keys(groups).indexOf(title), title, kind: 'mono', mode: 'stroke', license: 'MIT', credit: 'Tabler Icons (MIT)' }, 'tabler', names);
  }
}

// social media & brand logos (Simple Icons, CC0): brand colour
{
  const BRANDS = [['facebook', '#0866FF'], ['instagram', '#E4405F'], ['line', '#00C300'], ['tiktok', '#000000'], ['youtube', '#FF0000'], ['x', '#000000'], ['messenger', '#00B2FF'], ['whatsapp', '#25D366'], ['telegram', '#26A5E4'], ['discord', '#5865F2'], ['threads', '#000000'], ['pinterest', '#BD081C'], ['snapchat', '#FFFC00'], ['spotify', '#1ED760'], ['gmail', '#EA4335'], ['googlemaps', '#4285F4'], ['google', '#4285F4'], ['shopee', '#EE4D2D'], ['twitch', '#9146FF'], ['reddit', '#FF4500'], ['medium', '#000000'], ['wechat', '#07C160'], ['kakaotalk', '#FFCD00'], ['zoom', '#0B5CFF'], ['googlemeet', '#00897B'], ['apple', '#000000'], ['android', '#3DDC84'], ['googleplay', '#414141'], ['appstore', '#0D96F6'], ['github', '#181717'], ['paypal', '#002991'], ['visa', '#1A1F71'], ['mastercard', '#EB001B'], ['tumblr', '#36465D'], ['vimeo', '#1AB7EA'], ['behance', '#1769FF'], ['dribbble', '#EA4C89'], ['canva', null], ['grab', '#00B14F'], ['lazada', '#0F146D']].filter(([n, c]) => c && data['simple-icons'].icons[n]);
  const src = data['simple-icons'];
  collections.push({
    k: 'social', title: 'โซเชียลมีเดียและแบรนด์', kind: 'mono', mode: 'fill', license: 'CC0', credit: 'Simple Icons (CC0) – โลโก้เป็นเครื่องหมายการค้าของเจ้าของแต่ละราย', set: 'simple-icons',
    items: BRANDS.map(([n, c]) => [n, src.icons[n].body, src.icons[n].width || src.width || 24, src.icons[n].height || src.height || 24, 'โซเชียล โลโก้ ' + n, c]),
  });
}

// ---------------------------------------------------------------- write
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'graphics-data.js');
const total = collections.reduce((a, c) => a + c.items.length, 0);
fs.writeFileSync(out, `// Generated by tools/build-graphics.mjs – do not edit by hand.\n// ${total} graphics in ${collections.length} collections. Licences and credits are listed per collection.\nexport default ${JSON.stringify(collections)};\n`);
console.log(`${total} graphics, ${collections.length} collections, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
for (const c of collections) console.log(`  ${c.k.padEnd(12)} ${String(c.items.length).padStart(4)}  ${c.title}`);
if (missing.length) console.log('not found:', missing.join(', '));
