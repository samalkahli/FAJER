'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('dashboard updates from snapshots, escapes names and disconnects on navigation',async()=>{
 const dom=new JSDOM(read('admin.html'),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.com/admin.html'}),w=dom.window;
 try{
 const listeners={},off=[];w.athntaDb={collection:name=>({onSnapshot(options,ok,error){listeners[name]={ok,error};return()=>off.push(name);}})};
 w.eval(read('js/ui.js'));w.themeAdminReady=true;w.eval(read('js/dashboard.js'));
 assert.equal(Object.keys(listeners).length,6);
 const send=(name,data)=>listeners[name].ok({docs:data.map(d=>({id:d.id,data:()=>d})),metadata:{fromCache:false}});
 Object.keys(listeners).forEach(name=>send(name,[]));
 send('categories',[{id:'قسم'}]);send('products',[{id:'p',name:'<img onerror=alert(1)>',mainCategory:'قسم',imageURLs:['https://example.com/a.png']}]);
 await new Promise(r=>setTimeout(r,100));
 assert.match(w.document.getElementById('recentProducts').textContent,/<img onerror/);
 assert.equal(w.document.querySelectorAll('[onerror]').length,0);
 assert.match(w.document.getElementById('contentConnection').textContent,/متصل/);
 send('products',[]);await new Promise(r=>setTimeout(r,100));assert.match(w.document.getElementById('recentProducts').textContent,/أول منتج/);
 listeners.products.error();assert.equal(w.document.getElementById('contentExport').disabled,true);
 w.dispatchEvent(new w.CustomEvent('admin-tab-change',{detail:{id:'productsTab'}}));assert.equal(off.length,6);
 send('products',[{id:'late',name:'late'}]);assert.ok(!w.document.getElementById('recentProducts').textContent.includes('late'));
 }finally{w.close();}
});
test('report API authorizes before setup, validates range, and caches only successful reports',async()=>{
 let allowed=false,calls=0;const env={GA4_PROPERTY_ID:'123'};
 const context={module:{exports:{}},process:{env},console,Date,Map,require(name){return name.includes('server-auth')?{authorize:async(req,res)=>{if(!allowed)res.status=401;return allowed;},json:(res,status,data)=>Object.assign(res,{status,data})}:{report:async()=>{calls++;return {status:'connected',updatedAt:Date.now()};}};}};
 vm.runInNewContext(read('api/admin-reports.js'),context);const handler=context.module.exports;
 let res={};await handler({method:'GET',query:{}},res);assert.equal(res.status,401);assert.equal(calls,0);
 allowed=true;env.GA4_PROPERTY_ID='';res={};await handler({method:'GET',query:{}},res);assert.equal(res.data.status,'setup_required');
 env.GA4_PROPERTY_ID='123';res={};await handler({method:'GET',query:{days:'1'}},res);assert.equal(res.status,400);
 await handler({method:'GET',query:{days:'7'}},{});await handler({method:'GET',query:{days:'7'}},{});assert.equal(calls,1);
 allowed=false;res={};await handler({method:'GET',query:{days:'7'}},res);assert.equal(res.status,401);
});
