'use strict';
const {normalize,defaults}=require('../js/theme-schema');
const {getDatabase,authorize,json}=require('../lib/server-auth');
module.exports=async function(req,res){
 if(req.method!=='GET'&&req.method!=='POST'){res.setHeader('Allow','GET, POST');return json(res,405,{error:'طلب غير مسموح'});}
 if(req.method==='POST'&&!await authorize(req,res))return;
 try{
  const ref=getDatabase().collection('_siteSettings').doc('theme');
  if(req.method==='GET'){
   const snap=await ref.get();const saved=snap.exists?snap.data():{};
   res.setHeader('Content-Type','application/json; charset=utf-8');
   res.setHeader('Cache-Control','no-store');
   return res.end(JSON.stringify({theme:normalize(saved.theme||defaults),version:Number(saved.version)||0}));
  }
  let body=req.body;
  if(typeof body==='string'){if(Buffer.byteLength(body)>30000)return json(res,413,{error:'حجم الإعدادات كبير'});try{body=JSON.parse(body);}catch{return json(res,400,{error:'بيانات غير صالحة'});}}
  if(!body||typeof body!=='object'||Buffer.byteLength(JSON.stringify(body))>30000)return json(res,400,{error:'بيانات غير صالحة'});
  if(!Number.isSafeInteger(body.version)||body.version<0)return json(res,400,{error:'إصدار الحفظ غير صالح'});
  let theme;try{theme=normalize(body.theme,true);}catch(error){return json(res,400,{error:error.message});}
  const version=await getDatabase().runTransaction(async tx=>{
   const snap=await tx.get(ref),current=snap.exists?Number(snap.data().version)||0:0;
   if(current!==body.version)throw Error('CONFLICT');
   tx.set(ref,{theme,version:current+1,updatedAt:Date.now()});return current+1;
  });
  return json(res,200,{theme,version});
 }catch(error){
  if(error.message==='CONFLICT')return json(res,409,{error:'تم تعديل الثيم من جلسة أخرى. احتفظ بمسودتك عبر التصدير ثم اضغط إعادة تحميل المحفوظ.'});
  console.error('THEME_FAILURE',error.code||error.name);
  return json(res,503,{error:'تعذر الوصول لإعدادات الثيم. راجع اتصال الخادم وصلاحيات Firebase Admin ثم أعد المحاولة.'});
 }
};
