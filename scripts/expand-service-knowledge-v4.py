#!/usr/bin/env python3
import json, re, hashlib
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
K = ROOT / 'public' / 'service' / 'knowledge'
HYPER = K / 'hyper'
ALIASES_DIR = K / 'aliases'
MODELS_DIR = K / 'device-models'
HYPER.mkdir(parents=True, exist_ok=True)
ALIASES_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

SOURCE = 'internal-hyper-service-knowledge-v4'
NOW = datetime.now(timezone.utc).date().isoformat()

def slug(s):
    s = re.sub(r'[^a-zA-Z0-9\u0600-\u06FF]+', '-', str(s).lower()).strip('-')
    return s[:90] or hashlib.sha1(str(s).encode()).hexdigest()[:12]

def topic(brand, ar, category, intent, title_ar, summary, kws, steps, needs_model=False, safety=False):
    return {
        'id': f'hyper-{slug(category)}-{slug(brand)}-{slug(intent)}-{hashlib.sha1((brand+intent+title_ar).encode()).hexdigest()[:8]}',
        'intent': intent,
        'title': title_ar,
        'summary': summary,
        'keywords': list(dict.fromkeys([brand, ar, intent] + kws)),
        'steps': steps,
        'safe': True,
        'needsModelWhen': [intent, 'exact_model_needed'] if needs_model else [],
        'whenToCallTechnician': ['رائحة حرق أو دخان', 'فتح الجهاز أو لحام أو بوردة', 'مشكلة كهرباء داخلية', 'فشل تحديث أوقف الجهاز'] if safety else [],
        'sources': [SOURCE],
        'updatedAt': NOW,
    }

def item(brand, ar, category, aliases, models, oses, topics):
    return {
        'brand': brand,
        'nameAr': ar,
        'category': category,
        'market': ['Jordan', 'Middle East', 'GCC', 'Levant', 'Egypt', 'North Africa'],
        'aliases': list(dict.fromkeys([brand, ar] + aliases)),
        'knownModels': list(dict.fromkeys(models)),
        'possibleOperatingSystems': oses,
        'topics': topics,
    }

receivers = [
 ('Spider','سبايدر',['spidar','سبيدر','سپايدر','سبايدر سات'],['T888','T800','T700','V300','KICK P1','NO1 PLUS','Mini','4K','Pro']),
 ('Tiger','تايجر',['red tiger','تيجر','تايكر','تايجر سات'],['T8','T9','T3000','T600','T800','I500','AG 999','Q8','HD']),
 ('Starsat','ستارسات',['star sat','ستار سات','starsat sr'],['SR-2000HD','SR-8800','SR-2020HD','SR-2090HD','SR-X1','SR-X3','SR-X5','SR-4K']),
 ('Geant','جيون',['geant','جيانت','جون','جيون سات'],['GN-2500HD','GN-M4','GN-OTT','GN-CX','GN-RS8','GN-4K']),
 ('Senator','سيناتور',['سناتور','senator sat'],['999','111','222','Senator 4K','Mini','Plus']),
 ('Majestic','ماجستيك',['ماجستك','ماجيستك','majestik'],['MJ-1000','MJ-2000','MJ-3000','Mini','4K','Plus']),
 ('Ghazal','غزال',['gazal','gazel','ghazel'],['G1','G2','G3','Mini','Plus','4K']),
 ('Infinity','إنفينيتي',['Infiniti','انفينتي','إنفنتي','انفنتي'],['X1','X2','X3','Mini','Plus','4K','Pro']),
 ('Echolink','إيكولينك',['echo link','ايكولينك','ايكو لينك'],['EL-700','EL-777','EL-999','Femto','Tornado','4K']),
 ('Icone','آيكون',['icone','icon','ايكون','أيقون'],['Iron','Vogue','Weego','i3030','i40','4K']),
 ('Forever','فوريفر',['forever server','فور ايفر','فوريفر'],['Forever HD','4K','Mini','Pro','S2020']),
 ('Qmax','كيوماكس',['q max','كيو ماكس'],['H7','H8','MST-999','VHD','Mini','4K']),
 ('Star-X','ستار إكس',['starx','ستار اكس','star x'],['X1','X2','X3','X98','4K','Mini']),
 ('National','ناشيونال',['national sat','ناشونال'],['N100','N200','N300','HD','4K','Mini']),
 ('MediaStar','ميديا ستار',['mediastar','media star','ميدياستار'],['MS-4030','MS-5000','Phoenix','Z2','4K']),
 ('Samsat','سامسات',['sam sat','سام سات'],['HD 90','HD 80','560','4K','Mini']),
 ('Openbox','أوبن بوكس',['open box','اوبن بوكس'],['S10','V8S','X5','Z5','SX4','4K']),
 ('Dreambox','دريم بوكس',['dream box','دريمبوكس'],['DM500','DM800','DM920','Two','One','4K']),
 ('Technosat','تكنوسات',['techno sat','تكنو سات'],['T-888','T-777','HD','Mini','4K']),
 ('Truman','ترومان',['trueman','ترومن'],['TM-999','TM-909','Premier','HD','4K']),
 ('SuperMax','سوبر ماكس',['super max','سوبرماكس'],['SM-2100','SM-2425','HD','Mini','4K']),
 ('PowerSat','باورسات',['power sat','باور سات'],['PS-100','PS-200','HD','Mini','4K']),
 ('Royal','رويال',['royal sat','رويال سات'],['R100','R200','HD','Mini','4K']),
 ('Vision','فيجن',['vision sat','فيجين'],['V1','V2','HD','Mini','4K']),
 ('StarNet','ستار نت',['star net','ستارنت'],['SN-100','SN-200','HD','Mini','4K']),
 ('DigiClass','ديجي كلاس',['digiclass','ديجي كلاس'],['MA-902','MA-905','HD','Mini','4K']),
 ('Redline','ريدلاين',['red line','ريد لاين'],['TS-4000','TS-5000','HD','Mini','4K']),
 ('Hivion','هاي فيون',['hivion','هيفيون'],['9090','9191','HD','Mini','4K']),
 ('Condor','كوندور',['condor sat','كوندور سات'],['5500','6600','HD','Mini','4K']),
 ('Strong','سترونغ',['strong sat','سترونج'],['SRT 4620','SRT 4950','SRT 7000','4K']),
 ('Humax','هيوماكس',['humax','هيومكس'],['IRHD','HDR','HD Nano','4K']),
 ('Beout','بي آوت',['beoutq','بي اوت','بي اوت كيو'],['Q','Q2','Mini','4K']),
 ('iSTAR','آي ستار',['istar','اي ستار','i star'],['A8000','A9000','HD','Mini','4K']),
 ('Moresat','مورسات',['more sat','مور سات'],['HD','Mini','4K','Pro']),
 ('Alpha','ألفا',['alpha sat','الفا سات'],['A1','A2','HD','Mini','4K']),
 ('Digital World','ديجيتال وورلد',['digitalworld','ديجيتال ورلد'],['DW-100','DW-200','HD','4K']),
 ('Matrix','ماتريكس',['matrix sat','ماتركس'],['MX-100','MX-200','HD','4K']),
 ('Nashare','ناشير',['na share','ناشير'],['N1','N2','HD','4K']),
]
extra_receiver_names = ['Atlas','Cristor','Vision Plus','Sunplus','Eurosat','Microbox','Mediacom','Gold Vision','Sat Integral','HD Line','Sky Line','Premium X','Amiko','Opticum','Ferguson','Golden Interstar','Next','NextStar','Botech','Watan','Legend','Topfield','Manhattan','Digiquest','SAB','Octagon','AB Cryptobox','VU+','Zgemma','Formuler Sat','World Vision','NOVA','Star Gold','Future','Magnum','Platinum','DVB Max','Sat King','Orbit','Falcon','Lazer','Universal','MegaSat','DigiSat','NileSat Box','ArabSat Box']
for n in extra_receiver_names:
    ar = {'Atlas':'أطلس','Cristor':'كريستور','Vision Plus':'فيجن بلس','Sunplus':'صن بلس','Eurosat':'يورو سات','Microbox':'مايكرو بوكس','Mediacom':'ميديا كوم','Gold Vision':'جولد فيجن','Sat Integral':'سات إنتغرال','Amiko':'أميكو','Opticum':'أوبتيكم','Ferguson':'فيرغسون','Next':'نيكست','NextStar':'نيكست ستار','Botech':'بوتك','Watan':'وطن','Legend':'ليجند','Topfield':'توب فيلد','Manhattan':'مانهاتن','Digiquest':'ديجي كويست','Octagon':'أوكتاجون','Falcon':'فالكون','Lazer':'ليزر','MegaSat':'ميجا سات'}.get(n, n)
    receivers.append((n, ar, [n.lower().replace(' ','-'), n.lower().replace(' ','')], ['HD','Mini','Plus','Pro','4K','Combo'],))

receiver_topic_defs = [
 ('connect_wifi','توصيل {ar} على الواي فاي','تشخيص وتوصيل الإنترنت عبر Wi‑Fi.', ['واي فاي','wifi','شبك النت','انترنت'], ['افتح Menu ثم Network أو إعدادات الشبكة.','اختر Wi‑Fi/Wireless وابحث عن الشبكة.','اكتب كلمة المرور بدقة وجرّب شبكة 2.4GHz إذا لم تظهر.','إذا يحتاج قطعة USB Wi‑Fi فتأكد أنها مدعومة للموديل.','جرّب هوتسبوت الهاتف لعزل مشكلة الراوتر.'], True, False),
 ('connect_lan','توصيل {ar} بكابل LAN','استخدام كابل الشبكة للثبات.', ['lan','ethernet','كابل نت'], ['وصل كابل LAN بين الراوتر والريسيفر.','اجعل IP على DHCP/Auto من الشبكة.','إذا لم يأخذ IP غيّر الكابل أو منفذ الراوتر.','أعد تشغيل الراوتر والريسيفر.'], False, False),
 ('hotspot_setup','تشغيل {ar} على هوتسبوت الهاتف','توصيل الجهاز من نقطة اتصال الهاتف.', ['هوتسبوت','hotspot','نقطة اتصال'], ['فعّل نقطة الاتصال من الهاتف على 2.4GHz إن وجد.','ابحث عن شبكة الهاتف من الريسيفر.','اكتب كلمة المرور كما هي.','أوقف VPN أو توفير الطاقة إذا لم يتصل.'], False, False),
 ('internet_connected_no_service','{ar} متصل بالنت لكن الخدمة لا تعمل','عندما يكون الاتصال ظاهرًا لكن التطبيقات/الخدمة لا تعمل.', ['متصل بدون انترنت','server not connected','الخدمة لا تعمل'], ['افحص التاريخ والوقت داخل الجهاز.','أعد تشغيل الراوتر والريسيفر.','جرّب DNS تلقائي ثم DNS معروف إذا متاح.','تأكد أن الخدمة الرسمية فعالة وليست منتهية.','لا تستخدم سيرفرات مجهولة أو غير قانونية.'], False, False),
 ('official_subscription_activation','تفعيل اشتراك رسمي على {ar}','إرشاد قانوني لتفعيل الاشتراك الرسمي فقط.', ['تفعيل','اشتراك','باقات','activation','subscription'], ['افتح معلومات الجهاز واحفظ الموديل والرقم التسلسلي إن طلبته الخدمة.','اتبع تعليمات المزود الرسمي أو التطبيق الرسمي فقط.','تأكد من الإنترنت والتاريخ والوقت.','إذا ظهر كود خطأ اكتبه كما هو.','لا أدعم فتح قنوات مدفوعة بدون اشتراك رسمي.'], True, False),
 ('iptv_buffering','تقطيع IPTV على {ar}','تحسين تقطيع IPTV القانوني أو التطبيقات الرسمية.', ['iptv','تقطيع','buffering','m3u'], ['جرّب كابل LAN بدل Wi‑Fi.','اختبر السرعة على نفس الشبكة.','أعد تشغيل الراوتر والجهاز.','خفف جودة البث إن وجدت.','إذا التقطيع من مزود واحد فتواصل مع المزود الرسمي.'], False, False),
 ('playlist_setup_official','تشغيل قائمة IPTV قانونية على {ar}','إدخال بيانات IPTV قانونية من مزود رسمي.', ['playlist','m3u','xtream','قائمة قانونية'], ['افتح تطبيق IPTV الرسمي أو المشغل الموثوق.','أدخل رابط M3U أو بيانات Xtream من المزود الرسمي.','تأكد من الوقت والإنترنت قبل الحكم على الخدمة.','لا تستخدم روابط مسروقة أو مصادر غير مصرح بها.'], True, False),
 ('youtube_receiver','تشغيل YouTube أو فيديو على {ar}','إذا كان الريسيفر يدعم تطبيقات فيديو.', ['youtube','يوتيوب','تطبيق فيديو'], ['تأكد أن الموديل يدعم التطبيق أصلًا.','افتح Apps أو Internet Apps.','حدّث التطبيق أو السوفتوير الرسمي إن توفر.','إذا توقف دعم التطبيق استخدم Android TV Box أو شاشة ذكية حديثة.'], True, False),
 ('software_update_safe','تحديث سوفتوير {ar} بأمان','قواعد تحديث السوفتوير الرسمي.', ['تحديث','سوفتوير','firmware','فلاشة'], ['اكتب الموديل الكامل من STB Info قبل أي تحديث.','استخدم ملفًا رسميًا مطابقًا للموديل فقط.','لا تفصل الكهرباء أثناء التحديث.','اعمل نسخة قنوات قبل التحديث إن أمكن.','إذا علق الجهاز على الشعار يحتاج فني أو ملف رسمي صحيح.'], True, True),
 ('backup_channels','حفظ نسخة قنوات {ar}','حفظ القنوات قبل الضبط أو التحديث.', ['نسخة قنوات','backup','db'], ['من قائمة Tools أو USB ابحث عن Dump/Backup.','احفظ ملف القنوات على USB نظيف.','سمّ الملف باسم الموديل والتاريخ.','لا تسترجع ملف قنوات من موديل مختلف.'], True, False),
 ('factory_reset','ضبط مصنع {ar}','إعادة ضبط النظام عند التعليق.', ['ضبط مصنع','factory reset','reset'], ['احفظ نسخة قنوات إن أمكن.','افتح System ثم Factory Reset.','أدخل الرمز الافتراضي حسب الدليل إن طُلب.','بعد الضبط أعد اللغة والشبكة والبحث.'], True, False),
 ('boot_logo_stuck','{ar} عالق على الشعار','تشخيص آمن عند الوقوف على الشعار.', ['واقف على الشعار','boot','logo','ريستارت'], ['افصل الكهرباء دقيقة وجرب بدون USB.','لا تركب سوفتوير عشوائي.','إذا بدأ بعد تحديث، يلزم ملف رسمي مطابق أو فني.','إذا توجد سخونة أو رائحة، افصل الجهاز.'], True, True),
 ('channel_scan','بحث القنوات على {ar}','بحث قنوات يدوي أو تلقائي.', ['بحث قنوات','scan','blind scan'], ['حدد القمر الصحيح من قائمة التركيب.','تأكد من LNB Frequency غالبًا Universal 9750/10600.','استخدم Blind Scan أو بحث يدوي بتردد معروف.','احفظ النتائج بعد البحث.'], False, False),
 ('transponder_add','إضافة تردد يدوي على {ar}','إدخال تردد جديد يدويًا.', ['تردد','transponder','frequency','اضافة تردد'], ['ادخل Installation ثم TP List.','أضف التردد والاستقطاب ومعدل الترميز كما هي.','اختر بحث على التردد.','إذا لا توجد جودة افحص الإشارة أو القمر.'], False, False),
 ('diseqc_setup','ضبط DiSEqC على {ar}','عند وجود أكثر من قمر.', ['diseqc','دايسك','عدة اقمار'], ['حدد لكل قمر منفذ DiSEqC الصحيح.','جرّب Port 1/2/3/4 حسب تركيب الدش.','راقب جودة الإشارة وليس القوة فقط.','احفظ الإعداد قبل البحث.'], False, False),
 ('lnb_setup','ضبط LNB على {ar}','إعداد LNB Power وUniversal.', ['lnb','الان بي','لاقط'], ['اجعل LNB Frequency على Universal 9750/10600 غالبًا.','تأكد أن LNB Power ON.','إذا القوة صفر افحص الكابل والكونكتور.','إذا الجودة صفر افحص توجيه الطبق أو التردد.'], False, False),
 ('no_signal','لا توجد إشارة على {ar}','تمييز مشكلة الدش من مشكلة HDMI.', ['no signal','لا توجد إشارة','سنكل','اشارة'], ['إذا الرسالة من التلفزيون فافحص HDMI/source أولًا.','إذا داخل قائمة الريسيفر فافحص التردد والقمر.','تأكد من LNB Power والكابل.','جرّب ترددًا قويًا معروفًا للقمر.'], False, False),
 ('weak_signal','ضعف الإشارة على {ar}','تقطيع أو جودة منخفضة.', ['ضعف اشارة','quality','signal low'], ['راقب Quality وليس Signal فقط.','افحص الكونكتور والكابل من الصدأ.','اضبط الطبق بدقة أو اطلب فني دش.','جرّب ترددًا آخر للتأكد.'], False, False),
 ('remote_not_working','ريموت {ar} لا يعمل','تشخيص الريموت.', ['ريموت','remote','تحكم'], ['بدّل البطاريات.','اختبر لمبة IR بكاميرا الهاتف.','نظف الحساس الأمامي للريسيفر.','إذا ريموت Bluetooth/RF أعد الاقتران إن كان مدعومًا.'], False, False),
 ('forgotten_pin','نسيت رمز {ar}','التعامل مع رمز القفل.', ['pin','رمز','كلمة مرور','قفل'], ['جرّب الرمز الذي وضعته أو الرمز الافتراضي من دليل الجهاز.','إذا لا تعرفه، اعمل ضبط مصنع بعد حفظ القنوات إن أمكن.','لا تستخدم ملفات كسر قفل مجهولة.'], True, False),
 ('hdmi_no_signal','HDMI لا يظهر من {ar}','حل مشكلة صورة الريسيفر على التلفزيون.', ['hdmi','مصدر','source','لا يظهر'], ['اختر مصدر HDMI الصحيح من التلفزيون.','جرّب كابل HDMI آخر ومنفذ آخر.','أطفئ الجهازين ثم شغّل التلفزيون أولًا ثم الريسيفر.','إذا الصورة سوداء جرّب دقة أقل من إعدادات الريسيفر.'], False, False),
 ('date_time','ضبط التاريخ والوقت على {ar}','التاريخ يؤثر على التطبيقات والخدمات.', ['تاريخ','وقت','ساعة','date','time'], ['افتح Time/Date من الإعدادات.','اجعل الوقت تلقائيًا من الشبكة إن وجد.','اختر المنطقة الزمنية الصحيحة.','أعد تشغيل التطبيق أو الخدمة بعد التصحيح.'], False, False),
 ('storage_full','ذاكرة {ar} ممتلئة','عند فشل التثبيت أو البطء.', ['ذاكرة','مساحة','storage'], ['احذف التطبيقات غير المستخدمة إن كان الجهاز يدعم.','امسح الكاش من التطبيقات.','انقل التسجيلات أو الملفات إلى USB.','إذا الذاكرة داخلية ضعيفة فقد يلزم جهاز أحدث.'], False, False),
]
receiver_items=[]
for brand, ar, aliases, models in receivers:
    ts=[topic(brand, ar, 'receiver', intent, title.format(ar=ar), summary, kws, steps, needs, saf) for intent,title,summary,kws,steps,needs,saf in receiver_topic_defs]
    receiver_items.append(item(brand, ar, 'receiver', aliases, models, ['DVB-S2','DVB-S2X','Enigma2','Linux STB','Android Receiver حسب الموديل'], ts))

# TVs
tvs = [
 ('Samsung','سامسونج',['سمسونج','samsung tv','سامسونغ'],['UA','UE','QN','QLED','Crystal UHD','BU','CU','DU','NU','RU','AU'],['Tizen','Samsung Smart Hub']),
 ('LG','إل جي',['ال جي','الجى','lg tv'],['OLED','QNED','NANO','UQ','UR','UP','UN','UK','UJ','LM'],['webOS','LG Content Store']),
 ('TCL','تي سي إل',['tcl tv','تي سي ال'],['C645','C735','C755','P635','P735','P755','S5400'],['Google TV','Android TV','Roku TV حسب السوق']),
 ('Hisense','هايسنس',['hisense tv','هايسنس'],['A4','A6','A7','U6','U7','U8','E7'],['VIDAA','Google TV حسب الموديل']),
 ('Sony','سوني',['sony bravia','براڤيا','برافيا'],['BRAVIA','X75','X80','X85','X90','A80','A95'],['Google TV','Android TV']),
 ('Sharp','شارب',['sharp tv','شارب'],['Aquos','Android','Google','LE','LC'],['Android TV','Google TV','Smart OS']),
 ('Toshiba','توشيبا',['toshiba tv','توشيبا'],['C350','V35','L5','U5','Fire TV'],['VIDAA','Android TV','Fire TV حسب السوق']),
 ('Philips','فيليبس',['philips tv','فيلبس'],['PUS','OLED','The One'],['Android TV','Google TV','Saphi حسب الموديل']),
 ('Panasonic','باناسونيك',['panasonic tv','بناسونيك'],['JX','LX','MX','MZ'],['Android TV','Google TV','My Home Screen']),
 ('Skyworth','سكاي وورث',['sky worth','سكايورث'],['SUE','STD','Google TV','Android'],['Google TV','Android TV']),
 ('Xiaomi','شاومي',['mi tv','xiaomi tv','شياومي'],['Mi TV','A Pro','P1','Q1','TV Stick'],['Google TV','Android TV']),
 ('JVC','جي في سي',['jvc tv','جى فى سى'],['LT','Android','Google'],['Android TV','Google TV','Smart OS']),
 ('Haier','هاير',['haier tv','هير'],['H','K','Android','Google'],['Android TV','Google TV','Smart OS']),
 ('Vestel','فيستل',['vestel tv','فيستل'],['Smart','Android','4K'],['Linux Smart TV','Android TV']),
 ('Nikai','نيكاي',['nikai tv','نيكاي'],['NIK','Smart','Android'],['Android TV','Smart OS']),
 ('G-Guard','جي جارد',['g guard','gguard','جي غارد','جي جارد'],['GG-32','GG-43','GG-50','GG-55','GG-65','QLED','Google TV'],['Google TV','Android TV','Smart OS حسب الموديل']),
 ('Magic','ماجيك',['magic tv','ماجك','ماجيك'],['MG-32','MG-43','MG-50','MG-55','Android','Smart'],['Android TV','Google TV','Smart OS حسب الموديل']),
 ('General View','جنرال فيو',['generalview','جنرال ڤيو','جنرال فيو'],['GV-32','GV-43','GV-50','GV-55','Smart','Android'],['Android TV','Google TV','Smart OS حسب الموديل']),
 ('General Deluxe','جنرال ديلوكس',['general deluxe','جنرال دلوكس'],['GD-32','GD-43','GD-55'],['Android TV','Smart OS']),
 ('General Gold','جنرال جولد',['general gold','جنرال غولد'],['GGD-32','GGD-43','GGD-55'],['Android TV','Smart OS']),
 ('Tiger TV','تايجر',['tiger tv','تايجر شاشة'],['TTV-32','TTV-43','TTV-55'],['Android TV','Google TV','Smart OS']),
 ('Star-X TV','ستار إكس',['star x tv','star-x tv','ستار اكس شاشة'],['SX-32','SX-43','SX-55'],['Android TV','Google TV','Smart OS']),
 ('National TV','ناشيونال',['national tv','ناشونال شاشة'],['NT-32','NT-43','NT-55'],['Android TV','Smart OS']),
 ('GoldSky','جولد سكاي',['gold sky','جولدسكي'],['GS-32','GS-43','GS-55'],['Android TV','Smart OS']),
 ('Samix','سامكس',['samix tv','سامكس'],['SMX-32','SMX-43','SMX-55'],['Android TV','Smart OS']),
 ('ROWA','رووا',['rowa tv','روا'],['RW-32','RW-43','RW-55'],['Android TV','Smart OS']),
 ('VIVA','فيفا',['viva tv','ڤيڤا'],['VV-32','VV-43','VV-55'],['Android TV','Smart OS']),
 ('STIGG','ستيج',['stigg tv','ستغ'],['ST-32','ST-43','ST-55'],['Android TV','Smart OS']),
 ('I Like','آي لايك',['ilike','i-like','اي لايك'],['IL-32','IL-43','IL-55'],['Android TV','Smart OS']),
 ('UGINE','يوجين',['ugine tv','يوجن'],['UG-32','UG-43','UG-55'],['Android TV','Smart OS']),
 ('Mirna','ميرنا',['mirna tv','مرنا'],['MR-32','MR-43','MR-55'],['Android TV','Smart OS']),
 ('PowerSat TV','باورسات',['powersat tv','باور سات شاشة'],['PS-32','PS-43','PS-55'],['Android TV','Smart OS']),
]
extra_tvs = ['Nokia','Hitachi','Sanyo','Akai','Aiwa','Daewoo','Beko','Arcelik','Grundig','Telefunken','Thomson','Changhong','KONKA','Manta','Blaupunkt','Westinghouse','RCA','Onida','Prestige','Hommer','Midea','Kivi','Element','Sansui','AOC','BenQ','ViewSonic','Orient','Unionaire','Fresh','Tornado','Bompani','Gree','ClassPro','Royal TV','Dora','Lava','Tecnogas','Oscar','Nova TV','Falcon TV','Lazer TV','Platinum TV','Mega TV','Orbit TV','Union TV']
for n in extra_tvs:
    ar = {'Nokia':'نوكيا','Hitachi':'هيتاشي','Sanyo':'سانيو','Akai':'أكاي','Aiwa':'أيوا','Daewoo':'دايو','Beko':'بيكو','Grundig':'غرونديغ','Telefunken':'تلفنكن','Thomson':'تومسون','Changhong':'تشانغهونغ','KONKA':'كونكا','Blaupunkt':'بلاوبونكت','Westinghouse':'وستنجهاوس','Prestige':'بريستيج','Hommer':'هومر','Kivi':'كيفي','Orient':'أورينت','Fresh':'فريش','Tornado':'تورنيدو','Royal TV':'رويال','Falcon TV':'فالكون','Lazer TV':'ليزر'}.get(n,n)
    tvs.append((n, ar, [n.lower().replace(' ','-'), n.lower().replace(' ','')], ['32','43','50','55','65','Smart','Android','Google'], ['Android TV','Google TV','Smart OS حسب الموديل']))

tv_topic_defs = [
 ('identify_model_os','تحديد نظام شاشة {ar} من الموديل','تحديد النظام قبل تثبيت التطبيقات.', ['موديل','نظام التشغيل','حول التلفزيون'], ['افتح الإعدادات ثم النظام/الدعم ثم حول التلفزيون.','اكتب الموديل كما يظهر بالضبط.','إذا ظهر Google Play فالمسار Android/Google TV.','إذا ظهر Smart Hub فالمسار Samsung Tizen.','إذا ظهر LG Content Store فالمسار webOS.'], True, False),
 ('install_youtube','تنزيل YouTube على شاشة {ar}','طريقة تثبيت أو تحديث يوتيوب حسب النظام.', ['يوتيوب','youtube','تنزيل','تثبيت'], ['حدد المتجر أولًا: Google Play أو Smart Hub أو LG Content Store أو VIDAA.','ابحث عن YouTube واضغط تثبيت/تحديث.','إذا التطبيق مثبت لكنه لا يعمل، امسح الكاش أو أعد تشغيل الشاشة.','إذا غير متاح للموديل استخدم Android/Google TV Box رسمي.'], True, False),
 ('install_shahid','تنزيل Shahid على شاشة {ar}','تثبيت شاهد من المتجر الرسمي.', ['شاهد','shahid','تطبيقات'], ['افتح متجر التطبيقات الرسمي في الشاشة.','ابحث عن Shahid.','حدّث النظام إذا لم يظهر التطبيق.','تأكد من البلد/المنطقة والحساب.','إذا لا يدعم الموديل، استخدم جهاز خارجي رسمي.'], True, False),
 ('install_netflix','تشغيل Netflix على شاشة {ar}','تشخيص نتفليكس.', ['netflix','نتفليكس','نتفلكس'], ['ابحث عن Netflix في المتجر الرسمي.','إذا موجود ولا يفتح، أعد تسجيل الدخول وحدّث التطبيق.','صحح التاريخ والوقت.','إذا يظهر خطأ، اكتب الكود كما هو.','بعض الموديلات القديمة لم تعد مدعومة.'], True, False),
 ('install_tod_osn','تشغيل TOD أو OSN+ على شاشة {ar}','تثبيت خدمات البث الرسمية حسب البلد والدعم.', ['tod','osn','تود','او اس ان'], ['افتح المتجر الرسمي وابحث عن التطبيق.','تأكد من البلد/المنطقة والحساب.','حدّث النظام.','إذا غير مدعوم، استخدم جهاز خارجي رسمي يدعم التطبيق.'], True, False),
 ('app_not_found','تطبيق غير موجود على شاشة {ar}','لماذا لا يظهر التطبيق في المتجر.', ['تطبيق غير موجود','مش لاقي','المتجر'], ['تأكد من نظام الشاشة والموديل.','حدّث النظام وأعد تشغيل الشاشة.','افحص إعداد البلد/المنطقة.','إذا المتجر محدود فغالبًا النظام Smart خاص ولا يدعم كل التطبيقات.','الحل الرسمي: جهاز Android/Google TV Box.'], True, False),
 ('app_freeze','تطبيق يعلق على شاشة {ar}','حل تعليق التطبيقات.', ['يعلق','تعليق','crash','freeze'], ['أغلق التطبيق وافصل الشاشة من الكهرباء دقيقة.','امسح كاش التطبيق إن كان النظام يدعم.','حدّث التطبيق والنظام.','جرب الإنترنت عبر LAN أو هوتسبوت لعزل الشبكة.','إذا كل التطبيقات تعلق فافحص الذاكرة أو اعمل ضبط مصنع بعد حفظ الإعدادات.'], False, False),
 ('clear_cache','مسح كاش التطبيقات على شاشة {ar}','تنظيف التطبيق بدون حذف الحساب عند الإمكان.', ['cache','كاش','مسح بيانات'], ['من الإعدادات افتح التطبيقات.','اختر التطبيق ثم Clear Cache إن وجدت.','إذا لم يوجد خيار الكاش، احذف التطبيق وثبته من جديد.','أعد تشغيل الشاشة بعد التنظيف.'], True, False),
 ('country_region_tv','تغيير البلد/المنطقة للتطبيقات على {ar}','بعض التطبيقات تظهر حسب البلد.', ['بلد','منطقة','region','country'], ['افتح إعداد البلد/المنطقة إن كان متاحًا.','اختر بلدك الصحيح.','أعد تشغيل الشاشة وابحث عن التطبيق.','لا تغيّر المنطقة عشوائيًا حتى لا تختفي تطبيقات أخرى.'], True, False),
 ('connect_wifi','توصيل شاشة {ar} بالواي فاي','إعداد Wi‑Fi للشاشة.', ['واي فاي','wifi','انترنت'], ['افتح Network/Wi‑Fi.','اختر الشبكة واكتب كلمة المرور.','جرّب شبكة 2.4GHz إذا لم تظهر.','أعد تشغيل الراوتر والشاشة.','جرّب هوتسبوت الهاتف لعزل المشكلة.'], False, False),
 ('connect_lan','توصيل شاشة {ar} بكابل LAN','شبكة أكثر ثباتًا للتطبيقات.', ['lan','ethernet','كابل'], ['وصل كابل LAN من الراوتر للشاشة.','اجعل IP تلقائي DHCP.','أعد تشغيل الشاشة.','إذا يعمل LAN ولا يعمل Wi‑Fi فالمشكلة من الواي فاي أو قرب الراوتر.'], False, False),
 ('dns','ضبط DNS على شاشة {ar}','حل بعض مشاكل الاتصال بالتطبيقات.', ['dns','دي ان اس'], ['افتح إعدادات الشبكة المتقدمة.','جرّب DNS تلقائي أولًا.','إذا المشكلة مستمرة جرب DNS موثوق حسب بلدك.','أعد تشغيل الشاشة والراوتر.'], False, False),
 ('date_time','تصحيح التاريخ والوقت في شاشة {ar}','التاريخ الخاطئ يعطل التطبيقات.', ['تاريخ','وقت','date','time'], ['افتح Date & Time.','اجعل الوقت تلقائيًا من الشبكة.','اختر المنطقة الزمنية الصحيحة.','أعد فتح التطبيق بعد التصحيح.'], False, False),
 ('screen_cast','ربط الهاتف مع شاشة {ar}','Cast / Mirroring / AirPlay.', ['cast','airplay','screen mirroring','ربط الهاتف'], ['اجعل الهاتف والشاشة على نفس الشبكة.','فعّل Screen Mirroring أو Chromecast/AirPlay حسب النظام.','حدّث تطبيق YouTube أو Google Home إن احتجت.','إذا الجهاز لا يدعم، استخدم Chromecast أو Android TV Box.'], True, False),
 ('hdmi','HDMI لا يعمل على شاشة {ar}','تشخيص المصدر والكابل والدقة.', ['hdmi','source','مصدر'], ['اختر المصدر الصحيح من الريموت.','جرّب كابل ومنفذ HDMI آخر.','أطفئ الجهازين وشغّل الشاشة أولًا.','إذا الرسيفر لا يظهر، خفّض دقته إلى 1080p.'], False, False),
 ('arc_earc_sound','تشغيل ARC/eARC أو السماعة على {ar}','حل صوت المسرح المنزلي أو الساوند بار.', ['arc','earc','soundbar','سماعة'], ['استخدم منفذ HDMI ARC/eARC المكتوب على الشاشة.','فعّل HDMI-CEC من الإعدادات.','اختر إخراج الصوت HDMI ARC.','جرّب كابل HDMI عالي الجودة.','إذا لا يعمل، جرّب Optical كبديل.'], True, False),
 ('bluetooth','إقران Bluetooth على شاشة {ar}','ربط سماعة أو ريموت بلوتوث.', ['bluetooth','بلوتوث','اقتران'], ['افتح إعدادات Bluetooth.','ضع السماعة أو الريموت في وضع الاقتران.','اختر الجهاز من القائمة.','إذا لا يظهر، أعد تشغيل Bluetooth أو احذف الاقتران القديم.'], True, False),
 ('remote_not_working','ريموت شاشة {ar} لا يعمل','تشخيص ريموت عادي أو ذكي.', ['ريموت','remote','تحكم'], ['بدّل البطاريات.','اختبر IR بكاميرا الهاتف إن كان ريموت عادي.','إذا ريموت ذكي، أعد الاقتران حسب النظام.','تأكد أن لا يوجد عائق أمام حساس الشاشة.'], False, False),
 ('storage_full','ذاكرة شاشة {ar} ممتلئة','عند فشل تثبيت التطبيقات.', ['ذاكرة','مساحة','storage'], ['احذف تطبيقات غير مستخدمة.','امسح كاش التطبيقات.','أوقف التنزيلات غير الضرورية.','إذا التخزين قليل جدًا استخدم جهاز خارجي بدل تحميل كثير على الشاشة.'], False, False),
 ('software_update_safe','تحديث نظام شاشة {ar} بأمان','تحديث رسمي فقط.', ['تحديث','software update','firmware'], ['افتح Settings ثم About/Support ثم Software Update.','استخدم التحديث الهوائي أو الرسمي فقط.','لا تفصل الكهرباء أثناء التحديث.','إذا فشل التحديث وعلقت الشاشة راجع فني.'], True, True),
 ('factory_reset','ضبط مصنع شاشة {ar}','آخر خطوة بعد استنفاد الحلول.', ['ضبط مصنع','factory reset','reset'], ['احفظ الحسابات وكلمات المرور قبل الضبط.','افتح System/General ثم Reset.','بعد الضبط اختر اللغة والمنطقة والشبكة.','ثبّت التطبيقات من المتجر الرسمي فقط.'], True, False),
 ('picture_settings','ضبط صورة شاشة {ar}','ألوان أو سطوع أو HDR.', ['صورة','الوان','سطوع','hdr'], ['افتح Picture Settings.','جرّب Standard أو Cinema.','أوقف توفير الطاقة إذا الصورة مظلمة.','إذا نصف الشاشة مظلم أو فيها خطوط ثابتة فهذه صيانة فنية.'], False, True),
 ('black_screen','شاشة {ar} سوداء والصوت موجود','تشخيص آمن للصورة السوداء.', ['شاشة سوداء','black screen','صوت بدون صورة'], ['افصل الشاشة دقيقة.','جرّب مصدر HDMI آخر.','ارفع السطوع وأوقف توفير الطاقة.','إذا الصوت موجود والصورة سوداء دائمًا قد تكون إضاءة خلفية أو لوحة وتحتاج فني.'], False, True),
 ('no_power_tv','شاشة {ar} لا تعمل نهائيًا','خطوات آمنة فقط عند انطفاء الشاشة.', ['لا تعمل','no power','كهرباء'], ['جرّب مقبس كهرباء آخر.','افصل الشاشة دقيقة ثم شغلها من زر الشاشة.','تأكد من الريموت والبطاريات.','إذا لا توجد لمبة أو توجد رائحة حرق، راجع فني ولا تفتح الجهاز.'], False, True),
 ('restart_loop_tv','شاشة {ar} تعيد التشغيل','Restart loop أو عالقة على الشعار.', ['تعيد تشغيل','restart','الشعار'], ['افصل الكهرباء دقيقة وجرب بدون USB/HDMI.','إذا دخلت للنظام، احذف آخر تطبيق وحدّث النظام.','لا تركب ملفات USB مجهولة.','إذا بقيت على الشعار تحتاج فني أو تحديث رسمي.'], True, True),
]
tv_items=[]
for brand, ar, aliases, models, oses in tvs:
    ts=[topic(brand, ar, 'tv', intent, title.format(ar=ar), summary, kws, steps, needs, saf) for intent,title,summary,kws,steps,needs,saf in tv_topic_defs]
    tv_items.append(item(brand, ar, 'tv', aliases, models, oses, ts))

# Android/IPTV boxes
boxes = [
 ('X96','إكس 96',['x96 mini','x96 max','x96q'],['X96 Mini','X96 Max','X96Q','X96 Air']),
 ('H96','إتش 96',['h96 max','h96 pro'],['H96 Max','H96 Pro','H96 Mini']),
 ('MXQ','إم إكس كيو',['mxq pro','mxq 4k'],['MXQ Pro','MXQ 4K','MXQ Mini']),
 ('Mecool','ميكول',['mecool km','mecool box'],['KM2','KM6','KM7','KM9','KM3']),
 ('Tanix','تانيكس',['tanix tx'],['TX3','TX5','TX6','TX9']),
 ('A95X','إيه 95 إكس',['a95x f3','a95x'],['F3','F4','Max','Plus']),
 ('MAG','ماج',['mag box','infomir'],['MAG 250','MAG 254','MAG 322','MAG 420','MAG 524']),
 ('Formuler','فورميولر',['formuler z','فورمولر'],['Z8','Z10','Z11','Z mini','CC']),
 ('Xiaomi TV Box','شاومي بوكس',['mi box','xiaomi box'],['Mi Box S','TV Box S 2nd Gen','Mi TV Stick']),
 ('Chromecast','كروم كاست',['chromecast google tv','google chromecast'],['Chromecast HD','Chromecast 4K','Google TV Streamer']),
 ('Fire TV','فاير تي في',['fire stick','amazon fire'],['Fire TV Stick','Fire TV Stick 4K','Fire TV Cube']),
 ('Nvidia Shield','إنفيديا شيلد',['shield tv','nvidia'],['Shield TV','Shield Pro']),
 ('Roku','روكو',['roku stick','roku tv'],['Express','Streaming Stick','Ultra']),
 ('Apple TV','آبل تي في',['apple tv box'],['Apple TV HD','Apple TV 4K']),
 ('G-Guard Box','جي جارد بوكس',['g guard box','gguard box'],['Android Box','Google TV Box']),
 ('Magic Box','ماجيك بوكس',['magic android box'],['Android Box','IPTV Box']),
 ('General View Box','جنرال فيو بوكس',['general view box'],['Android Box','IPTV Box']),
]
extra_boxes = ['T95','Vontar','HK1','Ugoos','Beelink','Minix','Q Plus','Rikomagic','Nexbox','Transpeed','Pendoo','Alfawise','Ematic','Strong Leap','Homatics','Dune HD','Zidoo','BuzzTV','Dreamlink','TVIP','Openbox Android','Unblock Tech','EVPAD','SuperBox','Mi Stick','Realme TV Stick']
for n in extra_boxes:
    boxes.append((n, n, [n.lower().replace(' ','-'), n.lower().replace(' ','')], ['Android Box','4K','Plus','Pro']))
box_topic_defs = [
 ('connect_wifi','توصيل {ar} بالواي فاي','توصيل Android/IPTV Box بالإنترنت.', ['wifi','واي فاي','انترنت'], ['افتح Settings ثم Network/Wi‑Fi.','اختر الشبكة واكتب كلمة المرور.','جرّب 2.4GHz إذا كان الجهاز قديمًا.','اختبر هوتسبوت الهاتف لعزل الراوتر.'], False, False),
 ('connect_lan','توصيل {ar} بكابل LAN','LAN أكثر ثباتًا للبث.', ['lan','ethernet','كابل'], ['وصل الكابل بالراوتر.','اجعل IP تلقائي DHCP.','أعد تشغيل الجهاز.','إذا لا يوجد منفذ LAN استخدم محول USB Ethernet مدعومًا.'], False, False),
 ('install_app','تنزيل تطبيق على {ar}','تثبيت التطبيقات الرسمية.', ['تطبيق','install','google play','apk'], ['استخدم Google Play أو المتجر الرسمي أولًا.','إذا التطبيق غير متاح، تحقق من توافق الجهاز والبلد.','تجنب ملفات APK مجهولة.','بعد التثبيت افتح التطبيق وسجل الدخول بحسابك الرسمي.'], True, False),
 ('app_not_found','تطبيق غير موجود على {ar}','عندما لا يظهر التطبيق في المتجر.', ['مش موجود','not found','store'], ['تأكد من إصدار Android/Google TV.','حدّث Google Play Services والنظام إن توفر.','افحص البلد/الحساب.','استخدم جهازًا أحدث إذا التطبيق يتطلب اعتماد DRM أو إصدار أعلى.'], True, False),
 ('app_freeze','تطبيق يعلق على {ar}','حل التجمّد والتوقف.', ['يعلق','crash','freeze'], ['أغلق التطبيق إجباريًا.','امسح الكاش.','حدّث التطبيق.','أعد تشغيل الجهاز.','إذا كل التطبيقات تعلق افحص الحرارة والذاكرة.'], False, False),
 ('iptv_buffering','تقطيع IPTV على {ar}','تشخيص تقطيع البث القانوني.', ['iptv','buffering','تقطيع'], ['استخدم LAN إن أمكن.','اختبر سرعة الإنترنت.','غيّر جودة البث من التطبيق.','أغلق VPN إن كان يسبب بطئًا.','إذا المزود واحد فقط يقطع، تواصل مع المزود الرسمي.'], False, False),
 ('playlist_setup_official','تشغيل Playlist رسمية على {ar}','إدخال بيانات قانونية فقط.', ['m3u','xtream','playlist'], ['افتح التطبيق الرسمي أو المشغل القانوني.','أدخل رابط M3U/بيانات Xtream من المزود الرسمي.','صحح الوقت والمنطقة.','لا أدعم قوائم مقرصنة أو روابط مسروقة.'], True, False),
 ('clear_cache','مسح كاش {ar}','تنظيف التطبيقات.', ['cache','كاش'], ['Settings → Apps.','اختر التطبيق.','Clear Cache ثم Force Stop.','أعد تشغيل التطبيق.'], False, False),
 ('storage_full','ذاكرة {ar} ممتلئة','إدارة مساحة التخزين.', ['ذاكرة','مساحة','storage'], ['احذف تطبيقات لا تستخدمها.','امسح الكاش.','انقل ملفات الفيديو إلى USB إن مدعوم.','تجنب تثبيت تطبيقات كثيرة على جهاز ضعيف.'], False, False),
 ('factory_reset','ضبط مصنع {ar}','إعادة ضبط عند مشاكل مستمرة.', ['factory reset','ضبط مصنع'], ['احفظ الحسابات والبيانات.','Settings → Device Preferences → Reset.','بعد الضبط أعد تحديث التطبيقات.','لا تفعلها إلا بعد تجربة الحلول الأخف.'], True, False),
 ('software_update_safe','تحديث نظام {ar}','التحديث الرسمي.', ['تحديث','firmware','system update'], ['Settings → About → System Update.','استخدم تحديث OTA الرسمي.','لا تفصل الكهرباء.','إذا الجهاز علق بعد تحديث، لا تستخدم ملفات مجهولة وراجع فني/الدعم.'], True, True),
 ('bluetooth','إقران Bluetooth على {ar}','ربط ريموت أو سماعة.', ['bluetooth','ريموت','سماعة'], ['Settings → Remotes & Accessories.','ضع الجهاز الآخر في وضع pairing.','اختره من القائمة.','إذا فشل، احذف الاقتران وأعد المحاولة.'], False, False),
 ('screen_cast','Cast على {ar}','ربط الهاتف بالبث.', ['cast','chromecast','airplay'], ['تأكد أن الهاتف والجهاز على نفس الشبكة.','افتح تطبيق يدعم Cast.','اختر الجهاز من الأيقونة.','إذا لا يظهر، أعد تشغيل الراوتر والجهاز.'], False, False),
 ('hdmi_resolution','تعديل دقة {ar}','حل شاشة سوداء أو لا يدعم الدقة.', ['resolution','دقة','hdmi'], ['جرّب منفذ HDMI آخر.','اخفض الدقة إلى 1080p إذا الشاشة قديمة.','غيّر Refresh Rate إلى 50/60Hz حسب الشاشة.','استخدم كابل HDMI جيد.'], False, False),
]
box_items=[]
for brand, ar, aliases, models in boxes:
    ts=[topic(brand, ar, 'android-receiver-iptv-box', intent, title.format(ar=ar), summary, kws, steps, needs, saf) for intent,title,summary,kws,steps,needs,saf in box_topic_defs]
    box_items.append(item(brand, ar, 'android-receiver-iptv-box', aliases, models, ['Android TV','Google TV','Fire TV','Roku OS','tvOS','Linux IPTV حسب الجهاز'], ts))

# Apps and services
apps = [
 ('YouTube','يوتيوب',['youtube','يوتوب'],['Android TV','Google TV','Tizen','webOS','VIDAA','Roku','Fire TV']),
 ('Netflix','نتفليكس',['netflix','نتفلكس'],['Android TV','Google TV','Tizen','webOS','VIDAA','Roku','Fire TV']),
 ('Shahid','شاهد',['shahid','شاهد vip'],['Android TV','Google TV','Tizen','webOS','VIDAA']),
 ('TOD','تود',['tod tv','beIN TOD'],['Android TV','Google TV','Tizen','webOS']),
 ('OSN+','أو إس إن',['osn','osn plus','او اس ان'],['Android TV','Google TV','Tizen','webOS']),
 ('StarzPlay','ستارز بلاي',['starz','starzplay'],['Android TV','Google TV','Tizen','webOS']),
 ('Amazon Prime Video','برايم فيديو',['prime video','amazon prime'],['Android TV','Google TV','Tizen','webOS','VIDAA']),
 ('Disney+','ديزني بلس',['disney plus','ديزني'],['Android TV','Google TV','Tizen','webOS']),
 ('Apple TV','آبل تي في',['apple tv plus','appletv'],['Android TV','Google TV','Tizen','webOS','Apple tvOS']),
 ('IPTV Player','مشغل IPTV',['iptv','m3u','xtream'],['Android TV','Google TV','Tizen','webOS','Android Box']),
 ('TiviMate','تيفي ميت',['tivimate'],['Android TV','Google TV','Android Box']),
 ('OTT Navigator','أوتي تي نافيجيتور',['ott navigator'],['Android TV','Google TV','Android Box']),
 ('XCIPTV','إكس سي IPTV',['xciptv'],['Android TV','Google TV','Android Box']),
 ('Smart IPTV','سمارت IPTV',['siptv','smart iptv'],['Tizen','webOS','Android TV']),
 ('VLC','في إل سي',['vlc player'],['Android TV','Google TV','Android Box']),
 ('Kodi','كودي',['kodi'],['Android TV','Google TV','Android Box']),
 ('Google Play Store','جوجل بلاي',['play store','google play'],['Android TV','Google TV']),
 ('Samsung Smart Hub','سمارت هب',['smart hub','samsung apps'],['Tizen']),
 ('LG Content Store','متجر LG',['lg content store','lg apps'],['webOS']),
 ('VIDAA Store','متجر VIDAA',['vidaa apps'],['VIDAA']),
 ('Browser','المتصفح',['browser','متصفح'],['Android TV','Google TV','Tizen','webOS','VIDAA']),
 ('Screen Mirroring','مشاركة الشاشة',['cast','airplay','mirroring'],['Android TV','Google TV','Tizen','webOS','VIDAA']),
 ('Spotify','سبوتيفاي',['spotify'],['Android TV','Google TV','Tizen','webOS']),
 ('Anghami','أنغامي',['anghami'],['Android TV','Google TV','Tizen','webOS']),
 ('Plex','بليكس',['plex'],['Android TV','Google TV','Tizen','webOS']),
 ('Jellyfin','جيليفن',['jellyfin'],['Android TV','Google TV','Android Box']),
 ('Emby','إمبي',['emby'],['Android TV','Google TV','Android Box']),
]
app_topic_defs = [
 ('install_app','تثبيت {ar} من المتجر الرسمي','تثبيت التطبيق من المسار الصحيح.', ['install','تنزيل','تثبيت'], ['افتح المتجر الرسمي المناسب للنظام.','ابحث عن التطبيق باسمه.','اضغط Install/تثبيت أو Update/تحديث.','إذا لم يظهر، تحقق من البلد وإصدار النظام.'], True, False),
 ('app_not_found','{ar} غير موجود في المتجر','أسباب اختفاء التطبيق.', ['not found','غير موجود','لا يظهر'], ['حدّث نظام الجهاز.','افحص البلد/المنطقة والحساب.','تأكد أن جهازك يدعم التطبيق.','إذا الموديل قديم استخدم جهاز خارجي رسمي.'], True, False),
 ('app_freeze','{ar} يعلق أو لا يفتح','حل تعليق التطبيق.', ['يعلق','crash','freeze'], ['أغلق التطبيق إجباريًا.','امسح الكاش أو أعد التثبيت.','صحح التاريخ والوقت.','اختبر الإنترنت عبر هوتسبوت أو LAN.'], False, False),
 ('login_problem','مشكلة تسجيل الدخول في {ar}','حل مشاكل الحساب والكود.', ['login','تسجيل دخول','رمز','كود'], ['تأكد من البريد وكلمة المرور.','جرب تسجيل الدخول من الهاتف للتأكد من الحساب.','صحح الوقت والمنطقة.','إذا يظهر كود خطأ اكتبه كما هو.'], False, False),
 ('audio_video_problem','مشكلة صوت أو صورة في {ar}','تقطيع/تأخير/عدم تطابق.', ['صوت','صورة','audio','video'], ['حدّث التطبيق.','جرّب جودة أقل.','أعد تشغيل الجهاز والراوتر.','إذا المشكلة على التطبيق فقط، انتظر تحديثًا أو تواصل مع الدعم الرسمي.'], False, False),
 ('storage_full','{ar} لا يثبت بسبب الذاكرة','حل مشكلة المساحة.', ['ذاكرة','مساحة','storage'], ['احذف تطبيقات غير مستخدمة.','امسح الكاش.','أعد تشغيل الجهاز.','إذا التخزين محدود جدًا استخدم جهاز أحدث.'], False, False),
]
app_items=[]
for brand, ar, aliases, oses in apps:
    ts=[topic(brand, ar, 'app', intent, title.format(ar=ar), summary, kws, steps, needs, saf) for intent,title,summary,kws,steps,needs,saf in app_topic_defs]
    app_items.append(item(brand, ar, 'app', aliases, [], oses, ts))

# Hyper diagnostic brain - compact, high value flows
flows=[]
flow_defs = [
 ('universal_triage','تشخيص سريع لأي مشكلة','ابدأ من نوع الجهاز ثم الموديل ثم الرسالة الظاهرة.', ['تشخيص','مشكلة','لا يعمل'], ['حدد نوع الجهاز: شاشة، ريسيفر، Android Box، تطبيق.','اسأل عن الماركة والموديل.','اسأل: هل المشكلة بدأت بعد تحديث/تطبيق/انقطاع كهرباء؟','ابدأ بالخطوات الآمنة: إعادة تشغيل، كابل/شبكة، تحديث رسمي.']),
 ('tv_app_install_decision','قرار تنزيل تطبيق على شاشة','التطبيقات تعتمد على نظام الشاشة لا الاسم التجاري فقط.', ['تطبيق شاشة','متجر','يوتيوب'], ['إذا يوجد Google Play فالمسار Android/Google TV.','إذا يوجد Smart Hub فالمسار Samsung Tizen.','إذا يوجد LG Content Store فالمسار webOS.','إذا المتجر محدود/غير معروف، اطلب الموديل واقترح جهاز خارجي رسمي عند عدم الدعم.']),
 ('receiver_internet_decision','قرار الإنترنت في الريسيفر','فصل مشكلة الراوتر عن الريسيفر.', ['ريسيفر نت','واي فاي','server'], ['جرّب LAN أو هوتسبوت الهاتف.','صحح التاريخ والوقت.','إذا متصل ولا خدمة، افحص الاشتراك الرسمي أو الخدمة.','لا تعطي بيانات سيرفرات غير قانونية.']),
 ('no_signal_splitter','تقسيم No Signal','تمييز No Signal التلفزيون من No Signal القناة.', ['no signal','لا توجد اشارة'], ['إذا تظهر على شاشة التلفزيون قبل دخول قائمة الريسيفر فهي HDMI/Source.','إذا تظهر داخل القناة مع وجود قوائم الريسيفر فهي دش/تردد.','افحص HDMI أولًا ثم LNB والقمر.']),
 ('firmware_safety_gate','بوابة أمان السوفتوير','لا تحديث بدون موديل مؤكد.', ['سوفتوير','firmware','تحديث'], ['اطلب الموديل الكامل قبل أي ملف.','اسم الملف يجب أن يطابق الموديل والهاردوير.','لا تستخدم ملفات من جروبات أو مصادر مجهولة.','إذا الجهاز عالق بعد تحديث يحتاج فني أو ملف رسمي صحيح.']),
 ('iptv_legal_quality_gate','تحسين IPTV قانوني','حل التقطيع بدون طرق مخالفة.', ['iptv','تقطيع'], ['استخدم LAN.','اختبر سرعة وثبات الإنترنت.','خفف الجودة.','تأكد أن الاشتراك رسمي.','إذا التقطيع من مزود واحد فالمشكلة غالبًا من المزود.']),
]
for intent,title,summary,kws,steps in flow_defs:
    flows.append({'id': f'hyper-flow-{intent}', 'intent': intent, 'title': title, 'summary': summary, 'keywords': kws+[intent], 'steps': steps, 'safe': True, 'sources':[SOURCE]})
flow_items=[{'brand':'Internal Diagnostic Brain','nameAr':'عقل التشخيص الداخلي','category':'diagnostic-flow','aliases':['تشخيص داخلي','مساعد الصيانة','internal brain'], 'topics': flows}]

# Alias dictionary and model map
alias_items=[]
for brand, ar, aliases, models in receivers:
    alias_items.append({'canonical':brand,'nameAr':ar,'deviceType':'receiver','aliases':list(dict.fromkeys([brand,ar]+aliases+models))})
for brand, ar, aliases, models, oses in tvs:
    alias_items.append({'canonical':brand,'nameAr':ar,'deviceType':'tv','aliases':list(dict.fromkeys([brand,ar]+aliases+models))})
for brand, ar, aliases, models in boxes:
    alias_items.append({'canonical':brand,'nameAr':ar,'deviceType':'android-receiver-iptv-box','aliases':list(dict.fromkeys([brand,ar]+aliases+models))})
for brand, ar, aliases, oses in apps:
    alias_items.append({'canonical':brand,'nameAr':ar,'deviceType':'app','aliases':list(dict.fromkeys([brand,ar]+aliases))})

model_items=[]
for brand, ar, aliases, models, oses in tvs:
    for m in models[:12]:
        model_items.append({'brand':brand,'nameAr':ar,'category':'tv','modelPattern':m,'likelyOs':oses[0] if oses else 'Smart OS حسب الموديل','certainty':'internal-market-map','aliases':[brand,ar,m], 'notes':'إذا الموديل غير كامل، اسأل عن صورة الملصق أو صفحة حول التلفزيون.'})
for brand, ar, aliases, models in receivers:
    for m in models[:8]:
        model_items.append({'brand':brand,'nameAr':ar,'category':'receiver','modelPattern':m,'likelyOs':'Receiver Firmware / DVB','certainty':'internal-market-map','aliases':[brand,ar,m], 'notes':'قبل أي سوفتوير يجب مطابقة الموديل والهاردوير.'})

writes = {
    HYPER/'hyper-receivers-middle-east-v4.json': {'items': receiver_items},
    HYPER/'hyper-tvs-middle-east-v4.json': {'items': tv_items},
    HYPER/'hyper-android-iptv-boxes-v4.json': {'items': box_items},
    HYPER/'hyper-apps-services-v4.json': {'items': app_items},
    HYPER/'hyper-internal-diagnostic-brain-v4.json': {'items': flow_items},
    ALIASES_DIR/'hyper-device-aliases-v4.json': {'items': alias_items},
    MODELS_DIR/'hyper-device-os-map-v4.json': {'items': model_items},
}
for path, data in writes.items():
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

catalog_path = K / 'catalog.json'
try:
    catalog=json.loads(catalog_path.read_text(encoding='utf-8'))
except Exception:
    catalog={}
catalog['version']='2026.06-service-hyper-internal-assistant-v4'
catalog['mode']='internal-ai-like-chat-first-ai-fallback-last'
catalog['region']='Jordan / Middle East'
catalog['lastExpandedAt']=NOW
catalog['notes']='Expanded with hyper internal service knowledge for TVs, receivers, Android/IPTV boxes, apps, network, signal and safe diagnostics. External AI remains a last-resort option only.'
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'ok':True, 'files':len(writes), 'receiverBrands':len(receivers), 'tvBrands':len(tvs), 'boxBrands':len(boxes), 'apps':len(apps), 'aliases':len(alias_items), 'modelMap':len(model_items)}, ensure_ascii=False, indent=2))
