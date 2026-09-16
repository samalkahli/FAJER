async function login() {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value;
    const status = document.getElementById('status');
    const btn = document.getElementById('loginBtn');

    if (!email || !pass) {
        status.innerText = 'الرجاء إدخال البريد وكلمة المرور';
        return;
    }

    if (!window.athntaAuth) {
        status.innerText = 'تعذر تشغيل Firebase Auth. تأكد من وجود مجلد js وفتح الموقع عبر localhost أو Vercel.';
        console.error('Firebase Auth is not initialized. Check firebase-config.js and script paths.');
        return;
    }

    btn.innerText = 'جاري التحقق...';
    btn.disabled = true;

    try {
        await window.athntaAuth.signInWithEmailAndPassword(email, pass);

            status.style.color = '#28a745';
            status.innerText = 'نجح الدخول! جاري التحويل...';
            window.location.href = 'admin.html';
    } catch (error) {
        btn.innerText = 'دخول';
        btn.disabled = false;
        console.error('Error Code:', error.code, error);

        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            status.innerText = 'البريد أو كلمة المرور غير صحيحة';
        } else if (error.code === 'auth/operation-not-allowed') {
            status.innerText = 'تسجيل الدخول بالبريد غير مفعل من Firebase Authentication';
        } else if (error.code === 'auth/network-request-failed') {
            status.innerText = 'تعذر الاتصال بـ Firebase. افتح الموقع عبر localhost أو Vercel وتأكد من الإنترنت';
        } else {
            status.innerText = 'خطأ: ' + (error.message || 'تعذر تسجيل الدخول');
        }
    }
}
