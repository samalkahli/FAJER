'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');const root=path.join(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');const S=require('../js/theme-schema');
test('theme rejects injected CSS, unsafe URLs, unknown keys and out-of-range values',()=>{
 for(const value of [{e_bgA:'red;display:none'},{e_logo:'javascript:alert(1)'},{e_logo:'data:text/html,test'},{e_logo:'assets/../../secret'},{e_radius:999},{motion:'true'},{unknown:1}])assert.throws(()=>S.normalize(value,true));
 const normalized=S.normalize({...S.defaults,title:'<script>alert(1)</script>'},true);assert.equal(normalized.title,'<script>alert(1)</script>');
 assert.ok(S.validURL('assets/lavinta-logo.jpeg'));assert.ok(S.validURL('https://i.ibb.co/logo.png'));
});
function apiMock(){let data=null,writes=0;const ref={get:async()=>({exists:!!data,data:()=>data})};const db={collection:name=>{assert.equal(name,'_siteSettings');return {doc:id=>{assert.equal(id,'theme');return ref;}};},runTransaction:async cb=>cb({get:ref.get,set:(r,v)=>{data=v;writes++;}})};
 const json=(res,status,body)=>{res.statusCode=status;res.body=body;};const auth={getDatabase:()=>db,json,authorize:async(req,res)=>{if(req.headers.authorization!=='Bearer admin'){json(res,403,{error:'denied'});return null;}return{uid:'owner'};}};
 const context={module:{exports:{}},require:n=>n.includes('theme-schema')?S:auth,Buffer,console};vm.runInNewContext(read('api/theme.js'),context);
 return{handler:context.module.exports,writes:()=>writes};}
function response(){return{statusCode:200,setHeader(){},end(text){this.body=JSON.parse(text);}};}
test('public theme returns defaults; only authorized valid saves persist; stale saves conflict',async()=>{
 const api=apiMock();let res=response();await api.handler({method:'GET',headers:{}},res);assert.equal(res.body.version,0);assert.equal(res.body.theme.title,S.defaults.title);
 res=response();await api.handler({method:'POST',headers:{},body:{theme:S.defaults,version:0}},res);assert.equal(res.statusCode,403);assert.equal(api.writes(),0);
 res=response();await api.handler({method:'POST',headers:{authorization:'Bearer admin'},body:{theme:{e_logo:'javascript:x'},version:0}},res);assert.equal(res.statusCode,400);assert.equal(api.writes(),0);
 res=response();await api.handler({method:'POST',headers:{authorization:'Bearer admin'},body:{theme:{...S.defaults,title:'تم الحفظ'},version:0}},res);assert.equal(res.body.version,1);assert.equal(api.writes(),1);
 res=response();await api.handler({method:'POST',headers:{authorization:'Bearer admin'},body:{theme:S.defaults,version:0}},res);assert.equal(res.statusCode,409);assert.equal(api.writes(),1);
 res=response();await api.handler({method:'GET',headers:{}},res);assert.equal(res.body.theme.title,'تم الحفظ');
});
test('public theme uses safe text and applies correct brand settings on navigation',async()=>{
 const dom=new JSDOM(read('index.html'),{url:'https://example.test/index.html',runScripts:'outside-only'}),w=dom.window;
 w.fetch=async()=>({ok:true,json:async()=>({theme:{...S.defaults,title:'<img onerror=alert(1)>',p_storeBg:'#123456',p_sectionTitle:'معرض الطباعة'}})});
 w.eval(read('js/theme-schema.js'));w.eval(read('js/theme-public.js'));await new Promise(r=>setTimeout(r,10));
 assert.equal(w.document.getElementById('gatewayTitle').textContent,'<img onerror=alert(1)>');assert.equal(w.document.querySelectorAll('#gatewayTitle img').length,0);
 w.document.body.dataset.mode='printing';await new Promise(r=>setTimeout(r,0));assert.equal(w.document.getElementById('mainSectionTitle').textContent,'معرض الطباعة');assert.equal(w.document.body.style.background,'rgb(18, 52, 86)');dom.window.close();
});
test('admin changes remain drafts until explicit save, persisted version is used',async()=>{
 const dom=new JSDOM(read('admin.html'),{url:'https://example.test/admin.html',runScripts:'outside-only'}),w=dom.window;const calls=[];
 w.confirm=()=>true;w.themeAdminReady=true;w.athntaAuth={currentUser:{getIdToken:async()=> 'admin'}};w.switchTab=()=>{};
 w.eval(read('js/ui.js'));w.eval(read('js/theme-schema.js'));
 w.fetch=async(url,options)=>{calls.push({url,options});return{status:200,ok:true,headers:{get:()=> 'application/json'},json:async()=>options.method==='POST'?{theme:JSON.parse(options.body).theme,version:3}:{theme:S.defaults,version:2}};};
 w.eval(read('js/theme-admin.js'));w.document.getElementById('btnThemeTab').click();await new Promise(r=>setTimeout(r,5));
 const input=w.document.getElementById('theme-title');input.value='مسودة جديدة';input.dispatchEvent(new w.Event('input'));
 assert.equal(calls.filter(c=>c.options.method==='POST').length,0);
 w.document.getElementById('themeSave').click();await new Promise(r=>setTimeout(r,5));const post=calls.find(c=>c.options.method==='POST');assert.equal(JSON.parse(post.options.body).version,2);assert.equal(JSON.parse(post.options.body).theme.title,'مسودة جديدة');
 assert.ok(w.document.getElementById('themeStatus').textContent.includes('تم حفظ'));dom.window.close();
});
