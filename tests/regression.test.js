'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
function snapshot(items) {
    const docs=items.map(p=>({id:p.id,data:()=>p,ref:{id:p.id}}));
    return {docs,size:docs.length,empty:!docs.length,forEach:fn=>docs.forEach(fn)};
}
function mockDB(fixtures,override) {
    const calls=[];
    const db={collection(name) {
        const filters=[];
        const query={
            where(field,op,value){filters.push([field,value]);return this;},
            orderBy(){return this;},limit(){return this;},startAfter(){return this;},
            async get(){
                calls.push({name,filters:[...filters]});
                if(override) {const result=override(name,filters);if(result) return result;}
                return snapshot((fixtures[name]||[]).filter(p=>filters.every(([key,value])=>p[key]===value)));
            },
            doc(id){return {id,async update(value){calls.push({write:name,id,value});},async get(){const row=(fixtures[name]||[]).find(p=>p.id===id);return {exists:!!row,data:()=>row};},async delete(){calls.push({delete:name,id});}}}
        };
        return query;
    }};
    return {db,calls};
}
function browser(page,db) {
    const dom=new JSDOM(read(page+'.html'),{url:'https://athnta-ten.vercel.app/'+page+'.html',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window;
    w.scrollTo=()=>{};w.confirm=()=>true;w.firebase={firestore:()=>db};w.athntaDb=db;
    w.eval(read('js/ui.js'));
    return dom;
}
test('all local HTML script/style/image references exist; no inline handlers',()=>{
    for(const page of ['index','admin','login']) {
        const dom=new JSDOM(read(page+'.html'));
        for(const el of dom.window.document.querySelectorAll('*')) {
            for(const attr of el.attributes) assert.ok(!/^on/i.test(attr.name),page+': inline '+attr.name);
        }
        for(const el of dom.window.document.querySelectorAll('script[src],link[rel="stylesheet"],img[src]')) {
            const url=el.getAttribute('src')||el.getAttribute('href');
            if(!/^(https?:|data:)/.test(url)) assert.ok(fs.existsSync(path.join(root,url)),url);
        }
        dom.window.close();
    }
});
test('gateway performs ZERO database reads; selecting a store only reads its categories',async()=>{
    const {db,calls}=mockDB({categories:[{id:'قسم',imageUrl:'https://i.ibb.co/test.png'}]});
    const dom=browser('index',db),w=dom.window;
    w.eval(read('js/public.js'));w.eval(read('js/index-bindings.js'));
    assert.equal(calls.length,0);
    await w.enterStore('embroidery');
    assert.deepEqual(calls.map(c=>c.name),['categories']);
    assert.equal(w.document.querySelectorAll('.cat-card').length,1);
    await w.backToCategories();
    assert.equal(calls.length,1,'cache reuses categories');
    dom.window.close();
});
test('category and product strings are text, not HTML or executable event attributes',async()=>{
    const evil="قميص'\"<img src=x onerror=window.pwned=1>";
    const {db,calls}=mockDB({categories:[{id:evil,subs:[evil],imageUrl:'javascript:alert(1)'}],products:[{id:'p',name:evil,mainCategory:evil,subCategory:evil,imageURLs:['javascript:alert(1)']}]});
    const dom=browser('index',db),w=dom.window;w.eval(read('js/public.js'));
    await w.enterStore('embroidery');await w.showProducts(evil);
    assert.equal(w.document.querySelector('.product-card h4').textContent,evil);
    assert.equal(w.document.querySelectorAll('[onerror],[onclick]').length,0);
    assert.equal(w.pwned,undefined);
    assert.ok(w.document.querySelector('.product-card img').src.startsWith('data:image/svg+xml,'));
    assert.deepEqual(calls.map(c=>c.name),['categories','products']);
    dom.window.close();
});
test('concurrent categories requests are deduplicated; old store cannot paint over new store',async()=>{
    let finish;
    const wait=new Promise(r=>finish=r);
    const {db,calls}=mockDB({printCategories:[{id:'طباعة'}]},name=>name==='categories'?wait:null);
    const dom=browser('index',db),w=dom.window;w.eval(read('js/public.js'));
    const a=w.enterStore('embroidery'),b=w.enterStore('embroidery');
    await tick();await w.enterStore('printing');
    finish(snapshot([{id:'تطريز'}]));await Promise.all([a,b]);
    assert.equal(calls.filter(c=>c.name==='categories').length,1);
    assert.equal(w.document.querySelector('.cat-card h3').textContent,'طباعة');
    dom.window.close();
});
test('late products response does not erase the current store products',async()=>{
    let finish;
    const delayed=new Promise(r=>finish=r);
    const {db}=mockDB({categories:[{id:'A'}],printCategories:[{id:'B'}],printProducts:[{id:'2',name:'B product',mainCategory:'B'}]},name=>name==='products'?delayed:null);
    const dom=browser('index',db),w=dom.window;w.eval(read('js/public.js'));
    await w.enterStore('embroidery');const old=w.showProducts('A');
    await tick();await w.enterStore('printing');await w.showProducts('B');
    finish(snapshot([{id:'1',name:'A product',mainCategory:'A'}]));await old;
    assert.equal(w.document.querySelector('.product-card h4').textContent,'B product');
    dom.window.close();
});
test('only 24 products rendered initially, remaining products on request',async()=>{
    const {db}=mockDB({categories:[{id:'A'}],products:Array.from({length:30},(_,i)=>({id:String(i),name:'P'+i,mainCategory:'A'}))});
    const dom=browser('index',db),w=dom.window;w.eval(read('js/public.js'));
    await w.enterStore('embroidery');await w.showProducts('A');
    assert.equal(w.document.querySelectorAll('.product-card').length,24);
    w.document.querySelector('#products-grid > button').click();
    assert.equal(w.document.querySelectorAll('.product-card').length,30);
    dom.window.close();
});
test('failed reads can be retried, failures do not poison cache',async()=>{
    let count=0;
    const {db,calls}=mockDB({categories:[{id:'A'}]},name=>name==='categories'&&count++===0?Promise.reject(new Error('offline')):null);
    const dom=browser('index',db),w=dom.window;w.eval(read('js/public.js'));
    await w.enterStore('embroidery');
    assert.ok(w.document.querySelector('#categories-grid button'));
    await w.backToCategories();
    assert.equal(calls.length,2);assert.equal(w.document.querySelector('.cat-card h3').textContent,'A');
    dom.window.close();
});
test('review data is fetched only after review view is requested',async()=>{
    const {db,calls}=mockDB({categories:[],reviews:[{id:'r',imageUrl:'javascript:alert(1)'}]});
    const dom=browser('index',db),w=dom.window;w.eval(read('js/public.js'));
    await w.enterStore('embroidery');
    assert.equal(calls.some(c=>c.name==='reviews'),false);
    await w.showReviews();
    assert.equal(calls.at(-1).name,'reviews');
    assert.ok(w.document.querySelector('.review-img-wrap img').src.startsWith('data:'));
    dom.window.close();
});
test('administration renders unsafe names safely, preserves legacy product images, locks mode during writes',async()=>{
    let authCallback;
    const evil="منتج'\"<svg onload=alert(1)>";
    const {db,calls}=mockDB({categories:[{id:'A',subs:[]}],products:[{id:'p',name:evil,mainCategory:'A',imageUrl:'https://i.ibb.co/old.png'}]});
    const dom=browser('admin',db),w=dom.window;
    w.athntaAuth={currentUser:{getIdToken:async()=>'test'},onAuthStateChanged:fn=>authCallback=fn};
    w.firebase.firestore.FieldValue={arrayUnion:x=>[x]};
    w.fetch=async()=>({status:200,ok:true,headers:{get:()=> 'application/json'},json:async()=>({ok:true})});
    w.eval(read('js/admin.js'));w.eval(read('js/admin-bindings.js'));
    await authCallback(w.athntaAuth.currentUser);
    await w.switchTab(null,'productsTab');
    assert.equal(w.document.querySelectorAll('[onclick],[onload],[onerror]').length,0);
    assert.ok(w.document.getElementById('productsList').textContent.includes(evil));
    w.document.querySelector('#productsList .edit-btn').click();
    assert.equal(w.document.querySelector('#editPrevContainer img').src,'https://i.ibb.co/old.png');
    w.closeModal();
    w.document.getElementById('mainCatForSub').value='A';
    w.document.getElementById('newSubCat').value='new';
    const saving=w.saveSubCategory();
    await w.switchAdminMode('printing');await saving;
    assert.equal(calls.find(c=>c.write).write,'categories');
    assert.ok(w.document.getElementById('adminEmbroideryTab').classList.contains('active'));
    dom.window.close();
});
test('admin rename rejects existing target without writing or deleting it',async()=>{
    let authCallback,writes=0;
    const {db}=mockDB({categories:[{id:'A',subs:[]},{id:'B',subs:[]}],products:[]});
    db.runTransaction=fn=>fn({get:ref=>ref.get(),set:()=>writes++,delete:()=>writes++,update:()=>writes++});
    const dom=browser('admin',db),w=dom.window;
    w.athntaAuth={currentUser:{getIdToken:async()=>'test'},onAuthStateChanged:fn=>authCallback=fn};
    w.fetch=async()=>({status:200,ok:true,headers:{get:()=> 'application/json'},json:async()=>({ok:true})});
    w.eval(read('js/admin.js'));await authCallback(w.athntaAuth.currentUser);
    w.prompt=()=> 'B';w.editCatName('A');await tick();await tick();
    assert.equal(writes,0);
    assert.match(w.document.getElementById('toast').textContent,/مستخدم/);
    dom.window.close();
});
function response() {
    return {headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v?JSON.parse(v):null;}};
}
function authModule(overrides={}) {
    const verify=[];
    const fake={getApps:()=>[{}],getApp:()=>({}),getAuth:()=>({verifyIdToken:async(token,revoked)=>{verify.push(revoked);if(overrides.invalid)throw Error();return {uid:overrides.uid||'owner'};}})};
    const context={require:()=>fake,module:{exports:{}},process:{env:{ADMIN_UIDS:'owner,second'}}};
    vm.runInNewContext(read('lib/server-auth.js'),context);
    return {api:context.module.exports,verify};
}
test('server auth rejects missing token, unlisted UID, revoked token; checks revocation',async()=>{
    for(const settings of [{},{uid:'outsider'},{invalid:true}]) {
        const {api,verify}=authModule(settings),res=response();
        const req={headers:settings.uid||settings.invalid?{authorization:'Bearer test'}:{}};
        assert.equal(await api.authorize(req,res),null);
        assert.equal(res.statusCode,settings.uid?403:401);
        if(verify.length)assert.equal(verify[0],true);
    }
    const {api,verify}=authModule(),res=response();
    assert.equal((await api.authorize({headers:{authorization:'Bearer test'}},res)).uid,'owner');
    assert.equal(verify[0],true);
});
test('CORS rejects untrusted origin and permits configured production origin',()=>{
    const {api}=authModule();
    assert.equal(api.cors({headers:{origin:'https://attacker.example'}},response()),false);
    assert.equal(api.cors({headers:{origin:'https://athnta-ten.vercel.app'}},response()),true);
});

const {Readable}=require('node:stream');
function uploadModule(settings={}) {
    let upstream=0;
    const fakeDB={
        collection:()=>({doc:()=>({})}),
        runTransaction:async fn=>{
            if(settings.rate)throw Error('RATE_LIMIT');
            if(settings.dbFail)throw Error('offline');
            return fn({get:async()=>({data:()=>({})}),set:()=>{}});
        }
    };
    const auth={
        getDatabase:()=>fakeDB,
        authorize:async(req,res)=>{if(settings.unauthorized){auth.json(res,401,{error:'unauthorized'});return null;}return {uid:'owner'};},
        cors:()=>!settings.originDenied,
        json:(res,status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));}
    };
    const context={
        require:name=>name==='busboy'?require('busboy'):auth,
        module:{exports:{}},process:{env:{IMGBB_API_KEY:'test-only'}},Buffer,URLSearchParams,AbortSignal,console,
        fetch:async()=>{
            upstream++;
            return {ok:true,status:200,json:async()=>({success:true,data:{display_url:settings.badURL?'https://attacker.example/file':'https://i.ibb.co/test.png'}})};
        }
    };
    vm.runInNewContext(read('api/upload-image.js'),context);
    return {handler:context.module.exports,upstream:()=>upstream};
}
function multipart(payload,type='image/png',extra='') {
    return Buffer.concat([
        Buffer.from('--BOUNDARY\r\nContent-Disposition: form-data; name="image"; filename="test.png"\r\nContent-Type: '+type+'\r\n\r\n'),
        payload,Buffer.from('\r\n'+extra+'--BOUNDARY--\r\n')
    ]);
}
async function uploadRequest(body,settings={},method='POST') {
    const {handler,upstream}=uploadModule(settings),res=response();
    const req=Readable.from(body);
    req.method=method;req.headers={'content-type':'multipart/form-data; boundary=BOUNDARY'};
    await handler(req,res);return {res,upstream:upstream()};
}
test('upload accepts a valid signature and rejects spoofed/empty/oversized images',async()=>{
    const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
    const good=await uploadRequest(multipart(png));
    assert.equal(good.res.statusCode,200);assert.equal(good.upstream,1);
    for(const content of [Buffer.from('not a png'),Buffer.alloc(0),Buffer.alloc(4*1024*1024+1)]) {
        const result=await uploadRequest(multipart(content));
        assert.equal(result.res.statusCode,400);assert.equal(result.upstream,0);
    }
});
test('upload rejects additional fields/files and never calls upstream for unauthorized/rate-limited requests',async()=>{
    const png=Buffer.from([137,80,78,71,13,10,26,10]);
    const extra='--BOUNDARY\r\nContent-Disposition: form-data; name="extra"\r\n\r\nbad\r\n';
    assert.equal((await uploadRequest(multipart(png,'image/png',extra))).res.statusCode,400);
    const second='--BOUNDARY\r\nContent-Disposition: form-data; name="image"; filename="two.png"\r\nContent-Type: image/png\r\n\r\nbad\r\n';
    assert.equal((await uploadRequest(multipart(png,'image/png',second))).res.statusCode,400);
    for(const [settings,status] of [[{unauthorized:true},401],[{rate:true},429],[{dbFail:true},503],[{originDenied:true},403]]) {
        const result=await uploadRequest(multipart(png),settings);
        assert.equal(result.res.statusCode,status);assert.equal(result.upstream,0);
    }
    assert.equal((await uploadRequest(multipart(png),{badURL:true})).res.statusCode,502);
});
test('API returns explicit status for disallowed method and preflight',async()=>{
    assert.equal((await uploadRequest(Buffer.alloc(0),{},'GET')).res.statusCode,405);
    assert.equal((await uploadRequest(Buffer.alloc(0),{},'OPTIONS')).res.statusCode,204);
});

test('gaxios multipart still works with patched uuid dependency, without network',async()=>{
    const {Gaxios}=require('gaxios');
    let body='',headers;
    const result=await new Gaxios().request({
        url:'https://example.invalid',method:'POST',
        multipart:[{headers:{'Content-Type':'text/plain'},content:'fixture'}],
        adapter:async options=>{
            headers=options.headers;
            for await(const chunk of options.body) body+=chunk.toString();
            return {status:200,statusText:'OK',headers:{},config:options,data:'ok'};
        }
    });
    assert.equal(result.data,'ok');
    assert.match(headers['Content-Type'],/multipart\/related; boundary=[a-f0-9-]+/);
    assert.ok(body.includes('fixture'));
});

test('store arrow returns from products and reviews to categories before the gateway',async()=>{
    const {db}=mockDB({categories:[{id:'A'}],products:[{id:'p',mainCategory:'A'}]});
    const dom=browser('index',db),w=dom.window;
    w.eval(read('js/public.js'));w.eval(read('js/index-bindings.js'));
    await w.enterStore('embroidery');await w.showProducts('A');
    const arrow=w.document.querySelector('.store-back-btn');
    arrow.click();await tick();
    assert.equal(w.document.getElementById('categories-section').style.display,'block');
    assert.equal(w.document.getElementById('store-gateway').hidden,true);
    await w.showReviews();arrow.click();await tick();
    assert.equal(w.document.getElementById('categories-section').style.display,'block');
    arrow.click();await tick();
    assert.equal(w.document.getElementById('store-gateway').hidden,false);
    dom.window.close();
});
test('API errors explain missing local server and valid JSON remains usable',async()=>{
    const dom=browser('login',{}),w=dom.window;
    w.fetch=async()=>({status:404,headers:{get:()=> 'text/html'}});
    await assert.rejects(w.StoreUI.fetchJSON('/api/admin-session'),/مسار الإدارة/);
    w.fetch=async()=>({status:500,headers:{get:()=> 'text/plain'}});
    await assert.rejects(w.StoreUI.fetchJSON('/api/admin-session'),/HTTP 500/);
    w.fetch=async()=>({status:200,ok:true,headers:{get:()=> 'application/json'},json:async()=>({ok:true})});
    assert.equal((await w.StoreUI.fetchJSON('/api/admin-session')).ok,true);
    w.fetch=async()=>({status:403,ok:false,headers:{get:()=> 'application/json'},json:async()=>({error:'ليس لديك صلاحية الإدارة'})});
    await assert.rejects(w.StoreUI.fetchJSON('/api/admin-session'),/صلاحية/);
    dom.window.close();
});


test('missing SDK does not crash startup; unauthorized requests stay rejected',async()=>{
    let imports=0;
    const context={require:()=>{imports++;throw Object.assign(new Error('missing'),{code:'MODULE_NOT_FOUND'});},module:{exports:{}},process:{env:{}}};
    vm.runInNewContext(read('lib/server-auth.js'),context);
    assert.equal(imports,0);
    const api=context.module.exports,missing=response();
    await api.authorize({headers:{}},missing);
    assert.equal(missing.statusCode,401);
    assert.equal(imports,0);
    const withToken=response();
    assert.equal(await api.authorize({headers:{authorization:'Bearer test'}},withToken),null);
    assert.equal(withToken.statusCode,500);
});
test('admin endpoint survives missing shared module and returns structured failure',async()=>{
    const context={require:()=>{throw Object.assign(new Error('missing'),{code:'MODULE_NOT_FOUND'});},module:{exports:{}},console:{error:()=>{}}};
    vm.runInNewContext(read('api/admin-session.js'),context);
    const res=response();
    await context.module.exports({method:'GET',headers:{}},res);
    assert.equal(res.statusCode,500);
});
test('reviews retain full original URL in the clickable lightbox',async()=>{
    const url='https://i.ibb.co/original.png';
    const {db}=mockDB({reviews:[{id:'r',imageUrl:url}]});
    const dom=browser('index',db),w=dom.window;
    w.eval(read('js/public.js'));await w.enterStore('embroidery');await w.showReviews();
    w.document.querySelector('.review-img-wrap').click();
    assert.equal(w.document.getElementById('expandedReviewImg').src,url);
    assert.ok(w.document.getElementById('reviewImgModal').classList.contains('active'));
    assert.equal(w.document.querySelectorAll('[data-bind-click="index-5"],[data-bind-click="index-6"]').length,0);
    assert.equal(w.document.querySelectorAll('.swiper-button-next svg,.swiper-button-prev svg').length,2);
    dom.window.close();
});
