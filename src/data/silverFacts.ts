/**
 * The 30 silver cards: fun, motivating facts about German and learning it.
 * A day with more than 15 correct vocabulary answers earns the next card in this order.
 * Facts were checked against sources (see docs/silver-cards-plan.md); keep wording careful when editing.
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
    fa: 'Drachenfutter یعنی «غذای اژدها»: هدیه‌ای که برای آشتی دادنِ کسی که از دستمان دلخور است می‌خریم. شما ۳۰ کارت نقره‌ای گرفتید؛ این یکی جایزه‌ی خودتان است! 🎉',
    en: 'Drachenfutter means “dragon food”: a present you buy to make peace with someone who is upset with you. You collected all 30 silver cards; this one is your reward! 🎉'
  }
];

export const SILVER_MAX = SILVER_FACTS.length;
