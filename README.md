# لایتنر هوشمند DaF & Mind

[![CI](https://github.com/mrsadri/daf-leitner-box/actions/workflows/ci.yml/badge.svg)](https://github.com/mrsadri/daf-leitner-box/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **English:** An open-source Leitner-box web app for learning the German vocabulary of the *DaF kompakt* course (A1–B1, 3,420 words) with Persian and English translations and a Persian or English interface, plus personal reflection cards. Google sign-in, cross-device sync and a leaderboard via Supabase. Live: https://daf-leitner-box.vercel.app · Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

جعبه لایتنر برای واژگان کتاب **DaF kompakt (A1–B1، ۳۰ درس، ۳۴۲۰ واژه)** به‌همراه کارت‌های تصمیم و انگیزه. رابط کاربری فارسی و انگلیسی دارد و معنی واژه‌ها به هر دو زبان موجود است.
هر کاربر با حساب گوگل وارد می‌شود، پیشرفتش در حساب خودش ذخیره و بین دستگاه‌ها همگام می‌شود، و در **جدول رقابت** (کلی و هفتگی) با بقیه مقایسه می‌شود.

- فرانت‌اند: React 19 + Vite + Tailwind (اپ استاتیک، روی Vercel)
- ورود، دیتابیس و جدول رقابت: [Supabase](https://supabase.com) (Google OAuth + Postgres + Row Level Security)

فهرست اشکالات منطقی پیدا‌شده و وضعیت رفع هرکدام در [LOGIC_REVIEW.md](LOGIC_REVIEW.md) آمده است.

---

## راه‌اندازی (یک بار)

### ۱. ساخت پروژه Supabase و جدول‌ها

1. در [supabase.com](https://supabase.com) یک پروژه بسازید.
2. در **SQL Editor** محتوای فایل [supabase/schema.sql](supabase/schema.sql) را اجرا کنید (جدول‌های `profiles`، `cards`، `review_events`، سیاست‌های RLS و تابع `get_leaderboard`). اجرای دوباره‌اش بی‌خطر است.
3. (اختیاری، برای پنل مدیریت) بعد از اولین ورود به اپ، حساب خودتان را ادمین کنید:
   ```sql
   insert into public.app_admins (user_id)
   select id from auth.users where email = 'YOUR-EMAIL@example.com'
   on conflict do nothing;
   ```
4. از **Project Settings → API** دو مقدار `Project URL` و کلید `anon` / `publishable` را بردارید.

### ۲. ساخت OAuth Client در گوگل

1. در [Google Cloud Console](https://console.cloud.google.com/apis/credentials) یک پروژه بسازید، **OAuth consent screen** را تنظیم کنید (نوع External، و برای انتشار عمومی آن را Publish کنید).
2. **Create credentials → OAuth client ID → Web application**
3. در **Authorized redirect URIs** این آدرس را بگذارید:
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
4. Client ID و Client Secret را کپی کنید.

### ۳. فعال‌کردن ورود با گوگل در Supabase

1. **Authentication → Sign In / Providers → Google**: فعال کنید و Client ID / Secret را وارد کنید.
2. **Authentication → URL Configuration**:
   - **Site URL**: آدرس نهایی اپ روی Vercel، مثلاً `https://daf-leitner-box.vercel.app`
   - **Redirect URLs**: این‌ها را اضافه کنید:
     - `https://daf-leitner-box.vercel.app/**`
     - `http://localhost:3000/**` (برای اجرای محلی)
     - `https://*-YOUR-VERCEL-TEAM.vercel.app/**` (اختیاری، برای Preview Deployment‌ها)

### ۴. دیپلوی روی Vercel

1. پروژه را در یک مخزن Git (GitHub/GitLab) قرار دهید و در Vercel **Add New → Project** را بزنید و مخزن را import کنید. تنظیمات build از `vercel.json` خوانده می‌شود (Vite، خروجی `dist`).
2. در **Settings → Environment Variables** این دو متغیر را برای Production و Preview تعریف کنید:

   | نام | مقدار |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | کلید anon / publishable |

3. Deploy کنید. اگر آدرس نهایی با Site URL مرحله ۳ فرق داشت، آن را در Supabase اصلاح کنید.

> متغیرهای `VITE_*` هنگام build داخل کد قرار می‌گیرند؛ بعد از تغییرشان باید دوباره deploy کنید.
> کلید anon عمومی است و مشکلی ندارد؛ امنیت داده‌ها با RLS تأمین می‌شود. **کلید `service_role` را هرگز در فرانت‌اند نگذارید.**

---

## اجرای محلی

```bash
npm install
cp .env.example .env.local   # و مقادیر Supabase را وارد کنید
npm run dev                  # http://localhost:3000
```

بررسی تایپ‌ها: `npm run lint` · ساخت نسخه نهایی: `npm run build`

**حالت دمو (بدون Supabase):** با `VITE_DEMO_MODE=1 npm run dev` (یا گذاشتن `VITE_DEMO_MODE=1` در `.env.development.local`) اپ بدون ورود و بدون اتصال به دیتابیس با داده‌ی نمونه اجرا می‌شود و همه‌چیز فقط در localStorage همان مرورگر می‌ماند. این حالت فقط در `npm run dev` کار می‌کند و در بیلد production وجود ندارد؛ برای توسعه‌ی رابط کاربری کنار دیتابیس واقعی کاربران امن است.

### زبان‌ها و ترجمه

- متن‌های رابط کاربری در [src/i18n/fa.ts](src/i18n/fa.ts) و [src/i18n/en.ts](src/i18n/en.ts) هستند. فایل فارسی شکل دیکشنری را تعیین می‌کند و TypeScript اجازه نمی‌دهد کلیدی در انگلیسی جا بیفتد.
- متن آلمانی همیشه با کامپوننت `<De>` (چپ‌به‌راست و `lang="de"`) و متن کاربر با `<Auto>` (`dir="auto"`) نمایش داده می‌شود؛ از کلاس‌های منطقی Tailwind (`ms-`، `pe-`، `text-start`، `start-`) به‌جای `ml-`/`right-` استفاده کنید.
- زبان انتخابی در `profiles.settings.language` ذخیره می‌شود (بدون تغییر schema).
- ستون‌های `Englisch`، `Beispiel_en`، `Formen_en` و `Österreich_en` در CSV نسخه‌ی انگلیسی معنی، ترجمه‌ی مثال و یادداشت‌ها هستند.

---

## ساختار داده

| جدول | محتوا |
|---|---|
| `profiles` | نام نمایشی، آواتار، نمایش در جدول رقابت، تنظیمات (صدا، سرعت تلفظ و…) |
| `cards` | کارت‌های هر کاربر: خانه لایتنر، تاریخ مرور بعدی، شمارنده‌ها و محتوای کارت |
| `review_events` | ثبت هر پاسخ (برای امتیاز هفتگی و روزهای پیاپی) |

- هر کاربر فقط داده‌های خودش را می‌خواند و می‌نویسد (RLS).
- جدول رقابت از تابع `get_leaderboard` می‌آید که فقط اعداد تجمیعی و نام نمایشی را برمی‌گرداند؛ محتوای کارت‌ها (از جمله تصمیم‌ها و انگیزه‌ها) هیچ‌وقت دیده نمی‌شود.
- **امتیاز** = مجموع (تعداد کارت‌های هر خانه × شماره ایندکس آن خانه)؛ خانه ۰ صفر و تسلط کامل (بعد از خانه ۵) ۶ امتیاز. **امتیاز هفتگی** = تغییر همین امتیاز بر اثر مرورهای ۷ روز اخیر.
- تغییرات ابتدا در حافظه و localStorage اعمال و سپس با تأخیر کوتاه به سرور ارسال می‌شوند. اگر اینترنت قطع باشد، در صف می‌مانند و بعداً ارسال می‌شوند.
- پیشرفتی که قبل از اضافه‌شدن ورود با گوگل در مرورگر ذخیره شده بود، در اولین ورود به حساب منتقل می‌شود.

---

## مشارکت

مشارکت خیلی خوش‌آمد است: اصلاح ترجمه‌ها، رفع باگ، قابلیت جدید. راهنما در [CONTRIBUTING.md](CONTRIBUTING.md) است. اشکالات امنیتی را **خصوصی** و طبق [SECURITY.md](SECURITY.md) گزارش کنید.

اگر نسخه خودتان را راه می‌اندازید، ایمیل تماس در [public/privacy.html](public/privacy.html) را به ایمیل خودتان تغییر دهید.

## مجوز

کد تحت مجوز [MIT](LICENSE) منتشر شده است.
این پروژه مستقل است و هیچ ارتباطی با ناشر کتاب *DaF kompakt* (Ernst Klett Sprachen) ندارد؛ نام کتاب فقط برای مشخص‌کردن ترتیب درس‌ها آمده است.
