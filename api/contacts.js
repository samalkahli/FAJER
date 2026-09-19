'use strict';
const {normalize,defaults}=require('../js/contact-schema');
const {getDatabase,authorize,json}=require('../lib/server-auth');
module.exports=async(req,res)=>{
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return json(res,405,{error:'طلب غير مسموح'});}
 if(req.method==='POST'&&!await authorize(req,res))return;
 try{
 const db=getDatabase(),ref=db.collection('_siteSettings').doc('contacts');
 if(req.method==='GET'){const snap=await ref.get(),d=snap.exists?snap.data():{};return json(res,200,{contacts:normalize(d.contacts||defaults),version:Number(d.version)||0});}
 let b=req.body;if(typeof b==='string'){if(Buffer.byteLength(b)>25000)return json(res,413,{error:'الإعدادات كبيرة'});try{b=JSON.parse(b);}catch{return json(res,400,{error:'بيانات غير صالحة'});}}
 if(!b||Buffer.byteLength(JSON.stringify(b))>25000||!Number.isSafeInteger(b.version)||b.version<0)return json(res,400,{error:'بيانات الحفظ غير صالحة'});
 let contacts;try{contacts=normalize(b.contacts,true);}catch(e){return json(res,400,{error:e.message});}
 const version=await db.runTransaction(async tx=>{const snap=await tx.get(ref),current=snap.exists?Number(snap.data().version)||0:0;if(current!==b.version)throw Error('CONFLICT');tx.set(ref,{contacts,version:current+1,updatedAt:Date.now()});return current+1;});
 return json(res,200,{contacts,version});
 }catch(e){if(e.message==='CONFLICT')return json(res,409,{error:'تم الحفظ من جلسة أخرى. أعد تحميل المحفوظ ثم عدل مجددًا.'});console.error('CONTACTS_FAILURE',e.code||e.name);return json(res,503,{error:'تعذر تحميل أو حفظ روابط التواصل. أعد المحاولة.'});}
};
