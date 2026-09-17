'use strict';
const {authorize,cors,json}=require('../lib/server-auth');
module.exports=async function(req,res) {
    if(!cors(req,res)) return json(res,403,{error:'نطاق غير مسموح'});
    if(req.method==='OPTIONS') {res.statusCode=204;return res.end();}
    if(req.method!=='GET') {res.setHeader('Allow','GET, OPTIONS');return json(res,405,{error:'طلب غير مسموح'});}
    if(await authorize(req,res)) return json(res,200,{ok:true});
};

