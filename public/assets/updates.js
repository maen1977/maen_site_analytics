/* MAEN_UPDATES_HINTS_FEED_V1_2026_06_01 */
(function(){
  'use strict';
  var state={items:[],category:'all',query:'',sort:'newest',loaded:false,loading:false,visible:9,error:false,generatedAt:''};
  var labels={all:'كل التلميحات',frequency:'ترددات',satellite:'أقمار',channels:'قنوات',sports:'رياضة',alert:'تنبيه'};
  var shortLabels={all:'الكل',frequency:'تردد',satellite:'قمر',channels:'قناة',sports:'رياضة',alert:'تنبيه'};
  var icons={frequency:'📡',satellite:'🛰️',channels:'📺',sports:'⚽',alert:'⚠️'};
  var priority={alert:6,frequency:5,sports:4,channels:3,satellite:2};
  var hintLead={frequency:'استخدمه في البحث',satellite:'راجع القمر',channels:'معلومة قناة',sports:'تنبيه رياضي',alert:'انتبه'};
  function $(id){return document.getElementById(id);}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function norm(v){return String(v||'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ؤ]/g,'و').replace(/[ئ]/g,'ي').replace(/[\u064b-\u065f]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();}
  function dateValue(v){var n=Date.parse(v||'');return Number.isFinite(n)?n:0;}
  function dateText(v){
    if(!v)return'';
    try{return new Intl.DateTimeFormat('ar-JO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}
    catch(e){return String(v).slice(0,16);}
  }
  function relativeDate(v){
    var t=dateValue(v); if(!t)return '';
    var diff=Date.now()-t;
    var abs=Math.abs(diff);
    var units=[['day',86400000],['hour',3600000],['minute',60000]];
    try{
      var rtf=new Intl.RelativeTimeFormat('ar',{numeric:'auto'});
      for(var i=0;i<units.length;i++){
        if(abs>=units[i][1] || i===units.length-1){return rtf.format(Math.round(-diff/units[i][1]),units[i][0]);}
      }
    }catch(e){}
    return dateText(v);
  }
  function words(v){return norm(v).split(' ').filter(function(x){return x.length>1;});}
  function detail(label,value){
    if(value===undefined||value===null||String(value).trim()==='')return'';
    return '<span class="update-detail-chip"><b>'+esc(label)+'</b><em>'+esc(value)+'</em></span>';
  }
  function frequencyText(item){
    return [item.oldFrequency && item.frequency ? item.oldFrequency+' → '+item.frequency : (item.frequency || item.oldFrequency), item.polarity, item.symbolRate].filter(Boolean).join(' / ');
  }
  function detailsHtml(item){
    var html='';
    html+=detail('القمر',item.satellite);
    html+=detail('التردد',frequencyText(item));
    html+=detail('الحالة',item.status);
    return html;
  }
  function sourceTags(sources){
    return (sources||[]).slice(0,3).map(function(s){
      if(s&&typeof s==='object'&&s.url){
        return '<a class="update-source" href="'+esc(s.url)+'" target="_blank" rel="noopener nofollow">'+esc(s.name||'مصدر')+'</a>';
      }
      var text=typeof s==='string'?s:(s&&s.name)||'مصدر موثوق';
      return '<span class="update-source">'+esc(text)+'</span>';
    }).join('');
  }
  function tagsHtml(tags){
    return (tags||[]).slice(0,5).map(function(t){return '<span>'+esc(t)+'</span>';}).join('');
  }
  function itemSearchText(item){
    return norm([item.title,item.summary,item.satellite,item.frequency,item.oldFrequency,item.polarity,item.symbolRate,item.status,(item.tags||[]).join(' '),(item.sources||[]).map(function(s){return typeof s==='string'?s:(s&&s.name)||'';}).join(' ')].join(' '));
  }
  function cleanLabel(text){
    return String(text||'').replace(/GitHub Actions/gi,'نظام التحديث اليومي').replace(/Cloudflare|Netlify|JSON|frequency-data\.json/gi,'').replace(/داخل محرك البحث/g,'').replace(/\s{2,}/g,' ').trim();
  }
  function makeHintTitle(item){
    var title=cleanLabel(item.title||'تحديث جديد');
    if(/^تلميح|^انتبه|^ملاحظة/.test(title))return title;
    if(item.category==='frequency')return 'تلميح ترددات: '+title;
    if(item.category==='satellite')return 'تلميح قمر: '+title;
    if(item.category==='sports')return 'تلميح رياضي: '+title;
    if(item.category==='channels')return 'تلميح قنوات: '+title;
    return item.important?'انتبه: '+title:'تلميح سريع: '+title;
  }
  function makeHintSummary(item){
    var summary=cleanLabel(item.summary||'');
    summary=summary.replace(/عند توفر مصادر كافية/g,'حسب توفر المصادر الموثوقة');
    if(!summary)return 'تحديث مختصر من نظام الفحص اليومي. افتح قاعدة الترددات إذا كنت تريد التأكد من النتيجة الحالية.';
    return summary;
  }
  function cleanItems(items){
    var seen={};
    return (items||[]).filter(function(item){return item&&item.title;}).map(function(item,index){
      var copy=Object.assign({},item);
      copy.id=String(copy.id||('hint-'+index+'-'+Date.now()));
      copy.category=labels[copy.category]?copy.category:'alert';
      copy.title=makeHintTitle(copy).slice(0,190);
      copy.summary=makeHintSummary(copy).slice(0,680);
      copy.status=cleanLabel(copy.status||'');
      copy.sources=(copy.sources||[]).map(function(s){
        if(typeof s!=='string')return s;
        return cleanLabel(s).replace(/قاعدة الترددات\.json/gi,'قاعدة الترددات');
      }).filter(Boolean);
      copy.date=copy.date||copy.updatedAt||new Date().toISOString();
      copy._time=dateValue(copy.date);
      copy._search=itemSearchText(copy);
      var key=norm([copy.category,copy.title,copy.satellite,copy.frequency,copy.oldFrequency,copy.status].join(' '));
      if(seen[key])return null;
      seen[key]=1;
      return copy;
    }).filter(Boolean);
  }
  function matches(item){
    if(state.category!=='all'&&item.category!==state.category)return false;
    var q=norm(state.query);
    if(!q)return true;
    var hay=item._search||itemSearchText(item);
    var itemWords=words(hay);
    return words(q).every(function(w){
      return hay.indexOf(w)!==-1 || itemWords.some(function(hw){return hw.indexOf(w)===0||w.indexOf(hw)===0;});
    });
  }
  function sortedItems(items){
    var copy=items.slice();
    copy.sort(function(a,b){
      if(state.sort==='important')return (Number(b.important)-Number(a.important)) || (priority[b.category]||0)-(priority[a.category]||0) || b._time-a._time;
      if(state.sort==='frequency')return Number(b.category==='frequency')-Number(a.category==='frequency') || b._time-a._time;
      if(state.sort==='alerts')return Number(b.category==='alert')-Number(a.category==='alert') || Number(b.important)-Number(a.important) || b._time-a._time;
      return b._time-a._time || (priority[b.category]||0)-(priority[a.category]||0);
    });
    return copy;
  }
  function currentItems(){return sortedItems(state.items.filter(matches));}
  function categoryCounts(){
    var counts={all:state.items.length};
    Object.keys(labels).forEach(function(k){if(k!=='all')counts[k]=0;});
    state.items.forEach(function(item){counts[item.category]=(counts[item.category]||0)+1;});
    return counts;
  }
  function updateFilters(){
    var counts=categoryCounts();
    document.querySelectorAll('[data-updates-filter]').forEach(function(btn){
      var cat=btn.getAttribute('data-updates-filter')||'all';
      btn.classList.toggle('active',state.category===cat);
      btn.setAttribute('aria-pressed',state.category===cat?'true':'false');
      var small=btn.querySelector('small');
      if(small)small.textContent=String(counts[cat]||0);
    });
  }
  function updateMetrics(){
    var count=$('updatesCount'),updated=$('updatesUpdatedAt'),important=$('updatesImportantCount'),freq=$('updatesFrequencyCount');
    var newest=state.items[0]&&(state.items[0].date||state.items[0].updatedAt);
    if(count)count.textContent=state.loaded?String(state.items.length):(state.loading?'...':'—');
    if(important)important.textContent=state.loaded?String(state.items.filter(function(x){return x.important;}).length):(state.loading?'...':'—');
    if(freq)freq.textContent=state.loaded?String(state.items.filter(function(x){return x.category==='frequency';}).length):(state.loading?'...':'—');
    if(updated){updated.textContent=state.loaded&&newest?relativeDate(newest):(state.loading?'جارٍ التحميل':'عند الفتح');updated.title=state.loaded&&newest?dateText(newest):'';}
    var pulse=$('updatesLastPulse');
    if(pulse){pulse.textContent=state.loaded&&newest?'آخر تلميح: '+relativeDate(newest):(state.loading?'جارٍ تجهيز التلميحات...':'بانتظار فتح القسم');}
  }
  function renderTicker(){
    var ticker=$('updatesTickerTrack'); if(!ticker)return;
    if(state.loading&&!state.items.length){ticker.innerHTML='<span>جارٍ تحميل تلميحات اليوم...</span>';return;}
    var list=sortedItems(state.items).slice(0,7);
    if(!list.length){ticker.innerHTML='<span>لا توجد تلميحات منشورة حاليًا.</span>';return;}
    ticker.innerHTML=list.map(function(item){
      var cat=shortLabels[item.category]||'تلميح';
      var freq=frequencyText(item);
      return '<button type="button" data-ticker-filter="'+esc(item.category)+'"><strong>'+esc(cat)+'</strong><span>'+esc(item.title)+'</span>'+(freq?'<em>'+esc(freq)+'</em>':'')+'</button>';
    }).join('');
  }
  function renderSpotlight(){
    var box=$('updatesSpotlight'); if(!box)return;
    if(!state.loaded||!state.items.length){box.hidden=true;return;}
    var sorted=sortedItems(state.items);
    var featured=sorted.find(function(x){return x.important;})||sorted[0];
    if(!featured){box.hidden=true;return;}
    box.hidden=false;
    var cat=shortLabels[featured.category]||'تلميح';
    var fc=$('updatesFeaturedCategory'),ft=$('updatesFeaturedTitle'),fs=$('updatesFeaturedSummary'),fm=$('updatesFeaturedMeta'),fa=$('updatesFeaturedAction');
    if(fc)fc.textContent='أهم تلميح الآن / '+cat;
    if(ft)ft.textContent=featured.title||'تلميح جديد';
    if(fs)fs.textContent=featured.summary||'';
    if(fm)fm.innerHTML=detailsHtml(featured) || '<span class="update-detail-chip"><b>الخلاصة</b><em>تلميح موثّق من آخر فحص</em></span>';
    if(fa){
      var freq=frequencyText(featured);
      fa.innerHTML=freq?'<button type="button" class="update-copy-btn" data-copy-frequency="'+esc(freq)+'">نسخ التردد</button>':'<button type="button" onclick="showPage(\'frequencies\')">افتح قاعدة الترددات</button>';
    }
    var stats=$('updatesQuickStats');
    if(stats){
      var c=categoryCounts();
      stats.innerHTML=''
        +'<div><strong>'+esc(c.frequency||0)+'</strong><span>تلميحات تردد</span></div>'
        +'<div><strong>'+esc(c.alert||0)+'</strong><span>تنبيهات</span></div>'
        +'<div><strong>'+esc(c.sports||0)+'</strong><span>رياضة</span></div>'
        +'<div><strong>'+esc(c.channels||0)+'</strong><span>قنوات</span></div>';
    }
  }
  function renderCard(item,index){
    var cat=item.category||'alert';
    var badge=shortLabels[cat]||cat;
    var freq=frequencyText(item);
    var copyButton=freq?'<button type="button" class="update-copy-btn" data-copy-frequency="'+esc(freq)+'">نسخ التردد</button>':'';
    var openButton=item.category==='frequency'?'<button type="button" onclick="showPage(\'frequencies\')">جرّبه بالبحث</button>':'';
    var details=detailsHtml(item);
    return '<article class="update-card update-hint-card category-'+esc(cat)+' '+(item.important?'important':'')+'" data-update-index="'+esc(index+1)+'">'
      +'<div class="update-feed-marker"><span>'+esc(icons[cat]||'💡')+'</span></div>'
      +'<div class="update-feed-body">'
      +'<div class="meta"><span class="update-badge '+esc(cat)+'">'+esc(badge)+'</span><span class="update-date" title="'+esc(dateText(item.date||item.updatedAt))+'">'+esc(relativeDate(item.date||item.updatedAt))+'</span>'+(item.important?'<span class="update-verified">مهم</span>':'')+'</div>'
      +'<div class="update-hint-lead">'+esc(hintLead[cat]||'تلميح')+'</div>'
      +'<h3>'+esc(item.title)+'</h3>'
      +'<p>'+esc(item.summary)+'</p>'
      +(freq?'<div class="update-frequency-line"><b>استخدم هذا</b><strong>'+esc(freq)+'</strong></div>':'')
      +(details?'<div class="update-details">'+details+'</div>':'')
      +(item.tags&&item.tags.length?'<div class="update-tags">'+tagsHtml(item.tags)+'</div>':'')
      +'<div class="update-card-footer"><div class="update-sources">'+sourceTags(item.sources)+'</div><div class="update-card-actions">'+copyButton+openButton+'</div></div>'
      +'</div></article>';
  }
  function renderSkeleton(){
    var grid=$('updatesGrid'); if(!grid)return;
    grid.innerHTML=[1,2,3,4,5,6].map(function(){return '<article class="update-card update-hint-card update-skeleton"><div class="update-feed-marker"><span></span></div><div class="update-feed-body"><div></div><h3></h3><p></p><p></p></div></article>';}).join('');
    var empty=$('updatesEmpty'); if(empty)empty.classList.remove('active');
  }
  function renderSummary(filtered,total){
    var el=$('updatesActiveSummary'); if(!el)return;
    if(state.loading){el.innerHTML='<strong>جارٍ التحميل</strong><span>يتم تحويل آخر التحديثات إلى تلميحات مختصرة بدون تشغيل قاعدة بيانات إضافية.</span>';return;}
    if(state.error){el.innerHTML='<strong>تنبيه مؤقت</strong><span>تعذر تحميل التلميحات، لكن الموقع وبحث الترددات يعملان بشكل طبيعي.</span>';return;}
    var label=labels[state.category]||'كل التلميحات';
    var q=state.query?(' / بحث: '+esc(state.query.trim())):'';
    el.innerHTML='<strong>'+esc(label)+'</strong><span>يعرض '+esc(Math.min(filtered,state.visible))+' من '+esc(filtered)+' تلميح'+esc(q)+'.</span>';
    if(total===0)el.innerHTML='<strong>لا توجد تلميحات</strong><span>سيظهر هنا أي تغيير جديد بعد الفحص اليومي.</span>';
  }
  function render(){
    var grid=$('updatesGrid'),empty=$('updatesEmpty'),more=$('updatesLoadMore');
    if(!grid)return;
    updateFilters();
    updateMetrics();
    renderTicker();
    renderSpotlight();
    if(state.loading&&!state.items.length){renderSkeleton();renderSummary(0,state.items.length);return;}
    var filtered=currentItems();
    var shown=filtered.slice(0,state.visible);
    grid.innerHTML=shown.map(renderCard).join('');
    if(empty){
      empty.innerHTML=state.query||state.category!=='all'
        ? 'لا توجد تلميحات مطابقة. جرّب اسم القمر، رقم التردد، أو امسح الفلتر الحالي.'
        : 'لا توجد تلميحات جديدة حاليًا. آخر فحص تم بنجاح، وسيتم عرض أي تغييرات جديدة فور توفرها.';
      empty.classList.toggle('active',state.loaded&&!filtered.length);
    }
    if(more){
      more.hidden=!(filtered.length>state.visible);
      more.textContent='عرض تلميحات أكثر ('+(filtered.length-state.visible)+')';
    }
    renderSummary(filtered.length,state.items.length);
  }
  function setFilter(cat){state.category=cat||'all';state.visible=9;render();}
  function setupCopyButtons(){
    document.addEventListener('click',function(ev){
      var btn=ev.target.closest('[data-copy-frequency]');
      if(!btn)return;
      var text=btn.getAttribute('data-copy-frequency')||'';
      var original=btn.textContent;
      function done(){btn.textContent='تم النسخ';setTimeout(function(){btn.textContent=original||'نسخ التردد';},1400);}
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done).catch(done);}else{done();}
    });
  }
  function setupTickerClicks(){
    document.addEventListener('click',function(ev){
      var btn=ev.target.closest('[data-ticker-filter]');
      if(!btn)return;
      setFilter(btn.getAttribute('data-ticker-filter')||'all');
      var feed=$('updatesFeedPanel'); if(feed&&feed.scrollIntoView)feed.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }
  async function load(){
    if(state.loaded||state.loading)return;
    var grid=$('updatesGrid'); if(!grid)return;
    state.loading=true;state.error=false;render();
    try{
      var res=await fetch('updates/latest-updates.json',{cache:'default'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      var data=await res.json();
      state.generatedAt=data.generatedAt||'';
      state.items=cleanItems(data.items||[]).sort(function(a,b){return b._time-a._time;});
      state.loaded=true;
    }catch(e){
      state.error=true;
      state.items=cleanItems([{category:'alert',important:true,date:new Date().toISOString(),title:'التلميحات غير متاحة مؤقتًا',summary:'الموقع يعمل بشكل طبيعي، وسيتم عرض آخر تلميحات الترددات والقنوات فور عودة ملف التحديثات.',status:'تنبيه مؤقت',sources:['إدارة الموقع'],tags:['تنبيه']}]);
      state.loaded=true;
    }finally{
      state.loading=false;render();
    }
  }
  function ensureLoadedWhenNeeded(){
    var active=document.querySelector('.page.active');
    var isUpdates=(active&&active.id==='updates')||String(location.hash||'').replace('#','')==='updates';
    if(isUpdates)load();
  }
  function setupLazyLoad(){
    var section=$('updates');
    if(!section)return;
    if('IntersectionObserver' in window){
      var obs=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){if(entry.isIntersecting){load();obs.disconnect();}});
      },{root:null,rootMargin:'140px'});
      obs.observe(section);
    }
    var original=window.showPage;
    if(typeof original==='function'&&!original.__updatesWrapped){
      var wrapped=function(id){var out=original.apply(this,arguments);if(id==='updates')load();return out;};
      wrapped.__updatesWrapped=true;
      window.showPage=wrapped;
    }
    window.addEventListener('hashchange',function(){setTimeout(ensureLoadedWhenNeeded,20);});
    window.addEventListener('load',function(){setTimeout(ensureLoadedWhenNeeded,80);});
    setTimeout(ensureLoadedWhenNeeded,200);
  }
  function boot(){
    document.querySelectorAll('[data-updates-filter]').forEach(function(btn){btn.addEventListener('click',function(){setFilter(btn.getAttribute('data-updates-filter')||'all');});});
    var search=$('updatesSearch');
    if(search)search.addEventListener('input',function(){state.query=search.value;state.visible=9;render();});
    var sort=$('updatesSort');
    if(sort)sort.addEventListener('change',function(){state.sort=sort.value||'newest';state.visible=9;render();});
    var more=$('updatesLoadMore');
    if(more)more.addEventListener('click',function(){state.visible+=9;render();});
    setupCopyButtons();setupTickerClicks();updateFilters();updateMetrics();renderTicker();renderSummary(0,0);setupLazyLoad();
  }
  window.loadLatestUpdates=load; window.setUpdatesFilter=setFilter;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
