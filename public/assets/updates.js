/* MAEN_PROFESSIONAL_LATEST_UPDATES_SECTION_2026_05_29 */
(function(){
  'use strict';
  var state={items:[],category:'all',query:''};
  var labels={all:'الكل',frequency:'ترددات',satellite:'أقمار',channels:'قنوات',sports:'رياضة',alert:'تنبيهات',report:'بلاغات'};
  var icons={frequency:'📡',satellite:'🛰️',channels:'📺',sports:'⚽',alert:'⚠️',report:'📝'};
  function $(id){return document.getElementById(id);}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function norm(v){return String(v||'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').trim();}
  function dateText(v){
    if(!v)return'';
    try{return new Intl.DateTimeFormat('ar-JO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}
    catch(e){return String(v).slice(0,16);}
  }
  function sourceTags(sources){
    return (sources||[]).slice(0,4).map(function(s){
      var text=typeof s==='string'?s:(s.name||s.url||'مصدر موثوق');
      return '<span class="update-source">'+esc(text)+'</span>';
    }).join('');
  }
  function detailRow(label,value){
    if(!value)return'';
    return '<div class="update-detail"><b>'+esc(label)+'</b>'+esc(value)+'</div>';
  }
  function detailsHtml(item){
    var html='';
    html+=detailRow('القمر',item.satellite);
    var freq=[item.oldFrequency,item.frequency].filter(Boolean).join(' → ');
    html+=detailRow('التردد',freq);
    html+=detailRow('الاستقطاب',item.polarity);
    html+=detailRow('SR',item.symbolRate);
    html+=detailRow('الحالة',item.status);
    return html;
  }
  function match(item){
    var c=state.category==='all'||item.category===state.category;
    var q=norm(state.query);
    if(!q)return c;
    var hay=norm([item.title,item.summary,item.satellite,item.frequency,item.oldFrequency,item.status,(item.tags||[]).join(' ')].join(' '));
    return c&&hay.indexOf(q)!==-1;
  }
  function updateMetrics(items){
    var count=$('updatesCount'),updated=$('updatesUpdatedAt'),important=$('updatesImportantCount'),freq=$('updatesFrequencyCount');
    if(count)count.textContent=String(items.length);
    if(important)important.textContent=String(items.filter(function(x){return x.important;}).length);
    if(freq)freq.textContent=String(items.filter(function(x){return x.category==='frequency';}).length);
    if(updated){
      var newest=items[0]&&(items[0].date||items[0].updatedAt);
      updated.textContent=newest?dateText(newest):'جاهز';
    }
  }
  function render(){
    var grid=$('updatesGrid'),empty=$('updatesEmpty');
    if(!grid)return;
    var filtered=state.items.filter(match);
    grid.innerHTML=filtered.map(function(item){
      var cat=item.category||'report';
      var badge=labels[cat]||cat;
      return '<article class="update-card category-'+esc(cat)+' '+(item.important?'important':'')+'">'
        +'<div class="meta"><span class="update-badge '+esc(cat)+'" data-icon="'+esc(icons[cat]||'•')+'">'+esc(badge)+'</span><span class="update-date">'+esc(dateText(item.date||item.updatedAt))+'</span></div>'
        +'<h3>'+esc(item.title)+'</h3>'
        +'<p>'+esc(item.summary)+'</p>'
        +'<div class="update-details">'+detailsHtml(item)+'</div>'
        +'<div class="update-sources">'+sourceTags(item.sources)+'</div>'
        +'</article>';
    }).join('');
    if(empty){
      empty.innerHTML=state.query||state.category!=='all'
        ? 'لا توجد تحديثات مطابقة للبحث أو الفلتر الحالي.'
        : 'لا توجد تحديثات جديدة حاليًا. آخر فحص تم بنجاح، وسيتم عرض أي تغييرات جديدة فور توفرها.';
      empty.classList.toggle('active',!filtered.length);
    }
    updateMetrics(state.items);
  }
  function setFilter(cat){
    state.category=cat;
    document.querySelectorAll('[data-updates-filter]').forEach(function(btn){btn.classList.toggle('active',btn.getAttribute('data-updates-filter')===cat);});
    render();
  }
  function cleanItems(items){
    return (items||[]).filter(function(item){return item&&item.title;}).map(function(item){
      var copy=Object.assign({},item);
      copy.title=String(copy.title||'تحديث جديد').replace(/GitHub Actions|Cloudflare|Netlify|JSON|frequency-data\.json/gi,'').trim()||'تحديث جديد';
      copy.summary=String(copy.summary||'').replace(/GitHub Actions/gi,'نظام التحديث اليومي').replace(/Cloudflare|Netlify|JSON|frequency-data\.json/gi,'').replace(/\s{2,}/g,' ').trim();
      copy.status=String(copy.status||'').replace(/GitHub Actions/gi,'تحديث يومي').replace(/Cloudflare|Netlify|JSON|frequency-data\.json/gi,'').trim();
      copy.sources=(copy.sources||[]).map(function(s){
        if(typeof s!=='string')return s;
        return s.replace(/GitHub Actions/gi,'نظام التحديث اليومي').replace(/frequency-data\.json/gi,'قاعدة الترددات').replace(/Cloudflare|Netlify|JSON/gi,'').trim();
      }).filter(Boolean);
      return copy;
    });
  }
  async function load(){
    var grid=$('updatesGrid');
    if(!grid)return;
    try{
      var res=await fetch('updates/latest-updates.json',{cache:'no-cache'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      var data=await res.json();
      state.items=cleanItems(data.items||[]).sort(function(a,b){return String(b.date||b.updatedAt||'').localeCompare(String(a.date||a.updatedAt||''));});
      render();
    }catch(e){
      state.items=[{category:'alert',important:true,date:new Date().toISOString(),title:'آخر التحديثات غير متاحة مؤقتًا',summary:'الموقع يعمل بشكل طبيعي، وسيتم عرض آخر تغييرات الترددات والقنوات فور عودة ملف التحديثات.',status:'تنبيه مؤقت',sources:['إدارة الموقع']}];
      render();
    }
  }
  function endpoint(){if(window.MAEN_REPORT_ENDPOINT)return window.MAEN_REPORT_ENDPOINT; if(location.hostname.indexOf('pages.dev')>-1)return '/api/submit-report'; return 'https://maensat.pages.dev/api/submit-report';}
  async function submitReport(ev){
    ev.preventDefault();
    var form=ev.currentTarget,status=$('visitorReportStatus');
    if(status){status.textContent='جارٍ إرسال البلاغ...';status.className='report-status';}
    var fd=new FormData(form);
    var payload={type:fd.get('type'),title:fd.get('title'),details:fd.get('details'),contact:fd.get('contact'),page:location.pathname+location.search+location.hash,referrer:document.referrer||'',ts:new Date().toISOString()};
    try{
      var res=await fetch(endpoint(),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      var json=await res.json().catch(function(){return{};});
      if(!res.ok||json.ok===false)throw new Error(json.error||('HTTP '+res.status));
      form.reset();
      if(status){status.textContent='تم استلام البلاغ. سيتم مراجعته قبل اعتماد أي تحديث على الموقع.';status.className='report-status ok';}
    }catch(e){
      if(status){status.textContent='لم يتم إرسال البلاغ حاليًا. جرّب لاحقًا أو تواصل عبر واتساب.';status.className='report-status error';}
    }
  }
  function boot(){
    document.querySelectorAll('[data-updates-filter]').forEach(function(btn){btn.addEventListener('click',function(){setFilter(btn.getAttribute('data-updates-filter')||'all');});});
    var search=$('updatesSearch');
    if(search)search.addEventListener('input',function(){state.query=search.value;render();});
    var form=$('visitorReportForm');
    if(form)form.addEventListener('submit',submitReport);
    load();
  }
  window.loadLatestUpdates=load; window.setUpdatesFilter=setFilter;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
