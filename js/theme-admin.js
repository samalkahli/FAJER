(function(){
'use strict';
const S=window.ThemeSchema,$=id=>document.getElementById(id),U=window.StoreUI;
let draft=S.normalize(S.defaults),saved={...draft},version=0,loaded=false,busy=false,dirty=false,previewMode='gateway';
let undo=[],redo=[],timer;
const inputs=new Map();
const labels={linear:'خطي',radial:'دائري',background:'خلفية الشريحة',box:'داخل مربع',plain:'شعار بدون مربع',contain:'كامل بدون قص',cover:'ملء المساحة مع القص',center:'وسط',right:'يمين',left:'يسار'};
function status(message){$('themeStatus').textContent=message;}
function controls(){ $('themeSave').disabled=busy||!loaded||!window.themeAdminReady;for(const el of $('themeTab').querySelectorAll('button,input,select'))if(el.id!=='themeSave')el.disabled=busy; }
function sync(){for(const [key,input]of inputs){const f=S.fields.find(f=>f.key===key);if(f.type==='boolean')input.checked=draft[key];else input.value=draft[key];const out=$('out-'+key);if(out)out.textContent=draft[key];}send();}
function send(){const frame=$('themePreview');if(frame.contentWindow)frame.contentWindow.postMessage({type:'FAJER_THEME_PREVIEW',theme:draft,mode:previewMode},location.origin);}
function changed(){dirty=JSON.stringify(draft)!==JSON.stringify(saved);status(dirty?'معاينة فقط — لديك تغييرات غير محفوظة':'مطابق للثيم المحفوظ');clearTimeout(timer);timer=setTimeout(send,50);try{localStorage.setItem('fajer-theme-draft',JSON.stringify(draft));}catch{}}
function checkpoint(){undo.push({...draft});if(undo.length>40)undo.shift();redo=[];}
function setDraft(value){checkpoint();draft=S.normalize(value,true);sync();changed();}
async function load(){
 if(busy)return;if(dirty&&!confirm('إلغاء التعديلات الحالية وإعادة تحميل المحفوظ؟'))return;
 busy=true;controls();status('جاري تحميل الثيم المحفوظ...');
 try{const data=await U.fetchJSON('/api/theme');draft=S.normalize(data.theme,true);saved={...draft};version=data.version;loaded=true;dirty=false;undo=[];redo=[];sync();status('تم تحميل الثيم — التعديلات تظهر للزوار بعد الحفظ');}
 catch(e){status(e.message+' يمكنك المعاينة، لكن الحفظ متوقف حتى تحميل النسخة الحالية.');}
 finally{busy=false;controls();}
}
async function upload(file,key){
 if(busy||!window.themeAdminReady)return;
 if(!file||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>4*1024*1024){status('اختر PNG أو JPG أو WebP أو GIF بحجم لا يتجاوز 4 ميجابايت');return;}
 busy=true;controls();status('جاري رفع الشعار...');
 try{const token=await window.athntaAuth.currentUser.getIdToken();const body=new FormData();body.append('image',file,file.name);const data=await U.fetchJSON('/api/upload-image',{method:'POST',headers:{Authorization:'Bearer '+token},body},45000);if(!S.validURL(data.url))throw Error('رابط غير صالح');checkpoint();draft[key]=data.url;sync();changed();status('تم رفع الشعار. اضغط حفظ الثيم لتطبيقه على الموقع.');}
 catch(e){status(e.message);}finally{busy=false;controls();}
}
function build(){
 const groups=new Map();
 for(const f of S.fields){
  if(!groups.has(f.group)){const section=document.createElement('details');section.open=groups.size===0;const title=U.node('summary','',f.group);section.append(title);const grid=U.node('div','theme-fields');section.append(grid);$('themeFields').append(section);groups.set(f.group,grid);}
  const row=U.node('div','theme-field'),label=U.node('label','',f.label);label.htmlFor='theme-'+f.key;
  let input;
  if(f.type==='select'){input=document.createElement('select');f.options.forEach(v=>input.add(new Option(labels[v]||v,v)));}
  else{input=document.createElement('input');input.type=f.type==='boolean'?'checkbox':f.type==='number'?'range':f.type==='color'?'color':'text';if(f.type==='number'){input.min=f.min;input.max=f.max;input.step=1;}if(f.max&&f.type==='text')input.maxLength=f.max;if(f.type==='url')input.maxLength=1500;}
  input.id='theme-'+f.key;inputs.set(f.key,input);row.append(label,input);
  if(f.type==='number'){const out=U.node('output');out.id='out-'+f.key;out.htmlFor=input.id;row.append(out);}
  input.addEventListener('focus',()=>{input.dataset.before=JSON.stringify(draft);});
  input.addEventListener('input',()=>{const v=f.type==='boolean'?input.checked:f.type==='number'?Number(input.value):input.value;try{S.normalize({...draft,[f.key]:v},true);draft[f.key]=v;input.setCustomValidity('');const out=$('out-'+f.key);if(out)out.textContent=v;changed();}catch(e){input.setCustomValidity(e.message);status(e.message);}});
  input.addEventListener('change',()=>{if(input.dataset.before){undo.push(JSON.parse(input.dataset.before));if(undo.length>40)undo.shift();redo=[];delete input.dataset.before;}});
  if(f.type==='url'){const uploadInput=document.createElement('input');uploadInput.type='file';uploadInput.accept='image/png,image/jpeg,image/webp,image/gif';uploadInput.setAttribute('aria-label','رفع '+f.label);uploadInput.addEventListener('change',()=>{upload(uploadInput.files[0],f.key);uploadInput.value='';});row.append(uploadInput);}
  groups.get(f.group).append(row);
 }
 for(const s of S.backgrounds){
  const section=document.createElement('details');section.append(U.node('summary','','دمج ألوان: '+s.label));
  const grid=U.node('div','theme-fields');section.append(grid);groups.get(s.group).append(section);
  const keys=[s.first,s.second,s.enabled,s.angle,s.id+'Count',s.id+'Kind',s.id+'C',s.id+'D',...Array.from({length:4},(_,i)=>s.id+'Stop'+(i+1)),s.id+'X',s.id+'Y'];
  keys.forEach(key=>grid.append(inputs.get(key).parentElement));
  const add=U.node('button','','إضافة لون'),remove=U.node('button','','إزالة آخر لون');add.type=remove.type='button';grid.append(add,remove);
  const refresh=()=>{const count=Number(draft[s.id+'Count']);inputs.get(s.second).parentElement.hidden=!draft[s.enabled];for(let i=1;i<=4;i++){inputs.get(s.id+'Stop'+i).parentElement.hidden=!draft[s.enabled]||i>count;if(i>2)inputs.get(s.id+(i===3?'C':'D')).parentElement.hidden=!draft[s.enabled]||i>count;}add.disabled=busy||(draft[s.enabled]&&count===4);remove.disabled=busy||!draft[s.enabled];};
  add.addEventListener('click',()=>{checkpoint();if(!draft[s.enabled])draft[s.enabled]=true;else draft[s.id+'Count']=String(Math.min(4,Number(draft[s.id+'Count'])+1));const n=Number(draft[s.id+'Count']);for(let i=1;i<=n;i++)draft[s.id+'Stop'+i]=Math.round((i-1)*100/(n-1));sync();changed();});
  remove.addEventListener('click',()=>{checkpoint();const n=Number(draft[s.id+'Count']);if(n>2)draft[s.id+'Count']=String(n-1);else draft[s.enabled]=false;sync();changed();});
  grid.addEventListener('input',refresh);backgroundRefresh.push(refresh);
 }
 sync();
}
const backgroundRefresh=[];
const baseSync=sync;sync=function(){baseSync();backgroundRefresh.forEach(fn=>fn());};
build();
$('btnThemeTab').addEventListener('click',event=>{window.switchTab(event,'themeTab');if(!$('themePreview').getAttribute('src'))$('themePreview').src='index.html?themePreview=1';if(!loaded)load();});
$('themePreview').addEventListener('load',send);
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===$('themePreview').contentWindow&&event.data?.type==='FAJER_THEME_READY')send();});
$('themePreviewMode').addEventListener('change',event=>{previewMode=event.target.value;send();});
$('themePreviewSize').addEventListener('change',event=>{$('themePreviewWrap').dataset.size=event.target.value;});
$('themeSave').addEventListener('click',async()=>{
 if(busy||!loaded||!window.themeAdminReady)return;
 if(![...inputs.values()].every(el=>el.reportValidity()))return;
 busy=true;controls();status('جاري حفظ الثيم...');
 try{const theme=S.normalize(draft,true),token=await window.athntaAuth.currentUser.getIdToken();const data=await U.fetchJSON('/api/theme',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({theme,version})});saved=S.normalize(data.theme,true);draft={...saved};version=data.version;dirty=false;status('تم حفظ الثيم — يظهر للزوار عند فتح الصفحة أو تحديثها');try{localStorage.setItem('fajer-theme-v1',JSON.stringify({time:Date.now(),theme:saved}));localStorage.removeItem('fajer-theme-draft');}catch{}}
 catch(e){status(e.message);}finally{busy=false;controls();}
});
$('themeReload').addEventListener('click',load);
$('themeReset').addEventListener('click',()=>{if(confirm('استعادة التصميم الافتراضي في المعاينة؟ لن يتغير الموقع حتى تضغط حفظ.'))setDraft(S.defaults);});
$('themeUndo').addEventListener('click',()=>{if(!undo.length)return;redo.push({...draft});draft=undo.pop();sync();changed();});
$('themeRedo').addEventListener('click',()=>{if(!redo.length)return;undo.push({...draft});draft=redo.pop();sync();changed();});
$('themeDraft').addEventListener('click',()=>{try{const raw=localStorage.getItem('fajer-theme-draft');if(!raw)throw Error('لا توجد مسودة محلية');setDraft(JSON.parse(raw));}catch(e){status(e.message);}});
$('themeExport').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='fajer-theme.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('themeImport').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>30000)throw Error('ملف الثيم أكبر من الحد');setDraft(JSON.parse(await file.text()));}catch(e){status(e.message);}event.target.value='';});
$('themePreset').addEventListener('change',event=>{
 const v=event.target.value;if(!v)return;const t={...draft};
 if(v==='original'){for(const s of S.backgrounds)for(const key of [s.first,s.second,s.enabled,s.angle,s.id+'Count',s.id+'Kind',s.id+'C',s.id+'D',s.id+'X',s.id+'Y',...Array.from({length:4},(_,i)=>s.id+'Stop'+(i+1))])t[key]=S.defaults[key];for(const key of ['pageGlow','e_storeGlow','p_storeGlow','e_storeAccent','p_storeAccent'])t[key]=S.defaults[key];}
 if(v==='gold'){Object.assign(t,{pageA:'#050505',pageB:'#30251b',headingColor:'#fffaf5',e_borderColor:'#d4aa6d',p_borderColor:'#d4aa6d',e_buttonColor:'#d4aa6d',p_buttonColor:'#d4aa6d'});}
 if(v==='sand'){Object.assign(t,{pageA:'#5e4a3f',pageB:'#92715d',e_bgA:'#4b3930',p_bgA:'#755747',e_overlay:20,p_overlay:20});}
 if(v==='minimal'){Object.assign(t,{pageA:'#101010',pageB:'#101010',pageGradient:false,e_border:false,p_border:false,e_shadow:0,p_shadow:0,e_logoMode:'plain',p_logoMode:'plain'});}
 setDraft(t);event.target.value='';
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('theme-admin-ready',controls);controls();
})();
