# تعديل رسالة أنت هنا فقط

هذا الإصلاح نفس الإصلاح السابق، لكنه يزيل عبارة **مباشر الآن** وأي وصف إضافي من العلامة بجانب المباراة.

الآن ستظهر العلامة فقط:

```text
أنت هنا
```

التعديل لا يلمس:

- التحديث كل ربع ساعة.
- GitHub Actions.
- ملفات JSON.
- قسم الرئيسية.

الملفات المعدلة فقط:

```text
public/index.html
public/index_phone.html
public/assets/worldcup-current-focus.js
```

طريقة التركيب:

1. فك الضغط.
2. ارفع مجلد `public` فوق مجلد `public` الموجود في GitHub.
3. شغّل ملف `APPLY_WORLD_CUP_YOU_ARE_HERE_FOCUS.bat` إذا كنت تعمل محليًا على ويندوز.
4. اعمل Commit.

رسالة commit المقترحة:

```text
Show only you are here label on current World Cup match
```
