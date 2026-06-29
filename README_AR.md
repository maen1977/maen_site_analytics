# إصلاح فتح الموقع كامل عند أول زيارة

هذا الإصلاح يحل مشكلة أن الموقع لا يظهر أحيانًا عند فتح الرابط الأساسي:

https://maensat.pages.dev

من فيسبوك، متصفح متخفي، جهاز جديد، أو أول زيارة بدون كاش.

## ماذا يفعل؟

- يضيف سكربت حماية صغير: `public/assets/maensat-first-load-safe.js`
- يضمن ظهور صفحة صالحة حتى لو حدث خطأ JavaScript عند أول تحميل.
- إذا كانت `localStorage` غير متاحة في المتصفح أو WebView، يستخدم تخزينًا مؤقتًا داخل نفس الزيارة بدل أن يتوقف الموقع.
- إذا لم تظهر أي صفحة فعّالة، يفتح صفحة مناسبة تلقائيًا بدل الشاشة الفارغة.
- يحمي `showPage` حتى لا يتوقف الموقع كامل بسبب خطأ في قسم فرعي.

## ما الذي لا يلمسه؟

- لا يلمس تحديث كأس العالم كل 15 دقيقة.
- لا يلمس GitHub Actions.
- لا يلمس ملفات JSON.
- لا يغير تصميم الموقع.
- لا يغير منطق نتائج كأس العالم.

## الملفات المعدلة أو المضافة

- `public/index.html`
- `public/index_phone.html`
- `public/assets/maensat-first-load-safe.js`

## طريقة التركيب

1. فك الضغط.
2. ارفع مجلد `public` فوق مجلد `public` في الريبو.
3. وافق على استبدال `index.html` و `index_phone.html` وإضافة ملف `assets/maensat-first-load-safe.js`.
4. اعمل commit.
5. انتظر النشر على Cloudflare.
6. جرّب من متصفح متخفي:

https://maensat.pages.dev/?v=first-load-safe

## رسالة commit مقترحة

Fix whole site first load for incognito and Facebook
