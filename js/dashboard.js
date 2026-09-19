(function(){
 'use strict';
 const $=id=>document.getElementById(id),U=window.StoreUI,db=window.athntaDb;
 if(!$('dashboardTab'))return;
 const brands={embroidery:'ATHNTA · التطريز',printing:'LAVINTA · الطباعة'};
 const collections={embroidery:['categories','products','reviews'],printing:['printCategories','printProducts','printReviews']};
 const states={},unsubscribers=[];let liveGeneration=0,tab='dashboardTab',lastUpdate=0,contentTimer,reportData=null,reportBusy=false,reportTicket=0,reportController=null;
 const number=n=>n==null?'—':new Intl.NumberFormat('ar-SA').format(n);
 const date=n=>n?new Date(n).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'}):'غير مسجل';
 const timestamp=r=>{const t=r.timestamp;if(!t)return 0;const n=typeof t.toMillis==='function'?t.toMillis():typeof t.seconds==='number'?t.seconds*1000:0;return Number.isFinite(n)&&n>0?n:0;};
 const node=(tag,cls,text)=>U.node(tag,cls||'',text==null?'':String(text));
 const selected=id=>$(id).value==='all'?Object.keys(brands):[$(id).value];
 const available=store=>['cats','products','reviews'].every(k=>states[store]?.[k]!==undefined);
 function empty(target,text){$(target).replaceChildren(node('p','empty-state',text));}
 function metric(target,label,value,detail,accent=''){
  const card=node('article','metric-card '+accent);card.append(node('span','metric-label',label),node('strong','metric-value',number(value)),node('small','muted',detail));$(target).append(card);
 }
 function table(target,headers,rows){
  if(!rows.length){empty(target,'لا توجد بيانات لهذا الاختيار');return;}
  const wrap=node('div','table-scroll'),t=node('table','data-table'),head=node('thead'),tr=node('tr');headers.forEach(v=>tr.append(node('th','',v)));head.append(tr);t.append(head);
  const body=node('tbody');rows.forEach(values=>{const row=node('tr');values.forEach(v=>row.append(node('td','',v)));body.append(row);});t.append(body);wrap.append(t);$(target).replaceChildren(wrap);
 }
 function inventory(stores){return stores.flatMap(store=>(states[store]?.products||[]).map(p=>({...p,store})));}
 function health(store){const s=states[store],ids=new Set(s.cats.map(c=>c.id));return{orphan:s.products.filter(p=>!ids.has(p.mainCategory)).length,missing:s.products.filter(p=>!U.images(p).length).length,empty:s.cats.filter(c=>!s.products.some(p=>p.mainCategory===c.id)).length};}
 function renderContent(){
  const stores=selected('dashStore'),loaded=stores.every(available);$('contentMetrics').replaceChildren();
  if(!loaded){['المنتجات','التصنيفات','التقييمات','صور المنتجات'].forEach(l=>metric('contentMetrics',l,null,'بانتظار بيانات موثوقة'));['storeComparison','contentHealth','recentProducts','categoryBars'].forEach(id=>empty(id,'جاري تحميل البيانات أو إعادة الاتصال…'));renderContentReport();return;}
  const products=inventory(stores),cats=stores.flatMap(s=>states[s].cats),reviews=stores.flatMap(s=>states[s].reviews);
  metric('contentMetrics','المنتجات',products.length,'أعمال منشورة في النطاق المختار','mint');metric('contentMetrics','التصنيفات',cats.length,'تصنيفات رئيسية');metric('contentMetrics','التقييمات',reviews.length,'صور آراء العملاء');metric('contentMetrics','صور المنتجات',products.reduce((n,p)=>n+U.images(p).length,0),'إجمالي الصور المرتبطة بالمنتجات');
  table('storeComparison',['المعرض','منتجات','تصنيفات','تقييمات'],stores.map(s=>[brands[s],number(states[s].products.length),number(states[s].cats.length),number(states[s].reviews.length)]));
  const totals=stores.map(health).reduce((a,b)=>({orphan:a.orphan+b.orphan,missing:a.missing+b.missing,empty:a.empty+b.empty}),{orphan:0,missing:0,empty:0});
  $('contentHealth').replaceChildren();for(const [k,label]of [['orphan','منتجات مرتبطة بقسم غير موجود'],['missing','منتجات بدون صور صالحة للعرض'],['empty','تصنيفات بدون منتجات']]){const row=node('div','health-row');row.append(node('span','',label),node('strong',totals[k]?'warning':'success',number(totals[k])));$('contentHealth').append(row);}
  if(!products.length)empty('recentProducts','أضف أول منتج ليظهر هنا');else{
   const sorted=[...products].sort((a,b)=>timestamp(b)-timestamp(a)).slice(0,8);$('recentProducts').replaceChildren(...sorted.map(p=>{const card=node('article','recent-card');card.append(U.img(U.images(p)[0],p.name||'منتج'),node('small','muted',brands[p.store]),node('strong','',p.name||'بدون اسم'),node('span','muted',p.mainCategory||'بدون قسم'),node('small','muted',date(timestamp(p))));return card;}));
  }
  const counts=new Map();products.forEach(p=>{const key=brands[p.store]+' / '+(p.mainCategory||'بدون قسم');counts.set(key,(counts.get(key)||0)+1);});
  bars('categoryBars',[...counts].sort((a,b)=>b[1]-a[1]),'لا توجد منتجات بعد');renderContentReport();
 }
 function bars(target,values,message){
  if(!values.length){empty(target,message);return;}const max=Math.max(1,...values.map(v=>v[1]));$(target).replaceChildren(...values.map(([label,n])=>{const row=node('div','bar-row'),track=node('div','bar-track'),fill=node('div','bar-fill');fill.style.width=(n/max*100)+'%';track.append(fill);row.append(node('span','',label),node('strong','',number(n)),track);return row;}));
 }
 function renderContentReport(){
  const stores=selected('reportStore');$('contentExport').disabled=!stores.every(available);
  if(!stores.every(available)){empty('contentReport','التقرير ينتظر اكتمال بيانات المحتوى');return;}
  const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-Number($('reportDays').value)+1);
  table('contentReport',['المعرض','كل المنتجات','أضيفت خلال الفترة','بلا تاريخ','التصنيفات','التقييمات'],stores.map(s=>{const p=states[s].products;return[brands[s],number(p.length),number(p.filter(r=>timestamp(r)>=start.getTime()).length),number(p.filter(r=>!timestamp(r)).length),number(states[s].cats.length),number(states[s].reviews.length)];}));
 }
 function stopLive(){++liveGeneration;unsubscribers.splice(0).forEach(fn=>fn());clearTimeout(contentTimer);}
 function startLive(force=false){
  if(!window.themeAdminReady||document.hidden||!['dashboardTab','reportsTab'].includes(tab))return;
  if(unsubscribers.length&&!force)return;stopLive();const generation=liveGeneration;
  Object.keys(states).forEach(k=>delete states[k]);$('contentConnection').textContent='جاري الاتصال';renderContent();
  for(const [store,names]of Object.entries(collections)){
   states[store]={};names.forEach((name,i)=>{
    const key=['cats','products','reviews'][i];
    const off=db.collection(name).onSnapshot({includeMetadataChanges:true},snap=>{
     if(generation!==liveGeneration)return;
     states[store][key]=snap.docs.map(d=>({...d.data(),id:d.id}));states[store][key+'Cache']=!!snap.metadata?.fromCache;
     delete states[store][key+'Error'];lastUpdate=Date.now();
     const all=Object.keys(brands).every(available),cached=Object.values(states).some(s=>['cats','products','reviews'].some(k=>s[k+'Cache']));
     const failed=Object.values(states).some(s=>Object.keys(s).some(k=>k.endsWith('Error')));
     $('contentConnection').textContent=failed?'بعض البيانات غير متاحة':!all?'جاري تحميل المحتوى':cached?'بيانات مخزنة · بانتظار الخادم':'متصل · تحديث مباشر';
     $('contentUpdated').textContent='آخر استلام: '+date(lastUpdate);clearTimeout(contentTimer);contentTimer=setTimeout(renderContent,80);
    },()=>{if(generation!==liveGeneration)return;delete states[store][key];states[store][key+'Error']=true;$('contentConnection').textContent='تعذر الاتصال ببعض البيانات';$('contentUpdated').textContent='تحقق من الاتصال وصلاحيات Firestore ثم اضغط تحديث';renderContent();});
    unsubscribers.push(off);
   });
  }
 }
 function clearReports(message){$('analyticsMetrics').replaceChildren();['المستخدمون','مرات الدخول','ضغطات واتساب','النشطون خلال 30 دقيقة'].forEach(l=>metric('analyticsMetrics',l,null,'غير متاح حاليًا'));['trafficChart','analyticsStores','analyticsSources','analyticsItems'].forEach(id=>empty(id,message));$('reportExport').disabled=true;}
 const event=(name)=>reportData?.events?.find(r=>r.eventName===name)||{eventCount:0,totalUsers:0};
 function renderReports(){
  renderContentReport();if(!reportData||reportData.status!=='connected'){clearReports('لا توجد بيانات زيارات متاحة حاليًا');return;}
  const stores=selected('reportStore'),all=$('reportStore').value==='all',eventsOK=Array.isArray(reportData.events),total=reportData.totals?.[0]||{},rt=reportData.realtime?.[0];
  $('analyticsMetrics').replaceChildren();metric('analyticsMetrics',all?'مستخدمو الموقع':'مستخدمو دخول المعرض',all?(reportData.totals?total.totalUsers||0:null):(eventsOK?event('visit_'+stores[0]).totalUsers:null),all?'مستخدمون خلال الفترة':'نفذوا حدث دخول هذا المعرض','mint');
  metric('analyticsMetrics','مرات الدخول للمعارض',eventsOK?stores.reduce((n,s)=>n+event('visit_'+s).eventCount,0):null,'الرجوع من المنتجات لا يعد دخولًا جديدًا');
  metric('analyticsMetrics','ضغطات واتساب',eventsOK?stores.reduce((n,s)=>n+event('whatsapp_'+s).eventCount,0):null,'اهتمام بالطلب · ليست مبيعات');
  metric('analyticsMetrics','النشطون خلال 30 دقيقة',reportData.realtime?rt?.activeUsers||0:null,'للموقع كله · لا يتأثر بفلتر المعرض');
  if(eventsOK)table('analyticsStores',['المعرض','مرات الدخول','مستخدمو الدخول','واتساب'],stores.map(s=>[brands[s],number(event('visit_'+s).eventCount),number(event('visit_'+s).totalUsers),number(event('whatsapp_'+s).eventCount)]));else empty('analyticsStores','تعذر جلب تقرير الأحداث');
  if(reportData.sources)bars('analyticsSources',reportData.sources.map(r=>[r.sessionSourceMedium,r.sessions]),'لا توجد مصادر زيارات خلال الفترة');else empty('analyticsSources','تعذر جلب المصادر');
  if(reportData.items)table('analyticsItems',['المنتج','العلامة','مرات المشاهدة'],reportData.items.filter(r=>all||r.itemBrand===(stores[0]==='embroidery'?'ATHNTA':'LAVINTA')).map(r=>[r.itemName,r.itemBrand,number(r.itemsViewed)]));else empty('analyticsItems','تعذر جلب مشاهدات المنتجات');
  if(reportData.daily){
   const daily=new Map();reportData.daily.filter(r=>stores.some(s=>r.eventName==='visit_'+s)).forEach(r=>daily.set(r.date,(daily.get(r.date)||0)+r.eventCount));
   const values=[...daily].sort((a,b)=>a[0].localeCompare(b[0]));
   if(!values.length)empty('trafficChart','لم تُسجل أحداث دخول خلال الفترة');else{
    const max=Math.max(1,...values.map(v=>v[1]));$('trafficChart').replaceChildren(...values.map(([d,n])=>{const label=d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6),bar=node('div','day-bar');bar.tabIndex=0;bar.title=label+': '+number(n)+' دخول';bar.setAttribute('aria-label',bar.title);const fill=node('span','day-fill');fill.style.height=Math.max(2,n/max*160)+'px';bar.append(node('small','',number(n)),fill,node('small','',d.slice(6)+'/'+d.slice(4,6)));return bar;}));
   }
  }else empty('trafficChart','تعذر جلب التقرير اليومي');
  $('reportExport').disabled=false;
 }
 async function loadReports(){
  if(!window.themeAdminReady||tab!=='reportsTab'||document.hidden)return;
  const ticket=++reportTicket;reportController?.abort();reportController=new AbortController();const controller=reportController;
  reportBusy=true;$('reportRefresh').disabled=true;$('reportStatus').textContent='جاري جلب التقارير من Google…';reportData=null;clearReports('جاري تحميل الفترة المختارة…');
  const timeout=setTimeout(()=>controller.abort(),25000);
  try{
   const token=await window.athntaAuth.currentUser.getIdToken();
   if(ticket!==reportTicket)return;
   const response=await fetch('/api/admin-reports?days='+$('reportDays').value,{headers:{Authorization:'Bearer '+token},signal:controller.signal,cache:'no-store'});
   const result=await response.json();if(ticket!==reportTicket)return;
   if(!response.ok)throw Error(result.error||'تعذر تحميل التقرير');
   reportData=result;$('analyticsSetup').hidden=result.status!=='setup_required';
   $('reportStatus').textContent=result.status==='setup_required'?result.message:'آخر جلب: '+date(result.updatedAt)+(Object.keys(result.errors||{}).length?' · بعض التقارير غير متاحة':' · التقارير اليومية تخضع لتأخير معالجة Google');renderReports();
  }catch(e){if(ticket!==reportTicket)return;reportData=null;$('reportStatus').textContent=e.name==='AbortError'?'انتهت مهلة الاتصال. اضغط تحديث للمحاولة مجددًا.':e.message;clearReports('تعذر جلب الإحصائيات. لم نعرض أرقامًا تقديرية.');}
  finally{clearTimeout(timeout);if(ticket===reportTicket){reportBusy=false;$('reportRefresh').disabled=false;}}
 }
 function csv(filename,rows){
  const cell=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const blob=new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 $('btnDashboardTab').addEventListener('click',e=>window.switchTab(e,'dashboardTab'));$('btnReportsTab').addEventListener('click',e=>window.switchTab(e,'reportsTab'));
 $('quickProducts').addEventListener('click',()=>window.switchTab(null,'productsTab'));
 $('managementRefresh').addEventListener('click',()=>window.refreshAdminData?.());
 $('dashStore').addEventListener('change',renderContent);$('contentRefresh').addEventListener('click',()=>startLive(true));
 $('reportStore').addEventListener('change',()=>{renderReports();renderContentReport();});$('reportDays').addEventListener('change',()=>{renderContentReport();loadReports();});$('reportRefresh').addEventListener('click',loadReports);
 $('reportPrint').addEventListener('click',()=>window.print());
 $('contentExport').addEventListener('click',()=>{const stores=selected('reportStore');if(!stores.every(available))return;csv('products-report.csv',[['المعرض','معرف المنتج','الاسم','التصنيف','الفرعي','عدد الصور','تاريخ الإضافة'],...inventory(stores).map(p=>[brands[p.store],p.id,p.name,p.mainCategory,p.subCategory,U.images(p).length,date(timestamp(p))])]);});
 $('reportExport').addEventListener('click',()=>{if(!reportData||reportData.status!=='connected')return;const stores=selected('reportStore');csv('analytics-report.csv',[['الفترة بالأيام',reportData.days],['تاريخ الجلب',date(reportData.updatedAt)],['المعرض','مرات الدخول','مستخدمو الدخول','ضغطات واتساب'],...stores.map(s=>[brands[s],reportData.events?event('visit_'+s).eventCount:'غير متاح',reportData.events?event('visit_'+s).totalUsers:'غير متاح',reportData.events?event('whatsapp_'+s).eventCount:'غير متاح']),[],['اليوم','الحدث','العدد'],...(reportData.daily||[]).filter(r=>stores.some(s=>r.eventName.endsWith(s))).map(r=>[r.date,r.eventName,r.eventCount])]);});
 function search(){const term=$('adminProductSearch').value.trim().toLocaleLowerCase();for(const card of $('productsList').querySelectorAll('.list-item'))card.hidden=!card.dataset.search.includes(term);for(const box of $('productsList').querySelectorAll('.accordion-content')){const shown=[...box.querySelectorAll('.list-item')].some(n=>!n.hidden);box.parentElement.hidden=!shown;if(term)box.classList.toggle('open',shown);}}
 $('adminProductSearch').addEventListener('input',search);window.addEventListener('admin-list-rendered',search);
 window.addEventListener('admin-tab-change',e=>{tab=e.detail.id;if(['dashboardTab','reportsTab'].includes(tab))startLive();else stopLive();if(tab==='reportsTab')loadReports();else{++reportTicket;reportController?.abort();reportBusy=false;$('reportRefresh').disabled=false;}});
 window.addEventListener('theme-admin-ready',()=>{startLive();if(tab==='reportsTab')loadReports();});
 window.addEventListener('admin-signed-out',()=>{stopLive();++reportTicket;reportController?.abort();reportData=null;Object.keys(states).forEach(k=>delete states[k]);renderContent();clearReports('بانتظار التحقق من الحساب');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopLive();++reportTicket;reportController?.abort();reportBusy=false;}else{startLive();if(tab==='reportsTab')loadReports();}});
 window.addEventListener('pagehide',()=>{stopLive();reportController?.abort();});
 setInterval(()=>{if(tab==='reportsTab'&&!document.hidden&&$('reportAuto').checked&&!reportBusy&&reportData?.status!=='setup_required')loadReports();},60000);
 renderContent();clearReports('افتح التقارير لعرض الإحصائيات');if(window.themeAdminReady)startLive();
})();
