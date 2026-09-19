'use strict';
const {authorize,json}=require('../lib/server-auth');
const {report}=require('../lib/analytics-report');
const cache=new Map(),pending=new Map();
module.exports=async(req,res)=>{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{error:'طلب غير مسموح'});}
 if(!await authorize(req,res))return;
 const property=process.env.GA4_PROPERTY_ID||'';
 if(!/^\d+$/.test(property))return json(res,200,{status:'setup_required',message:'تقارير الزيارات تحتاج ربط حساب Google Analytics. اتبع دليل التركيب المرفق.'});
 const raw=req.query?.days||'30';if(!['7','30','90'].includes(String(raw)))return json(res,400,{error:'الفترة غير صالحة'});
 const days=Number(raw),key=property+':'+days,hit=cache.get(key);
 if(hit&&Date.now()-hit.updatedAt<60000)return json(res,200,hit);
 try{
  if(!pending.has(key))pending.set(key,report(property,days).then(data=>{cache.set(key,data);return data;}).finally(()=>pending.delete(key)));
  return json(res,200,await pending.get(key));
 }catch(error){
  console.error('ANALYTICS_REPORT_FAILURE',error.status||error.name);
  return json(res,error.status===403?403:503,{status:'unavailable',error:error.status===403?'حساب الخدمة لا يملك قراءة Analytics أو أن Data API غير مفعلة. راجع دليل الربط.':'تعذر جلب التقارير من Google الآن. تحقق من إعداد الربط ثم أعد المحاولة.'});
 }
};
