/* MAEN_UPDATES_SIMPLE_NEWS_ONLY_V2_2026_06_03 */
(function(){
  'use strict';
  var state={items:[],loaded:false,loading:false,error:false};
  var hiddenWords=['كاش','أداء','سرعة الصفحة','خفيف','خفيفة','سياسة نشر','سياسة تحريرية','منع تكرار','جودة النتائج','تحسين واجهة','استضافة','Cloudflare','Netlify','GitHub','JSON'];

  function $(id){return document.getElementById(id);}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function dateValue(v){var n=Date.parse(v||'');return Number.isFinite(n)?n:0;}
  function dateText(v){
    if(!v)return '';
    try{return new Intl.DateTimeFormat('ar-JO',{dateStyle:'medium'}).format(new Date(v));}
    catch(e){return String(v).slice(0,10);}
  }
  function cleanText(v){
    return String(v||'')
      .replace(/تلميح\s*(?:الترددات|قمر|سريع|مراجعة)?\s*:?/g,'')
      .replace(/الخلاصة\s*:?/g,'')
      .replace(/داخل محرك البحث/g,'')
      .replace(/نظام التحديث اليومي/g,'فريق المتابعة')
      .replace(/GitHub Actions|Cloudflare|Netlify|JSON|frequency-data\.json/gi,'')
      .replace(/\s{2,}/g,' ')
      .trim();
  }
  function looksLikePublicNews(item){
    var text=[item.title,item.summary,item.status,(item.tags||[]).join(' '),(item.sources||[]).map(function(s){return typeof s==='string'?s:(s&&s.name)||'';}).join(' ')].join(' ');
    if(hiddenWords.some(function(w){return text.indexOf(w)!==-1;}))return false;
    if(item.category==='alert' && !/تردد|قناة|قمر|بث|رياضي|Sports|ON/i.test(text))return false;
    return true;
  }
  function normalizeNewsItem(item,index){
    var title=cleanText(item.title||'خبر جديد');
    var summary=cleanText(item.summary||'');
    if(!summary)summary='تم نشر خبر جديد ضمن آخر تحديثات الترددات والقنوات.';
    return {
      id:String(item.id||('news-'+index)),
      title:title,
      summary:summary,
      date:item.date||item.updatedAt||new Date().toISOString(),
      _time:dateValue(item.date||item.updatedAt)
    };
  }
  function cleanItems(items){
    var seen={};
    return (items||[])
      .filter(function(item){return item&&item.title;})
      .filter(looksLikePublicNews)
      .map(normalizeNewsItem)
      .filter(function(item){
        var key=[item.title,item.summary].join('|');
        if(seen[key])return false;
        seen[key]=1;
        return true;
      })
      .sort(function(a,b){return b._time-a._time;});
  }
  function renderCard(item){
    return '<article class="updates-simple-card">'
      +'<time datetime="'+esc(item.date)+'">'+esc(dateText(item.date))+'</time>'
      +'<h3>'+esc(item.title)+'</h3>'
      +'<p>'+esc(item.summary)+'</p>'
      +'</article>';
  }
  function render(){
    var grid=$('updatesGrid'),empty=$('updatesEmpty');
    if(!grid)return;
    if(state.loading&&!state.items.length){
      grid.innerHTML='<article class="updates-simple-card updates-simple-loading"><time>...</time><h3>جاري تحميل الأخبار...</h3><p>سيظهر موجز آخر التحديثات بعد لحظات.</p></article>';
      if(empty)empty.classList.remove('active');
      return;
    }
    grid.innerHTML=state.items.map(renderCard).join('');
    if(empty){
      empty.textContent=state.error?'تعذر تحميل الأخبار مؤقتًا.':'لا توجد أخبار جديدة حاليًا.';
      empty.classList.toggle('active',!state.items.length);
    }
  }
  async function load(){
    if(state.loaded||state.loading)return;
    var grid=$('updatesGrid'); if(!grid)return;
    state.loading=true;state.error=false;render();
    try{
      var res=await fetch('updates/latest-updates.json',{cache:'default'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      var data=await res.json();
      state.items=cleanItems(data.items||[]);
      state.loaded=true;
    }catch(e){
      state.error=true;
      state.items=[];
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
      },{root:null,rootMargin:'160px'});
      obs.observe(section);
    }
    var original=window.showPage;
    if(typeof original==='function'&&!original.__updatesSimpleNewsWrapped){
      var wrapped=function(id){var out=original.apply(this,arguments);if(id==='updates')load();return out;};
      wrapped.__updatesSimpleNewsWrapped=true;
      window.showPage=wrapped;
    }
    window.addEventListener('hashchange',function(){setTimeout(ensureLoadedWhenNeeded,20);});
    window.addEventListener('load',function(){setTimeout(ensureLoadedWhenNeeded,80);});
    setTimeout(ensureLoadedWhenNeeded,200);
  }
  function boot(){setupLazyLoad();}
  window.loadLatestUpdates=load;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
