(function(root,factory){const s=factory();if(typeof module==='object'&&module.exports)module.exports=s;else root.ContactSchema=s;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const channels={whatsapp:'واتساب',phone:'الاتصال',email:'البريد الإلكتروني',instagram:'إنستقرام',tiktok:'تيك توك',snapchat:'سناب شات',x:'إكس',youtube:'يوتيوب',website:'المتجر الإلكتروني',maps:'الموقع على الخريطة'};
const defaults=Object.fromEntries(['embroidery','printing'].map(s=>[s,{message:'السلام عليكم، عندي استفسار',...Object.fromEntries(Object.keys(channels).map(k=>[k,{value:k==='whatsapp'?'966552125258':'',enabled:k==='whatsapp'}]))}]));
function value(k,v){
 if(typeof v!=='string'||v.length>1500)throw Error('قيمة غير صالحة: '+channels[k]);v=v.trim();if(!v)return '';
 if(k==='phone'||k==='whatsapp'){v=v.replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[\s()+-]/g,'').replace(/^00/,'');if(!/^[1-9]\d{7,14}$/.test(v))throw Error('اكتب رقم '+channels[k]+' مع رمز الدولة مثل 96655XXXXXXX');return v;}
 if(k==='email'){if(!/^[^\s@<>?&#]+@[^\s@<>?&#]+\.[^\s@<>?&#]+$/.test(v)||v.length>254)throw Error('البريد الإلكتروني غير صالح');return v;}
 let u;try{u=new URL(v);}catch{throw Error('أدخل رابط https كامل لـ '+channels[k]);}if(u.protocol!=='https:'||u.username||u.password)throw Error('الرابط يجب أن يبدأ بـ https بدون بيانات دخول');return u.href;
}
function normalize(input,strict=false){
 const out=JSON.parse(JSON.stringify(defaults));if(!input||typeof input!=='object'){if(strict)throw Error('إعدادات غير صالحة');return out;}
 for(const s of Object.keys(out)){const raw=input[s];if(!raw){if(strict)throw Error('إعدادات المتجر ناقصة');continue;}
 if(typeof raw.message==='string'&&raw.message.length<=500)out[s].message=raw.message;else if(strict)throw Error('رسالة واتساب لا تتجاوز 500 حرف');
 for(const k of Object.keys(channels)){const row=raw[k];if(!row){if(strict)throw Error('إعدادات التواصل ناقصة');continue;}try{if(typeof row.enabled!=='boolean')throw Error('خيار الإظهار غير صالح');out[s][k]={value:value(k,row.value),enabled:row.enabled};}catch(e){if(strict)throw e;}}
 }return out;
}
function href(k,row,message=''){if(!row?.enabled||!row.value)return '';const v=value(k,row.value);return k==='whatsapp'?'https://wa.me/'+v+(message?'?text='+encodeURIComponent(message):''):k==='phone'?'tel:+'+v:k==='email'?'mailto:'+v:v;}
return {channels,defaults,normalize,href};
});
