/**
 * The 60 silver cards: fun, motivating facts about German and learning it (cards 31–60 added 2026-11-24).
 * A day with more than 15 correct vocabulary answers earns the next card in this order.
 * Facts were checked against sources (the plan document is in the Git history); keep wording careful when editing.
 */
export interface SilverFact {
  /** 3D icon in public/icons3d (thiings.co, see docs/icon-credits.md) */
  icon: string;
  fa: string;
  en: string;
}

export const SILVER_FACTS: SilverFact[] = [
  {
    icon: 'filing-cabinet',
    fa: 'جعبه‌ای که با آن درس می‌خوانید اختراع یک آلمانی‌زبان است: سباستین لایتنر، روزنامه‌نگار علمی متولد سالزبورگ، این روش را در کتاب «⁦So lernt man lernen⁩» (۱۹۷۲) معرفی کرد.',
    en: 'The box you are studying with was invented by a German speaker: science journalist Sebastian Leitner, born in Salzburg, introduced it in his 1972 book “So lernt man lernen”.'
  },
  {
    icon: 'globe',
    fa: 'آلمانی پرگویشورترین زبان مادری در اتحادیه‌ی اروپاست؛ نزدیک به ۱۰۰ میلیون نفر در اروپا با آن بزرگ شده‌اند.',
    en: 'German is the most widely spoken native language in the European Union: close to 100 million people in Europe grew up with it.'
  },
  {
    icon: 'map',
    fa: 'آلمانی در شش کشور زبان رسمی است: آلمان، اتریش، سوئیس، لیختن‌اشتاین، لوکزامبورگ و بلژیک. با یک زبان، شش کشور!',
    en: 'German is an official language in six countries: Germany, Austria, Switzerland, Liechtenstein, Luxembourg and Belgium. One language, six countries!'
  },
  {
    icon: 'typewriter',
    fa: 'در آلمانی همه‌ی اسم‌ها با حرف بزرگ شروع می‌شوند؛ پس در هر متنی اسم‌ها را با یک نگاه پیدا می‌کنید.',
    en: 'In German every noun starts with a capital letter, so you can spot the nouns in any text at a glance.'
  },
  {
    icon: 'teddy-bear',
    fa: 'das Mädchen (دختر) خنثی است، نه مؤنث! چون هر اسمی که با ‎-chen‎ تمام شود آرتیکلش das است. یک قاعده، کلی آرتیکل درست.',
    en: 'das Mädchen (girl) is neuter, not feminine! Every noun ending in -chen takes das. One rule, lots of correct articles.'
  },
  {
    icon: 'gift',
    fa: 'مراقب باشید: Gift در آلمانی یعنی «سم»، نه «هدیه»! هدیه می‌شود das Geschenk.',
    en: 'Careful: Gift in German means “poison”, not “present”! A present is das Geschenk.'
  },
  {
    icon: 'cake',
    fa: 'Kummerspeck یعنی «چربیِ غصه»: وزنی که از خوردنِ وقت ناراحتی اضافه می‌شود. آلمانی برای همه‌چیز یک کلمه دارد!',
    en: 'Kummerspeck means “grief bacon”: the weight you put on from eating when you are sad. German has a word for everything!'
  },
  {
    icon: 'handshake',
    fa: 'آلمانی و انگلیسی خواهر و برادرند (هر دو ژرمنی غربی): Haus/house، Wasser/water، Hand/hand، Buch/book. خیلی از کلمه‌ها را از قبل بلدید!',
    en: 'German and English are siblings (both West Germanic): Haus/house, Wasser/water, Hand/hand, Buch/book. You already know lots of words!'
  },
  {
    icon: 'backpack',
    fa: 'کلمه‌ی Kindergarten («باغ کودکان») را فریدریش فروبل، مربی آلمانی، برای کودکستانی گذاشت که در سال ۱۸۴۰ راه انداخت؛ امروز ده‌ها زبان همین کلمه را به کار می‌برند.',
    en: 'The word Kindergarten (“children’s garden”) comes from German educator Friedrich Fröbel, who opened his Kindergarten in 1840; dozens of languages use the word today.'
  },
  {
    icon: 'headphones',
    fa: 'Ohrwurm یعنی «کرمِ گوش»: آهنگی که از سرتان بیرون نمی‌رود. انگلیسی هم آن را از آلمانی گرفته: earworm.',
    en: 'Ohrwurm means “ear worm”: a song you can’t get out of your head. English borrowed it from German as “earworm”.'
  },
  {
    icon: 'mountain',
    fa: 'در اتریش و بایرن با یک کلمه هم سلام می‌کنند هم خداحافظی: Servus!',
    en: 'In Austria and Bavaria one word says both hello and goodbye: Servus!'
  },
  {
    icon: 'tomato',
    fa: 'آلمانیِ اتریشی واژه‌های خودش را دارد: گوجه‌فرنگی Paradeiser است، سیب‌زمینی Erdäpfel و ژانویه Jänner.',
    en: 'Austrian German has its own words: a tomato is a Paradeiser, potatoes are Erdäpfel and January is Jänner.'
  },
  {
    icon: 'abacus',
    fa: 'آلمانی‌ها عدد را برعکس می‌گویند: ۲۱ می‌شود einundzwanzig، یعنی «یک و بیست»؛ در حالی که ما می‌گوییم «بیست و یک».',
    en: 'Germans say numbers “backwards”: 21 is einundzwanzig, “one-and-twenty”, just like old English “four-and-twenty”.'
  },
  {
    icon: 'piano',
    fa: 'موتسارت در سالزبورگ به دنیا آمد و نامه‌های بامزه‌اش را به آلمانی می‌نوشت. با آلمانی می‌توانید آن‌ها را به زبان اصلی بخوانید.',
    en: 'Mozart was born in Salzburg and wrote his famously funny letters in German. With German you can read them in the original.'
  },
  {
    icon: 'ferris-wheel',
    fa: 'وین چند بار (از جمله ۲۰۱۸، ۲۰۱۹ و ۲۰۲۲ تا ۲۰۲۴) در رده‌بندی اکونومیست «بهترین شهر دنیا برای زندگی» شد.',
    en: 'Vienna was named the world’s most liveable city by the Economist Intelligence Unit several times, including 2018, 2019 and 2022 to 2024.'
  },
  {
    icon: 'coffee',
    fa: 'فرهنگ کافه‌های وین از سال ۲۰۱۱ در فهرست میراث فرهنگی ناملموس یونسکو در اتریش ثبت شده است.',
    en: 'Since 2011, Viennese coffee house culture has been on Austria’s UNESCO list of intangible cultural heritage.'
  },
  {
    icon: 'smartphone',
    fa: 'در آلمانی به موبایل می‌گویند Handy و به ویدئوپروژکتور Beamer؛ کلمه‌هایی که انگلیسی به نظر می‌رسند ولی انگلیسی‌زبان‌ها این‌طور به کارشان نمی‌برند!',
    en: 'In German a mobile phone is a Handy and a projector is a Beamer: words that look English, but English speakers don’t use them that way!'
  },
  {
    icon: 'violin',
    fa: 'Fingerspitzengefühl یعنی «حسِ نوک انگشت»: ظرافت و درک غریزی در برخورد با موقعیت‌های حساس.',
    en: 'Fingerspitzengefühl means “fingertip feeling”: an instinctive sense of tact in delicate situations.'
  },
  {
    icon: 'atom',
    fa: 'اینشتین مقاله‌های معروف سال ۱۹۰۵ خود، از جمله نسبیت خاص، را به آلمانی منتشر کرد.',
    en: 'Einstein published his famous 1905 papers, including special relativity, in German.'
  },
  {
    icon: 'brain',
    fa: 'روانشناس آلمانی، هرمان ابینگهاوس، در ۱۸۸۵ نشان داد مرور با فاصله‌های بیشتر از حفظ کردن یک‌باره بهتر در ذهن می‌ماند؛ همان کاری که الان با لایتنر می‌کنید.',
    en: 'In 1885 German psychologist Hermann Ebbinghaus showed that reviewing at growing intervals beats cramming: exactly what you are doing with Leitner.'
  },
  {
    icon: 'ruler',
    fa: 'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz (۶۳ حرف) نام واقعی یک قانون در آلمان بود. نگران نباشید، در امتحان نمی‌آید!',
    en: 'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz (63 letters) was the real name of a German law. Don’t worry, it won’t be in your exam!'
  },
  {
    icon: 'dumbbell',
    fa: 'یک پژوهش در سال ۲۰۰۷ نشان داد در کسانی که همیشه از دو زبان استفاده می‌کردند، نشانه‌های زوال عقل به‌طور میانگین حدود ۴ سال دیرتر ظاهر شد. زبان یاد گرفتن ورزشِ مغز است.',
    en: 'A 2007 study found that in people who used two languages throughout life, dementia symptoms appeared about 4 years later on average. Learning a language is exercise for the brain.'
  },
  {
    icon: 'sunset',
    fa: 'Feierabend یعنی وقتِ بعد از کار، وقتی کار تمام شده و استراحت شروع می‌شود. آلمانی برایش یک کلمه‌ی جدا دارد، چون مهم است!',
    en: 'Feierabend is the time after work, when the work is done and the rest begins. German has its own word for it, because it matters!'
  },
  {
    icon: 'book',
    fa: 'نمایشگاه کتاب فرانکفورت بزرگ‌ترین نمایشگاه کتاب جهان است؛ هر سال هزاران ناشر از بیش از صد کشور در آن شرکت می‌کنند.',
    en: 'The Frankfurt Book Fair is the largest book fair in the world, with thousands of publishers from more than 100 countries every year.'
  },
  {
    icon: 'door',
    fa: 'Torschlusspanik یعنی «ترسِ بسته شدنِ دروازه»: نگرانیِ اینکه زمان بگذرد و فرصت‌ها از دست برود. خبر خوب: برای یاد گرفتن آلمانی هیچ‌وقت دیر نیست!',
    en: 'Torschlusspanik means “gate-closing panic”: the fear that time is running out and chances are slipping away. Good news: it is never too late to learn German!'
  },
  {
    icon: 'fountain-pen',
    fa: 'حرف ß فقط در آلمانی هست. از سال ۲۰۱۷ شکل بزرگش (ẞ) هم رسماً در املای آلمانی پذیرفته شده است.',
    en: 'The letter ß exists only in German. Since 2017 its capital form (ẞ) has also been officially accepted in German spelling.'
  },
  {
    icon: 'sofa',
    fa: 'زیگموند فروید در وین کار می‌کرد و همه‌ی آثارش را به آلمانی نوشت؛ کلمه‌هایی مثل Ich و Über-Ich از همان‌جا آمده‌اند.',
    en: 'Sigmund Freud worked in Vienna and wrote all his works in German; terms like Ich and Über-Ich (ego and superego) come from there.'
  },
  {
    icon: 'graduation-cap',
    fa: 'در بیشتر ایالت‌های آلمان، دانشگاه‌های دولتی شهریه‌ی تحصیلی ندارند و فقط هزینه‌ی کمی برای هر ترم گرفته می‌شود. آلمانی می‌تواند درِ تحصیل را باز کند.',
    en: 'In most German states, public universities charge no tuition fees, only a small fee per semester. German can open the door to studying there.'
  },
  {
    icon: 'briefcase',
    fa: 'آلمان بزرگ‌ترین اقتصاد اروپاست و آلمان و اتریش در خیلی از رشته‌ها به نیروی متخصص نیاز دارند. هر کلمه‌ای که یاد می‌گیرید، یک قدم به این فرصت‌ها نزدیک‌ترتان می‌کند.',
    en: 'Germany is Europe’s largest economy, and Germany and Austria need skilled workers in many fields. Every word you learn brings you a step closer to those opportunities.'
  },
  {
    icon: 'dragon',
    fa: 'Drachenfutter یعنی «غذای اژدها»: هدیه‌ای که برای آشتی دادنِ کسی که از دستمان دلخور است می‌خریم. نیمه‌ی راه: ۳۰ کارت نقره‌ای جمع کردید؛ این یکی جایزه‌ی خودتان است! 🎉',
    en: 'Drachenfutter means “dragon food”: a present you buy to make peace with someone who is upset with you. Halfway there: you collected 30 silver cards; this one is your reward! 🎉'
  },
  {
    icon: 'door',
    fa: 'در اسم‌های مرکب، آرتیکل را همیشه کلمه‌ی آخر تعیین می‌کند: ⁦das Haus⁩ + ⁦die Tür⁩ = ⁦die Haustür⁩. آرتیکلِ جزء آخر را بلد باشید، آرتیکل کل کلمه را هم بلدید!',
    en: 'In a compound noun the last word decides the article: das Haus + die Tür = die Haustür. Know the last part, and you know the article of the whole word!'
  },
  {
    icon: 'ruler',
    fa: 'اسم‌هایی که به ‎-ung‎، ‎-heit‎، ‎-keit‎، ‎-schaft‎ و ‎-ion‎ ختم می‌شوند تقریباً همیشه مؤنث‌اند: ⁦die Zeitung⁩، ⁦die Freiheit⁩، ⁦die Freundschaft⁩، ⁦die Nation⁩. پنج پسوند، هزاران آرتیکل درست.',
    en: 'Nouns ending in -ung, -heit, -keit, -schaft and -ion are almost always feminine: die Zeitung, die Freiheit, die Freundschaft, die Nation. Five endings, thousands of correct articles.'
  },
  {
    icon: 'abacus',
    fa: 'خبر خوب: در جمع، der و die و das همه ⁦die⁩ می‌شوند: ⁦die Männer⁩، ⁦die Frauen⁩، ⁦die Kinder⁩. برای همه‌ی جمع‌ها فقط یک آرتیکل!',
    en: 'Good news: in the plural, der, die and das all become die: die Männer, die Frauen, die Kinder. One article for every plural!'
  },
  {
    icon: 'lightbulb',
    fa: 'در جمله‌ی اصلی آلمانی، فعلِ صرف‌شده تقریباً همیشه در جایگاه دوم است: ⁦Ich lerne heute Deutsch.⁩ ← ⁦Heute lerne ich Deutsch.⁩ بقیه جابه‌جا می‌شوند، فعل سر جایش می‌ماند.',
    en: 'In a German main clause the conjugated verb almost always comes second: Ich lerne heute Deutsch. → Heute lerne ich Deutsch. The rest can move around; the verb stays put.'
  },
  {
    icon: 'smartphone',
    fa: 'کیبوردتان اوملاوت ندارد؟ به جایش ae، oe، ue و ss بنویسید: ⁦Mädchen → Maedchen⁩، ⁦schön → schoen⁩، ⁦Straße → Strasse⁩. هر آلمانی‌زبانی منظورتان را می‌فهمد.',
    en: 'No umlauts on your keyboard? Write ae, oe, ue and ss instead: Mädchen → Maedchen, schön → schoen, Straße → Strasse. Every German speaker will understand.'
  },
  {
    icon: 'tram',
    fa: '«⁦Ich verstehe nur Bahnhof⁩» (فقط «ایستگاه قطار» را می‌فهمم) یعنی «هیچ‌چیز نمی‌فهمم!». اگر درسی این حس را به شما داد، فقط به مرور ادامه دهید!',
    en: '“Ich verstehe nur Bahnhof” (I only understand “train station”) means “I don’t understand a thing”. If a lesson feels like that, just keep reviewing!'
  },
  {
    icon: 'tomato',
    fa: '«⁦Tomaten auf den Augen haben⁩» (روی چشم‌ها گوجه داشتن) یعنی چیزی را که درست جلوی چشمتان است نبینید.',
    en: '“Tomaten auf den Augen haben” (to have tomatoes on your eyes) means not seeing something that is right in front of you.'
  },
  {
    icon: 'handshake',
    fa: 'آلمانی‌ها برای آرزوی موفقیت انگشت‌هایشان را روی هم نمی‌گذارند، شستشان را فشار می‌دهند: «⁦Ich drücke dir die Daumen!⁩» یعنی «برایت آرزوی موفقیت می‌کنم!»',
    en: 'Germans don’t cross their fingers for luck, they press their thumbs: “Ich drücke dir die Daumen!” means “I’m keeping my fingers crossed for you!”'
  },
  {
    icon: 'flame',
    fa: '«⁦Feuer und Flamme sein⁩» (آتش و شعله بودن) یعنی برای چیزی حسابی شور و شوق داشتن؛ مثل شما برای یادگرفتن آلمانی!',
    en: '“Feuer und Flamme sein” (to be fire and flame) means to be really enthusiastic about something, like you about learning German!'
  },
  {
    icon: 'teddy-bear',
    fa: '«⁦Hier steppt der Bär⁩» (این‌جا خرس می‌رقصد) یعنی این‌جا حسابی شلوغ و پرهیجان است؛ جشن این‌جاست!',
    en: '“Hier steppt der Bär” (the bear is tap-dancing here) means this is where the action is: a lively place with lots going on.'
  },
  {
    icon: 'dumbbell',
    fa: '«⁦Übung macht den Meister⁩»: تمرین، استاد می‌سازد. هر روزِ مرور یک قدم شما را به استادی نزدیک‌تر می‌کند.',
    en: '“Übung macht den Meister”: practice makes the master. Every day of review brings you a step closer.'
  },
  {
    icon: 'alarm-clock',
    fa: '«⁦Morgenstund hat Gold im Mund⁩» (ساعتِ صبح طلا در دهان دارد): همان «سحرخیز باش تا کامروا باشی» خودمان. چند کارت همراه چای صبح؟',
    en: '“Morgenstund hat Gold im Mund” (the morning hour has gold in its mouth) is the German “the early bird catches the worm”. A few cards with your morning tea?'
  },
  {
    icon: 'fountain-pen',
    fa: '⁦verschlimmbessern⁩ از ترکیب ⁦schlimmer⁩ (بدتر) و ⁦verbessern⁩ (بهتر کردن) ساخته شده: چیزی را با تلاش برای بهتر کردن، بدتر کردن!',
    en: 'verschlimmbessern blends schlimmer (worse) and verbessern (to improve): to make something worse by trying to improve it!'
  },
  {
    icon: 'map',
    fa: '⁦Heimweh⁩ یعنی دلتنگی برای خانه، و ⁦Fernweh⁩ («درد دوری») برعکس آن است: اشتیاقِ رفتن به جایی دوردست.',
    en: 'Heimweh is homesickness; its opposite, Fernweh (“far-sickness”), is the longing to be somewhere far away.'
  },
  {
    icon: 'globe',
    fa: 'انگلیسی خیلی از کلمه‌های آلمانی را عیناً قرض گرفته است: ⁦Angst⁩، ⁦Kitsch⁩، ⁦Zeitgeist⁩، ⁦Wanderlust⁩، ⁦Schadenfreude⁩ و ⁦Doppelgänger⁩.',
    en: 'English has borrowed many German words just as they are: Angst, Kitsch, Zeitgeist, Wanderlust, Schadenfreude and Doppelgänger.'
  },
  {
    icon: 'mountain',
    fa: 'آلمانیِ معیار سوئیس اصلاً حرف ß ندارد: سوئیسی‌ها ⁦Strasse⁩ می‌نویسند، جایی که آلمانی‌ها و اتریشی‌ها ⁦Straße⁩ می‌نویسند. به جای ⁦Hallo⁩ هم اغلب می‌گویند ⁦Grüezi⁩!',
    en: 'Swiss Standard German doesn’t use the letter ß at all: the Swiss write Strasse where Germans and Austrians write Straße. And instead of Hallo they often say Grüezi!'
  },
  {
    icon: 'sunset',
    fa: '⁦Donnerstag⁩ (پنجشنبه) روزِ دونار، خدای تندرِ ژرمن‌هاست (⁦Donner⁩ یعنی تندر) که در شمال اروپا «ثور» نامیده می‌شد. ⁦Thursday⁩ انگلیسی هم یعنی «روز ثور»: همان خدا!',
    en: 'Donnerstag (Thursday) is the day of Donar, the Germanic god of thunder (Donner), called Thor in the north. English Thursday is “Thor’s day”: the same god!'
  },
  {
    icon: 'pretzel',
    fa: 'کلمه‌ی ⁦Brezel⁩ احتمالاً از ⁦bracchium⁩ لاتین به معنای «بازو» آمده است: گره‌اش شبیه دست‌هایی است که روی سینه ضربدری شده‌اند.',
    en: 'The word Brezel probably comes from Latin bracchium, “arm”: the knot looks like arms folded across the chest.'
  },
  {
    icon: 'book-lg',
    fa: 'یوهانس گوتنبرگ، اهل ماینتس، حدود سال ۱۴۵۰ چاپ با حروف متحرک فلزی را به وجود آورد. انجیلی که حدود ۱۴۵۵ چاپ کرد از نخستین کتاب‌هایی بود که در اروپا این‌گونه چاپ شدند.',
    en: 'Around 1450 Johannes Gutenberg of Mainz developed printing with movable metal type. His Bible, printed around 1455, was one of the first books in Europe printed this way.'
  },
  {
    icon: 'book',
    fa: 'مارتین لوتر در سال ۱۵۲۲ ترجمه‌ی آلمانیِ عهد جدید را منتشر کرد. این کتاب در شمار بسیار زیادی چاپ شد، در همه‌ی سرزمین‌های آلمانی‌زبان خوانده شد و به شکل‌گیری یک آلمانیِ نوشتاریِ مشترک کمک کرد.',
    en: 'In 1522 Martin Luther published his German New Testament. Printed in huge numbers and read across the German-speaking lands, it helped shape a shared written German.'
  },
  {
    icon: 'hourglass',
    fa: 'برادران گریم، که با قصه‌هایشان مشهورند، در سال ۱۸۳۸ نوشتن یک فرهنگ لغت بزرگ آلمانی را آغاز کردند. تکمیل ۳۲ جلد آن تا ۱۹۶۱ طول کشید: ۱۲۳ سال! خیالتان راحت، کلمه‌های شما خیلی زودتر تمام می‌شوند.',
    en: 'The Brothers Grimm, famous for their fairy tales, began a huge German dictionary in 1838. Its 32 volumes were finished only in 1961: 123 years! Don’t worry, your word list will be done much sooner.'
  },
  {
    icon: 'brain',
    fa: 'در پژوهشی در سال ۲۰۰۶، دانشجویانی که از خودشان آزمون گرفتند یک هفته بعد خیلی بیشتر از کسانی به یاد داشتند که فقط متن را دوباره خوانده بودند. هر کارتی که از حافظه جواب می‌دهید همین آزمون است.',
    en: 'In a 2006 study, students who tested themselves remembered much more a week later than students who only reread the text. Every card you answer from memory is that kind of test.'
  },
  {
    icon: 'bell',
    fa: 'سرود «⁦Stille Nacht, heilige Nacht⁩» نخستین بار در سال ۱۸۱۸ در اوبرندورف، نزدیک سالزبورگ، خوانده شد. امروز به صدها زبان خوانده می‌شود و از سال ۲۰۱۱ در فهرست میراث فرهنگی ناملموس اتریش است.',
    en: '“Stille Nacht, heilige Nacht” (Silent Night) was first sung in 1818 in Oberndorf near Salzburg. Today it is sung in hundreds of languages, and since 2011 it has been on Austria’s list of intangible cultural heritage.'
  },
  {
    icon: 'edelweiss',
    fa: '⁦Edelweiss⁩ («سفیدِ نجیب») گلِ نمادِ کوه‌های آلپ است. به سکه‌ی ۲ سنتیِ اتریش نگاه کنید: همان‌جاست!',
    en: 'The Edelweiss (“noble white”) is a symbol of the Alps. Look at an Austrian 2-cent coin: there it is!'
  },
  {
    icon: 'ferris-wheel',
    fa: 'چرخ‌وفلکِ بزرگ وین، ⁦Riesenrad⁩ («چرخ غول‌پیکر»)، از سال ۱۸۹۷ در پارک پراتر می‌چرخد. ⁦Riese⁩ یعنی غول و ⁦Rad⁩ یعنی چرخ.',
    en: 'Vienna’s giant Ferris wheel, the Riesenrad, has been turning in the Prater since 1897. Riese means giant, and Rad means wheel.'
  },
  {
    icon: 'violin',
    fa: 'سرود اروپا ملودیِ سمفونی نهم بتهوون است؛ قطعه‌ای که روی شعر آلمانیِ فریدریش شیلر، «⁦An die Freude⁩» (سرود شادی)، ساخته شده است.',
    en: 'The anthem of Europe is a melody from Beethoven’s Ninth Symphony, which sets Friedrich Schiller’s German poem “An die Freude” (Ode to Joy).'
  },
  {
    icon: 'typewriter',
    fa: 'فرانتس کافکا در پراگ زندگی می‌کرد، اما همه‌ی آثار مشهورش، مثل «⁦Die Verwandlung⁩» (مسخ)، را به آلمانی نوشت.',
    en: 'Franz Kafka lived in Prague, but he wrote all his famous works, like “Die Verwandlung” (The Metamorphosis), in German.'
  },
  {
    icon: 'trophy',
    fa: 'برتا بنتس در سال ۱۸۸۸ همراه دو پسرش خودروی همسرش را حدود ۱۰۰ کیلومتر از مانهایم تا پفورتسهایم راند: نخستین سفرِ طولانی با خودرو در تاریخ.',
    en: 'In 1888 Bertha Benz drove her husband’s motor car about 100 km from Mannheim to Pforzheim with her two sons: the first long-distance car journey in history.'
  },
  {
    icon: 'atom',
    fa: 'ویلهلم کنراد رونتگن در سال ۱۸۹۵ پرتو ایکس را کشف کرد. برای همین در آلمانی به عکس پرتو ایکس ⁦Röntgenbild⁩ و به این پرتوها ⁦Röntgenstrahlen⁩ می‌گویند.',
    en: 'Wilhelm Conrad Röntgen discovered X-rays in 1895. That’s why in German an X-ray image is ein Röntgenbild and the rays are Röntgenstrahlen.'
  },
  {
    icon: 'party-popper',
    fa: '«⁦Ende gut, alles gut⁩»: پایانِ خوش، همه‌چیز خوش. هر ۶۰ کارت نقره‌ای را جمع کردید؛ یعنی ۶۰ روز مرورِ جدی. ⁦Herzlichen Glückwunsch!⁩ 🎉',
    en: '“Ende gut, alles gut”: all’s well that ends well. You collected all 60 silver cards: that’s 60 days of serious review. Herzlichen Glückwunsch! 🎉'
  }
];

export const SILVER_MAX = SILVER_FACTS.length;
