'use strict';
module.exports=async function(req,res) {
    try {
    const {authorize,cors,json}=require('../lib/server-auth');
    if(!cors(req,res)) return json(res,403,{error:'نطاق غير مسموح'});
    if(req.method==='OPTIONS') {res.statusCode=204;return res.end();}
    if(req.method!=='GET') {res.setHeader('Allow','GET, OPTIONS');return json(res,405,{error:'طلب غير مسموح'});}
    if(await authorize(req,res)) return json(res,200,{ok:true});
    } catch (error) {
        console.error('ADMIN_SESSION_FAILURE', error.code || error.name);
        res.statusCode=500;
        res.setHeader('Content-Type','application/json; charset=utf-8');
        res.setHeader('Cache-Control','no-store');
        res.end(JSON.stringify({code:'ADMIN_SESSION_FAILURE',error:'تعذر تشغيل التحقق الإداري. راجع Vercel Logs وتأكد من وجود lib/server-auth.js وتثبيت المكتبات.'}));
    }
};

