'use strict';
const {createSign}=require('node:crypto');
let tokenCache=null,tokenPending=null;
async function request(url,options){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
 let data;try{data=await response.json();}catch{throw Object.assign(Error('INVALID_RESPONSE'),{status:response.status});}
 if(!response.ok)throw Object.assign(Error('UPSTREAM_ERROR'),{status:response.status});
 return data;
}
async function accessToken(){
 if(tokenCache&&tokenCache.until>Date.now()+60000)return tokenCache.token;
 if(tokenPending)return tokenPending;
 tokenPending=(async()=>{
  const email=process.env.FIREBASE_ADMIN_CLIENT_EMAIL,key=(process.env.FIREBASE_ADMIN_PRIVATE_KEY||'').replace(/\\n/g,'\n');
  if(!email||!key)throw Error('CREDENTIALS_MISSING');
  const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
  const assertion=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:email,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const signature=createSign('RSA-SHA256').update(assertion).sign(key,'base64url');
  const data=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:assertion+'.'+signature})});
  if(typeof data.access_token!=='string')throw Error('TOKEN_MISSING');
  tokenCache={token:data.access_token,until:Date.now()+Number(data.expires_in||3600)*1000};return data.access_token;
 })().finally(()=>{tokenPending=null;});return tokenPending;
}
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
function rows(data){return(data.rows||[]).map(row=>Object.fromEntries([...(data.dimensionHeaders||[]).map((h,i)=>[h.name,row.dimensionValues?.[i]?.value||'']),...(data.metricHeaders||[]).map((h,i)=>[h.name,num(row.metricValues?.[i]?.value)])]));}
async function report(property,days){
 const token=await accessToken(),url='https://analyticsdata.googleapis.com/v1beta/properties/'+property;
 const post=(method,body)=>request(url+':'+method,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const dateRanges=[{startDate:(days-1)+'daysAgo',endDate:'today'}];
 const metrics=names=>names.map(name=>({name})),dimensions=metrics;
 const events=['visit_embroidery','visit_printing','whatsapp_embroidery','whatsapp_printing','view_item'];
 const filter={filter:{fieldName:'eventName',inListFilter:{values:events}}};
 const specs={
  totals:['runReport',{dateRanges,metrics:metrics(['totalUsers','sessions','screenPageViews'])}],
  events:['runReport',{dateRanges,dimensions:dimensions(['eventName']),metrics:metrics(['eventCount','totalUsers']),dimensionFilter:filter,limit:20}],
  daily:['runReport',{dateRanges,dimensions:dimensions(['date','eventName']),metrics:metrics(['eventCount']),dimensionFilter:filter,limit:1000,orderBys:[{dimension:{dimensionName:'date'}}]}],
  sources:['runReport',{dateRanges,dimensions:dimensions(['sessionSourceMedium']),metrics:metrics(['sessions']),orderBys:[{metric:{metricName:'sessions'},desc:true}],limit:8}],
  items:['runReport',{dateRanges,dimensions:dimensions(['itemName','itemBrand']),metrics:metrics(['itemsViewed']),orderBys:[{metric:{metricName:'itemsViewed'},desc:true}],limit:30}],
  realtime:['runRealtimeReport',{metrics:metrics(['activeUsers'])}]
 };
 const entries=Object.entries(specs),results=await Promise.allSettled(entries.map(([,s])=>post(...s)));
 const output={status:'connected',updatedAt:Date.now(),days,errors:{}};
 results.forEach((r,i)=>{const name=entries[i][0];if(r.status==='fulfilled')output[name]=rows(r.value);else{output[name]=null;output.errors[name]=r.reason.status===403?'PERMISSION_DENIED':'REPORT_UNAVAILABLE';}});
 if(results.every(r=>r.status==='rejected'))throw Object.assign(Error('REPORTS_UNAVAILABLE'),{status:results[0].reason.status});
 return output;
}
module.exports={report,rows};
