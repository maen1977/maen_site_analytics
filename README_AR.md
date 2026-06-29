# إزالة القنوات الناقلة من قسم كأس العالم - نسخة مباشرة

هذا الملف يزيل عرض معلومات المحطات / القنوات الناقلة من كروت مباريات كأس العالم مباشرة.

## ماذا يغير؟

يستبدل ملفي:

- `public/index.html`
- `public/index_phone.html`

ويجعل دالة عرض القنوات داخل قسم كأس العالم لا تعرض أي شيء.

## ماذا لا يلمس؟

- لا يلمس التحديث كل 15 دقيقة.
- لا يلمس GitHub Actions.
- لا يلمس ملفات JSON.
- لا يلمس ميزة أنت هنا.
- لا يلمس باقي أقسام الموقع.

## طريقة التركيب

1. فك الضغط.
2. ارفع مجلد `public` فوق مجلد `public` في GitHub.
3. وافق على استبدال `index.html` و `index_phone.html`.
4. اعمل Commit.

## رسالة Commit

```text
Remove World Cup broadcast info from UI directly
```

بعد النشر افتح الموقع بكسر الكاش:

```text
https://maensat.pages.dev/?v=no-broadcasts-direct
```
