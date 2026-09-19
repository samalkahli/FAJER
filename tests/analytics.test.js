const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');const source=fs.readFileSync(path.join(__dirname,'../js/analytics.js'),'utf8');
function setup(url){const dom=new JSDOM('<div id="store-gateway"></div><a id="modalWhatsappBtn" href="https://wa.me/966552125258?text=private">طلب</a>',{url,runScripts:'outside-only'});dom.window.eval(source);return dom;}
test('analytics excludes local/theme previews, disables automatic initial views and deduplicates navigation',()=>{
 for(const url of ['http://localhost/','https://athnta-ten.vercel.app/?themePreview=1']){const d=setup(url);assert.equal(d.window.dataLayer,undefined);d.window.close();}
 const d=setup('https://athnta-ten.vercel.app/?utm_source=tiktok&secret=private'),w=d.window,a=w.StoreAnalytics;
 a.screen('gateway','embroidery');a.screen('gateway','embroidery');a.screen('categories','embroidery');a.screen('products','embroidery','هودي');a.screen('categories','embroidery');a.screen('categories','printing');
 const q=w.dataLayer.map(x=>Array.from(x)),events=q.filter(x=>x[0]==='event');assert.equal(q.find(x=>x[0]==='config')[2].send_page_view,false);
 assert.equal(events.filter(x=>x[1]==='page_view').length,5);assert.equal(events.filter(x=>x[1]==='visit_embroidery').length,1);assert.equal(events.filter(x=>x[1]==='visit_printing').length,1);
 assert.ok(events.every(x=>!JSON.stringify(x).includes('secret')));assert.ok(events[0][2].page_location.includes('utm_source=tiktok'));
 w.document.body.dataset.mode='printing';a.item('printing',{id:'p1',name:'تيشرت',mainCategory:'تيشرتات'});w.document.getElementById('modalWhatsappBtn').addEventListener('click',e=>e.preventDefault());w.document.getElementById('modalWhatsappBtn').click();
 const click=Array.from(w.dataLayer.at(-1));assert.equal(click[1],'whatsapp_printing');assert.equal(click[2].item_id,'p1');assert.ok(!JSON.stringify(click).includes('private'));d.window.close();
});
