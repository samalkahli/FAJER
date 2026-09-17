/* Safe UI helpers shared by the gallery and administration. */
(function () {
    'use strict';
    const placeholder = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="100%" height="100%" fill="#302922"/><text x="50%" y="50%" text-anchor="middle" fill="#eee" font-size="20">الصورة غير متاحة</text></svg>');
    function node(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text != null) el.textContent = String(text);
        return el;
    }
    function safeURL(value) {
        if (typeof value !== 'string' || !value.trim()) return placeholder;
        try {
            const url = new URL(value, location.href);
            return url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === location.origin)
                ? url.href : placeholder;
        } catch { return placeholder; }
    }
    function img(url, alt = '', eager = false) {
        const el = node('img');
        el.alt = String(alt || '');
        el.loading = eager ? 'eager' : 'lazy';
        el.decoding = 'async';
        el.src = safeURL(url);
        el.addEventListener('error', () => { el.src = placeholder; }, { once: true });
        return el;
    }
    function button(text, className, action) {
        const el = node('button', className, text);
        el.type = 'button';
        el.addEventListener('click', action);
        return el;
    }
    function actionable(el, action) {
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.addEventListener('click', action);
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action(e); }
        });
        return el;
    }
    function images(product) {
        const urls = Array.isArray(product.imageURLs) ? product.imageURLs.filter(u => typeof u === 'string' && u) : [];
        return urls.length ? urls : product.imageUrl ? [product.imageUrl] : [];
    }
    function message(container, text, retry) {
        container.replaceChildren(node('p', 'empty-state', text));
        if (retry) container.append(button('إعادة المحاولة', 'btn-back', retry));
    }
    async function fetchJSON(url, options = {}, timeout = 35000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
            let data;
            try { data = await response.json(); } catch { throw new Error('استجابة غير صالحة من الخادم'); }
            if (!response.ok) throw new Error(data.error || 'تعذر إتمام الطلب');
            return data;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('انتهت مهلة الاتصال. تحقق من الإنترنت ثم حاول مجددا');
            throw error;
        } finally { clearTimeout(timer); }
    }
    window.StoreUI = Object.freeze({ node, img, button, actionable, images, message, safeURL, fetchJSON });
})();

