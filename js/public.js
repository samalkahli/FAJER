/* No database writes. Public data is fetched only when its view is opened. */
(function () {
    'use strict';
    const U = window.StoreUI;
    const $ = id => document.getElementById(id);
    const modes = {
        embroidery: { categories: 'categories', products: 'products', reviews: 'reviews', name: 'ATHNTA', logo: 'assets/athnta-logo.png', color: '#050505' },
        printing: { categories: 'printCategories', products: 'printProducts', reviews: 'printReviews', name: 'LAVINTA', logo: 'assets/lavinta-logo.jpeg', color: '#5e4a3f' }
    };
    let mode = 'embroidery', view = 'gateway', category = '', sub = 'all', revision = 0;
    let categoryData = [], products = [], visibleCount = 24, swiper = null, modalRevision = 0, returnFocus = null;
    const cache = new Map(), scripts = new Map();
    const TTL = 60000;
    function script(src) {
        if (!scripts.has(src)) {
            const promise = new Promise((resolve, reject) => {
                const el = document.createElement('script');
                el.src = src; el.async = true;
                const timer = setTimeout(() => { el.remove(); reject(new Error('تعذر تحميل مكتبة الموقع')); }, 20000);
                el.onload = () => { clearTimeout(timer); resolve(); };
                el.onerror = () => { clearTimeout(timer); el.remove(); reject(new Error('تعذر تحميل مكتبة الموقع')); };
                document.head.append(el);
            }).catch(error => { scripts.delete(src); throw error; });
            scripts.set(src, promise);
        }
        return scripts.get(src);
    }
    async function database() {
        if (!window.firebase) await script('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
        if (!firebase.firestore) await script('https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js');
        if (!window.athntaDb) await script('js/firebase-config.js');
        if (!window.athntaDb) throw new Error('تعذر تشغيل قاعدة البيانات');
        return window.athntaDb;
    }
    async function cached(key, loader) {
        const item = cache.get(key);
        if (item && item.promise) return item.promise;
        if (item && Date.now() - item.time < TTL) return item.value;
        const promise = loader().then(value => {
            cache.set(key, { value, time: Date.now() }); return value;
        }).catch(error => { cache.delete(key); throw error; });
        cache.set(key, { promise });
        return promise;
    }
    const records = snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    const time = p => p.timestamp && typeof p.timestamp.toMillis === 'function' ? p.timestamp.toMillis() : 0;
    function top() { window.scrollTo({ top: 0, behavior: 'auto' }); }
    function setView(next) {
        view = next;
        window.StoreAnalytics?.screen(next, mode, category);
        const back = document.querySelector('.store-back-btn');
        const label = next === 'categories' ? 'العودة إلى قائمة المتاجر' : 'العودة إلى الأقسام';
        if (back) { back.setAttribute('aria-label', label); back.title = label; }
        $('store-gateway').hidden = next !== 'gateway';
        $('store-app').hidden = next === 'gateway';
        for (const name of ['categories', 'products', 'reviews']) $(name + '-section').style.display = name === next ? 'block' : 'none';
        $('reviewsBtnWrapper').style.display = next === 'categories' ? 'block' : 'none';
        $('mainNav').classList.remove('sticky');
        closeModals();
        top();
    }
    function theme() {
        document.body.dataset.mode = mode;
        document.title = modes[mode].name + ' | المعرض';
        $('brandLogo').src = modes[mode].logo;
        $('brandLogo').alt = modes[mode].name;
        $('mainSectionTitle').textContent = 'هنا أعمالنا المنفذة خصيصاً لكم';
        $('themeColor').content = modes[mode].color;
    }
    function historyFor(store) {
        const url = new URL(location.href);
        if (store) url.searchParams.set('store', store); else url.searchParams.delete('store');
        if (url.href !== location.href) history.pushState({}, '', url);
    }
    async function categories() {
        const request = ++revision, selected = mode;
        setView('categories');
        U.message($('categories-grid'), 'جاري تحميل الأقسام...');
        try {
            const data = await cached(selected + ':categories', async () => {
                const db = await database();
                return records(await db.collection(modes[selected].categories).get()).sort((a,b) => (a.order || 0) - (b.order || 0));
            });
            if (request !== revision) return;
            categoryData = data;
            const fragment = document.createDocumentFragment();
            data.forEach((cat, i) => {
                const card = U.actionable(U.node('div', 'glass-card cat-card'), () => showProducts(cat.id));
                const image = U.node('div', 'image-container');
                image.append(U.img(cat.imageUrl, cat.id, i < 2));
                card.append(image, U.node('h3', '', cat.id));
                fragment.append(card);
            });
            $('categories-grid').replaceChildren(fragment);
            if (!data.length) U.message($('categories-grid'), 'لا توجد أقسام مضافة حاليا');
        } catch (error) {
            if (request === revision) U.message($('categories-grid'), 'تعذر تحميل الأقسام. تحقق من الاتصال', categories);
        }
    }
    window.switchMode = async function (next, options = {}) {
        if (!Object.hasOwn(modes, next)) return;
        mode = next;
        theme();
        if (options.updateHistory !== false) historyFor(mode);
        return categories();
    };
    window.enterStore = window.switchMode;
    window.backToCategories = categories;
    window.goBack = function () {
        if (view === 'products' || view === 'reviews') return categories();
        return window.backToGateway();
    };
    window.backToGateway = function (options = {}) {
        ++revision;
        setView('gateway');
        document.body.dataset.mode = 'gateway';
        document.title = 'ATHNTA × LAVINTA | اختر متجرك';
        $('themeColor').content = '#171110';
        if (options.updateHistory !== false) historyFor(null);
    };
    async function showProducts(id) {
        const request = ++revision, selected = mode;
        category = id; sub = 'all'; visibleCount = 24;
        setView('products');
        $('category-title').textContent = id;
        renderFilters();
        U.message($('products-grid'), 'جاري تحميل المنتجات...');
        products = [];
        try {
            const loaded = await cached(selected + ':products:' + id, async () => {
                const db = await database();
                // Single-field equality query: no new composite index required.
                return records(await db.collection(modes[selected].products).where('mainCategory', '==', id).get())
                    .sort((a,b) => time(b) - time(a) || a.id.localeCompare(b.id));
            });
            if (request === revision) { products = loaded; renderProducts(); }
        } catch {
            if (request === revision) U.message($('products-grid'), 'تعذر تحميل المنتجات', () => showProducts(id));
        }
    }
    window.showProducts = showProducts;
    function renderFilters() {
        const cat = categoryData.find(c => c.id === category);
        const subs = cat && Array.isArray(cat.subs) ? [...new Set(cat.subs.filter(s => typeof s === 'string'))] : [];
        const box = $('filters-container');
        box.replaceChildren();
        const select = value => { sub = value; visibleCount = 24; renderFilters(); renderProducts(); };
        box.append(U.button('الكل', 'filter-btn' + (sub === 'all' ? ' active' : ''), () => select('all')));
        subs.slice(0,3).forEach(s => box.append(U.button(s, 'filter-btn' + (sub === s ? ' active' : ''), () => select(s))));
        if (subs.length > 3) {
            const wrap = U.node('div', 'more-filters-container');
            const dropdown = U.node('div', 'more-filters-dropdown');
            const trigger = U.button('المزيد ▾', 'filter-btn' + (subs.slice(3).includes(sub) ? ' active' : ''), e => {
                e.stopPropagation(); dropdown.classList.toggle('show');
                trigger.setAttribute('aria-expanded', String(dropdown.classList.contains('show')));
            });
            trigger.setAttribute('aria-expanded', 'false');
            subs.slice(3).forEach(s => dropdown.append(U.button(s, 'filter-btn dropdown-item', () => select(s))));
            wrap.append(trigger, dropdown); box.append(wrap);
        }
    }
    document.addEventListener('click', () => document.querySelectorAll('.more-filters-dropdown.show').forEach(el => el.classList.remove('show')));
    function renderProducts() {
        const filtered = products.filter(p => sub === 'all' || p.subCategory === sub);
        const fragment = document.createDocumentFragment();
        filtered.slice(0, visibleCount).forEach((p, i) => {
            const card = U.node('div', 'glass-card product-card');
            const wrap = U.actionable(U.node('div', 'image-container'), () => openProduct(p));
            const urls = U.images(p);
            wrap.append(U.img(urls[0], p.name, i < 2));
            if (urls.length > 1) wrap.append(U.node('div', 'multi-img-icon', '▧ ' + urls.length));
            const overlay = U.node('div', 'hover-overlay'); overlay.append(U.node('span', '', 'عرض التفاصيل'));
            wrap.append(overlay);
            card.append(wrap, U.node('h4', '', p.name));
            fragment.append(card);
        });
        if (filtered.length > visibleCount) {
            const more = U.button('عرض المزيد', 'btn-back', () => { visibleCount += 24; renderProducts(); });
            more.style.gridColumn = '1 / -1'; fragment.append(more);
        }
        $('products-grid').replaceChildren(fragment);
        if (!filtered.length) U.message($('products-grid'), 'لا توجد منتجات هنا حاليا');
    }
    window.showReviews = async function () {
        const request = ++revision, selected = mode;
        setView('reviews');
        U.message($('reviews-grid'), 'جاري تحميل الآراء...');
        let cursor = null, loading = false;
        async function page() {
            if (loading || request !== revision) return;
            loading = true;
            const previous = $('reviews-grid').querySelector('button');
            if (previous) previous.disabled = true;
            try {
                const db = await database();
                let query = db.collection(modes[selected].reviews).orderBy('timestamp', 'desc').limit(24);
                if (cursor) query = query.startAfter(cursor);
                const snapshot = await cached(selected + ':reviews:' + (cursor ? cursor.id : 'first'), () => query.get());
                if (request !== revision) return;
                if (!cursor) $('reviews-grid').replaceChildren();
                if (previous) previous.remove();
                snapshot.docs.forEach(doc => {
                    const wrap = U.actionable(U.node('div', 'review-img-wrap'), () => {
                        openModal($('reviewImgModal')); $('expandedReviewImg').src = U.safeURL(doc.data().imageUrl);
                    });
                    wrap.append(U.img(doc.data().imageUrl, 'رأي عميل'));
                    $('reviews-grid').append(wrap);
                });
                cursor = snapshot.docs.at(-1) || cursor;
                if (snapshot.size === 24) $('reviews-grid').append(U.button('عرض المزيد', 'btn-back', page));
                if (!cursor) U.message($('reviews-grid'), 'لا توجد آراء حاليا');
            } catch {
                if (request === revision) {
                    if (!cursor) U.message($('reviews-grid'), 'تعذر تحميل الآراء', page);
                    else if (previous) { previous.disabled = false; previous.textContent = 'إعادة المحاولة'; }
                }
            } finally { loading = false; }
        }
        await page();
    };
    function openModal(el) {
        closeModals();
        returnFocus = document.activeElement;
        el.classList.add('active');
        el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
        document.body.style.overflow = 'hidden';
        const focus = el.querySelector('button, a') || el;
        focus.tabIndex = focus.tabIndex < 0 ? 0 : focus.tabIndex; focus.focus();
    }
    function closeModals() {
        ++modalRevision;
        document.querySelectorAll('.modal.active').forEach(el => el.classList.remove('active'));
        document.body.style.overflow = '';
        if (swiper) { swiper.destroy(true, true); swiper = null; }
        if (returnFocus && returnFocus.isConnected) returnFocus.focus();
        returnFocus = null;
    }
    async function openProduct(product) {
        openModal($('productModal'));
        window.StoreAnalytics?.item(mode, product);
        const ticket = modalRevision;
        const urls = U.images(product);
        $('modalSwiperWrapper').style.overflowX = '';
        const slides = (urls.length ? urls : ['']).map(url => {
            const slide = U.node('div', 'swiper-slide'); slide.append(U.img(url, product.name, true)); return slide;
        });
        $('modalSwiperWrapper').replaceChildren(...slides);
        $('modalProductTitle').textContent = product.name || '';
        const message = 'السلام عليكم، أود الاستفسار عن منتج ' + modes[mode].name + ': ' + product.name + ' في قسم ' + product.mainCategory;
        $('modalWhatsappBtn').href = 'https://wa.me/966552125258?text=' + encodeURIComponent(message);
        try {
            if (!window.Swiper) await script('https://cdn.jsdelivr.net/npm/swiper@10.3.1/swiper-bundle.min.js');
            if (ticket !== modalRevision) return;
            swiper = new Swiper('.modalSwiper', { navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }, pagination: { el: '.swiper-pagination', clickable: true }, loop: urls.length > 1 });
        } catch {
            if (ticket === modalRevision) {
                // Native horizontal swipe remains available if the CDN is unavailable.
                $('modalSwiperWrapper').style.overflowX = 'auto';
            }
        }
    }
    window.closeProductModal = closeModals;
    $('productModal').addEventListener('click', e => { if (e.target === $('productModal')) closeModals(); });
    $('reviewImgModal').onclick = closeModals;
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModals();
        const active = document.querySelector('.modal.active');
        if (!active || e.key !== 'Tab') return;
        const targets = [...active.querySelectorAll('button, a[href], [tabindex="0"]')].filter(el => el.getClientRects().length);
        if (!targets.length) { e.preventDefault(); active.focus(); return; }
        const first = targets[0], last = targets.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.addEventListener('scroll', () => $('mainNav').classList.toggle('sticky', view !== 'gateway' && view !== 'categories' && scrollY > 50), { passive: true });
    function route() {
        const next = new URLSearchParams(location.search).get('store');
        if (Object.hasOwn(modes, next)) window.switchMode(next, { updateHistory: false });
        else window.backToGateway({ updateHistory: false });
    }
    window.addEventListener('popstate', route);
    route();
})();
