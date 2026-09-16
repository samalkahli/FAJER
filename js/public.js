const db = window.athntaDb;

let allProducts = [];
let categoriesData = {};
let allReviews = [];
let modalSwiperInstance = null;

// النوع الحالي للموقع
let currentMode = 'embroidery';
const brandThemes = {
    embroidery: {
        pageTitle: 'ATHNTA | المعرض',
        logo: 'https://i.ibb.co/XftPtTSg/image.png',
        logoAlt: 'ATHNTA Logo',
        subtitle: 'نصنع قطع فنية 🧵',
        sectionTitle: 'هنا أعمال التطريز المنفذة خصيصاً لكم',
        themeColor: '#050505'
    },

    printing: {
        pageTitle: 'LAVINTA | الطباعة',
        logo: 'assets/lavinta-logo.jpeg',
        logoAlt: 'LAVINTA Logo',
        subtitle: 'نطبع فكرتك بأسلوبك 🤍',
        sectionTitle: 'هنا أعمال الطباعة المنفذة خصيصاً لكم',
        themeColor: '#5E4A3F'
    }
};

function applyBrandTheme(mode) {
    const theme = brandThemes[mode] || brandThemes.embroidery;

    document.body.dataset.mode = mode;
    document.title = theme.pageTitle;

    const logo = document.getElementById('brandLogo');
    const subtitle = document.getElementById('subHeaderText');
    const sectionTitle = document.getElementById('mainSectionTitle');
    const themeColor = document.getElementById('themeColor');

    if (logo) {
        logo.src = theme.logo;
        logo.alt = theme.logoAlt;
    }

    if (subtitle) {
        subtitle.innerText = theme.subtitle;
    }

    if (sectionTitle) {
        sectionTitle.innerText = theme.sectionTitle;
    }

    if (themeColor) {
        themeColor.setAttribute('content', theme.themeColor);
    }
}


window.backToCategories = function () {
    // نحفظ الوضع الحالي بدون تغييره
    const mode = currentMode;

    // إبقاء هوية المتجر الحالية
    applyBrandTheme(mode);

    // تحديث التبويب النشط
    document
        .getElementById('embroideryTab')
        .classList.toggle('active', mode === 'embroidery');

    document
        .getElementById('printingTab')
        .classList.toggle('active', mode === 'printing');

    // إظهار الأقسام وإخفاء المنتجات والآراء
    document.getElementById('categories-section').style.display = 'block';
    document.getElementById('products-section').style.display = 'none';
    document.getElementById('reviews-section').style.display = 'none';
    document.getElementById('reviewsBtnWrapper').style.display = 'block';
    document.getElementById('subHeaderText').style.display = 'block';

    // إزالة تثبيت الشريط العلوي
    document.getElementById('mainNav').classList.remove('sticky');

    // تنظيف المحتوى الداخلي فقط
    const filters = document.getElementById('filters-container');
    const products = document.getElementById('products-grid');
    const reviews = document.getElementById('reviews-grid');

    if (filters) filters.innerHTML = '';
    if (products) products.innerHTML = '';
    if (reviews) reviews.innerHTML = '';

    // إعادة عرض أقسام الوضع الحالي
    loadData(mode);

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
};
// أسماء مجموعات Firebase لكل نوع
const modeCollections = {
    embroidery: {
        categories: 'categories',
        products: 'products',
        reviews: 'reviews'
    },

    printing: {
        categories: 'printCategories',
        products: 'printProducts',
        reviews: 'printReviews'
    }
};
window.onscroll = function () {
    const nav = document.getElementById('mainNav');
    const pSec = document.getElementById('products-section');
    const rSec = document.getElementById('reviews-section');
    if (pSec.style.display === 'block' || rSec.style.display === 'block') {
        if (window.pageYOffset > 50) nav.classList.add('sticky');
        else nav.classList.remove('sticky');
    } else {
        nav.classList.remove('sticky');
    }
};

function formatURL(url) { return url && url.startsWith('http') ? url : 'https://via.placeholder.com/400x400/222/fff?text=Image'; }

const dataCache = {
    embroidery: null,
    printing: null
};

let loadRequestId = 0;

function renderCategories(catsArray) {
    const catGrid = document.getElementById('categories-grid');
    catGrid.innerHTML = '';

    if (catsArray.length === 0) {
        catGrid.innerHTML = '<p class="empty-state">لا توجد أقسام مضافة حاليًا</p>';
        return;
    }

    catsArray.forEach(data => {
        catGrid.innerHTML += `
                    <div class="glass-card cat-card" onclick="showProducts('${data.id}')">
                        <div class="image-container">
                            <img src="${formatURL(data.imageUrl)}" loading="lazy" alt="${data.id}">
                        </div>
                        <h3>${data.id}</h3>
                    </div>
                `;
    });
}

async function loadData(mode = currentMode, options = {}) {
    const catGrid = document.getElementById('categories-grid');
    if (!catGrid) return;

    currentMode = mode;
    const requestId = ++loadRequestId;

    if (dataCache[mode] && !options.force) {
        categoriesData = dataCache[mode].categories;
        allProducts = dataCache[mode].products;
        allReviews = dataCache[mode].reviews;
        renderCategories(dataCache[mode].catsArray);
        return;
    }

    catGrid.innerHTML = '<p class="empty-state">جاري تحميل الأقسام...</p>';
    const selectedCollections = modeCollections[mode];

    try {
        const [cSnap, pSnap, rSnap] = await Promise.all([
            db.collection(selectedCollections.categories).get(),
            db.collection(selectedCollections.products).orderBy('timestamp', 'desc').get(),
            db.collection(selectedCollections.reviews).orderBy('timestamp', 'desc').get()
        ]);

        if (requestId !== loadRequestId || mode !== currentMode) return;

        const nextCategories = {};
        const catsArray = [];
        cSnap.forEach(doc => {
            const data = { ...doc.data(), id: doc.id };
            catsArray.push(data);
            nextCategories[doc.id] = data;
        });
        catsArray.sort((a, b) => (a.order || 0) - (b.order || 0));

        const nextProducts = [];
        pSnap.forEach(doc => nextProducts.push({ ...doc.data(), id: doc.id }));

        const nextReviews = [];
        rSnap.forEach(doc => nextReviews.push(doc.data()));

        dataCache[mode] = {
            categories: nextCategories,
            products: nextProducts,
            reviews: nextReviews,
            catsArray
        };

        categoriesData = nextCategories;
        allProducts = nextProducts;
        allReviews = nextReviews;
        renderCategories(catsArray);
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
        if (requestId === loadRequestId) {
            catGrid.innerHTML = '<p class="empty-state">حدث خطأ أثناء تحميل البيانات</p>';
        }
    }
}

window.toggleMoreFilters = (e) => {
    e.stopPropagation();
    document.getElementById('moreFiltersDropdown').classList.toggle('show');
}

window.closeMoreFilters = () => {
    const dropdown = document.getElementById('moreFiltersDropdown');
    if (dropdown) dropdown.classList.remove('show');
}

document.addEventListener('click', closeMoreFilters);

window.showProducts = (categoryId) => {
    document.getElementById('categories-section').style.display = 'none';
    document.getElementById('subHeaderText').style.display = 'none';
    document.getElementById('reviewsBtnWrapper').style.display = 'none';
    document.getElementById('reviews-section').style.display = 'none';
    document.getElementById('products-section').style.display = 'block';

    document.getElementById('category-title').innerText = categoryId;
    const filtersBox = document.getElementById('filters-container');
    let filtersHTML = `<button class="filter-btn active" onclick="filterData('${categoryId}', 'all', event)">الكل</button>`;
    let subs = categoriesData[categoryId].subs || [];

    subs.forEach((sub, index) => {
        if (index < 3) filtersHTML += `<button class="filter-btn" onclick="filterData('${categoryId}', '${sub}', event)">${sub}</button>`;
    });

    if (subs.length > 3) {
        filtersHTML += `<div class="more-filters-container"><button class="filter-btn" onclick="toggleMoreFilters(event)">المزيد ▾</button><div id="moreFiltersDropdown" class="more-filters-dropdown">`;
        for (let i = 3; i < subs.length; i++) {
            filtersHTML += `<button class="filter-btn dropdown-item" onclick="filterData('${categoryId}', '${subs[i]}', event)">${subs[i]}</button>`;
        }
        filtersHTML += `</div></div>`;
    }

    filtersBox.innerHTML = filtersHTML;
    filterData(categoryId, 'all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.filterData = (mainCat, subCat, event) => {
    if (event) {
        document.querySelectorAll('.filter-btn:not(.dropdown-item)').forEach(btn => btn.classList.remove('active'));
        if (event.target.classList.contains('dropdown-item')) {
            document.querySelector('.more-filters-container > button').classList.add('active');
        } else {
            event.target.classList.add('active');
        }
    }

    let filtered = allProducts.filter(p => p.mainCategory === mainCat);
    if (subCat !== 'all') filtered = filtered.filter(p => p.subCategory === subCat);

    const prodGrid = document.getElementById('products-grid');
    if (filtered.length === 0) {
        prodGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 1.2rem;">لا توجد منتجات هنا حالياً.</p>';
        return;
    }

    prodGrid.innerHTML = filtered.map((p) => {
        let urls = p.imageURLs || (p.imageUrl ? [p.imageUrl] : []);
        const firstImg = urls.length > 0 ? urls[0] : 'https://via.placeholder.com/400';
        const iconMultiple = urls.length > 1 ? `<div class="multi-img-icon"><svg viewBox="0 0 24 24"><path d="M22 4h-14c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2v-14c0-1.103-.897-2-2-2zm-2.586 11l-2.707-2.707c-.391-.391-1.023-.391-1.414 0l-1.293 1.293-3.293-3.293c-.391-.391-1.023-.391-1.414 0l-3.293 3.293v-8.586h14v10zm-13.414-13h14v2h-14v-2zm-4 4h2v14h-14v-14z"/></svg>${urls.length}</div>` : '';
        const pStr = encodeURIComponent(JSON.stringify(p));
        return `
                    <div class="glass-card product-card">
                        <div class="image-container" onclick="openProductModal('${pStr}')">
                            <img src="${formatURL(firstImg)}" loading="lazy" alt="${p.name}">
                            ${iconMultiple}
                            <div class="hover-overlay"><span>عرض التفاصيل</span></div>
                        </div>
                        <h4>${p.name}</h4>
                    </div>
                `;
    }).join('');
}

// فتح قسم الآراء
window.showReviews = () => {
    document.getElementById('categories-section').style.display = 'none';
    document.getElementById('subHeaderText').style.display = 'none';
    document.getElementById('products-section').style.display = 'none';
    document.getElementById('reviewsBtnWrapper').style.display = 'none';

    document.getElementById('reviews-section').style.display = 'block';

    const rGrid = document.getElementById('reviews-grid');
    if (allReviews.length === 0) {
        rGrid.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:1.2rem;">لا توجد آراء حالياً.</p>';
    } else {
        rGrid.innerHTML = allReviews.map(r => `
                    <div class="review-img-wrap">
                        <img src="${r.imageUrl}" loading="lazy" onclick="openReviewImgModal('${r.imageUrl}')">
                    </div>
                `).join('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.openReviewImgModal = (url) => {
    document.getElementById('expandedReviewImg').src = url;
    document.getElementById('reviewImgModal').classList.add('active');
};

window.openProductModal = (pStr) => {
    const p = JSON.parse(decodeURIComponent(pStr));
    let urls = p.imageURLs || (p.imageUrl ? [p.imageUrl] : []);
    const wrapper = document.getElementById('modalSwiperWrapper');
    wrapper.innerHTML = urls.map(u => `<div class="swiper-slide"><img src="${formatURL(u)}" alt="${p.name}"></div>`).join('');
    document.getElementById('modalProductTitle').innerText = p.name;
    const brandName = currentMode === 'printing'
        ? 'LAVINTA'
        : 'ATHNTA';

    const msg = `السلام عليكم، أود الطلب/الاستفسار عن منتج ${brandName}: ${p.name} الموجود بقسم ${p.mainCategory}`;
    document.getElementById('modalWhatsappBtn').href = `https://wa.me/966552125258?text=${encodeURIComponent(msg)}`;
    document.getElementById('productModal').classList.add('active');
    if (modalSwiperInstance) { modalSwiperInstance.destroy(true, true); }
    modalSwiperInstance = new Swiper(".modalSwiper", { navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" }, pagination: { el: ".swiper-pagination", clickable: true }, grabCursor: true, loop: urls.length > 1 });
};

window.closeProductModal = () => document.getElementById('productModal').classList.remove('active');
document.getElementById('productModal').addEventListener('click', function (e) { if (e.target === this) closeProductModal(); });
function showGateway() {
    const gateway = document.getElementById('store-gateway');
    const app = document.getElementById('store-app');

    if (gateway) gateway.hidden = false;
    if (app) app.hidden = true;

    loadRequestId += 1;

    document.body.dataset.mode = 'gateway';
    document.title = 'ATHNTA × LAVINTA | اختر متجرك';

    const themeColor = document.getElementById('themeColor');

    if (themeColor) {
        themeColor.setAttribute('content', '#171110');
    }

    const nav = document.getElementById('mainNav');

    if (nav) {
        nav.classList.remove('sticky');
    }

    window.scrollTo({
        top: 0,
        behavior: 'auto'
    });
}

window.backToGateway = function (options = {}) {
    const updateHistory = options.updateHistory !== false;

    if (updateHistory) {
        const url = new URL(window.location.href);

        url.searchParams.delete('store');

        window.history.pushState(
            { page: 'gateway' },
            '',
            url.pathname + url.search + url.hash
        );
    }

    showGateway();
};

window.enterStore = function (mode) {
    return window.switchMode(mode);
};

window.switchMode = async function (mode, options = {}) {
    if (!modeCollections[mode]) {
        return;
    }

    currentMode = mode;

    const gateway = document.getElementById('store-gateway');
    const app = document.getElementById('store-app');

    if (gateway) gateway.hidden = true;
    if (app) app.hidden = false;

    applyBrandTheme(mode);

    document
        .getElementById('embroideryTab')
        ?.classList.toggle('active', mode === 'embroidery');

    document
        .getElementById('printingTab')
        ?.classList.toggle('active', mode === 'printing');

    document.getElementById('categories-section').style.display = 'block';
    document.getElementById('products-section').style.display = 'none';
    document.getElementById('reviews-section').style.display = 'none';
    document.getElementById('reviewsBtnWrapper').style.display = 'block';
    document.getElementById('subHeaderText').style.display = 'block';

    if (options.updateHistory !== false) {
        const url = new URL(window.location.href);

        if (url.searchParams.get('store') !== mode) {
            url.searchParams.set('store', mode);

            window.history.pushState(
                { store: mode },
                '',
                url.pathname + url.search + url.hash
            );
        }
    }

    await loadData(mode);

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
};

window.addEventListener('popstate', function () {
    const mode = new URLSearchParams(window.location.search).get('store');

    if (modeCollections[mode]) {
        window.switchMode(mode, {
            updateHistory: false
        });
    } else {
        showGateway();
    }
});

function initializeGateway() {
    const mode = new URLSearchParams(window.location.search).get('store');

    if (modeCollections[mode]) {
        window.switchMode(mode, {
            updateHistory: false
        });
    } else {
        showGateway();
    }
}

initializeGateway();
function setupGatewayMotion() {
    const cards = document.querySelectorAll('.gateway-card');

    if (!cards.length) {
        return;
    }

    const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    cards.forEach((card) => {
        function resetCard() {
            card.style.setProperty('--pointer-x', '50%');
            card.style.setProperty('--pointer-y', '50%');
            card.style.setProperty('--tilt-x', '0deg');
            card.style.setProperty('--tilt-y', '0deg');
            card.classList.remove('is-pressed');
        }

        card.addEventListener('pointermove', function (event) {
            const rect = card.getBoundingClientRect();

            const x = Math.max(
                0,
                Math.min(
                    100,
                    ((event.clientX - rect.left) / rect.width) * 100
                )
            );

            const y = Math.max(
                0,
                Math.min(
                    100,
                    ((event.clientY - rect.top) / rect.height) * 100
                )
            );

            card.style.setProperty('--pointer-x', `${x}%`);
            card.style.setProperty('--pointer-y', `${y}%`);

            if (!reduceMotion && event.pointerType === 'mouse') {
                const rotateX = (50 - y) * 0.12;
                const rotateY = (x - 50) * 0.12;

                card.style.setProperty('--tilt-x', `${rotateX}deg`);
                card.style.setProperty('--tilt-y', `${rotateY}deg`);
            }
        });

        card.addEventListener('pointerdown', function (event) {
            card.classList.add('is-pressed');

            if (event.pointerType === 'touch') {
                card.setPointerCapture?.(event.pointerId);
            }
        });

        card.addEventListener('pointerup', function () {
            card.classList.remove('is-pressed');
        });

        card.addEventListener('pointercancel', resetCard);
        card.addEventListener('pointerleave', resetCard);
    });
}

setupGatewayMotion();