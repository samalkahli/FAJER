(function(){
'use strict';const S=window.ContactSchema;let settings=S.normalize(S.defaults);const footer=document.querySelector('.social-footer');
const existing=[...footer.querySelectorAll('a')];existing.forEach((a,i)=>a.dataset.contact=['whatsapp','instagram','tiktok'][i]);
for(const [k,label]of Object.entries(S.channels)){if(footer.querySelector('[data-contact="'+k+'"]'))continue;const a=document.createElement('a');a.className='social-btn contact-extra';a.dataset.contact=k;a.textContent=label;a.title=label;a.setAttribute('aria-label',label);a.target='_blank';a.rel='noopener noreferrer';footer.append(a);}
function apply(){const mode=document.body.dataset.mode;if(!settings[mode])return;const c=settings[mode];for(const a of footer.querySelectorAll('[data-contact]')){const k=a.dataset.contact,url=S.href(k,c[k],c.message);a.hidden=!url;if(url)a.href=url;else a.removeAttribute('href');a.setAttribute('aria-label',S.channels[k]);}
const nav=document.querySelector('.nav-whatsapp'),modal=document.getElementById('modalWhatsappBtn');for(const a of [nav,modal]){if(!a)continue;const message=a===modal?(a.dataset.productMessage||c.message):c.message,url=S.href('whatsapp',c.whatsapp,message);a.hidden=!url;if(url)a.href=url;else a.removeAttribute('href');}footer.hidden=![...footer.querySelectorAll('a')].some(a=>!a.hidden);}
window.StoreContacts={product(message){document.getElementById('modalWhatsappBtn').dataset.productMessage=message;apply();}};
new MutationObserver(apply).observe(document.body,{attributes:true,attributeFilter:['data-mode']});apply();
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);fetch('/api/contacts',{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{settings=S.normalize(d.contacts);apply();}).catch(()=>{}).finally(()=>clearTimeout(timer));
})();
