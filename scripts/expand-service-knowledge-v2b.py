#!/usr/bin/env python3
import json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EXP=ROOT/'public'/'service'/'knowledge'/'expanded'

def slug(s):
    return re.sub(r'[^a-zA-Z0-9\u0600-\u06ff]+','-',s.lower()).strip('-')[:90]

def uniq(xs):
    out=[]; seen=set()
    for x in xs:
        if not x: continue
        k=str(x).strip().lower()
        if k and k not in seen:
            seen.add(k); out.append(str(x).strip())
    return out

def add_topics(file, templates, source):
    p=EXP/file
    data=json.load(open(p,encoding='utf-8'))
    for item in data['items']:
        brand=item.get('brand') or item.get('app') or ''
        ar=item.get('nameAr') or brand
        basekw=[brand,ar,*item.get('aliases',[]),*item.get('possibleOperatingSystems',[]),*item.get('operatingSystems',[]),*item.get('modelFamilies',[]),*item.get('knownModels',[])]
        existing={t.get('intent') for t in item.get('topics',[])}
        for tpl in templates:
            intent,title,summary,kws,steps,need_model,safety=tpl
            # don't skip fully; brand-safe IDs are unique by title
            item.setdefault('topics',[]).append({
                'id': slug(f"{brand}-{intent}"),
                'intent': intent,
                'title': title.format(ar=ar, brand=brand),
                'summary': summary,
                'keywords': uniq([*basekw,*kws,intent]),
                'steps': steps,
                'safe': True,
                'needsModelWhen': [intent,'exact_model_needed'] if need_model else [],
                'whenToCallTechnician': ['رائحة حرق أو دخان','مشكلة كهرباء أو فتح جهاز','تكرار فصل الكهرباء','فشل تحديث أوقف الجهاز'] if safety else [],
                'sources': [source]
            })
    json.dump(data,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=2)

receiver_extra=[
('wifi_dongle_not_detected','قطعة Wi‑Fi لا تظهر على {ar}','تشخيص قطعة الواي فاي USB على الريسيفر.', ['wifi dongle','قطعة واي فاي','usb wifi','لا تظهر'], ['أطفئ الريسيفر ثم ركب القطعة وشغله من جديد.','جرب منفذ USB آخر إن وجد.','تأكد أن القطعة مدعومة من نفس موديل الريسيفر.','إذا القطعة تظهر على جهاز آخر ولا تظهر هنا، غالبًا غير متوافقة.'], True, False),
('diseqc_setup','ضبط DiSEqC والأقمار على {ar}','عند وجود أكثر من قمر أو سويتش، يحتاج ضبط المنافذ.', ['diseqc','دايزك','سويتش','اكثر من قمر','port'], ['افتح إعدادات القمر Satellite Setup.','حدد القمر المطلوب ثم اختر منفذ DiSEqC الصحيح Port 1/2/3/4.','إذا لا تعرف الترتيب، جرّب منفذًا واحدًا ثم افحص جودة الإشارة.','احفظ الإعدادات قبل البحث.'], False, False),
('lnb_power','ضبط LNB Power على {ar}','مشكلة إشارة بسبب إطفاء تغذية اللاقط.', ['lnb','lnb power','لاقط','قوة الاشارة صفر'], ['ادخل لإعدادات القمر.','تأكد أن LNB Power على ON أو 13/18V.','لا تغيّر نوع LNB إذا لا تعرفه؛ الافتراضي غالبًا Universal.','إذا القوة صفر بعد ذلك افحص الكابل والـ LNB.'], False, True),
('channel_order','ترتيب أو نقل القنوات على {ar}','ترتيب القنوات والمفضلة.', ['ترتيب قنوات','نقل قناة','مفضلة','favorite'], ['افتح قائمة القنوات Channel List.','اضغط زر Edit أو اللون المناسب حسب الجهاز.','اختر Move أو Favorite ثم رتب القنوات.','احفظ التغييرات قبل الخروج.'], False, False),
('backup_channels_usb','حفظ نسخة من القنوات على USB في {ar}','حماية ترتيب القنوات قبل ضبط المصنع أو تحديث.', ['backup','نسخة قنوات','usb','حفظ القنوات'], ['ركب USB فارغ أو موثوق.','افتح Tools أو Upgrade/Backup إن وجدت.','اختر Backup Channel List أو Dump DB.','احتفظ بالملف ولا تستخدمه على موديل مختلف.'], True, False),
('usb_recording','التسجيل على USB من {ar}','تشغيل PVR أو Timeshift إذا الجهاز يدعم.', ['تسجيل','recording','pvr','timeshift','usb'], ['استخدم USB سريع ومهيأ بصيغة يدعمها الجهاز.','افتح القناة واضغط Record إذا كان الجهاز يدعم PVR.','بعض القنوات أو الأجهزة لا تسمح بالتسجيل.','إذا يتوقف التسجيل، جرب USB أفضل أو فرمتته من الجهاز.'], True, False),
('audio_track','تغيير الصوت أو اللغة على {ar}','اختيار مسار الصوت أو القناة الصوتية.', ['صوت','audio','لغة الصوت','لا يوجد صوت'], ['اضغط زر Audio من الريموت إن وجد.','اختر المسار العربي أو Stereo.','إذا الصوت لا يظهر على قناة واحدة فجرب قناة أخرى.','إذا المشكلة على كل القنوات افحص HDMI وإعدادات الصوت.'], False, False),
('subtitle_cc','تشغيل الترجمة على {ar}','تشغيل الترجمة إن كانت القناة أو الملف يدعمها.', ['ترجمة','subtitle','cc'], ['اضغط Subtitle من الريموت إن وجد.','اختر اللغة المتاحة.','إذا لا تظهر أي لغة فالبرنامج أو القناة لا يوفر ترجمة.','للملفات من USB، يجب أن يكون ملف الترجمة بنفس اسم الفيديو غالبًا.'], False, False),
('overheating_receiver','{ar} يسخن كثير','تخفيف الحرارة وحماية الجهاز.', ['سخن','يسخن','حرارة','overheat'], ['ضع الجهاز في مكان مفتوح وليس داخل خزانة مغلقة.','لا تضع فوقه أجهزة أخرى.','نظف فتحات التهوية من الغبار بدون فتح الجهاز.','إذا يفصل أو يعيد تشغيله مع الحرارة، يحتاج فحص فني.'], False, True),
('no_power_receiver','{ar} لا يعمل نهائيًا','خطوات آمنة قبل إرسال الجهاز للفني.', ['لا يعمل','no power','ميت','كهرباء'], ['جرّب مصدر كهرباء آخر ومشترك آخر.','تأكد من كابل الكهرباء أو المحول إن كان خارجيًا.','لا تفتح الجهاز ولا تفحص الباور بنفسك.','إذا لا توجد أي لمبة أو رائحة حرق، راجع فني.'], False, True),
]

tv_extra=[
('bluetooth_audio','توصيل سماعة Bluetooth على شاشة {ar}','اقتران سماعة أو سبيكر بلوتوث إذا النظام يدعم.', ['bluetooth','بلوتوث','سماعة','speaker'], ['افتح الإعدادات ثم Bluetooth أو Remotes & Accessories.','ضع السماعة في وضع الاقتران Pairing.','اختر اسم السماعة من الشاشة.','إذا لا تظهر، أعد تشغيل السماعة والشاشة وتأكد أن الشاشة تدعم بلوتوث صوت.'], True, False),
('soundbar_arc','توصيل ساوندبار HDMI ARC مع شاشة {ar}','ضبط ARC/eARC والصوت الخارجي.', ['soundbar','arc','earc','ساوند بار','صوت خارجي'], ['وصل الساوندبار بمنفذ HDMI ARC/eARC في الشاشة.','من إعدادات الصوت اختر HDMI ARC أو External Speaker.','فعّل CEC/Anynet+/Simplink حسب النظام إن لزم.','إذا لا يعمل، جرب كابل HDMI عالي الجودة.'], True, False),
('antenna_scan_tv','بحث القنوات الأرضية أو الديجتال على شاشة {ar}','بحث DTV/ATV عند استخدام هوائي أرضي.', ['بحث قنوات','antenna','dtv','قنوات ارضية','هوائي'], ['وصل كابل الهوائي في مدخل RF.', 'افتح Channel أو Broadcast من الإعدادات.', 'اختر Auto Scan وحدد Antenna/DTV.', 'إذا لا توجد قنوات افحص الهوائي والبلد/المنطقة.'], True, False),
('google_account_tv','تسجيل حساب Google على شاشة {ar}','عند شاشات Android/Google TV.', ['حساب جوجل','google account','تسجيل دخول','play store'], ['افتح Settings ثم Accounts & Sign-in.', 'أدخل حساب Google بشكل رسمي.', 'تأكد من التاريخ والوقت والإنترنت.', 'إذا لا يقبل الدخول، جرب تسجيل الدخول من الهاتف أو تغيير كلمة المرور.'], True, False),
('samsung_account_tv','حساب Samsung أو شروط Smart Hub على شاشة {ar}','عندما لا تظهر تطبيقات سامسونج أو يطلب شروط.', ['samsung account','smart hub','شروط','حساب سامسونج'], ['افتح Smart Hub أو Apps.', 'وافق على الشروط إذا ظهرت رسالة Terms and Conditions.', 'سجل الدخول بحساب Samsung إن طلب.', 'إذا التطبيقات بطيئة، جرب إعادة ضبط Smart Hub من الإعدادات.'], True, False),
('country_region_tv','تغيير البلد أو المنطقة للتطبيقات على شاشة {ar}','بعض التطبيقات تظهر حسب البلد والدعم.', ['بلد','منطقة','region','country','التطبيق لا يظهر'], ['افتح إعدادات البلد/المنطقة إن كانت متاحة.', 'اختر بلدك الصحيح ولا تستخدم إعدادات عشوائية قد تسبب اختفاء تطبيقات أخرى.', 'بعد تغيير المنطقة أعد تشغيل الشاشة وابحث عن التطبيق.', 'إذا التطبيق غير مدعوم لهذا الموديل، استخدم جهاز خارجي رسمي.'], True, False),
('slow_tv','شاشة {ar} بطيئة أو القائمة تعلق','تحسين بطء النظام بدون فورمات مباشرة.', ['بطيئة','تهنج','lag','slow','تعلق القائمة'], ['أعد تشغيل الشاشة من الكهرباء دقيقة.', 'احذف التطبيقات غير المستخدمة.', 'حدّث النظام إن توفر.', 'قلل التطبيقات التي تعمل بالخلفية إن كان النظام يدعم.', 'إذا استمر البطء بعد ضبط المصنع قد يكون الموديل قديمًا أو يحتاج فحص.'], True, False),
('picture_settings_tv','ضبط الصورة والألوان في شاشة {ar}','حل ألوان باهتة أو صورة مظلمة.', ['الوان','صورة','سطوع','brightness','hdr'], ['افتح Picture Settings.', 'جرّب وضع Standard أو Cinema بدل Dynamic إذا الألوان قوية.', 'ارفع Brightness/Backlight حسب الإضاءة.', 'أوقف وضع توفير الطاقة إذا الصورة مظلمة جدًا.', 'إذا نصف الشاشة مظلم أو خطوط ثابتة فهذا يحتاج فني.'], False, True),
('no_power_tv','شاشة {ar} لا تعمل نهائيًا','خطوات آمنة فقط عند انطفاء الشاشة.', ['لا تعمل','no power','كهرباء','لمبة'], ['جرّب مقبس كهرباء آخر.', 'افصل الشاشة دقيقة ثم أعد تشغيلها.', 'تأكد من الريموت وزر التشغيل في الشاشة.', 'إذا لا توجد لمبة أو توجد رائحة حرق، لا تفتح الشاشة وراجع فني.'], False, True),
('restart_loop_tv','شاشة {ar} تعيد التشغيل باستمرار','تشخيص restart loop بأمان.', ['تعيد تشغيل','restart','ريستارت','واقف على الشعار'], ['افصل الكهرباء دقيقة وجرب بدون USB أو HDMI.', 'إذا دخلت للنظام، احذف آخر تطبيقات أو اعمل تحديث.', 'إذا بقيت على الشعار، لا تركب ملفات USB غير رسمية.', 'قد تحتاج فحص سوفتوير أو بوردة من فني.'], True, True),
]

box_extra=[
('date_time_box','ضبط التاريخ والوقت على {ar}','التاريخ الخاطئ يسبب فشل التطبيقات والمتجر.', ['تاريخ','وقت','date','time'], ['افتح Settings ثم Date & Time.', 'فعّل Automatic date & time.', 'اختر المنطقة الزمنية الصحيحة.', 'أعد تشغيل التطبيق بعد ضبط الوقت.'], False, False),
('permissions_box','صلاحيات التطبيقات على {ar}','حل مشكلة التطبيق لا يرى التخزين أو المايك.', ['صلاحيات','permissions','storage permission','microphone'], ['افتح Settings ثم Apps.', 'اختر التطبيق ثم Permissions.', 'فعّل الصلاحية المطلوبة فقط إذا تثق بالتطبيق.', 'لا تمنح صلاحيات حساسة لتطبيقات مجهولة.'], False, False),
('unknown_sources_warning','تحذير من تثبيت APK مجهول على {ar}','أمان تثبيت التطبيقات خارج المتجر.', ['apk','unknown sources','مصادر مجهولة','تطبيق خارجي'], ['الأفضل استخدام المتجر الرسمي.', 'إذا اضطررت لملف APK، استخدم مصدرًا موثوقًا وقانونيًا فقط.', 'لا تثبت تطبيقات تطلب صلاحيات غريبة أو بيانات حسابات.', 'بعد التثبيت أوقف السماح للمصادر المجهولة.'], True, False),
('keyboard_mouse_box','توصيل كيبورد أو ماوس على {ar}','تحسين الاستخدام بإكسسوارات USB/Bluetooth.', ['كيبورد','ماوس','keyboard','mouse'], ['وصل USB Keyboard/Mouse مباشرة أو عبر Hub مدعوم.', 'للبلوتوث افتح Remotes & Accessories ثم Pair.', 'إذا لا يعمل جرّب قطعة أخرى أو أعد تشغيل الجهاز.'], False, False),
('play_protect_box','فحص التطبيقات الضارة على {ar}','تقليل مشاكل التطبيقات المشبوهة.', ['فيروس','malware','play protect','حماية'], ['افتح Google Play إن وجد.', 'ادخل Play Protect وشغّل الفحص.', 'احذف التطبيقات غير المعروفة.', 'غيّر كلمات مرور الحسابات إذا أدخلتها في تطبيق غير موثوق.'], False, False),
]

add_topics('mega-receivers-middle-east-v2.json', receiver_extra, 'internal-receiver-extra-v2')
add_topics('mega-tvs-middle-east-v2.json', tv_extra, 'internal-tv-extra-v2')
add_topics('mega-android-iptv-boxes-v2.json', box_extra, 'internal-android-box-extra-v2')
print(json.dumps({'ok':True},ensure_ascii=False))
