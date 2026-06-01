#!/usr/bin/env python3
import json, re, hashlib
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[1]
H=ROOT/'public/service/knowledge/hyper'
H.mkdir(parents=True, exist_ok=True)
NOW=datetime.now(timezone.utc).date().isoformat()
SOURCE='internal-hyper-scenario-playbooks-v4b'

def slug(s):
  return re.sub(r'[^a-zA-Z0-9\u0600-\u06FF]+','-',str(s).lower()).strip('-')[:80]

def t(brand, ar, cat, intent, title, summary, kws, steps, needs=False, safety=False):
  return {'id':f'hyper-scenario-{slug(cat)}-{slug(brand)}-{slug(intent)}-{hashlib.sha1((brand+intent+title).encode()).hexdigest()[:8]}','intent':intent,'title':title,'summary':summary,'keywords':list(dict.fromkeys([brand,ar,intent]+kws)),'steps':steps,'safe':True,'needsModelWhen':[intent,'exact_model_needed'] if needs else [],'whenToCallTechnician':['رائحة حرق أو دخان','فتح الجهاز أو لحام أو بوردة','فشل تحديث أوقف الجهاز','مشكلة كهرباء داخلية'] if safety else [],'sources':[SOURCE],'updatedAt':NOW}

def item(brand,ar,cat,aliases,models,oses,topics):
  return {'brand':brand,'nameAr':ar,'category':cat,'market':['Jordan','Middle East'],'aliases':list(dict.fromkeys([brand,ar]+aliases)),'knownModels':models,'possibleOperatingSystems':oses,'topics':topics}

# Keep lists compact but broad; these mirror popular Middle East devices.
tv_brands=[('Samsung','سامسونج',['سمسونج','smart hub'],['UA','QN','CU','DU'],['Tizen']),('LG','إل جي',['ال جي','webos'],['OLED','QNED','UR','UQ'],['webOS']),('TCL','تي سي إل',['tcl'],['C645','P735','P755'],['Google TV','Android TV']),('Hisense','هايسنس',['vidaa'],['A6','A7','U7'],['VIDAA','Google TV']),('Sony','سوني',['bravia'],['X80','X85','X90'],['Google TV']),('G-Guard','جي جارد',['g guard','gguard'],['GG-43','GG-50','GG-55'],['Google TV','Android TV','Smart OS']),('Magic','ماجيك',['magic tv'],['MG-43','MG-55'],['Android TV','Smart OS']),('General View','جنرال فيو',['generalview'],['GV-43','GV-55'],['Android TV','Smart OS']),('Star-X TV','ستار إكس',['star-x tv'],['SX-43','SX-55'],['Android TV','Smart OS']),('National TV','ناشيونال',['national tv'],['NT-43','NT-55'],['Android TV','Smart OS'])]
# add smaller brands from existing market
for n in ['Sharp','Toshiba','Philips','Panasonic','Skyworth','Xiaomi','JVC','Haier','Vestel','Nikai','General Deluxe','General Gold','Tiger TV','GoldSky','Samix','ROWA','VIVA','STIGG','I Like','UGINE','Mirna','PowerSat TV','Nokia','Hitachi','Sanyo','Akai','Aiwa','Daewoo','Beko','Grundig','Telefunken','Thomson','Changhong','KONKA','Blaupunkt','Westinghouse','RCA','Fresh','Tornado','Falcon TV','Lazer TV']:
  tv_brands.append((n,n,[n.lower().replace(' ','-'),n.lower().replace(' ','')],['32','43','55','65'],['Android TV','Google TV','Smart OS حسب الموديل']))

tv_scenarios=[
('youtube_not_found','يوتيوب غير موجود في متجر {ar}','حل اختفاء YouTube حسب النظام.', ['يوتيوب','مش موجود','متجر'], ['حدد المتجر الموجود في الشاشة.','إذا Google Play غير موجود فقد يكون النظام Smart خاص.','حدّث النظام وابحث مرة ثانية.','إذا الموديل لا يدعم YouTube استخدم جهاز Google/Android TV خارجي رسمي.'], True, False),
('youtube_freeze','يوتيوب يعلق على شاشة {ar}','تشخيص تعليق يوتيوب.', ['يوتيوب','يعلق','تعليق'], ['افصل الشاشة دقيقة.','حدّث YouTube من المتجر.','امسح الكاش أو احذف التطبيق وثبته.','جرّب LAN أو هوتسبوت للتأكد من الإنترنت.'], False, False),
('youtube_black_screen','يوتيوب شاشة سوداء على {ar}','صوت موجود أو شاشة سوداء داخل التطبيق.', ['يوتيوب','شاشة سوداء','black'], ['حدّث التطبيق والنظام.','أوقف تسريع الفيديو إن كان التطبيق يدعم.','غيّر جودة الفيديو.','إذا المشكلة بكل المصادر وليس YouTube فقط فافحص إعدادات الصورة أو الصيانة.'], False, True),
('shahid_login_code','شاهد يطلب كود أو لا يسجل دخول على {ar}','حل تسجيل الدخول في شاهد.', ['شاهد','كود','تسجيل دخول'], ['تأكد من البلد والحساب.','سجل دخول من الهاتف أولًا للتأكد من الحساب.','صحح الوقت والتاريخ.','اكتب كود الخطأ إذا ظهر.'], False, False),
('netflix_error_code','نتفليكس يظهر كود خطأ على {ar}','تشخيص أكواد Netflix.', ['netflix','نتفليكس','كود خطأ'], ['اكتب الكود كما يظهر.','صحح الوقت والتاريخ.','أعد تشغيل الراوتر والشاشة.','سجل خروج ودخول.','إذا الموديل قديم قد لا يدعم Netflix الحالي.'], True, False),
('store_not_opening','متجر التطبيقات لا يفتح على {ar}','حل متجر التطبيقات.', ['متجر','لا يفتح','apps'], ['افحص الإنترنت والوقت.','أعد تشغيل الشاشة.','وافق على شروط المتجر إن ظهرت.','سجل الدخول للحساب المطلوب.','إذا المتجر غير موجود فالنظام محدود.'], True, False),
('google_play_missing','لا يوجد Google Play على شاشة {ar}','توضيح وجود/غياب Google Play.', ['google play','جوجل بلاي','غير موجود'], ['Google Play يظهر فقط على Android/Google TV.','إذا شاشتك بنظام Tizen أو webOS أو VIDAA لن يظهر Google Play.','استخدم متجر النظام الأصلي.','إذا النظام Smart خاص ولا يدعم التطبيق استخدم جهاز Android TV خارجي.'], True, False),
('smart_hub_reset','إعادة ضبط Smart Hub أو متجر الشاشة في {ar}','حل مشاكل متجر سامسونج وما يشبهه.', ['smart hub','reset apps','متجر'], ['افتح إعدادات الدعم/العناية بالجهاز.','ابحث عن Reset Smart Hub أو إعادة ضبط التطبيقات إن وجدت.','وافق على الشروط وسجل دخولك.','إذا الشاشة ليست سامسونج استخدم مسار متجر النظام الخاص بها.'], True, False),
('lg_content_store_issue','LG Content Store أو متجر التطبيقات لا يعمل على {ar}','حل متجر LG أو المتاجر المشابهة.', ['lg content store','متجر lg','لا يعمل'], ['صحح الوقت والمنطقة.','حدّث webOS.','أعد تشغيل الشاشة.','إذا لا يوجد LG Content Store فالشاشة ليست webOS أو ليست LG أصلية.'], True, False),
('vidaa_apps_issue','تطبيقات VIDAA لا تظهر على {ar}','حل متجر VIDAA.', ['vidaa','فايدا','تطبيقات'], ['افتح متجر VIDAA.','تأكد من المنطقة والدولة.','حدّث النظام.','إذا التطبيق غير مدعوم، استخدم جهاز خارجي رسمي.'], True, False),
('remote_voice_not_working','البحث الصوتي أو ريموت ذكي لا يعمل على {ar}','حل المايك والاقتران.', ['ريموت صوتي','مايك','voice'], ['تأكد أن الريموت مقترن بالبلوتوث.','بدّل البطاريات.','اضغط أزرار الاقتران حسب النظام.','تأكد من اتصال الإنترنت لأن البحث الصوتي يحتاج شبكة.'], True, False),
('airplay_cast_issue','AirPlay أو Cast لا يظهر على {ar}','حل عدم ظهور الشاشة على الهاتف.', ['airplay','cast','مشاركة الشاشة'], ['ضع الهاتف والشاشة على نفس الشبكة.','أوقف VPN على الهاتف.','أعد تشغيل الراوتر والشاشة.','تأكد أن النظام يدعم AirPlay أو Chromecast.'], True, False),
('wifi_saved_no_internet','الشاشة متصلة بالواي فاي لكن لا يوجد إنترنت في {ar}','تشخيص اتصال الشبكة.', ['متصل بدون انترنت','wifi','انترنت'], ['انسَ الشبكة وأعد الاتصال.','صحح التاريخ والوقت.','جرّب هوتسبوت الهاتف.','إذا يعمل على الهوتسبوت فالمشكلة من الراوتر أو DNS.'], False, False),
('hdmi_cec_issue','HDMI-CEC لا يتحكم بالأجهزة على {ar}','تشغيل التحكم عبر HDMI.', ['cec','anynet','simplink','hdmi التحكم'], ['فعّل HDMI-CEC من إعدادات الشاشة.','فعله أيضًا في الجهاز الآخر.','استخدم كابل HDMI جيد.','أعد تشغيل الجهازين.'], True, False),
('arc_no_sound','ARC/eARC لا يعطي صوت على {ar}','صوت الساوند بار أو المسرح.', ['arc','earc','صوت','soundbar'], ['استخدم منفذ HDMI ARC/eARC فقط.','فعّل CEC.','اختر إخراج الصوت HDMI ARC.','جرّب كابل HDMI آخر.','استخدم Optical كبديل عند الحاجة.'], True, False),
]
tv_items=[]
for b,ar,aliases,models,oses in tv_brands:
  tv_items.append(item(b,ar,'tv',aliases,models,oses,[t(b,ar,'tv',intent,title.format(ar=ar),summary,kws,steps,needs,safety) for intent,title,summary,kws,steps,needs,safety in tv_scenarios]))

receiver_brands=['Spider','Tiger','Starsat','Geant','Senator','Majestic','Ghazal','Infinity','Echolink','Icone','Forever','Qmax','Star-X','National','MediaStar','Samsat','Openbox','Dreambox','Technosat','Truman','SuperMax','PowerSat','Royal','Vision','StarNet','DigiClass','Redline','Hivion','Condor','Strong','Humax','iSTAR','Moresat','Alpha','Digital World','Matrix','Nashare','Atlas','Cristor','Vision Plus','Sunplus','Eurosat','Microbox','Mediacom','Gold Vision','Sat Integral','HD Line','Sky Line','Premium X','Amiko','Opticum','Ferguson','Golden Interstar','Next','NextStar','Botech','Watan','Legend','Topfield','Manhattan','Digiquest','SAB','Octagon','AB Cryptobox','VU+','Zgemma','World Vision','Falcon']
receiver_scenarios=[
('wifi_usb_adapter','قطعة Wi‑Fi لا تعمل على {ar}','تشخيص USB Wi‑Fi.', ['قطعة واي فاي','usb wifi','لا تعمل'], ['تأكد أن القطعة مدعومة لنفس الموديل.','جرّب منفذ USB آخر.','أعد تشغيل الريسيفر بعد تركيب القطعة.','إذا لا تظهر في الشبكة فقد تحتاج قطعة بشريحة متوافقة.'], True, False),
('server_expired_message','رسالة Server Expired أو Disconnected على {ar}','تشخيص قانوني لحالة الخدمة.', ['server expired','server disconnected','سيرفر منتهي'], ['تأكد من الإنترنت والتاريخ والوقت.','افتح معلومات الخدمة الرسمية إن وجدت.','إذا الاشتراك منتهٍ تواصل مع المزود الرسمي.','لا أدعم سيرفرات غير قانونية أو فتح قنوات مدفوعة بدون اشتراك.'], False, False),
('encrypted_channel_message','رسالة قناة مشفرة على {ar}','تعامل قانوني مع القنوات المشفرة.', ['قناة مشفرة','scrambled','encrypted'], ['تأكد أن القناة ضمن اشتراك رسمي.','أعد تشغيل البطاقة/الوحدة الرسمية إن وجدت.','صحح الوقت والتحديث الرسمي.','إذا لا يوجد اشتراك رسمي فلا يمكن فتح القنوات المدفوعة قانونيًا.'], False, False),
('channel_disappeared','قنوات اختفت من {ar}','استرجاع القنوات.', ['قنوات اختفت','اختفت القنوات','قائمة القنوات'], ['تأكد أنك على القمر الصحيح.','افحص قائمة Favorites.','نفّذ بحثًا يدويًا على التردد المعروف.','إذا اختفت بعد ضبط مصنع استرجع نسخة القنوات إن لديك.'], False, False),
('audio_language','تغيير لغة الصوت أو الترجمة على {ar}','حل لغة الصوت والترجمة.', ['لغة الصوت','ترجمة','audio language','subtitle'], ['اضغط Audio أو زر اللغة من الريموت.','اختر Arabic أو English حسب المتاح.','للترجمة اضغط Subtitle إن وجدت.','بعض القنوات لا توفر كل اللغات.'], False, False),
('epg_time_wrong','EPG أو دليل البرامج غلط على {ar}','الوقت ودليل البرامج.', ['epg','دليل البرامج','وقت غلط'], ['صحح التاريخ والوقت والمنطقة.','فعّل الوقت التلقائي إن وجد.','أعد تشغيل الجهاز.','بعض القنوات لا ترسل EPG صحيح دائمًا.'], False, False),
('motor_setup_safe','ضبط موتور أو USALS على {ar}','إعداد الموتور يحتاج دقة.', ['motor','usals','موتور','دايزك موتور'], ['أدخل خطوط الطول والعرض بدقة إذا تستخدم USALS.','لا تغيّر إعدادات الموتور عشوائيًا.','ابدأ بقمر قوي ثم انتقل لباقي الأقمار.','إذا الطبق لا يتحرك أو يضرب الحدود اطلب فني دش.'], True, True),
('powervu_biss_request','طلب PowerVU/BISS على {ar}','سياسة قانونية للطلبات الحساسة.', ['powervu','biss','شفرة','كود'], ['أقدر أساعدك بضبط التردد والإشارة والبحث.','لا أقدّم أكواد أو طرق كسر تشفير أو فتح قنوات مدفوعة بدون إذن.','للقنوات الرسمية استخدم الاشتراك أو البطاقة القانونية.'], False, False),
('usb_recording_issue','التسجيل على USB لا يعمل في {ar}','حل التسجيل أو PVR.', ['تسجيل','pvr','usb recording'], ['استخدم USB سريعًا ومهيأ FAT32 أو exFAT حسب الجهاز.','فعّل PVR من القائمة إن وجد.','جرّب منفذ USB آخر.','بعض القنوات تمنع التسجيل أو تحتاج مساحة كبيرة.'], True, False),
('heat_restart','{ar} يسخن ويعيد التشغيل','تشخيص الحرارة.', ['يسخن','حرارة','restart'], ['ضع الجهاز بمكان مفتوح.','أزل أي غطاء فوقه.','افصل USB أو الهارد مؤقتًا.','إذا يستمر الريستارت مع رائحة أو حرارة عالية راجع فني.'], False, True),
]
receiver_items=[]
for b in receiver_brands:
  ar=b
  aliases=[b.lower().replace(' ','-'),b.lower().replace(' ','')]
  receiver_items.append(item(b,ar,'receiver',aliases,['HD','Mini','Plus','4K'],['DVB-S2','Linux/Receiver Firmware'],[t(b,ar,'receiver',intent,title.format(ar=ar),summary,kws,steps,needs,safety) for intent,title,summary,kws,steps,needs,safety in receiver_scenarios]))

# Universal OS x app playbooks for stronger matches without external AI.
systems=[('Google TV','جوجل تي في','Google Play'),('Android TV','أندرويد تي في','Google Play'),('Tizen','تايزن','Samsung Smart Hub'),('webOS','ويب أو إس','LG Content Store'),('VIDAA','فايدا','VIDAA Store'),('Fire TV','فاير تي في','Amazon Appstore'),('Roku TV','روكو','Roku Channel Store'),('Smart OS','نظام سمارت خاص','المتجر المدمج')]
app_names=['YouTube','Netflix','Shahid','TOD','OSN+','StarzPlay','Prime Video','Disney+','IPTV Player','VLC','Browser','Screen Mirroring']
os_items=[]
for os,en_ar,store in systems:
  topics=[]
  for app in app_names:
    topics.append(t(os,en_ar,'os-system',f'{slug(app)}_install_on_{slug(os)}',f'تثبيت {app} على نظام {en_ar}',f'طريقة التعامل مع {app} على {os}.',[app,store,'تطبيق','تنزيل'],[f'افتح {store} أو متجر النظام.',f'ابحث عن {app}.','ثبّت أو حدّث التطبيق إن كان متاحًا.','إذا التطبيق غير موجود، تحقق من البلد وإصدار النظام والموديل.','إذا النظام لا يدعم التطبيق استخدم جهاز بث خارجي رسمي.'],True,False))
  os_items.append(item(os,en_ar,'os-system',[os,en_ar,store],[],[os],topics))

Path(H/'hyper-scenario-tv-apps-v4b.json').write_text(json.dumps({'items':tv_items},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
Path(H/'hyper-scenario-receiver-cases-v4b.json').write_text(json.dumps({'items':receiver_items},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
Path(H/'hyper-os-app-playbooks-v4b.json').write_text(json.dumps({'items':os_items},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'ok':True,'tvItems':len(tv_items),'receiverItems':len(receiver_items),'osItems':len(os_items)},ensure_ascii=False,indent=2))
