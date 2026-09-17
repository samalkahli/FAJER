'use strict';
const { getApps, getApp, initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
function json(res,status,data) {
    res.statusCode=status;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.end(JSON.stringify(data));
}
function cors(req,res) {
    const origin=req.headers.origin;
    const allowed=new Set(['https://athnta-ten.vercel.app',...(process.env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean)]);
    if (origin && !allowed.has(origin) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return false;
    if(origin) { res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin'); }
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    return true;
}
function app() {
    if (getApps().length) return getApp();
    const projectId=process.env.FIREBASE_ADMIN_PROJECT_ID,clientEmail=process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey=(process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g,'\n');
    if(!projectId || !clientEmail || !privateKey) throw new Error('CONFIG_MISSING');
    return initializeApp({credential:cert({projectId,clientEmail,privateKey})});
}
async function authorize(req,res) {
    const match=/^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    if(!match) { json(res,401,{error:'يجب تسجيل الدخول أولا'}); return null; }
    try { app(); } catch { json(res,500,{error:'إعدادات الخادم غير مكتملة'}); return null; }
    let token;
    try { token=await getAuth().verifyIdToken(match[1],true); }
    catch { json(res,401,{error:'جلسة الدخول غير صالحة أو تم إلغاؤها'}); return null; }
    const uids=new Set((process.env.ADMIN_UIDS || '').split(',').map(s=>s.trim()).filter(Boolean));
    if(!uids.has(token.uid)) { json(res,403,{error:'ليس لديك صلاحية الإدارة'}); return null; }
    return token;
}
module.exports={getDatabase:()=>getFirestore(app()),app,authorize,cors,json};
