#!/usr/bin/env python3
import json, os, re, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
K = ROOT / 'public' / 'service' / 'knowledge'
EXP = K / 'expanded'
EXP.mkdir(parents=True, exist_ok=True)

def slug(s):
    s = re.sub(r'[^a-zA-Z0-9\u0600-\u06ff]+','-', str(s).strip().lower()).strip('-')
    return s[:80] or hashlib.sha1(str(s).encode()).hexdigest()[:10]

def uniq(seq):
    out=[]; seen=set()
    for x in seq:
        if x is None: continue
        x=str(x).strip()
        if not x: continue
        k=x.lower()
        if k not in seen:
            seen.add(k); out.append(x)
    return out

def topic(intent, title, summary, keywords, steps, need_model=False, sources=None, safety=False):
    return {
        'id': slug(title + '-' + intent),
        'intent': intent,
        'title': title,
        'summary': summary,
        'keywords': uniq(keywords),
        'steps': steps,
        'safe': True,
        'needsModelWhen': [intent, 'exact_device_steps'] if need_model else [],
        'whenToCallTechnician': [
            'رائحة حرق أو دخان', 'الجهاز لا يعمل نهائيًا بعد تجربة مصدر كهرباء آخر',
            'فتح الشاشة أو الريسيفر أو لحام أو تبديل بوردة', 'فشل تحديث أدى لتوقف كامل'
        ] if safety else [],
        'sources': sources or ['internal-mega-service-knowledge-v2']
    }

receiver_brands = [
    ('Spider','سبايدر',['spider','spidar','سبيدر','سپايدر','T888','T800','T700','V300','NO1 PLUS','KICK P1','سبايدر سات']),
    ('Tiger','تايجر',['tiger','تيجر','تايكر','red tiger','T800','T3000','T8','AG','Nova','تايغر']),
    ('Starsat','ستارسات',['starsat','star sat','ستار سات','SR','Hyper','Extreme','Mini','Pro','ستار سات']),
    ('Geant','جيون',['geant','géant','جيانت','جانت','GN','RS8','OTT','Mini','جيون']),
    ('Senator','سيناتور',['senator','سناتور','999','777','Royal','Mini']),
    ('Echolink','إيكولينك',['echolink','echo link','ايكولينك','EL','Open','Mini']),
    ('Icone','آيكون',['icone','icon','ايكون','Iron','Vogue','Weego','I-3030']),
    ('Forever','فوريفر',['forever','فور ايفر','فرفر','Mini','HD','Pro']),
    ('Qmax','كيوماكس',['qmax','q max','كيو ماكس','H7','MST','Mini']),
    ('Majestic','ماجستيك',['majestic','majestik','ماجستك','ماجيستك','M900','M880','M990','M500','Eagle','Gold']),
    ('Ghazal','غزال',['ghazal','gazal','gazel','غزّال','66 Turbo','701 Titanium','7100','8080 Turbo']),
    ('Infinity','إنفينيتي',['infinity','infiniti','انفنتي','إنفنتي','انفينتي','إنفينيتي','Sat','Mini','Pro','Forever']),
    ('Star-X','ستار إكس',['star-x','star x','ستار اكس','ستار إكس','starx','ستاركس']),
    ('National','ناشيونال',['national','ناشيونال','نشنال','ناشونال']),
    ('MediaStar','ميديا ستار',['mediastar','media star','ميدياستار','ميديا ستار']),
    ('Samsat','سامسات',['samsat','سام سات','سامسات']),
    ('Openbox','أوبن بوكس',['openbox','open box','اوبن بوكس','أوبن بوكس']),
    ('Dreambox','دريم بوكس',['dreambox','dream box','دريم بوكس']),
    ('Technosat','تكنوسات',['technosat','techno sat','تكنو سات']),
    ('Truman','ترومان',['truman','ترومان']),
    ('SuperMax','سوبر ماكس',['supermax','super max','سوبرماكس']),
    ('PowerSat','باورسات',['powersat','power sat','باور سات','باورسات']),
    ('Royal','رويال',['royal','رويال']), ('Vision','فيجن',['vision','فيجن','فيزيون']),
    ('StarNet','ستار نت',['starnet','star net','ستارنت']), ('DigiClass','ديجي كلاس',['digiclass','digi class','ديجي كلاس']),
    ('Redline','ريدلاين',['redline','red line','ريد لاين']), ('Hivion','هايفيون',['hivion','هايفيون','هاي فيون']),
    ('Condor','كوندور',['condor','كوندور']), ('Cristor','كريستور',['cristor','كريستور']), ('Atlas','أطلس',['atlas','اطلس','أطلس']),
    ('Humax','هيوماكس',['humax','هيوماكس']), ('Strong','سترونج',['strong','سترونج']), ('Beout','بي آوت',['beout','بي اوت','بي آوت']),
    ('Nova','نوفا',['nova','نوفا']), ('Alpha','ألفا',['alpha','الفا','ألفا']), ('DVBMax','دي في بي ماكس',['dvbmax','dvb max','دي في بي ماكس']),
    ('SunPlus','سن بلس',['sunplus','sun plus','سن بلس']), ('Montage','مونتاج',['montage','مونتاج']), ('SkyLine','سكاي لاين',['skyline','sky line','سكاي لاين']),
    ('DigiSat','ديجي سات',['digisat','digi sat','ديجي سات']), ('GX','جي إكس',['gx','جي اكس','جي إكس']), ('Vizyon','فيزيون',['vizyon','vision','فيزيون']),
    ('AlphaSat','ألفا سات',['alphasat','alpha sat','ألفا سات']), ('Sat-Integral','سات إنتغرال',['sat integral','sat-integral','سات انتغرال']),
    ('Moresat','مورسات',['moresat','more sat','مورسات']), ('Next','نكست',['next','نكست']), ('Euromax','يوروماكس',['euromax','euro max','يوروماكس']),
    ('Cobra','كوبرا',['cobra','كوبرا']), ('Matrix','ماتريكس',['matrix','ماتريكس']), ('Golden Interstar','غولدن إنترستار',['golden interstar','interstar','غولدن انترستار']),
    ('Amiko','أميكو',['amiko','اميكو','أميكو']), ('Octagon','أوكتاغون',['octagon','اوكتاجون','أوكتاغون']), ('Zgemma','زيجيما',['zgemma','زجيما','زيجيما']),
]

receiver_topic_templates = [
    ('connect_wifi','توصيل {ar} على الواي فاي','اتصال الريسيفر بالشبكة اللاسلكية بطريقة آمنة.', ['واي فاي','wifi','wireless','شبك النت','انترنت','شبكة'], [
        'افتح Menu من الريموت ثم ادخل إلى Network أو إعدادات الشبكة.', 'اختر Wi‑Fi أو Wireless ثم ابحث عن اسم الشبكة.',
        'اكتب كلمة المرور كما هي، ويفضل أن يكون اسم الشبكة وكلمة المرور بدون رموز غريبة.', 'إذا لم تظهر الشبكة جرّب 2.4GHz أو قرّب الراوتر أو أعد تشغيل الراوتر والريسيفر.',
        'إذا الجهاز يحتاج قطعة Wi‑Fi USB فتأكد أنها مدعومة لهذا الموديل.' ]),
    ('connect_lan','توصيل {ar} بكابل LAN','استخدام كابل الإنترنت يعطي ثباتًا أفضل من الواي فاي.', ['lan','ethernet','كابل نت','سلك نت','شبكة'], [
        'وصل كابل LAN بين الراوتر والريسيفر.', 'من إعدادات الشبكة اختر Ethernet أو LAN.', 'اجعل IP على Auto/DHCP.', 'إذا لم يتصل جرّب كابل أو منفذ راوتر آخر ثم أعد تشغيل الجهازين.' ]),
    ('hotspot','تشغيل {ar} على هوتسبوت الهاتف','توصيل الريسيفر على نقطة اتصال الهاتف عند عدم توفر راوتر.', ['hotspot','هوتسبوت','نقطة اتصال','مشاركة الانترنت'], [
        'فعّل نقطة الاتصال من الهاتف واجعل اسم الشبكة وكلمة المرور بسيطة.', 'من الريسيفر افتح Wi‑Fi وابحث عن شبكة الهاتف.', 'إذا فشل الاتصال أوقف توفير الطاقة في الهاتف وجرّب نطاق 2.4GHz.', 'راقب استهلاك الإنترنت لأن IPTV والتحديثات تستهلك بيانات كثيرة.' ]),
    ('network_connected_no_service','{ar} متصل بالنت لكن الخدمة لا تعمل','تشخيص حالة اتصال الإنترنت عندما تظهر الشبكة متصلة لكن التطبيقات أو الخدمات لا تعمل.', ['متصل ولا يعمل','السيرفر لا يعمل','server','connected no internet','خدمة لا تعمل'], [
        'تأكد أن التاريخ والوقت مضبوطين في الريسيفر.', 'جرّب YouTube أو تطبيق بسيط إن وجد للتأكد أن الإنترنت نفسه يعمل.', 'أعد تشغيل الراوتر والريسيفر.', 'جرّب DNS يدوي مثل 8.8.8.8 إذا كانت إعدادات الجهاز تسمح.', 'إذا الخدمة اشتراك رسمي، تأكد من حالة الاشتراك من المورّد الرسمي.' ]),
    ('official_subscription_activation','تفعيل اشتراك رسمي على {ar}','إرشاد عام لتفعيل خدمة رسمية أو باقة قانونية داخل الجهاز بدون كسر تشفير.', ['تفعيل','اشتراك','باقة','باقات','activation','subscription','server'], [
        'ادخل إلى معلومات الجهاز STB Info واكتب الموديل ورقم السوفتوير.', 'استخدم فقط كود أو حساب اشتراك رسمي من المورّد أو الوكيل.', 'تأكد أن الجهاز متصل بالإنترنت وأن التاريخ والوقت صحيحان.', 'إذا ظهر خطأ في التفعيل، صوّر الرسالة أو اكتبها كما هي.', 'لا تستخدم ملفات أو أكواد مجهولة المصدر لأنها قد توقف الجهاز أو تخالف القانون.' ]),
    ('iptv_buffering','IPTV يقطع على {ar}','حل تقطيع IPTV بطريقة عامة وآمنة.', ['iptv','تقطيع','يقطع','buffering','m3u','مشغل'], [
        'جرّب كابل LAN بدل Wi‑Fi إذا أمكن.', 'أعد تشغيل الراوتر والريسيفر.', 'تأكد أن سرعة الإنترنت مستقرة وليست فقط عالية بالاختبار.', 'خفّض جودة البث داخل التطبيق إن وجد.', 'إذا كل القنوات تقطع فالمشكلة غالبًا شبكة أو مزود الخدمة؛ إذا قناة واحدة فقط فالمشكلة من المصدر.' ]),
    ('update_firmware_safe','تحديث سوفتوير {ar} بأمان','طريقة آمنة للتعامل مع تحديث السوفتوير بدون تحميل ملفات مجهولة.', ['تحديث','سوفتوير','firmware','فلاشة','usb update'], [
        'افتح معلومات الجهاز واكتب الموديل الكامل وإصدار السوفتوير.', 'لا تركّب ملف تحديث إلا إذا كان مطابقًا للموديل واللوحة.', 'يفضل استخدام التحديث الرسمي من داخل الجهاز أو من موقع/وكيل موثوق.', 'لا تفصل الكهرباء أثناء التحديث.', 'إذا توقف الجهاز على الشعار بعد تحديث خاطئ، لا تكرر المحاولات العشوائية وراجع فني.' ], True, True),
    ('factory_reset','إعادة ضبط مصنع {ar}','استخدام ضبط المصنع عند تهنيج الجهاز أو بعد تغييرات كثيرة.', ['ضبط مصنع','factory reset','reset','تهيئة'], [
        'احفظ ترتيب القنوات أو خذ نسخة Backup إن وجدت.', 'افتح Menu ثم System أو Tools ثم Factory Reset.', 'اكتب الرقم السري إن طلب، غالبًا يكون 0000 أو حسب الجهاز.', 'بعد الضبط أعد إعداد اللغة والشبكة والبحث عن القنوات.', 'لا تستخدم هذا الخيار إذا لا تعرف بيانات الاشتراك الرسمي أو إعدادات الشبكة.' ]),
    ('remote_not_working','ريموت {ar} لا يعمل','تشخيص الريموت قبل الحكم أن المشكلة من الجهاز.', ['ريموت','remote','تحكم','لا يعمل','ازرار'], [
        'بدّل البطاريات وتأكد من اتجاهها.', 'صوّر لمبة الريموت بكاميرا الهاتف أثناء الضغط؛ إذا ظهرت ومضة فالريموت يرسل.', 'نظّف واجهة الريموت وحساس الجهاز.', 'جرّب الاقتراب من الجهاز وإزالة أي عائق.', 'إذا الريموت بلوتوث أو صوتي فقد يحتاج اقتران من الإعدادات.' ]),
    ('no_signal','لا توجد إشارة على {ar}','تشخيص رسالة No Signal أو ضعف الإشارة في الرسيفر.', ['no signal','لا توجد اشارة','لا توجد إشارة','اشارة','سنكل','signal'], [
        'تأكد أن التلفزيون على مدخل HDMI الصحيح أولًا.', 'افحص كابل الدش بين الطبق والريسيفر وتأكد أنه مثبت.', 'افتح قياس الإشارة من الرسيفر وتأكد من القوة والجودة.', 'إذا القوة صفر افحص الكابل أو الـ LNB أو الدايزك.', 'إذا الجودة ضعيفة قد يحتاج الطبق إلى ضبط اتجاه من فني.' ]),
    ('channel_scan','بحث القنوات على {ar}','إعادة البحث عن القنوات عند اختفاء قنوات أو تغيير ترددات.', ['بحث قنوات','scan','blind scan','ترددات','قنوات اختفت'], [
        'اختر القمر الصحيح من قائمة الأقمار.', 'استخدم Blind Scan أو بحث أعمى إذا كانت الترددات غير معروفة.', 'إذا تعرف التردد أدخله يدويًا مع الاستقطاب ومعدل الترميز.', 'احفظ النتائج بعد البحث.', 'إذا تكررت القنوات استخدم حذف المكرر إن وجد.' ]),
    ('date_time','ضبط التاريخ والوقت على {ar}','التاريخ الخاطئ قد يسبب فشل تطبيقات أو اتصال خدمات.', ['تاريخ','وقت','ساعة','date','time'], [
        'افتح الإعدادات ثم الوقت أو Time.', 'اجعل التوقيت تلقائيًا إن وجد.', 'اختر المنطقة الزمنية الصحيحة للأردن أو بلدك.', 'أعد تشغيل الجهاز ثم جرّب التطبيق أو الخدمة مرة أخرى.' ]),
    ('hdmi_resolution','صورة {ar لا تظهر أو HDMI لا يعمل'.replace('{ar', '{ar}'),'حل مشاكل HDMI والدقة غير المدعومة.', ['hdmi','الصورة لا تظهر','دقة','resolution','شاشة سوداء'], [
        'جرّب منفذ HDMI آخر في التلفزيون.', 'جرّب كابل HDMI مختلف.', 'إذا تظهر رسالة دقة غير مدعومة، غيّر دقة الرسيفر إلى 1080p أو Auto.', 'افصل الكهرباء دقيقة عن التلفزيون والريسيفر ثم شغلهم.', 'إذا الصوت موجود والصورة لا تظهر على كل الأجهزة فقد تكون مشكلة شاشة وتحتاج فني.' ], True, True),
    ('stuck_logo','{ar} عالق على الشعار','تشخيص تهنيج الرسيفر على اللوغو بدون خطوات خطرة.', ['واقف على الشعار','stuck logo','boot','ريستارت','يعيد تشغيل'], [
        'افصل الكهرباء دقيقة ثم شغّل الجهاز.', 'افصل USB أو أي قطعة خارجية ثم جرب.', 'إذا حدثت المشكلة بعد تحديث، غالبًا الملف غير مطابق للموديل.', 'لا تركّب سوفتوير عشوائي. اكتب الموديل وإصدار اللوحة لفني مختص.', 'إذا تكرر الريستارت قد تكون مشكلة تغذية أو سوفتوير وتحتاج فحص.' ], True, True),
    ('parental_lock','نسيان الرقم السري على {ar}','خطوات عامة عند نسيان قفل القنوات أو كلمة المرور.', ['رقم سري','password','pin','قفل','parental'], [
        'جرّب الرقم الافتراضي المكتوب في دليل الجهاز أو إعدادات الوكيل.', 'إذا لم ينجح، لا تستخدم ملفات مجهولة لإزالة القفل.', 'يمكن استخدام ضبط المصنع إذا كنت تعرف أنه لن يضيع إعدادات مهمة.', 'اكتب موديل الجهاز الكامل لأعطيك طريقة أدق إن كانت موجودة بالداتا.' ]),
    ('stb_info_model','معرفة موديل ومعلومات {ar}','طريقة استخراج الموديل والسوفتوير قبل أي تحديث أو تشخيص.', ['موديل','model','stb info','معلومات الجهاز','version'], [
        'افتح Menu ثم Information أو STB Info أو About.', 'اكتب Model وSoftware Version وHardware Version إن ظهرت.', 'لو الجهاز لا يدخل للقائمة، التقط صورة للملصق الخلفي أو علبة الجهاز.', 'الموديل مهم جدًا قبل أي تحديث أو ملف سوفتوير.' ]),
]

# Patch invalid heading if any due weird format
for i,t in enumerate(receiver_topic_templates):
    receiver_topic_templates[i]=tuple(t)

# TV data
tv_brands = [
    ('Samsung','سامسونج',['samsung','سامسونج','سمسونج'], ['Tizen','Samsung Smart Hub'], ['UA','UN','QN','QLED','Crystal UHD','Neo QLED','CU','DU','AU','BU','TU','MU','NU']),
    ('LG','إل جي',['lg','إل جي','ال جي','الجى'], ['webOS','LG Content Store'], ['OLED','QNED','NANO','UQ','UR','UP','UN','UK','UJ','LM']),
    ('TCL','تي سي إل',['tcl','تي سي ال','تي سي إل'], ['Google TV','Android TV','Roku TV','Smart TV'], ['C','P','S','QLED','Mini LED']),
    ('Hisense','هايسنس',['hisense','هايسنس','هايسنيس'], ['VIDAA','Google TV','Android TV'], ['A','U','E','QLED','ULED','VIDAA']),
    ('Sony','سوني',['sony','سوني'], ['Google TV','Android TV'], ['BRAVIA','KD','XR','X','A80','A95']),
    ('Sharp','شارب',['sharp','شارب'], ['Android TV','Google TV','Smart TV'], ['Aquos','LC','4T','2T']),
    ('Toshiba','توشيبا',['toshiba','توشيبا'], ['VIDAA','Android TV','Smart TV'], ['V','U','L','VIDAA']),
    ('Philips','فيليبس',['philips','فيليبس'], ['Android TV','Google TV','Saphi','Smart TV'], ['PUS','OLED','The One']),
    ('Panasonic','باناسونيك',['panasonic','باناسونيك'], ['Android TV','Google TV','My Home Screen','Smart TV'], ['LX','MX','JX','HX']),
    ('Skyworth','سكاي وورث',['skyworth','سكاي وورث','سكايورث'], ['Google TV','Android TV','Smart TV'], ['S','G','Q']),
    ('Xiaomi','شاومي',['xiaomi','mi tv','شاومي','شومي'], ['Google TV','Android TV','PatchWall'], ['Mi TV','A','P','Q']),
    ('JVC','جي في سي',['jvc','جي في سي'], ['Android TV','Google TV','Smart TV','Roku TV'], ['LT','QLED']),
    ('Haier','هاير',['haier','هاير'], ['Android TV','Google TV','Smart TV'], ['H','K']),
    ('Vestel','فيستل',['vestel','فيستل'], ['Smart TV','Android TV'], ['V','UHD']),
    ('Nikai','نيكاي',['nikai','نيكاي'], ['Android TV','Smart TV'], ['UHD','LED']),
    ('G-Guard','جي جارد',['g-guard','gguard','g guard','جي جارد','جيجارد','جى جارد','g-guard tv'], ['Google TV','Android TV','Smart TV'], ['GG','GTV','QLED','UHD','Google TV']),
    ('Magic','ماجيك',['magic','ماجيك','ماجك'], ['Android TV','Google TV','Smart TV'], ['MG','M','UHD','QLED']),
    ('General View','جنرال فيو',['general view','generalview','جنرال فيو','جنرال ڤيو'], ['Android TV','Google TV','Smart TV'], ['GV','GTV','UHD','QLED']),
    ('General Deluxe','جنرال ديلوكس',['general deluxe','جنرال ديلوكس'], ['Android TV','Smart TV'], ['GD','UHD']),
    ('General Gold','جنرال جولد',['general gold','جنرال جولد'], ['Android TV','Smart TV'], ['GGD','UHD']),
    ('Tiger TV','تايجر',['tiger tv','تايجر شاشة','شاشة تايجر'], ['Android TV','Google TV','Smart TV'], ['T','QLED']),
    ('Star-X','ستار إكس',['star-x tv','star x tv','ستار اكس شاشة'], ['Android TV','Google TV','Smart TV'], ['SX','UHD']),
    ('National','ناشيونال',['national tv','ناشيونال شاشة','نشنال شاشة'], ['Android TV','Smart TV'], ['N','UHD']),
    ('GoldSky','جولد سكاي',['goldsky','gold sky','جولد سكاي'], ['Android TV','Smart TV'], ['GS','UHD']),
    ('Samix','سامكس',['samix','سامكس'], ['Android TV','Smart TV'], ['SMX']),
    ('ROWA','روا',['rowa','روا'], ['Android TV','Smart TV'], ['RW']), ('VIVA','فيفا',['viva','فيفا'], ['Android TV','Smart TV'], ['V']),
    ('STIGG','ستيج',['stigg','ستيج'], ['Android TV','Smart TV'], ['ST']), ('I Like','آي لايك',['i like','ilike','اي لايك','آي لايك'], ['Android TV','Smart TV'], ['IL']),
    ('UGINE','يوجين',['ugine','يوجين'], ['Android TV','Smart TV'], ['UG']), ('Mirna','ميرنا',['mirna','ميرنا'], ['Android TV','Smart TV'], ['MR']),
    ('PowerSat TV','باورسات',['powersat tv','باورسات شاشة'], ['Android TV','Smart TV'], ['PS']), ('Midea','ميديا',['midea','ميديا'], ['Android TV','Smart TV'], ['M']),
    ('HOHO','هوهو',['hoho','هوهو'], ['Android TV','Smart TV'], ['HH']), ('Hitachi','هيتاشي',['hitachi','هيتاشي'], ['Android TV','Smart TV'], ['HIT']),
    ('Beko','بيكو',['beko','بيكو'], ['Android TV','Smart TV'], ['B']), ('Grundig','غرونديغ',['grundig','غرونديغ','جرونديج'], ['Android TV','Smart TV'], ['G']),
    ('Arcelik','أرشيليك',['arcelik','أرشيليك','ارشيليك'], ['Android TV','Smart TV'], ['A']), ('Tornado','تورنادو',['tornado','تورنادو'], ['Android TV','Smart TV'], ['T']),
    ('Fresh','فريش',['fresh','فريش'], ['Android TV','Smart TV'], ['FR']), ('Unionaire','يونيون اير',['unionaire','يونيون اير'], ['Android TV','Smart TV'], ['UN']),
    ('Royal TV','رويال',['royal tv','رويال شاشة'], ['Android TV','Smart TV'], ['RY']), ('Prima','بريما',['prima','بريما'], ['Android TV','Smart TV'], ['PR']),
    ('Telefunken','تلفونكن',['telefunken','تلفونكن'], ['Android TV','Smart TV'], ['TF']), ('Aiwa','أيوا',['aiwa','ايوا','أيوا'], ['Android TV','Smart TV'], ['AI']),
    ('Akai','أكاي',['akai','اكاي','أكاي'], ['Android TV','Smart TV'], ['AK']), ('Sencor','سينكور',['sencor','سينكور'], ['Android TV','Smart TV'], ['SC']),
    ('Kivi','كيفي',['kivi','كيفي'], ['Android TV','Google TV'], ['K']), ('Coocaa','كوكا',['coocaa','كوكا','كوكّا'], ['Google TV','Android TV'], ['S','Y']),
]

tv_templates = [
    ('identify_model_os','معرفة نظام وموديل شاشة {ar}','نحدد النظام من الموديل أو شكل المتجر قبل إعطاء الحل.', ['موديل','model','نظام','os','حول التلفزيون','about tv'], [
        'اطلب الموديل الكامل من الملصق خلف الشاشة أو من الإعدادات > حول الجهاز/الدعم.', 'إذا ظهر Google Play فهي غالبًا Android TV أو Google TV.',
        'إذا ظهر Samsung Smart Hub فهي Samsung Tizen.', 'إذا ظهر LG Content Store أو Apps على LG فهي webOS.', 'إذا ظهر VIDAA Store فهي غالبًا VIDAA.',
        'إذا المتجر غير معروف، اكتب لي اسمه أو ماذا يظهر بالقائمة الرئيسية.' ], True),
    ('install_youtube','تنزيل أو تشغيل YouTube على شاشة {ar}','خطوات تنزيل أو إصلاح يوتيوب حسب نظام الشاشة.', ['يوتيوب','youtube','تنزيل يوتيوب','تثبيت يوتيوب'], [
        'حدد نظام الشاشة أو اكتب الموديل أولًا لأن طريقة المتجر تختلف.', 'افتح متجر التطبيقات المناسب للنظام وابحث عن YouTube.',
        'إذا ظهر Install أو Update اضغط عليه.', 'إذا التطبيق غير موجود، حدّث نظام الشاشة وافحص البلد/المنطقة.', 'إذا الشاشة قديمة ولا تدعم التطبيق الحالي، الحل العملي جهاز Android/Google TV خارجي.' ], True),
    ('install_shahid','تنزيل Shahid على شاشة {ar}','تثبيت شاهد أو التعامل مع عدم ظهوره في المتجر.', ['شاهد','shahid','تنزيل شاهد','تطبيق شاهد'], [
        'افتح متجر التطبيقات المناسب للنظام.', 'ابحث عن Shahid أو شاهد بالعربية والإنجليزية.', 'إذا لم يظهر، تأكد من تحديث النظام والبلد/المنطقة.',
        'إذا الجهاز قديم أو النظام خاص، قد لا يكون التطبيق مدعومًا ويكون الحل جهاز خارجي يدعم التطبيق رسميًا.', 'تأكد أن حساب شاهد والاشتراك رسميان.' ], True),
    ('install_netflix','تشغيل Netflix على شاشة {ar}','تشخيص Netflix عند عدم الظهور أو التعليق.', ['netflix','نتفليكس','نتفلكس','نفلکس'], [
        'افتح متجر التطبيقات أو قائمة التطبيقات المثبتة وابحث عن Netflix.', 'إذا مثبت ويعلق، أعد تشغيل الشاشة من الكهرباء دقيقة ثم جرب.',
        'سجل الخروج ثم الدخول إن كانت المشكلة بالحساب.', 'إذا لم يظهر التطبيق، حدّث النظام وتأكد من دعم الموديل.', 'بعض الشاشات القديمة لا تدعم Netflix الرسمي ويحتاج جهاز خارجي.' ], True),
    ('install_tod_osn','تشغيل TOD أو OSN+ على شاشة {ar}','حلول عامة لتطبيقات البث الإقليمية حسب الدعم والبلد.', ['tod','osn','osn+','بي ان','bein','تود'], [
        'ابحث عن التطبيق في متجر الشاشة الرسمي.', 'تأكد من البلد/المنطقة والحساب الرسمي.', 'إذا التطبيق غير موجود رغم تحديث النظام، قد لا يدعم هذا الموديل.',
        'استخدم جهاز Android/Google TV خارجي مدعوم رسميًا إذا الشاشة لا تدعم التطبيق.', 'لا تستخدم نسخ تطبيقات مجهولة المصدر أو روابط غير رسمية.' ], True),
    ('app_not_found','التطبيق غير موجود في متجر شاشة {ar}','تشخيص عدم ظهور التطبيق في متجر الشاشة.', ['تطبيق مش موجود','غير موجود','لا يظهر','not found','متجر'], [
        'اكتب اسم التطبيق بالإنجليزية والعربية عند البحث.', 'تأكد أن الشاشة متصلة بالإنترنت وأن التاريخ والوقت صحيحان.', 'حدّث نظام الشاشة ثم أعد البحث.',
        'افحص إعداد البلد/المنطقة لأن بعض التطبيقات تظهر حسب المنطقة.', 'إذا لم يظهر بعد ذلك، غالبًا الموديل لا يدعمه رسميًا.' ], True),
    ('app_freeze','تطبيق يعلق أو يفصل على شاشة {ar}','خطوات آمنة عند تعليق التطبيقات أو خروجها المفاجئ.', ['يعلق','يفصل','crash','freeze','بطيء','ما يفتح'], [
        'أعد تشغيل الشاشة من الكهرباء لمدة دقيقة.', 'تأكد من تحديث التطبيق والنظام.', 'احذف التطبيق وأعد تثبيته إذا كان الحذف متاحًا.',
        'احذف تطبيقات غير مستخدمة إذا الذاكرة ممتلئة.', 'جرّب شبكة مختلفة للتأكد أن المشكلة ليست من الإنترنت.' ]),
    ('wifi_problem','مشكلة Wi‑Fi على شاشة {ar}','حل مشكلة الواي فاي لا يظهر أو لا يتصل.', ['واي فاي','wifi','شبكة','انترنت','لا يتصل'], [
        'أعد تشغيل الراوتر والشاشة.', 'قرّب الشاشة من الراوتر أو جرّب شبكة 2.4GHz.', 'انسَ الشبكة من إعدادات الشاشة ثم اتصل من جديد.',
        'تأكد من كتابة كلمة المرور بشكل صحيح.', 'إذا الشبكات كلها لا تظهر، قد تحتاج إعادة ضبط شبكة أو فحص فني.' ]),
    ('lan_problem','توصيل شاشة {ar} بكابل LAN','حل اتصال الشاشة بكابل الإنترنت.', ['lan','ethernet','كابل نت','سلك نت'], [
        'وصل كابل LAN بين الراوتر والشاشة.', 'افتح إعدادات الشبكة واختر Wired أو Ethernet.', 'اجعل IP تلقائيًا DHCP.', 'جرّب كابل أو منفذ راوتر آخر إذا لم يتصل.' ]),
    ('update_tv','تحديث نظام شاشة {ar}','تحديث آمن لنظام الشاشة.', ['تحديث','update','سوفتوير','firmware','نظام'], [
        'افتح الإعدادات ثم الدعم أو النظام ثم تحديث البرنامج.', 'اتصل بإنترنت ثابت قبل التحديث.', 'لا تفصل الكهرباء أثناء التحديث.', 'إذا فشل التحديث عدة مرات، لا تستخدم ملفات USB مجهولة واكتب الموديل الكامل للمراجعة.' ], True, True),
    ('factory_reset_tv','إعادة ضبط مصنع شاشة {ar}','استخدام ضبط المصنع عند مشاكل متكررة بعد حفظ الحسابات.', ['ضبط مصنع','factory reset','reset','تهيئة'], [
        'احفظ حسابات التطبيقات وكلمات المرور قبل البدء.', 'افتح الإعدادات ثم النظام أو الدعم ثم Reset/Factory Reset.', 'بعد الضبط اختر اللغة والبلد واتصل بالإنترنت.', 'أعد تثبيت التطبيقات الرسمية فقط.' ]),
    ('hdmi_no_signal_tv','HDMI لا يظهر على شاشة {ar}','تشخيص منفذ HDMI أو اختيار المصدر.', ['hdmi','لا توجد اشارة','no signal','مدخل','source'], [
        'تأكد أن الشاشة على Source/HDMI الصحيح.', 'جرّب كابل HDMI آخر ومنفذ آخر.', 'أعد تشغيل الجهاز المتصل والشاشة.', 'إذا جهاز واحد فقط لا يظهر فالمشكلة من الجهاز أو الكابل؛ إذا كل الأجهزة لا تظهر فقد يحتاج فحص HDMI.' ], True, True),
    ('black_screen_sound','الصوت موجود والصورة سوداء على شاشة {ar}','خطوات آمنة لمشكلة شاشة سوداء مع صوت.', ['شاشة سوداء','الصوت موجود','black screen','backlight'], [
        'افصل الشاشة من الكهرباء دقيقة ثم شغلها.', 'جرّب مصدر HDMI آخر أو تطبيق داخلي للتأكد هل المشكلة عامة.', 'ارفع إضاءة الشاشة من الإعدادات إن كان ممكنًا.', 'إذا الصوت موجود والصورة سوداء على كل المصادر، غالبًا تحتاج فني ولا تفتح الشاشة بنفسك.' ], True, True),
    ('remote_pairing_tv','ريموت شاشة {ar} لا يعمل أو يحتاج اقتران','حل مشاكل الريموت العادي أو البلوتوث.', ['ريموت','remote','اقتران','pair','تحكم'], [
        'بدّل البطاريات.', 'وجه الريموت للشاشة وجرب زر التشغيل.', 'للريموت البلوتوث/الصوتي ابحث في الإعدادات عن Remote Pairing أو Bluetooth.', 'إذا لا يعمل نهائيًا جرّب ريموت بديل أو تطبيق التحكم الرسمي إن وجد.' ]),
    ('screen_cast','ربط الهاتف أو Screen Mirroring مع شاشة {ar}','تشغيل انعكاس الشاشة أو Chromecast/AirPlay حسب النظام.', ['screen mirroring','cast','chromecast','airplay','ربط الهاتف','مشاركة الشاشة'], [
        'تأكد أن الهاتف والشاشة على نفس شبكة Wi‑Fi.', 'افتح Cast أو Screen Mirroring أو AirPlay من الهاتف.', 'على Google/Android TV استخدم Chromecast built-in إن وجد.', 'على بعض الأنظمة تحتاج تفعيل Miracast أو Screen Share من الشاشة.', 'إذا لم تظهر الشاشة، أعد تشغيل الراوتر والشاشة والهاتف.' ]),
    ('storage_full_tv','ذاكرة شاشة {ar} ممتلئة','حل مشاكل امتلاء المساحة وتأثيرها على التطبيقات.', ['ذاكرة ممتلئة','storage','مساحة','لا يثبت'], [
        'احذف التطبيقات غير المستخدمة.', 'امسح الكاش إن كان النظام يسمح.', 'أعد تشغيل الشاشة بعد الحذف.', 'بعض الشاشات لا تسمح بتوسيع مساحة التطبيقات؛ استخدم جهاز خارجي إذا التطبيقات كثيرة.' ]),
]

android_devices = [
    ('MAG Box','ماج بوكس',['mag','mag box','ماج بوكس','MAG254','MAG322','MAG524']), ('Formuler','فورميولر',['formuler','فورميولر','Z8','Z10','Z11','MYTVOnline']),
    ('X96','إكس 96',['x96','اكس 96','x96 max','x96 mini']), ('H96','إتش 96',['h96','اتش 96','h96 max']), ('MXQ','إم إكس كيو',['mxq','ام اكس كيو','mxq pro']),
    ('Mecool','ميكول',['mecool','ميكول','KM2','KM7','KM6']), ('Tanix','تانيكس',['tanix','تانيكس','TX3','TX6']), ('A95X','إيه 95 إكس',['a95x','اي 95 اكس']),
    ('HK1','إتش كيه 1',['hk1','اتش كيه 1']), ('T95','تي 95',['t95','تي 95']), ('Xiaomi TV Box','شاومي بوكس',['xiaomi tv box','mi box','mi stick','شاومي بوكس','مي بوكس']),
    ('Chromecast with Google TV','كرومكاست',['chromecast with google tv','كرومكاست','google tv chromecast']), ('Amazon Fire TV Stick','فاير ستيك',['fire tv','fire stick','فاير ستيك','امازون فاير']),
    ('Nvidia Shield','إنفيديا شيلد',['nvidia shield','shield tv','انفيديا شيلد']), ('Android TV Box','أندرويد بوكس',['android box','android tv box','اندرويد بوكس','تي في بوكس']),
    ('Roku','روكو',['roku','روكو']), ('Apple TV','آبل تي في',['apple tv','ابل تي في','آبل تي في']), ('Strong Android Box','سترونج أندرويد',['strong android','سترونج بوكس']),
    ('Beelink','بي لينك',['beelink','بي لينك']), ('Ugoos','يوغوس',['ugoos','يوغوس']), ('Homatics','هوماتكس',['homatics','هوماتكس']),
    ('Nokia Streaming Box','نوكيا بوكس',['nokia streaming box','nokia tv box','نوكيا بوكس']), ('Dune HD','ديون إتش دي',['dune hd','ديون']),
]

android_templates = [
    ('setup_first_time','إعداد {ar} لأول مرة','تهيئة جهاز Android/IPTV Box بعد التشغيل الأول.', ['اعداد','setup','اول مرة','تهيئة'], ['وصل HDMI والكهرباء.', 'اختر اللغة والبلد.', 'اتصل بالإنترنت Wi‑Fi أو LAN.', 'سجل الدخول بحساب رسمي إذا كان الجهاز Google/Android TV.', 'حدّث النظام والتطبيقات قبل الاستخدام.']),
    ('install_apps_box','تنزيل التطبيقات على {ar}','تثبيت تطبيقات رسمية من المتجر.', ['تطبيقات','install','google play','متجر','تنزيل'], ['افتح Google Play أو متجر الجهاز الرسمي.', 'ابحث عن التطبيق واضغط Install.', 'إذا التطبيق غير موجود فقد لا يدعم الجهاز أو البلد.', 'تجنب ملفات APK من مصادر مجهولة لأنها قد تحتوي برمجيات ضارة.'], True),
    ('iptv_buffering_box','IPTV يقطع على {ar}','تشخيص التقطيع على أجهزة IPTV/Android Box.', ['iptv','تقطيع','buffering','m3u','يقطع'], ['جرّب LAN بدل Wi‑Fi.', 'أغلق التطبيقات الخلفية وأعد تشغيل الجهاز.', 'غيّر DNS من إعدادات الشبكة إن كان متاحًا.', 'خفّض جودة البث مؤقتًا.', 'إذا كل القنوات تقطع فافحص سرعة وثبات الإنترنت أو مزود الخدمة.']),
    ('clear_cache_box','مسح كاش التطبيقات على {ar}','حل التعليق والبطء بمسح الكاش.', ['كاش','cache','يعلق','بطيء','مسح البيانات'], ['افتح Settings ثم Apps.', 'اختر التطبيق المطلوب.', 'اضغط Clear Cache أولًا.', 'إذا استمرت المشكلة استخدم Clear Data بعد معرفة بيانات الدخول.', 'أعد تشغيل الجهاز.']),
    ('update_box','تحديث نظام {ar}','تحديث آمن لأجهزة أندرويد/IPTV.', ['تحديث','update','firmware','سوفتوير'], ['افتح Settings ثم Device Preferences أو About.', 'اختر System Update إن وجد.', 'لا تفصل الكهرباء أثناء التحديث.', 'لا تستخدم ملفات تحديث غير مخصصة لنفس الموديل.'], True),
    ('storage_full_box','ذاكرة {ar} ممتلئة','حل مشكلة امتلاء مساحة التخزين.', ['ذاكرة','storage','مساحة ممتلئة','لا يثبت'], ['احذف التطبيقات غير المستخدمة.', 'امسح كاش التطبيقات الكبيرة.', 'انقل ملفات التحميل إلى USB إذا الجهاز يدعم.', 'أعد تشغيل الجهاز بعد التنظيف.']),
    ('remote_pair_box','ريموت {ar} لا يعمل أو بلوتوث لا يقترن','حل مشاكل ريموت البوكس.', ['ريموت','remote','bluetooth','اقتران','pair'], ['بدّل البطاريات.', 'ادخل Settings ثم Remotes & Accessories.', 'اختر Pair new remote إن وجد.', 'اضغط أزرار الاقتران حسب تعليمات الجهاز.', 'إذا الريموت IR فتأكد من توجيهه للجهاز مباشرة.']),
    ('hdmi_resolution_box','{ar} لا تظهر صورته على الشاشة','حل HDMI والدقة في أجهزة البوكس.', ['hdmi','دقة','resolution','شاشة سوداء','لا تظهر الصورة'], ['جرّب كابل HDMI آخر.', 'جرّب منفذ HDMI آخر في الشاشة.', 'إذا تظهر شاشة سوداء بعد تغيير الدقة، جرّب زر reset أو وضع الدقة الآمنة حسب الجهاز.', 'اضبط الدقة على Auto أو 1080p إذا الشاشة قديمة.'], True),
    ('legal_streaming_box','الاستخدام القانوني للتطبيقات على {ar}','توجيه آمن حول التطبيقات والاشتراكات.', ['اشتراك','تفعيل','iptv','باقات','قنوات'], ['استخدم التطبيقات والاشتراكات الرسمية فقط.', 'لا تدخل روابط أو أكواد مجهولة المصدر.', 'إذا لديك اشتراك رسمي، تأكد من بيانات الدخول والإنترنت والتاريخ.', 'لا أستطيع المساعدة في كسر تشفير أو فتح قنوات مدفوعة بدون اشتراك.']),
]

apps = [
    ('YouTube','يوتيوب',['youtube','يوتيوب','يوتوب']), ('Netflix','نتفليكس',['netflix','نتفلكس','نتفليكس']), ('Shahid','شاهد',['shahid','شاهد','شاهد vip']),
    ('TOD','تود',['tod','تود','bein tod']), ('OSN+','أو إس إن',['osn','osn+','او اس ان']), ('StarzPlay','ستارزبلاي',['starzplay','starz play','ستارز بلاي']),
    ('Amazon Prime Video','برايم فيديو',['prime video','amazon prime','برايم فيديو']), ('Disney+','ديزني بلس',['disney+','disney plus','ديزني بلس']),
    ('Apple TV','آبل تي في',['apple tv','ابل تي في']), ('Spotify','سبوتيفاي',['spotify','سبوتيفاي']), ('Anghami','أنغامي',['anghami','انغامي','أنغامي']),
    ('IPTV Player','مشغل IPTV',['iptv player','m3u','مشغل iptv','iptv smarters','smart iptv','ott navigator','xciptv','tivimate']), ('VLC','في إل سي',['vlc','في ال سي']),
    ('Kodi','كودي',['kodi','كودي']), ('Google Play Store','متجر Google Play',['google play','play store','جوجل بلاي','متجر بلاي']),
    ('Samsung Smart Hub','سامسونج سمارت هب',['smart hub','samsung apps','سامسونج ابس']), ('LG Content Store','متجر LG',['lg content store','lg apps','متجر lg']),
    ('VIDAA Store','متجر VIDAA',['vidaa store','vidaa apps','متجر vidaa']), ('Browser','المتصفح',['browser','متصفح']), ('Screen Mirroring','انعكاس الشاشة',['screen mirroring','miracast','smart view','انعكاس الشاشة']),
    ('AirPlay','إيربلاي',['airplay','ايربلاي']), ('Chromecast','كرومكاست',['chromecast','cast','كروم كاست']), ('DLNA','DLNA',['dlna','مشاركة وسائط']),
    ('Telegram','تيليجرام',['telegram','تيليجرام']), ('Facebook Watch','فيسبوك ووتش',['facebook watch','فيسبوك ووتش']), ('TikTok','تيك توك',['tiktok','تيك توك']),
    ('Plex','بلكس',['plex','بلكس']), ('Jellyfin','جيليفن',['jellyfin','جيليفن']), ('Emby','إمبي',['emby','امبي']),
]

app_templates = [
    ('install_app','تثبيت {ar} على الشاشة أو البوكس','طريقة عامة لتثبيت التطبيق من المتجر الرسمي.', ['تنزيل','تثبيت','install','متجر'], ['افتح متجر النظام الرسمي.', 'ابحث عن التطبيق بالاسم العربي والإنجليزي.', 'اضغط Install أو Update.', 'إذا لم يظهر التطبيق، افحص البلد/المنطقة وتحديث النظام.', 'إذا الجهاز لا يدعمه، استخدم جهاز خارجي حديث يدعم التطبيق رسميًا.'], True),
    ('app_not_found','{ar} غير موجود في المتجر','تشخيص عدم ظهور التطبيق في متجر الجهاز.', ['غير موجود','مش موجود','not found','لا يظهر'], ['تأكد من كتابة اسم التطبيق بشكل صحيح.', 'حدّث النظام والمتجر.', 'افحص البلد/المنطقة في الجهاز أو الحساب.', 'بعض التطبيقات لا تدعم كل الموديلات أو كل الدول.', 'لا تثبت نسخ مجهولة إذا كان التطبيق مالي/اشتراك.'], True),
    ('app_freeze','{ar} يعلق أو يفصل','حل تعليق التطبيق أو خروجه المفاجئ.', ['يعلق','يفصل','crash','freeze','ما يفتح'], ['أعد تشغيل الجهاز من الكهرباء دقيقة.', 'حدّث التطبيق من المتجر.', 'امسح الكاش إن كان النظام يسمح.', 'احذف التطبيق وأعد تثبيته إذا كان ذلك متاحًا.', 'جرّب شبكة مختلفة للتأكد من الإنترنت.']),
    ('login_problem','مشكلة تسجيل الدخول في {ar}','حل مشاكل الحساب أو رمز التحقق.', ['تسجيل دخول','login','حساب','كود','رمز'], ['تأكد من صحة البريد أو رقم الهاتف.', 'تأكد من التاريخ والوقت في الجهاز.', 'جرّب تسجيل الدخول من الهاتف للتأكد من الحساب.', 'إذا تظهر رسالة منطقة أو اشتراك، راجع مزود الخدمة الرسمي.', 'لا تشارك كود التحقق مع أي شخص.']),
    ('buffering_app','{ar} يقطع أو يحمّل كثير','تحسين التقطيع والتحميل.', ['تقطيع','buffering','تحميل','بطيء'], ['جرّب كابل LAN أو قرب الجهاز من الراوتر.', 'أعد تشغيل الراوتر.', 'خفّض جودة الفيديو مؤقتًا.', 'تأكد أن باقي الأجهزة لا تستهلك الإنترنت.', 'إذا كل التطبيقات تقطع فالمشكلة من الشبكة غالبًا.']),
    ('no_sound_app','لا يوجد صوت في {ar}','تشخيص الصوت داخل التطبيق.', ['صوت','no sound','بدون صوت'], ['ارفع صوت التطبيق والتلفزيون.', 'افحص إعدادات Audio Output.', 'جرّب تغيير HDMI أو إخراج الصوت إلى PCM إذا كان الرسيفر/الشاشة يدعم.', 'جرّب تطبيق آخر لمعرفة هل المشكلة عامة.']),
    ('subtitles_app','الترجمة لا تظهر في {ar}','حل الترجمة واللغة.', ['ترجمة','subtitle','language','لغة'], ['افتح إعدادات المشغل داخل التطبيق.', 'اختر اللغة العربية إن توفرت.', 'تأكد أن المحتوى نفسه يدعم الترجمة.', 'حدث التطبيق إذا كانت خيارات اللغة لا تظهر.']),
]

generic_items = []

receiver_items=[]
for brand, ar, aliases in receiver_brands:
    topics=[]
    for tpl in receiver_topic_templates:
        if len(tpl)==6:
            intent_, title, summary, kws, steps, need_model = tpl; safety=False
        elif len(tpl)==7:
            intent_, title, summary, kws, steps, need_model, safety = tpl
        else:
            intent_, title, summary, kws, steps = tpl; need_model=False; safety=False
        topics.append(topic(intent_, title.format(ar=ar), summary, [brand, ar, *aliases, *kws], steps, need_model, safety=safety))
    receiver_items.append({'brand':brand,'nameAr':ar,'category':'receiver','market':['Jordan','Middle East'],'aliases':uniq([brand,ar,*aliases]),'knownModels':uniq([a for a in aliases if any(ch.isdigit() for ch in a)]),'topics':topics})

json.dump({'items':receiver_items}, open(EXP/'mega-receivers-middle-east-v2.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

tv_items=[]
for brand, ar, aliases, systems, families in tv_brands:
    topics=[]
    for tpl in tv_templates:
        if len(tpl)==6:
            intent_, title, summary, kws, steps, need_model = tpl; safety=False
        elif len(tpl)==7:
            intent_, title, summary, kws, steps, need_model, safety = tpl
        else:
            intent_, title, summary, kws, steps = tpl; need_model=False; safety=False
        topics.append(topic(intent_, title.format(ar=ar), summary, [brand, ar, *aliases, *systems, *families, *kws], steps, need_model, safety=safety, sources=['internal-mega-tv-playbook-v2','Samsung Support','LG Support','Google TV Help','VIDAA Support']))
    tv_items.append({'brand':brand,'nameAr':ar,'category':'tv','market':['Jordan','Middle East'],'aliases':uniq([brand,ar,*aliases]),'possibleOperatingSystems':systems,'modelFamilies':families,'topics':topics})
json.dump({'items':tv_items}, open(EXP/'mega-tvs-middle-east-v2.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

box_items=[]
for brand, ar, aliases in android_devices:
    topics=[]
    for intent_, title, summary, kws, steps, *rest in android_templates:
        need_model = bool(rest[0]) if rest else False
        safety = True if intent_ in ('update_box','hdmi_resolution_box') else False
        topics.append(topic(intent_, title.format(ar=ar), summary, [brand, ar, *aliases, *kws], steps, need_model, safety=safety))
    box_items.append({'brand':brand,'nameAr':ar,'category':'android-receiver-iptv-box','market':['Jordan','Middle East'],'aliases':uniq([brand,ar,*aliases]),'operatingSystems':['Android TV','Google TV','Android AOSP','Linux IPTV'], 'topics':topics})
json.dump({'items':box_items}, open(EXP/'mega-android-iptv-boxes-v2.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

app_items=[]
for app, ar, aliases in apps:
    topics=[]
    for intent_, title, summary, kws, steps, *rest in app_templates:
        need_model = bool(rest[0]) if rest else False
        topics.append(topic(intent_, title.format(ar=ar), summary, [app, ar, *aliases, *kws], steps, need_model, sources=['internal-mega-app-playbook-v2','Samsung Support','LG Support','Google TV Help','VIDAA Support']))
    app_items.append({'app':app,'brand':app,'nameAr':ar,'category':'app','aliases':uniq([app,ar,*aliases]),'operatingSystems':['Google TV','Android TV','Samsung Tizen','LG webOS','VIDAA','Fire TV','Roku TV','Smart TV'],'topics':topics})
json.dump({'items':app_items}, open(EXP/'mega-apps-streaming-v2.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

# Device aliases mega merge
alias_items=[]
for brand, ar, aliases in receiver_brands:
    alias_items.append({'canonical':brand,'nameAr':ar,'deviceType':'receiver','aliases':uniq([brand,ar,*aliases])})
for brand, ar, aliases, systems, families in tv_brands:
    alias_items.append({'canonical':brand,'nameAr':ar,'deviceType':'tv','aliases':uniq([brand,ar,*aliases,*families])})
for brand, ar, aliases in android_devices:
    alias_items.append({'canonical':brand,'nameAr':ar,'deviceType':'android-receiver-iptv-box','aliases':uniq([brand,ar,*aliases])})
for app, ar, aliases in apps:
    alias_items.append({'canonical':app,'nameAr':ar,'deviceType':'app','aliases':uniq([app,ar,*aliases])})
json.dump({'items':alias_items}, open(EXP/'mega-device-aliases-v2.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

# OS map patterns
os_items=[]
for brand, ar, aliases, systems, families in tv_brands:
    for fam in families:
        os_items.append({'brand':brand,'nameAr':ar,'modelPattern':fam,'category':'tv','possibleOS':systems,'confidence':'family-pattern','note':'مطابقة عائلة عامة؛ اطلب الموديل الكامل إذا اختلف شكل القائمة.'})
    for sys in systems:
        os_items.append({'brand':brand,'nameAr':ar,'modelPattern':sys,'category':'tv','possibleOS':[sys],'confidence':'ui-hint','note':'مطابقة من اسم النظام أو المتجر الذي ذكره المستخدم.'})
json.dump({'items':os_items}, open(EXP/'mega-device-os-map-v2.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

# More diagnostic decision flows as plain knowledge items
flows=[]
flow_defs=[
    ('triage_tv_app','تشخيص سريع لمشكلة تطبيق على شاشة ذكية','عند سؤال المستخدم عن تطبيق لا يعمل على شاشة، حدد النظام والموديل قبل الحكم.', ['تطبيق','شاشة','يوتيوب','شاهد','netflix','ما يفتح'], ['اسأل عن نوع الشاشة والموديل إذا لم يذكره.', 'اسأل ما اسم المتجر الظاهر: Google Play أو Smart Hub أو LG Content Store أو VIDAA.', 'ابدأ بإعادة تشغيل الشاشة والتأكد من الإنترنت والتاريخ.', 'إذا التطبيق غير موجود بعد التحديث، غالبًا غير مدعوم على هذا الموديل.'], True),
    ('triage_receiver_network','تشخيص سريع لمشكلة نت على ريسيفر','يركز على الاتصال والشبكة والتاريخ قبل الخدمة.', ['ريسيفر','نت','واي فاي','سيرفر','iptv'], ['اسأل هل الاتصال Wi‑Fi أم LAN.', 'تأكد من التاريخ والوقت.', 'جرّب تطبيق أو اختبار إنترنت إن وجد.', 'جرّب LAN أو هوتسبوت للمقارنة.', 'إذا المشكلة بخدمة رسمية، تحقق من الاشتراك من المورد.'], False),
    ('triage_no_signal','تشخيص لا توجد إشارة','تمييز بين مدخل HDMI وإشارة الدش.', ['no signal','لا توجد إشارة','اشارة','hdmi','دش'], ['اسأل هل الرسالة من التلفزيون أم من الرسيفر.', 'إذا من التلفزيون، اختر HDMI الصحيح.', 'إذا من الرسيفر، افحص جودة الإشارة والكابل وLNB.', 'إذا الجودة منخفضة جدًا قد يحتاج الطبق إلى ضبط.'], False),
    ('triage_firmware','تشخيص تحديث سوفتوير آمن','تجنب الملفات العشوائية وربط التحديث بالموديل.', ['سوفتوير','تحديث','فلاشة','firmware'], ['اطلب الموديل الكامل ونسخة الهاردوير.', 'لا تعتمد أي ملف لا يطابق الموديل واللوحة.', 'لا تفصل الكهرباء أثناء التحديث.', 'إذا الجهاز عالق بعد التحديث، حوله لفني.'], True),
    ('triage_model_missing','عندما لا يعرف المستخدم الموديل','إرشاد بسيط لاستخراج الموديل من الجهاز.', ['موديل','مش عارف','model','حول الجهاز'], ['للتلفزيون: الإعدادات > الدعم/النظام > حول التلفزيون، أو الملصق الخلفي.', 'للريسيفر: Menu > Information أو STB Info.', 'إذا لا يستطيع، اطلب اسم المتجر الظاهر أو صورة القائمة.', 'بعد معرفة الموديل، أعطِ حل النظام المناسب.'], False),
]
for intent_, title, summary, kws, steps, need_model in flow_defs:
    flows.append({'title':title,'summary':summary,'category':'diagnostic-flow','intent':intent_,'keywords':kws,'steps':steps,'safe':True,'needsModelWhen':[intent_] if need_model else [],'sources':['internal-smart-diagnostic-v2']})
json.dump({'items':flows}, open(EXP/'mega-smart-diagnostic-flows-v2.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

# Approved answer cache augment with common variants
cache = ROOT/'public'/'service'/'cache'/'approved-answers.json'
try:
    approved=json.load(open(cache,encoding='utf-8'))
except Exception:
    approved={'items':[]}
existing={x.get('id') for x in approved.get('items',[])}
common=[]
common_qs=[
    ('q-gguard-youtube','كيف أنزل اليوتيوب على شاشة G Guard؟','G-Guard','tv','install_youtube',[
        'اكتب موديل الشاشة أولًا إذا متوفر، لأن G‑Guard تأتي أحيانًا Google TV أو Android TV أو Smart OS.', 'إذا يظهر Google Play: افتح المتجر وابحث عن YouTube ثم Install/Update.', 'إذا لا يوجد Google Play: ابحث في App Store الخاص بالشاشة أو حدّث النظام.', 'إذا التطبيق غير مدعوم، الحل العملي جهاز Android/Google TV خارجي.' ]),
    ('q-gguard-shahid','كيف أنزل شاهد على شاشة G-Guard؟','G-Guard','tv','install_shahid',[
        'حدد نظام الشاشة من الموديل أو اسم المتجر.', 'على Google/Android TV افتح Google Play وابحث عن Shahid.', 'إذا لم يظهر شاهد، حدّث النظام وافحص البلد/المنطقة.', 'إذا الشاشة لا تدعمه رسميًا، استخدم جهاز خارجي يدعم شاهد.' ]),
    ('q-spider-wifi','كيف أشبك ريسيفر سبايدر على النت؟','Spider','receiver','connect_wifi',[
        'من الريموت افتح Menu ثم Network.', 'اختر Wi‑Fi وابحث عن الشبكة.', 'اكتب كلمة المرور بدقة.', 'إذا لم تظهر الشبكة جرّب 2.4GHz أو قطعة Wi‑Fi مدعومة أو كابل LAN.' ]),
    ('q-tiger-iptv-buffer','ريسيفر تايجر IPTV يقطع كثير','Tiger','receiver','iptv_buffering',[
        'جرّب كابل LAN بدل الواي فاي.', 'أعد تشغيل الراوتر والريسيفر.', 'خفّض جودة البث مؤقتًا.', 'إذا كل القنوات تقطع فالمشكلة غالبًا من الشبكة أو مزود الخدمة.' ]),
    ('q-samsung-youtube-freeze','يوتيوب معلق على شاشة سامسونج','Samsung','tv','app_freeze',[
        'افصل الشاشة من الكهرباء دقيقة.', 'افتح Apps/Smart Hub وحدّث YouTube إن توفر.', 'امسح الكاش أو أعد تثبيت التطبيق إذا كان ذلك متاحًا.', 'إذا استمرت المشكلة، حدّث نظام الشاشة أو اكتب الموديل.' ]),
    ('q-general-view-model','كيف أعرف موديل شاشة جنرال فيو؟','General View','tv','identify_model_os',[
        'افتح الإعدادات ثم حول الجهاز أو About TV إن وجدت.', 'إذا لم تجدها، اقرأ الملصق الخلفي للشاشة.', 'اكتب رقم الموديل كما هو لأحدد هل النظام Android/Google TV أو Smart OS.' ]),
]
for id_, q, dev, dtype, intent_, steps in common_qs:
    if id_ not in existing:
        common.append({'id':id_,'question':q,'title':q,'deviceBrand':dev,'deviceType':dtype,'intent':intent_,'answer':'\n'.join(steps),'steps':steps,'keywords':[q,dev,intent_],'safe':True})
approved['items']=approved.get('items',[])+common
json.dump(approved, open(cache,'w',encoding='utf-8'), ensure_ascii=False, indent=2)

# Catalog update lightweight
catalog_path=K/'catalog.json'
try: catalog=json.load(open(catalog_path,encoding='utf-8'))
except Exception: catalog={'ok':True}
catalog['version']='2026.06-service-mega-internal-smart-chat-v2'
catalog['counts']={**catalog.get('counts',{}),'megaReceiverBrandsV2':len(receiver_brands),'megaTvBrandsV2':len(tv_brands),'megaAndroidIptvDevicesV2':len(android_devices),'megaAppsV2':len(apps)}
catalog['notes']=(catalog.get('notes') or [])+['Mega v2 adds broader Middle East device/app coverage and smarter internal-first conversational matching.']
json.dump(catalog, open(catalog_path,'w',encoding='utf-8'), ensure_ascii=False, indent=2)

print(json.dumps({'ok':True,'receiverBrands':len(receiver_brands),'tvBrands':len(tv_brands),'androidDevices':len(android_devices),'apps':len(apps)},ensure_ascii=False))
