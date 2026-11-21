"""Generates the ChatGPT prompt batches and the expected-image list from one master list.

    python3 illustrations/build_prompts.py

Writes:
  illustrations/prompts.json            every image: file name, batch, style, size, background, Thai name, keywords
  illustrations/batches/batch-XX-*.md   copy-paste prompts, at most 10 per batch (one image per prompt)
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- styles (repeated in full in every prompt so nothing drifts)
STYLES = {
    'S1': {
        'th': 'ลายเส้นน่ารัก (doodle)',
        'en': ('Cute hand-drawn doodle illustration. Thick, slightly uneven black outlines (about 6 px at 1024 px). '
               'Flat pastel fills only from this palette: cream #FFF4D6, mint #BDE7D2, sky blue #AFD8F2, peach #F9C7A8, '
               'lilac #D8C8F0, butter yellow #FBE38E, coral #F28B82, plus black for outlines. No gradients, no realistic shading, '
               'at most one flat darker shadow shape per object. Friendly, simple, rounded shapes. '
               'People have simple round faces with dot eyes and simple mitten-like hands.'),
    },
    'S2': {
        'th': 'แฟลตมีพื้นผิว (flat grain)',
        'en': ('Flat vector illustration with a subtle grain / risograph texture. No outlines. Natural muted palette: '
               'olive green #8DA65B, deep green #3F6B3A, warm sand #F2DDB6, terracotta #D9734E, dusty blue #7FA7C9, '
               'soft pink #EBA5B8, cream #FBF3E4, charcoal #2E2E2E. Simple geometric shapes, gentle textured shading, '
               'calm and warm mood. People are simplified with small features and natural Southeast Asian skin tones.'),
    },
    'S3': {
        'th': '3 มิติ (3D clay)',
        'en': ('Glossy 3D clay render. Soft rounded shapes, smooth plastic material, soft studio lighting from the top left, '
               'gentle soft shadow directly under the object, vibrant but soft colours (violet #8B5CF6, pink #F472B6, '
               'sky #38BDF8, yellow #FACC15, mint #34D399, orange #FB923C). Cute, chunky proportions.'),
    },
}

STICKER_RULES = ('Exactly ONE subject (or exactly the people listed), centred, the whole subject fully visible with an empty margin '
                 'of at least 10% on every side. Transparent background (PNG with alpha channel). If transparency is not possible, '
                 'use a plain pure white #FFFFFF background. Do NOT draw: any text, letters, numbers, words, Thai or English '
                 'characters, logos, brand marks, watermark, signature, frame, border, ground line, or a checkerboard pattern.')
SCENE_RULES = ('Full-bleed scene that fills the whole canvas edge to edge. {space} Keep every important element away from the outer 8% '
               'of the canvas (it may be cropped). Do NOT draw: any text, letters, numbers, words, Thai or English characters, '
               'signs with writing, logos, brand marks, watermark or signature.')
SIZE = {'1:1': '1024×1024 (square)', '3:2': '1536×1024 (landscape)', '2:3': '1024×1536 (portrait)'}

THAI_SCHOOL = ('Thai school uniform: white short-sleeved shirt, navy blue shorts for boys or navy blue pleated knee-length skirt for girls, '
               'black shoes and white socks')
BOY = 'Thai school uniform for a boy: white short-sleeved shirt, navy blue shorts, black shoes and white socks'
GIRL = 'Thai school uniform for a girl: white short-sleeved blouse, navy blue pleated knee-length skirt, black shoes and white socks'

# ---------------------------------------------------------------- master list
# (batch title, style, category key, Thai category, items)
# item: (slug, Thai name, subject description, aspect='1:1', kind='sticker' | 'scene', empty-space note for scenes)
B = []
def batch(title, style, cat, cat_th, items):
    B.append((title, style, cat, cat_th, items))

batch('ภาพตั้งต้นกำหนดสไตล์ (ทำก่อนทุกชุด)', 'MIX', 'anchor', 'ภาพตั้งต้น', [
    ('S1|anchor-student-girl', 'นักเรียนหญิงโบกมือ', f'A cheerful Thai schoolgirl waving one hand, standing, full body. {GIRL}.'),
    ('S1|anchor-laptop', 'แล็ปท็อป', 'An open laptop computer seen from a three-quarter angle with a blank light-blue screen.'),
    ('S1|anchor-potted-plant', 'ต้นไม้ในกระถาง', 'A small leafy green plant in a round terracotta pot.'),
    ('S1|anchor-sun', 'ดวงอาทิตย์', 'A round sun with short rounded rays and a small smile.'),
    ('S2|anchor-mango', 'มะม่วง', 'One ripe yellow mango with a small green leaf on the stem.'),
    ('S2|anchor-lotus', 'ดอกบัว', 'One pink lotus flower in full bloom with two round lotus leaves.'),
    ('S2|anchor-mountain-scene', 'ฉากภูเขาและทะเลสาบ', 'A calm landscape: green layered mountains, a blue lake, a few trees, warm sky.', '3:2', 'scene', 'Leave the upper third of the sky empty and calm for a title.'),
    ('S3|anchor-star', 'ดาว 3 มิติ', 'A chunky five-pointed yellow star.'),
    ('S3|anchor-gift', 'กล่องของขวัญ 3 มิติ', 'A gift box with a ribbon bow, violet box with pink ribbon.'),
    ('S3|anchor-trophy', 'ถ้วยรางวัล 3 มิติ', 'A golden trophy cup with two handles on a small round base, no engraving.'),
])

batch('นักเรียน ท่าทางต่าง ๆ', 'S1', 'students', 'นักเรียน', [
    ('boy-waving', 'นักเรียนชายโบกมือ', f'A Thai schoolboy waving and smiling, full body. {BOY}.'),
    ('girl-reading', 'นักเรียนหญิงอ่านหนังสือ', f'A Thai schoolgirl sitting cross-legged reading an open book (blank pages). {GIRL}.'),
    ('boy-raise-hand', 'นักเรียนชายยกมือ', f'A Thai schoolboy eagerly raising one hand to answer, full body. {BOY}.'),
    ('girl-writing', 'นักเรียนหญิงเขียนหนังสือ', f'A Thai schoolgirl sitting at a small desk writing in a notebook with a pencil. {GIRL}.'),
    ('two-high-five', 'นักเรียนสองคนแปะมือ', f'Exactly two Thai students, a boy and a girl, giving each other a high five, full body. {THAI_SCHOOL}.'),
    ('boy-backpack', 'นักเรียนชายสะพายกระเป๋า', f'A Thai schoolboy walking happily with a backpack on both shoulders, full body. {BOY}.'),
    ('girl-certificate', 'นักเรียนหญิงถือเกียรติบัตร', f'A proud Thai schoolgirl holding a blank certificate paper with a small ribbon seal. {GIRL}.'),
    ('boy-thinking', 'นักเรียนชายกำลังคิด', f'A Thai schoolboy with one hand on his chin thinking, a small empty thought bubble above his head. {BOY}.'),
    ('girl-laptop', 'นักเรียนหญิงใช้แล็ปท็อป', f'A Thai schoolgirl sitting and typing on a laptop with a blank screen. {GIRL}.'),
    ('three-cheering', 'นักเรียนสามคนดีใจ', f'Exactly three Thai students jumping and cheering with arms up, full body. {THAI_SCHOOL}.'),
])
batch('ครูและบุคคลในโรงเรียน', 'S1', 'school-people', 'ครูและโรงเรียน', [
    ('teacher-woman-board', 'ครูผู้หญิงชี้กระดาน', 'A friendly female Thai teacher in a light-blue blouse and dark knee-length skirt pointing at a small blank green chalkboard.'),
    ('teacher-man-book', 'ครูผู้ชายถือหนังสือ', 'A friendly male Thai teacher in a white shirt, dark trousers and glasses, holding an open book.'),
    ('teacher-with-student', 'ครูกับนักเรียน', f'Exactly two people: a female teacher kneeling beside a young student and smiling. Student wears {THAI_SCHOOL}.'),
    ('librarian-books', 'บรรณารักษ์ถือหนังสือ', 'A smiling woman carrying a tall stack of colourful books.'),
    ('principal', 'ผู้อำนวยการ', 'A kind middle-aged man in a dark suit and tie standing with hands clasped, full body.'),
    ('parent-child', 'ผู้ปกครองกับลูก', f'Exactly two people: a mother holding hands with her young child walking to school. Child wears {THAI_SCHOOL}.'),
    ('graduate', 'บัณฑิตรับปริญญา', 'A happy graduate in a plain dark graduation gown and square cap holding a rolled diploma with a ribbon.'),
    ('student-running', 'นักเรียนวิ่ง', 'A Thai student in a plain sports T-shirt and shorts running, full body, dynamic pose.'),
])
batch('อุปกรณ์การเรียน ชุด 1', 'S1', 'supplies', 'อุปกรณ์การเรียน', [
    ('pencil', 'ดินสอ', 'One yellow pencil with a pink eraser tip, lying diagonally.'),
    ('eraser', 'ยางลบ', 'One rectangular pink eraser.'),
    ('ruler', 'ไม้บรรทัด', 'One wooden ruler with simple tick marks (no numbers), lying diagonally.'),
    ('open-book', 'หนังสือเปิด', 'One open book with blank pages.'),
    ('book-stack', 'กองหนังสือ', 'A neat stack of four closed books with different coloured covers (no titles).'),
    ('notebook', 'สมุดจด', 'A spiral notebook with a blank cover.'),
    ('backpack', 'กระเป๋านักเรียน', 'A school backpack with two straps and a front pocket.'),
    ('scissors', 'กรรไกร', 'A pair of scissors with round handles, slightly open.'),
    ('glue', 'กาวแท่ง', 'One glue stick with its cap beside it.'),
    ('crayons', 'สีเทียน', 'Five crayons of different colours fanned out.'),
])
batch('อุปกรณ์การเรียน ชุด 2', 'S1', 'supplies', 'อุปกรณ์การเรียน', [
    ('globe', 'ลูกโลก', 'A desk globe on a stand showing simple continent shapes.'),
    ('microscope', 'กล้องจุลทรรศน์', 'A school microscope.'),
    ('test-tubes', 'หลอดทดลอง', 'A small rack with three test tubes containing coloured liquids.'),
    ('calculator', 'เครื่องคิดเลข', 'A calculator with a blank screen and plain buttons (no symbols on buttons).'),
    ('abacus', 'ลูกคิด', 'A wooden abacus with colourful beads.'),
    ('magnifier', 'แว่นขยาย', 'A magnifying glass with a round lens and a handle.'),
    ('paint-palette', 'จานสี', 'An artist paint palette with blobs of paint and a brush.'),
    ('school-bus', 'รถโรงเรียน', 'A yellow school bus seen from the side (no writing on it).'),
    ('alarm-clock', 'นาฬิกาปลุก', 'A round twin-bell alarm clock with plain dots instead of numbers.'),
    ('pencil-cup', 'กล่องใส่ดินสอ', 'A pencil cup holding pencils, a ruler and a brush.'),
])
batch('สัญลักษณ์วิชาเรียน', 'S1', 'subjects', 'วิชาเรียน', [
    ('math', 'คณิตศาสตร์', 'Four large math symbols plus, minus, multiply and divide drawn as chunky shapes in a 2×2 group.'),
    ('science', 'วิทยาศาสตร์', 'A simple atom model with an oval orbit and a flask beside it.'),
    ('language', 'ภาษา', 'Two overlapping empty speech bubbles in different colours.'),
    ('art', 'ศิลปะ', 'A small easel with a blank canvas and a paintbrush.'),
    ('music', 'ดนตรี', 'An acoustic guitar with two floating musical note symbols.'),
    ('pe', 'พลศึกษา', 'A football, a basketball and a whistle grouped together.'),
    ('social', 'สังคมศึกษา', 'A generic Thai-style temple roof silhouette with a small tree (not a real specific temple).'),
    ('computing', 'คอมพิวเตอร์', 'A desktop computer with a blank screen, keyboard and mouse.'),
    ('health', 'สุขศึกษา', 'A red apple next to a heart shape.'),
    ('reading', 'การอ่าน', 'An open book with a small sprout growing from the pages.'),
])
batch('ของตกแต่งห้องเรียน', 'S1', 'class-decor', 'ตกแต่งห้องเรียน', [
    ('chalkboard', 'กระดานดำ', 'A blank green chalkboard with a wooden frame on a stand.', '3:2'),
    ('whiteboard', 'ไวท์บอร์ด', 'A blank whiteboard on a stand with a marker tray.', '3:2'),
    ('bulletin-board', 'บอร์ดประกาศ', 'A cork bulletin board with three blank pinned papers and a sticky note.', '3:2'),
    ('star-reward', 'ดาวรางวัล', 'A shiny gold star sticker with a small ribbon.'),
    ('medal', 'เหรียญรางวัล', 'A gold medal on a red ribbon, plain face.'),
    ('trophy', 'ถ้วยรางวัล', 'A gold trophy cup, plain without engraving.'),
    ('idea-bulb', 'หลอดไฟไอเดีย', 'A glowing light bulb with short shine lines.'),
    ('speech-bubble', 'กล่องคำพูด', 'One empty rounded speech bubble.'),
    ('thought-bubble', 'กล่องความคิด', 'One empty cloud-shaped thought bubble with two small circles.'),
    ('rocket', 'จรวด', 'A small cartoon rocket launching with a puff of smoke.'),
])
batch('คนทำงาน', 'S1', 'work-people', 'คนทำงาน', [
    ('woman-laptop', 'ผู้หญิงทำงานกับแล็ปท็อป', 'A young woman sitting at a desk working on a laptop with a blank screen.'),
    ('man-presenting', 'ผู้ชายนำเสนอ', 'A man in a shirt presenting next to a stand with a simple bar chart (bars only, no labels).'),
    ('team-meeting', 'ประชุมทีม', 'Exactly three office workers around a small round table discussing papers.'),
    ('handshake', 'จับมือ', 'Exactly two business people shaking hands, full body.'),
    ('success', 'ดีใจสำเร็จ', 'An office worker jumping with both arms raised in celebration.'),
    ('phone-call', 'คุยโทรศัพท์', 'A woman smiling while talking on a smartphone.'),
    ('megaphone', 'ประกาศด้วยโทรโข่ง', 'A person shouting into a megaphone, energetic pose.'),
    ('busy', 'งานยุ่ง', 'A tired office worker behind a tall pile of papers on a desk.'),
    ('tablet', 'ใช้แท็บเล็ต', 'A man standing and using a tablet with a blank screen.'),
    ('delivery', 'พนักงานส่งของ', 'A delivery rider in a cap holding a cardboard parcel (no logos).'),
])
batch('ของใช้ธุรกิจ ชุด 1', 'S1', 'business', 'ธุรกิจ', [
    ('bar-chart', 'กราฟแท่ง', 'A simple bar chart with four rising bars on two axes (no labels).'),
    ('pie-chart', 'กราฟวงกลม', 'A pie chart with four coloured slices, one slice pulled out.'),
    ('growth-arrow', 'ลูกศรเติบโต', 'A zig-zag upward arrow over small bars.'),
    ('calendar', 'ปฏิทิน', 'A desk calendar page with an empty grid and two rings on top (no numbers).'),
    ('checklist', 'รายการตรวจสอบ', 'A clipboard with three tick boxes all checked and short grey lines instead of text.'),
    ('search-doc', 'ค้นหาเอกสาร', 'A magnifying glass over a paper document with grey lines instead of text.'),
    ('laptop', 'แล็ปท็อป', 'An open laptop with a blank screen.'),
    ('phone', 'สมาร์ตโฟน', 'A smartphone with a blank screen.'),
    ('coffee', 'แก้วกาแฟ', 'A coffee cup with steam swirls.'),
    ('briefcase', 'กระเป๋าเอกสาร', 'A brown briefcase.'),
])
batch('ของใช้ธุรกิจ ชุด 2', 'S1', 'business', 'ธุรกิจ', [
    ('money-bag', 'ถุงเงิน', 'A money sack next to a small stack of plain gold coins (no symbols).'),
    ('piggy-bank', 'กระปุกออมสิน', 'A pink piggy bank with a coin going into the slot.'),
    ('credit-card', 'บัตร', 'A blank credit card with a chip (no numbers or logo).'),
    ('target', 'เป้าหมาย', 'A target board with an arrow in the bullseye.'),
    ('puzzle', 'จิ๊กซอว์', 'Two puzzle pieces fitting together.'),
    ('gears-bulb', 'ไอเดียกับเฟือง', 'A light bulb with two small gears inside.'),
    ('cart', 'รถเข็นช้อปปิ้ง', 'A shopping cart with two paper bags.'),
    ('shield', 'โล่ความปลอดภัย', 'A shield with a check mark.'),
    ('handshake-icon', 'สัญลักษณ์จับมือ', 'Two hands shaking, close-up.'),
    ('trophy-star', 'ถ้วยกับดาว', 'A trophy with a star on top.'),
])
batch('เทคโนโลยีและการสื่อสาร', 'S1', 'tech', 'เทคโนโลยี', [
    ('email', 'อีเมล', 'A closed envelope with a small heart seal.'),
    ('chat', 'แชต', 'Two overlapping empty chat bubbles.'),
    ('video-call', 'ประชุมออนไลน์', 'A laptop showing a video call grid of four simple faces.'),
    ('cloud-upload', 'อัปโหลดคลาวด์', 'A cloud with an upward arrow.'),
    ('wifi', 'ไวไฟ', 'A Wi-Fi router with signal arcs above it.'),
    ('headset', 'หูฟัง', 'A headset with a microphone.'),
    ('camera', 'กล้องถ่ายรูป', 'A compact camera.'),
    ('printer', 'เครื่องพิมพ์', 'A printer printing a blank page.'),
    ('folder', 'แฟ้มเอกสาร', 'A file folder with papers sticking out.'),
    ('bell', 'กระดิ่งแจ้งเตือน', 'A notification bell with motion lines.'),
])
batch('สงกรานต์', 'S2', 'songkran', 'สงกรานต์', [
    ('water-gun-kid', 'เด็กเล่นปืนฉีดน้ำ', 'A happy child in a colourful floral shirt playing with a water gun, water splashing.'),
    ('silver-bowl', 'ขันน้ำ', 'A traditional Thai silver water bowl with jasmine flowers floating in water.'),
    ('blessing-elder', 'รดน้ำดำหัว', 'Exactly two people: a young person gently pouring water from a small bowl over the hands of a smiling elderly person.'),
    ('sand-pagoda', 'เจดีย์ทราย', 'A small sand pagoda decorated with little colourful paper flags (flags blank).'),
    ('floral-shirt', 'เสื้อลายดอก', 'A person wearing a bright floral Hawaiian-style shirt and sunglasses, waving.'),
    ('water-splash', 'สายน้ำกระเซ็น', 'A big decorative water splash shape with droplets.'),
    ('garland', 'พวงมาลัย', 'A Thai jasmine flower garland (phuang malai) with a small red rose and ribbon tassels.'),
    ('songkran-street', 'ฉากถนนสงกรานต์', 'A joyful street water festival with people splashing water, colourful buildings.', '3:2', 'scene', 'Leave the upper third of the sky empty and calm for a title.'),
])
batch('ลอยกระทง', 'S2', 'loykrathong', 'ลอยกระทง', [
    ('krathong', 'กระทงใบตอง', 'A traditional krathong made of banana leaves and flowers with one lit candle and three incense sticks.'),
    ('sky-lanterns', 'โคมลอย', 'Three glowing paper sky lanterns floating upward.'),
    ('woman-thai-dress', 'หญิงชุดไทยถือกระทง', 'A woman in a traditional Thai dress (sabai shawl and long wrap skirt) holding a krathong.'),
    ('lotus-krathong', 'กระทงดอกบัว', 'A floating krathong shaped like a pink lotus with a candle.'),
    ('candle', 'เทียน', 'One lit candle with a soft glow.'),
    ('river-fireworks', 'พลุเหนือแม่น้ำ', 'Fireworks bursting in the night sky over a river.', '3:2', 'scene', 'Leave the upper third of the sky dark and empty for a title.'),
    ('moon-river', 'จันทร์เต็มดวงเหนือแม่น้ำ', 'A full moon above a calm river at night with floating krathongs and their reflections.', '3:2', 'scene', 'Leave the upper-left area empty for a title.'),
    ('loykrathong-poster', 'ฉากลอยกระทงแนวตั้ง', 'Night river with many floating krathongs, small lanterns in the sky, a full moon.', '2:3', 'scene', 'Leave the upper third empty and calm for a title.'),
])
batch('วันสำคัญของไทย', 'S2', 'occasions', 'วันสำคัญ', [
    ('teachers-day-tray', 'พานไหว้ครู', 'A Thai teacher-honouring offering tray (phan) decorated with marigolds, jasmine and a cone-shaped floral arrangement.'),
    ('mothers-day-jasmine', 'มะลิวันแม่', 'A bunch of white jasmine flowers with green leaves tied with a light-blue ribbon.'),
    ('fathers-day-canna', 'ดอกพุทธรักษาวันพ่อ', 'Yellow canna lily flowers with long green leaves.'),
    ('childrens-day', 'วันเด็ก', 'Exactly two happy children holding colourful balloons.'),
    ('new-year', 'ปีใหม่', 'A festive party popper with confetti and a party hat.'),
    ('chinese-new-year', 'ตรุษจีน', 'A red Chinese lantern with tassels and two mandarin oranges with leaves (no characters).'),
    ('red-envelope', 'อั่งเปา', 'A plain red envelope with a simple gold flower pattern (no characters).'),
    ('thai-flag', 'ธงชาติไทย', ('A Thai national flag waving on a pole. The flag has exactly five horizontal stripes from top to bottom: red, white, '
                                'blue (double height), white, red.')),
    ('candle-procession', 'เวียนเทียน', 'Hands holding a lit candle, a lotus bud and three incense sticks together.'),
    ('graduation-cap', 'หมวกรับปริญญา', 'A graduation cap with a tassel on top of a rolled diploma.'),
])
batch('อาหารไทย', 'S2', 'thai-food', 'อาหารไทย', [
    ('somtam', 'ส้มตำ', 'Thai green papaya salad on a plate with a clay mortar and wooden pestle beside it.'),
    ('mango-sticky-rice', 'ข้าวเหนียวมะม่วง', 'Mango sticky rice on a plate: sliced yellow mango, white sticky rice, coconut cream.'),
    ('padthai', 'ผัดไทย', 'A plate of pad thai noodles with shrimp, lime wedge and bean sprouts.'),
    ('tomyum', 'ต้มยำกุ้ง', 'A bowl of tom yum soup with shrimp, chilli and herbs.'),
    ('thai-tea', 'ชาไทย', 'Orange Thai iced tea in a clear plastic cup with a straw.'),
    ('boat-noodles', 'ก๋วยเตี๋ยวเรือ', 'A small bowl of dark-broth boat noodles with herbs.'),
    ('grilled-chicken', 'ไก่ย่างข้าวเหนียว', 'Grilled chicken pieces next to a small bamboo sticky-rice basket.'),
    ('coconut-drink', 'น้ำมะพร้าว', 'A fresh green coconut with a straw.'),
    ('roti', 'โรตี', 'A plate of roti pancake pieces drizzled with sweetened condensed milk.'),
    ('khanom-krok', 'ขนมครก', 'A tray of Thai coconut pancakes (khanom krok) in a round pan.'),
])
batch('ตลาดและวิถีไทย', 'S2', 'thai-market', 'ตลาดไทย', [
    ('food-cart', 'รถเข็นขายอาหาร', 'A Thai street food cart with a small umbrella and pots (no signs).'),
    ('fruit-stall', 'แผงผลไม้', 'A fruit stall with baskets of mangoes, bananas, durian and mangosteens.'),
    ('floating-boat', 'เรือตลาดน้ำ', 'A wooden boat at a floating market loaded with fruits, a vendor in a wide straw hat paddling.'),
    ('tuktuk', 'รถตุ๊กตุ๊ก', 'A colourful Thai tuk-tuk three-wheeler seen from the side (no writing).'),
    ('motorbike-taxi', 'วินมอเตอร์ไซค์', 'A motorcycle taxi rider in a plain orange vest on a scooter.'),
    ('shoulder-pole-vendor', 'แม่ค้าหาบเร่', 'A street vendor carrying two baskets on a bamboo shoulder pole.'),
    ('market-umbrella', 'ร่มแผงตลาด', 'A big striped market umbrella over a small table of vegetables.'),
    ('market-poster', 'ฉากตลาดชุมชนแนวตั้ง', 'A lively outdoor community market with vendors, umbrellas, shoppers, green mountains in the background.', '2:3', 'scene', 'Leave the upper third (sky) empty and calm for a big title.'),
])
batch('สถานที่และธรรมชาติไทย', 'S2', 'thai-places', 'สถานที่ไทย', [
    ('temple', 'วัดไทย', 'A generic Thai Buddhist temple hall with layered orange and green roofs (not a real specific temple).'),
    ('elephant', 'ช้างไทย', 'A friendly Thai elephant standing.'),
    ('longtail-boat', 'เรือหางยาว', 'A wooden longtail boat with colourful ribbons on the bow, on calm water.'),
    ('rice-terraces', 'นาขั้นบันได', 'Green rice terraces on a hillside with a small hut.'),
    ('thai-house', 'เรือนไทย', 'A traditional Thai wooden house on stilts with steep roofs.'),
    ('lotus-pond', 'สระบัว', 'A pond with pink lotus flowers and round leaves.'),
    ('north-hills', 'ฉากดอยทางเหนือ', 'Misty green hills of northern Thailand at sunrise with pine trees.', '3:2', 'scene', 'Leave the upper third of the sky empty for a title.'),
    ('island', 'ฉากเกาะทะเลใต้', 'A tropical island with limestone cliffs, turquoise sea and a longtail boat.', '3:2', 'scene', 'Leave the upper third of the sky empty for a title.'),
])
batch('ต้นไม้ในกระถาง', 'S1', 'plants', 'ต้นไม้', [
    ('monstera', 'มอนสเตอร่า', 'A monstera plant in a pot.'), ('cactus', 'กระบองเพชร', 'A cactus in a small pot.'),
    ('succulent', 'ไม้อวบน้ำ', 'A rosette succulent in a small pot.'), ('snake-plant', 'ลิ้นมังกร', 'A snake plant in a pot.'),
    ('hanging-plant', 'ไม้แขวน', 'A hanging pot with trailing vines.'), ('small-tree', 'ต้นไม้เล็ก', 'A small round tree.'),
    ('bonsai', 'บอนไซ', 'A bonsai tree in a shallow pot.'), ('sunflower-pot', 'ทานตะวันในกระถาง', 'A sunflower in a pot.'),
    ('herb-pot', 'สมุนไพรในกระถาง', 'A pot of basil herbs.'), ('fern', 'เฟิร์น', 'A fern in a pot.'),
])
batch('ดอกไม้และใบไม้', 'S2', 'flowers', 'ดอกไม้', [
    ('bouquet', 'ช่อดอกไม้', 'A bouquet of mixed flowers wrapped in kraft paper.'), ('rose', 'กุหลาบ', 'One red rose with a stem and leaves.'),
    ('tulip', 'ทิวลิป', 'One pink tulip with a stem.'), ('lotus-flower', 'ดอกบัว', 'One pink lotus flower.'),
    ('orchid', 'กล้วยไม้', 'A purple orchid branch.'), ('jasmine', 'มะลิ', 'A sprig of white jasmine flowers.'),
    ('frangipani', 'ลีลาวดี', 'Three white-and-yellow frangipani flowers with a leaf.'), ('leaf-branch', 'กิ่งใบไม้', 'A branch with green leaves.'),
    ('eucalyptus', 'ยูคาลิปตัส', 'A eucalyptus sprig.'), ('wildflowers', 'ดอกไม้ป่า', 'A small bunch of wildflowers.'),
])
batch('ท้องฟ้าและอากาศ', 'S1', 'weather', 'ท้องฟ้าและอากาศ', [
    ('cloud', 'ก้อนเมฆ', 'A fluffy cloud.'), ('rain-cloud', 'เมฆฝน', 'A cloud with raindrops.'), ('rainbow', 'รุ้ง', 'A rainbow arc with two small clouds.'),
    ('moon-stars', 'พระจันทร์กับดาว', 'A crescent moon with three small stars.'), ('lightning', 'ฟ้าผ่า', 'A cloud with a lightning bolt.'),
    ('wind', 'ลม', 'Curly wind swirl lines with two leaves.'), ('thermometer', 'เทอร์โมมิเตอร์', 'A thermometer.'),
    ('umbrella', 'ร่ม', 'An open umbrella.'), ('sun-cloud', 'แดดกับเมฆ', 'A sun peeking behind a cloud.'), ('snowflake', 'เกล็ดหิมะ', 'A snowflake.'),
])
batch('กรอบและของตกแต่ง', 'S1', 'decor', 'ของตกแต่ง', [
    ('frame-rect', 'กรอบสี่เหลี่ยม', 'An empty hand-drawn rounded rectangle frame with a doodle outline.', '3:2'),
    ('wreath', 'พวงหรีดใบไม้', 'An empty circular wreath made of small leaves.'),
    ('washi-tape', 'เทปกาวลายน่ารัก', 'One strip of patterned washi tape, slightly diagonal.'),
    ('sticky-note', 'กระดาษโน้ต', 'One blank yellow sticky note with a slightly curled corner.'),
    ('torn-paper', 'กระดาษฉีก', 'One blank piece of torn paper.'),
    ('ribbon-banner', 'ริบบิ้นแบนเนอร์', 'A blank ribbon banner with folded ends.', '3:2'),
    ('curved-arrow', 'ลูกศรวาดมือ', 'One curvy hand-drawn arrow.'),
    ('sparkles', 'ประกาย', 'A cluster of three sparkle stars.'),
    ('hearts', 'หัวใจ', 'A cluster of three small hearts.'),
    ('doodle-corner', 'มุมตกแต่ง', 'A corner decoration of small doodles (stars, dots, squiggles) arranged in an L shape.'),
])
batch('ลายไทยและของตกแต่งแบบไทย', 'S2', 'thai-ornament', 'ลายไทย', [
    ('kanok-corner', 'ลายกนกมุม', 'A gold Thai kanok flame-pattern ornament for a corner, L-shaped.'),
    ('thai-border', 'แถบลายไทย', 'A horizontal gold Thai pattern border strip.', '3:2'),
    ('lotus-ornament', 'ลายดอกบัว', 'A symmetrical gold Thai lotus ornament.'),
    ('medallion', 'ลายไทยวงกลม', 'A circular gold Thai pattern medallion.'),
    ('garland-border', 'แถบมาลัย', 'A horizontal border of hanging Thai jasmine garlands.', '3:2'),
    ('thai-cloud', 'ลายเมฆไทย', 'A Thai-style curling cloud motif.'),
    ('thai-frame', 'กรอบลายไทย', 'An empty rectangular gold frame with Thai pattern corners.', '3:2'),
    ('elephant-ornament', 'ช้างลายไทย', 'A decorative elephant with Thai pattern details in gold and red.'),
])
batch('สุขภาพ', 'S1', 'health', 'สุขภาพ', [
    ('doctor', 'หมอ', 'A friendly doctor in a white coat with a stethoscope.'), ('nurse', 'พยาบาล', 'A friendly nurse in a white uniform holding a clipboard.'),
    ('stethoscope', 'หูฟังแพทย์', 'A stethoscope.'), ('pills', 'ยา', 'A pill bottle and two capsules.'),
    ('hand-washing', 'ล้างมือ', 'Two hands washing with soap bubbles.'), ('mask', 'หน้ากากอนามัย', 'A surgical face mask.'),
    ('healthy-plate', 'อาหารสุขภาพ', 'A plate with vegetables, rice and fish.'), ('heartbeat', 'หัวใจเต้น', 'A heart with a heartbeat line.'),
])
batch('กีฬา', 'S1', 'sport', 'กีฬา', [
    ('football-kid', 'เด็กเตะฟุตบอล', 'A child kicking a football.'), ('badminton', 'แบดมินตัน', 'A badminton racket and shuttlecock.'),
    ('takraw', 'ตะกร้อ', 'A rattan sepak takraw ball.'), ('swimming', 'ว่ายน้ำ', 'A child swimming with goggles.'),
    ('cycling', 'ปั่นจักรยาน', 'A person riding a bicycle.'), ('yoga', 'โยคะ', 'A person doing a yoga pose on a mat.'),
    ('podium', 'แท่นรับรางวัล', 'A three-step winners podium (no numbers).'), ('stopwatch', 'นาฬิกาจับเวลา', 'A whistle and a stopwatch.'),
])
batch('ท่องเที่ยว', 'S1', 'travel', 'ท่องเที่ยว', [
    ('suitcase', 'กระเป๋าเดินทาง', 'A suitcase with travel stickers (stickers blank).'), ('passport', 'พาสปอร์ต', 'A closed blank passport with a boarding pass.'),
    ('airplane', 'เครื่องบิน', 'A small airplane flying.'), ('map-pin', 'แผนที่', 'A folded map with a location pin.'),
    ('beach-umbrella', 'ร่มชายหาด', 'A beach umbrella with a towel and sandals.'), ('tent', 'เต็นท์', 'A camping tent with a small campfire.'),
    ('compass', 'เข็มทิศ', 'A compass (no letters).'), ('photo-camera', 'กล้องท่องเที่ยว', 'A camera with a strap.'),
])
batch('สติกเกอร์ 3 มิติ: พื้นฐาน', 'S3', '3d-basic', 'สติกเกอร์ 3 มิติ', [
    ('heart', 'หัวใจ', 'A chunky heart.'), ('thumbs-up', 'ยกนิ้ว', 'A hand giving a thumbs up.'), ('check', 'เครื่องหมายถูก', 'A round badge with a check mark.'),
    ('cross', 'เครื่องหมายผิด', 'A round badge with an X mark.'), ('bolt', 'สายฟ้า', 'A lightning bolt.'), ('fire', 'ไฟ', 'A flame.'),
    ('crown', 'มงกุฎ', 'A crown.'), ('diamond', 'เพชร', 'A diamond gem.'), ('rocket', 'จรวด', 'A rocket.'), ('balloon', 'ลูกโป่ง', 'Two balloons tied together.'),
])
batch('สติกเกอร์ 3 มิติ: เรียนและงาน', 'S3', '3d-work', 'สติกเกอร์ 3 มิติ', [
    ('pencil', 'ดินสอ', 'A pencil.'), ('books', 'กองหนังสือ', 'A stack of three books (no titles).'), ('grad-cap', 'หมวกรับปริญญา', 'A graduation cap.'),
    ('laptop', 'แล็ปท็อป', 'A laptop with a blank screen.'), ('chart', 'กราฟแท่ง', 'Three rising bars.'), ('alarm', 'นาฬิกาปลุก', 'An alarm clock (no numbers).'),
    ('calculator', 'เครื่องคิดเลข', 'A calculator (blank buttons).'), ('megaphone', 'โทรโข่ง', 'A megaphone.'), ('bulb', 'หลอดไฟ', 'A light bulb.'), ('target', 'เป้า', 'A target with an arrow.'),
])
batch('สติกเกอร์ 3 มิติ: ตัวเลข 0–9', 'S3', '3d-numbers', 'ตัวเลข 3 มิติ', [
    (f'number-{n}', f'เลข {n} สามมิติ', (f'Exactly one single digit "{n}" as a chunky 3D balloon-like numeral. This is the ONLY character allowed in the image; '
                                    'no other text.')) for n in range(10)
])
batch('สติกเกอร์ 3 มิติ: ป้ายและของขวัญ', 'S3', '3d-badges', 'สติกเกอร์ 3 มิติ', [
    ('speech', 'กล่องคำพูด', 'An empty speech bubble.'), ('price-tag', 'ป้ายราคา', 'A blank price tag with a string.'), ('gift', 'ของขวัญ', 'A gift box.'),
    ('bag', 'ถุงช้อปปิ้ง', 'A shopping bag (no logo).'), ('coin', 'เหรียญ', 'A plain gold coin.'), ('burst', 'ป้ายดาวระเบิด', 'A blank starburst badge.'),
    ('ribbon-badge', 'ป้ายริบบิ้น', 'A blank round badge with two ribbon tails.'), ('arrow', 'ลูกศร', 'A curved arrow.'), ('pin', 'หมุดตำแหน่ง', 'A location pin.'), ('cart', 'รถเข็น', 'A shopping cart.'),
])
batch('ฉากพื้นหลังสไลด์ 3:2', 'S1', 'slide-bg', 'ฉากสไลด์', [
    (s, t, d, '3:2', 'scene', sp) for s, t, d, sp in [
        ('classroom', 'ห้องเรียน', 'A classroom wall with a large blank chalkboard, a clock without numbers and plants.', 'Keep the chalkboard area completely empty for text.'),
        ('desk-top', 'โต๊ะทำงานมุมบน', 'A top-down view of a desk with stationery, a plant and a cup arranged around the edges.', 'Leave a large empty area in the centre for text.'),
        ('doodle-frame', 'ขอบลายเส้น', 'Cute doodles (stars, books, pencils, clouds) arranged only around the edges on a cream background.', 'Leave the centre 60% completely empty for text.'),
        ('hills', 'ทุ่งหญ้าและภูเขา', 'Rolling green hills with small trees and a few clouds.', 'Leave the upper half of the sky empty for text.'),
        ('meeting-room', 'ห้องประชุม', 'An office meeting room with a big blank screen on the wall.', 'Keep the screen area empty for text.'),
        ('science-lab', 'ห้องวิทยาศาสตร์', 'A science lab with shelves of flasks and a blank board.', 'Keep the board empty for text.'),
        ('library', 'ห้องสมุด', 'Bookshelves on the left and right edges with a soft wall in between.', 'Leave the centre empty for text.'),
        ('playground', 'สนามเด็กเล่น', 'A school playground with a slide and swings along the bottom.', 'Leave the upper half of the sky empty for text.'),
    ]
])
batch('ฉากโปสเตอร์แนวตั้ง 2:3', 'S2', 'poster-bg', 'ฉากโปสเตอร์', [
    (s, t, d, '2:3', 'scene', sp) for s, t, d, sp in [
        ('festival-market', 'ตลาดนัดเทศกาล', 'An evening community festival market with string lights and food stalls along the bottom.', 'Leave the upper third empty for a big title.'),
        ('mountain-lake', 'ทะเลสาบภูเขา', 'A mountain lake landscape with pine trees.', 'Leave the upper third empty for a big title.'),
        ('beach', 'ชายหาด', 'A tropical beach with palm trees and gentle waves.', 'Leave the upper third empty for a big title.'),
        ('songkran', 'สงกรานต์', 'People splashing water at a festive Songkran street along the bottom half.', 'Leave the upper third empty for a big title.'),
        ('garden-frame', 'กรอบสวนดอกไม้', 'Lush flowers and leaves framing all four edges.', 'Leave the centre empty for text.'),
        ('temple-sunset', 'วัดยามเย็น', 'Silhouettes of generic Thai temple roofs at sunset.', 'Leave the upper half of the sky empty for a title.'),
        ('rice-field', 'ทุ่งนา', 'Golden rice fields with a small hut and a farmer in a straw hat.', 'Leave the upper half of the sky empty for a title.'),
        ('city-night', 'เมืองยามค่ำ', 'A city skyline at night with soft lights along the bottom.', 'Leave the upper half empty for a title.'),
    ]
])
batch('ฉากโพสต์โซเชียล 1:1', 'S3', 'social-bg', 'ฉากโพสต์', [
    (s, t, d, '1:1', 'scene', sp) for s, t, d, sp in [
        ('podium', 'แท่นโชว์สินค้า', 'Two round pastel podiums for product display with soft spheres around.', 'Keep the area above the podiums empty.'),
        ('blobs', 'ฟองสีพาสเทล', 'Soft pastel abstract blob shapes around the edges.', 'Leave the centre empty for text.'),
        ('neon-sale', 'พื้นหลังลดราคานีออน', 'A dark violet backdrop with glowing neon light beams and floating 3D cubes.', 'Leave the centre empty for text.'),
        ('confetti', 'คอนเฟตติฉลอง', 'Floating 3D confetti, balloons and gift boxes around the edges.', 'Leave the centre empty for text.'),
        ('leaves', 'ใบไม้รอบขอบ', 'Glossy 3D tropical leaves along the corners.', 'Leave the centre empty for text.'),
        ('waves', 'คลื่นไล่สี', 'Smooth glossy 3D waves in violet and pink at the bottom.', 'Leave the upper two thirds empty for text.'),
        ('food-flatlay', 'อาหารมุมบน', 'Top-down 3D dishes and fruits arranged around the edges of a table.', 'Leave the centre empty for text.'),
        ('desk-flatlay', 'โต๊ะทำงานมุมบน 3 มิติ', 'Top-down 3D desk objects (laptop, plant, cup, notebook) around the edges.', 'Leave the centre empty for text.'),
    ]
])
batch('กรอบเกียรติบัตร 3:2', 'S2', 'certificate', 'กรอบเกียรติบัตร', [
    (s, t, d, '3:2', 'scene', 'The whole centre must stay completely empty for certificate text.') for s, t, d in [
        ('thai-gold', 'ลายไทยทอง', 'An elegant certificate border with gold Thai pattern corners on a cream background.'),
        ('kids-stars', 'เด็กและดาว', 'A cheerful kids certificate border with stars, crayons and balloons along the edges.'),
        ('floral', 'ดอกไม้', 'A soft floral certificate border with watercolour-like flowers in the corners.'),
        ('medal-ribbon', 'เหรียญและริบบิ้น', 'A certificate border with a gold medal and ribbons in the bottom-right corner and a thin double line border.'),
        ('elegant-lines', 'เส้นคู่หรูหรา', 'A simple elegant double-line border with small flourishes at the corners, navy and gold.'),
        ('academic', 'วิชาการ', 'A blue and gold academic certificate border with laurel leaves at the bottom corners.'),
    ]
])

# ---------------------------------------------------------------- write
def prompt_text(style, it, kind, aspect, space):
    rules = STICKER_RULES if kind == 'sticker' else SCENE_RULES.format(space=space or '')
    canvas = f'Canvas: {SIZE[aspect]}.'
    return f"{STYLES[style]['en']}\n\nSubject: {it}\n\n{canvas} {rules}"

def slugify(s):
    return re.sub(r'[^a-z0-9-]+', '-', s.lower()).strip('-')

items, files = [], []
os.makedirs(os.path.join(HERE, 'batches'), exist_ok=True)
for f in os.listdir(os.path.join(HERE, 'batches')):
    if f.endswith('.md'):
        os.remove(os.path.join(HERE, 'batches', f))
for bi, (title, style, cat, cat_th, lst) in enumerate(B):
    md = []
    bname = f'batch-{bi:02d}'
    md.append(f'# ชุดที่ {bi:02d} · {title}\n')
    styles_used = sorted({(x[0].split('|')[0] if '|' in x[0] else style) for x in lst})
    md.append(f"สไตล์: {', '.join(f'{s} {STYLES[s]['th']}' for s in styles_used)} · {len(lst)} ภาพ\n")
    md.append('**วิธีใช้** (ทำตามทุกครั้ง)\n')
    if cat == 'anchor':
        md.append('1. เปิดแชตใหม่ใน ChatGPT 1 แชตต่อ 1 สไตล์ (S1, S2, S3) ส่งคำสั่งทีละข้อ รอภาพเสร็จก่อนส่งข้อต่อไป\n'
                  '2. ภาพชุดนี้คือ "ภาพตั้งต้น" ที่จะใช้เป็นแบบของสไตล์ทั้งหมด ถ้าภาพไหนยังไม่สวย ให้สั่งสร้างใหม่จนพอใจก่อนไปชุดอื่น\n'
                  '3. ดาวน์โหลดเป็น PNG แล้วตั้งชื่อไฟล์ตามที่ระบุ ใส่ไว้ในโฟลเดอร์ `illustrations/inbox/batch-00/`\n')
    else:
        md.append(f'1. เปิด **แชตใหม่** แล้ว **แนบภาพตั้งต้นของสไตล์ {style}** จากชุด 00 (เช่น `{style.lower()}-anchor-*.png`) พร้อมพิมพ์ประโยคแรกนี้ก่อน:\n'
                  f'   > I will send you {len(lst)} separate image requests. Use exactly the same art style, line weight and colour palette as the attached reference image for every image. Make one image per request.\n'
                  '2. ส่งคำสั่งด้านล่าง **ทีละข้อ** รอภาพเสร็จก่อนส่งข้อต่อไป (อย่าส่งหลายข้อในข้อความเดียว จะทำให้ภาพมั่ว)\n'
                  f'3. ดาวน์โหลดเป็น PNG ตั้งชื่อไฟล์ตามที่ระบุ ใส่ไว้ในโฟลเดอร์ `illustrations/inbox/{bname}/`\n'
                  '4. ถ้าภาพมีตัวหนังสือ มือผิดรูป หรือไม่ตรงคำสั่ง ให้พิมพ์ "Please regenerate. Problems: …" แล้วระบุปัญหา\n')
    md.append('5. ครบชุดแล้วส่งภาพมาให้ Claude ตรวจ (หรือรัน `npm run illus:check -- illustrations/inbox/' + bname + '`) ก่อนนำเข้าทุกครั้ง\n')
    for ii, x in enumerate(lst):
        slug, th, desc = x[0], x[1], x[2]
        aspect = x[3] if len(x) > 3 else '1:1'
        kind = x[4] if len(x) > 4 else 'sticker'
        space = x[5] if len(x) > 5 else ''
        st = style
        if '|' in slug:
            st, slug = slug.split('|')
        fname = f'{st.lower()}-{cat}-{slugify(slug)}.png'
        if cat == 'anchor':
            fname = f'{st.lower()}-anchor-{slugify(slug.replace("anchor-", ""))}.png'
        text = prompt_text(st, desc, kind, aspect, space)
        md.append(f'\n---\n\n### {bi:02d}-{ii + 1:02d} · {th}\n\nไฟล์: `{fname}` · {SIZE[aspect]} · '
                  f"{'พื้นหลังโปร่งใส' if kind == 'sticker' else 'ภาพเต็มพื้นที่ (ฉาก)'} · สไตล์ {st}\n\n```text\n{text}\n```\n")
        items.append({'file': fname, 'batch': bname, 'style': st, 'cat': cat, 'catTh': cat_th, 'th': th, 'aspect': aspect,
                      'kind': kind, 'bg': 'transparent' if kind == 'sticker' else 'full', 'subject': desc, 'space': space})
    with open(os.path.join(HERE, 'batches', f'{bname}-{cat}.md'), 'w') as fh:
        fh.write('\n'.join(md))

with open(os.path.join(HERE, 'prompts.json'), 'w') as fh:
    json.dump({'styles': {k: v for k, v in STYLES.items()}, 'items': items}, fh, ensure_ascii=False, indent=1)
dupes = {f for f in [i['file'] for i in items] if [i['file'] for i in items].count(f) > 1}
assert not dupes, dupes
print(f'{len(items)} prompts in {len(B)} batches ({sum(1 for i in items if i["kind"] == "scene")} scenes)')
