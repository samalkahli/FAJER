(function () {
    'use strict';
    // Only the public production gallery is measured; previews and local tests stay out.
    if (location.hostname !== 'athnta-ten.vercel.app' || window.parent !== window ||
        new URLSearchParams(location.search).has('themePreview') ||
        !document.getElementById('store-gateway') || window.StoreAnalytics) return;
    const id = 'G-YJ9G35FSL3';
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    const emit = (name, values) => window.gtag('event', name, { send_to: id, ...values });
    window.gtag('js', new Date());
    window.gtag('config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    const tag = document.createElement('script');
    tag.async = true; tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.append(tag);
    let last = '', previousStore = '', previousLocation = document.referrer, product = null;
    const stores = { embroidery: 'ATHNTA', printing: 'LAVINTA', gateway: 'الرئيسية' };
    const clean = value => String(value || '').slice(0, 100);
    function screen(view, mode, category) {
        const store = view === 'gateway' ? 'gateway' : mode;
        if (!Object.hasOwn(stores, store)) return;
        const key = JSON.stringify([view, store, view === 'products' ? category : '']);
        if (key === last) return;
        last = key; product = null;
        const url = new URL(location.origin + '/');
        // Keep campaign attribution while excluding arbitrary query strings.
        const query = new URLSearchParams(location.search);
        for (const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid']) if(query.has(k)) url.searchParams.set(k,query.get(k));
        if (store !== 'gateway') url.searchParams.set('store',store);
        if (view === 'products') { url.searchParams.set('view','products'); url.searchParams.set('category',clean(category)); }
        if (view === 'reviews') url.searchParams.set('view','reviews');
        const pageTitle = view === 'gateway' ? 'الرئيسية | اختيار المتجر' : stores[store] + ' | ' + ({categories:'الأقسام',products:clean(category),reviews:'آراء العملاء'}[view] || view);
        const context = {page_title:pageTitle,page_location:url.href,page_referrer:previousLocation,store:store,store_name:stores[store]};
        window.gtag('set',{page_title:pageTitle,page_location:url.href});
        emit('page_view',context); previousLocation = url.href;
        if (store !== 'gateway' && store !== previousStore) emit('visit_' + store,context);
        previousStore = store;
    }
    function item(mode, value) {
        if (!Object.hasOwn(stores,mode) || mode === 'gateway') return;
        product = {item_id:clean(value.id),item_name:clean(value.name),item_brand:stores[mode],item_category:clean(value.mainCategory)};
        emit('view_item',{store:mode,store_name:stores[mode],items:[product]});
    }
    document.addEventListener('click',event => {
        const link = event.target.closest?.('a[href]'); if(!link) return;
        let url; try {url=new URL(link.href);} catch {return;}
        if(url.hostname!=='wa.me'&&url.hostname!=='api.whatsapp.com') return;
        const mode=document.body.dataset.mode;
        if(!['embroidery','printing'].includes(mode)) return;
        const values={store:mode,store_name:stores[mode],placement:link.id==='modalWhatsappBtn'?'product':'general'};
        if(values.placement==='product'&&product) Object.assign(values,{item_id:product.item_id,item_name:product.item_name});
        emit('whatsapp_'+mode,values);
    });
    window.StoreAnalytics = Object.freeze({screen,item});
})();
