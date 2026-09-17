'use strict';
let loggingIn=false;
async function login() {
    if(loggingIn) return;
    const email=document.getElementById('email').value.trim(),password=document.getElementById('password').value;
    const status=document.getElementById('status'),btn=document.getElementById('loginBtn');
    status.style.color='#f08080';
    if(!email || !password) {status.textContent='أدخل البريد وكلمة المرور';return;}
    if(!window.athntaAuth) {status.textContent='تعذر تشغيل تسجيل الدخول. أعد تحميل الصفحة';return;}
    loggingIn=true;btn.disabled=true;btn.textContent='جاري التحقق...';
    try {
        await athntaAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        await athntaAuth.signInWithEmailAndPassword(email,password);
        const token=await athntaAuth.currentUser.getIdToken();
        const url='/api/admin-session';
        await StoreUI.fetchJSON(url,{headers:{Authorization:'Bearer '+token}});
        status.style.color='#28a745';status.textContent='تم الدخول';
        location.replace('admin.html');
    } catch(error) {
        document.getElementById('password').value='';
        if(athntaAuth.currentUser) await athntaAuth.signOut().catch(()=>{});
        const messages={
            'auth/wrong-password':'البريد أو كلمة المرور غير صحيحة',
            'auth/user-not-found':'البريد أو كلمة المرور غير صحيحة',
            'auth/invalid-credential':'البريد أو كلمة المرور غير صحيحة',
            'auth/too-many-requests':'محاولات كثيرة. انتظر قليلا ثم حاول مجددا',
            'auth/network-request-failed':'تعذر الاتصال. تحقق من الإنترنت',
            'auth/user-disabled':'هذا الحساب غير متاح'
        };
        status.textContent=messages[error.code] || (error.code?'تعذر تسجيل الدخول':error.message);
    } finally {loggingIn=false;btn.disabled=false;btn.textContent='دخول';}
}
document.getElementById('password').addEventListener('keydown',event=>{if(event.key==='Enter') login();});
