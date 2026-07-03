# إصلاح فشل GitHub Actions بسبب lock file و Node 20

المشكلة كانت في workflow اليومي داخل خطوة actions/setup-node. كان فيها:

node-version: '20'
cache: npm

والريبو لا يحتوي على package-lock.json، لذلك فشل setup-node قبل الوصول إلى npm install برسالة:
Dependencies lock file is not found

هذا الإصلاح يغير Node إلى 24 ويحذف cache: npm.

بعد رفع الملف شغل:
GitHub -> Actions -> Daily frequency and analytics reports -> Run workflow -> all

رسالة الكومت المقترحة:
Fix daily reports workflow dependency install
