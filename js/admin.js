const db = window.athntaDb;
            const auth = window.athntaAuth;

     let adminMode = 'embroidery';

            const adminCollections = {
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

            function getCollection(type) {
                return db.collection(adminCollections[adminMode][type]);
            }

            function updateS() { localStorage.setItem('at', Date.now()); }
            function checkS() { if (localStorage.getItem('at') && (Date.now() - localStorage.getItem('at') > 3600000)) logout(); }
            setInterval(checkS, 30000);
            auth.onAuthStateChanged(u => { if (u) { updateS(); document.body.style.display = 'block'; init(); } else window.location.href = 'login.html'; });
            function logout() { localStorage.clear(); auth.signOut().then(() => window.location.href = 'login.html'); }

            function showToast(msg) {
                const t = document.getElementById('toast');
                t.innerText = msg; t.style.display = 'block';
                setTimeout(() => { t.style.display = 'none'; }, 3000);
            }

            async function startProgress() {
                document.getElementById('uploadProgress').style.display = 'block';
                let p = 0, bar = document.getElementById('pBar');
                return new Promise(res => {
                    let itv = setInterval(() => {
                        p += Math.random() * 15;
                        if (p >= 90) { clearInterval(itv); res(); }
                        bar.style.width = p + '%';
                    }, 150);
                });
            }

            function endProgress() {
                document.getElementById('pBar').style.width = '100%';
                setTimeout(() => {
                    document.getElementById('uploadProgress').style.display = 'none';
                    document.getElementById('pBar').style.width = '0%';
                }, 500);
            }

            function previewMultiple(input, containerId, zoneId) {
                const container = document.getElementById(containerId);
                container.innerHTML = '';
                if (input.files && input.files.length > 0) {
                    document.getElementById(zoneId).classList.add('has-img');
                    Array.from(input.files).forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (e) => { container.innerHTML += `<img src="${e.target.result}">`; };
                        reader.readAsDataURL(file);
                    });
                }
            }

           async function up(f) {
  const allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ]);

  const maxFileSize = 4 * 1024 * 1024;

  if (!f || !allowedTypes.has(f.type)) {
    throw new Error("يسمح فقط بصور JPG وPNG وWebP وGIF");
  }

  if (f.size > maxFileSize) {
    throw new Error("حجم الصورة يجب ألا يتجاوز 4 ميجابايت");
  }

  if (!auth || !auth.currentUser) {
    throw new Error("يجب تسجيل الدخول أولًا");
  }

  const idToken = await auth.currentUser.getIdToken();

  const formData = new FormData();
  formData.append("image", f, f.name || "image");

  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  const uploadUrl = isLocal
    ? "https://athnta-ten.vercel.app/api/upload-image"
    : "/api/upload-image";

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`
    },
    body: formData
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("استجابة غير صالحة من الخادم");
  }

  if (!response.ok || !result.url) {
    throw new Error(result.error || "فشل رفع الصورة");
  }

  return result.url;
}


            window.loadSubCats = (mId, sId, sel = '') => {
                const m = document.getElementById(mId).value, s = document.getElementById(sId);
                s.innerHTML = '<option value="">(بدون فرعي)</option>';
                if (m && siteCategories[m]) siteCategories[m].subs.forEach(sub => s.innerHTML += `<option value="${sub}" ${sub === sel ? 'selected' : ''}>${sub}</option>`);
            };

            async function saveProduct() {
                const n = document.getElementById('productName').value;
                const m = document.getElementById('productMainCat').value;
                const s = document.getElementById('productSubCat').value;
                const files = document.getElementById('productFile').files;

                if (!n || !m || files.length === 0) return alert("الرجاء إدخال البيانات المطلوبة");

                await startProgress();

                try {
                    let uploadedUrls = [];
                    for (let i = 0; i < files.length; i++) {
                        let url = await up(files[i]);
                        uploadedUrls.push(url);
                    }

                    await getCollection("products").add({
                        name: n,
                        mainCategory: m,
                        subCategory: s || "عام",
                        imageURLs: uploadedUrls,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    endProgress();
                    showToast("تم رفع المنتج! ✅");
                    document.getElementById('productName').value = '';
                    document.getElementById('productFile').value = '';
                    document.getElementById('prodPrevContainer').innerHTML = '';
                    document.getElementById('prodDZ').classList.remove('has-img');
                    init();

                } catch (error) {
                    endProgress(); // إيقاف شريط التحميل عشان ما يعلق
                    alert("حدث خطأ أثناء الرفع: " + error.message); // إظهار المشكلة لك مباشرة
                    console.error("Error details:", error);
                }
            }


            async function saveMainCategory() {
                const n = document.getElementById('newMainCat').value, f = document.getElementById('catFile').files[0];
                if (!n || !f) return alert("أكمل البيانات");
                await startProgress();
                const url = await up(f);
                const orderIndex = Object.keys(siteCategories).length;
                await getCollection("categories").doc(n).set({ imageUrl: url, subs: [], order: orderIndex });
                endProgress();
                showToast("تم إنشاء القسم! ✅");
                document.getElementById('newMainCat').value = '';
                document.getElementById('catPrevContainer').innerHTML = '';
                document.getElementById('catDZ').classList.remove('has-img');
                init();
            }

            async function saveSubCategory() {
                const m = document.getElementById('mainCatForSub').value, s = document.getElementById('newSubCat').value;
                if (!m || !s) return alert("أكمل البيانات");
                await startProgress();
                await getCollection("categories").doc(m).update({ subs: firebase.firestore.FieldValue.arrayUnion(s) });
                endProgress();
                showToast("تمت إضافة القسم الفرعي! ✅");
                document.getElementById('newSubCat').value = '';
                init();
            }

            // حفظ التقييمات
            window.saveReviews = async () => {
                const files = document.getElementById('reviewFile').files;
                if (files.length === 0) return alert("اختر صورة واحدة على الأقل");

                await startProgress();
                for (let i = 0; i < files.length; i++) {
                    let url = await up(files[i]);
                    await getCollection("reviews").add({ imageUrl: url, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                }
                endProgress();
                showToast("تم رفع الآراء بنجاح! ✅");
                document.getElementById('reviewFile').value = '';
                document.getElementById('revPrevContainer').innerHTML = '';
                document.getElementById('revDZ').classList.remove('has-img');
                init();
            }

            window.delRev = async (id) => {
                if (confirm("حذف هذا التقييم؟")) {
                    await getCollection("reviews").doc(id).delete();
                    showToast("تم الحذف 🗑️");
                    init();
                }
            };

            window.editSub = async (m, oldS) => {
                const newS = prompt("تعديل القسم الفرعي:", oldS);
                if (newS && newS !== oldS) {
                    await startProgress();
                    await getCollection("categories").doc(m).update({ subs: firebase.firestore.FieldValue.arrayRemove(oldS) });
                    await getCollection("categories").doc(m).update({ subs: firebase.firestore.FieldValue.arrayUnion(newS) });
                    const ps = await getCollection("products").where("mainCategory", "==", m).where("subCategory", "==", oldS).get();
                    const b = db.batch(); ps.forEach(d => b.update(d.ref, { subCategory: newS }));
                    await b.commit();
                    endProgress();
                    showToast("تم التعديل! ✅");
                    init();
                }
            };
            // دالة تعديل اسم القسم الرئيسي
            window.editCatName = async (oldName) => {
                const newName = prompt("تعديل اسم القسم الرئيسي:", oldName);
                if (!newName || newName.trim() === "" || newName === oldName) return;

                if (confirm(`هل أنت متأكد من تغيير الاسم إلى "${newName}"؟ سيتم نقل جميع المنتجات تلقائياً.`)) {
                    await startProgress();
                    try {
                        const catRef = getCollection("categories").doc(oldName);
                        const catDoc = await catRef.get();
                        const catData = catDoc.data();

                        // 1. إنشاء القسم بالاسم الجديد
                        await getCollection("categories").doc(newName).set(catData);

                        // 2. تحديث اسم القسم في جميع المنتجات المرتبطة
                        const ps = await getCollection("products").where("mainCategory", "==", oldName).get();
                        const batch = db.batch();
                        ps.forEach(d => batch.update(d.ref, { mainCategory: newName }));
                        await batch.commit();

                        // 3. حذف القسم القديم
                        await catRef.delete();

                        endProgress();
                        showToast("تم تغيير اسم القسم بنجاح! ✅");
                        init();
                    } catch (e) {
                        endProgress();
                        console.error(e);
                        alert("حدث خطأ أثناء التعديل.");
                    }
                }
            };

            // دالة تعديل صورة القسم الرئيسي
            window.editCatImage = async (catId) => {
                // إنشاء زر اختيار ملف مخفي برمجياً
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (confirm('هل أنت متأكد من رفع هذه الصورة كغلاف للقسم؟')) {
                        await startProgress();
                        const newUrl = await up(file);
                        await getCollection("categories").doc(catId).update({ imageUrl: newUrl });
                        endProgress();
                        showToast("تم تحديث صورة القسم! ✅");
                        init();
                    }
                };
                input.click(); // فتح نافذة اختيار الصورة
            };

            let currentImgUrls = [];
            window.renderEditImages = () => {
                const container = document.getElementById('editPrevContainer');
                if (currentImgUrls.length === 0) {
                    container.innerHTML = '<span style="color:#888;">لا توجد صور.</span>'; return;
                }
                container.innerHTML = currentImgUrls.map((url, index) => `
                <div class="edit-img-wrap">
                    <img src="${url}">
                    <button class="delete-img-btn" onclick="removeExistingImg(event, ${index})">×</button>
                </div>
            `).join('');
            };

            window.removeExistingImg = (event, index) => {
                event.stopPropagation();
                if (confirm("حذف هذه الصورة؟")) { currentImgUrls.splice(index, 1); renderEditImages(); }
            };

            window.openEdit = (id, n, m, s, imgUrlsStr) => {
                document.getElementById('editModal').classList.add('active');
                document.getElementById('editId').value = id;
                document.getElementById('editName').value = n;
                document.getElementById('editMainCat').value = m;
                currentImgUrls = JSON.parse(decodeURIComponent(imgUrlsStr));
                renderEditImages();
                document.getElementById('newEditPrevContainer').innerHTML = '';
                document.getElementById('editFile').value = '';
                document.getElementById('editDZ').classList.remove('has-img');
                loadSubCats('editMainCat', 'editSubCat', s);
            };

            window.closeModal = () => document.getElementById('editModal').classList.remove('active');

            async function updateProduct() {
                const id = document.getElementById('editId').value;
                const n = document.getElementById('editName').value;
                const m = document.getElementById('editMainCat').value;
                const s = document.getElementById('editSubCat').value;
                const files = document.getElementById('editFile').files;

                await startProgress();
                let finalUrlsToSave = [...currentImgUrls];
                if (files.length > 0) {
                    for (let i = 0; i < files.length; i++) {
                        let url = await up(files[i]);
                        finalUrlsToSave.push(url);
                    }
                }
                if (finalUrlsToSave.length === 0) {
                    endProgress(); alert("يجب وجود صورة واحدة على الأقل!"); return;
                }
                await getCollection("products").doc(id).update({ name: n, mainCategory: m, subCategory: s || "عام", imageURLs: finalUrlsToSave });
                endProgress(); closeModal(); showToast("تم الحفظ! ✅"); init();
            }

            window.delP = async (id) => { if (confirm("حذف المنتج؟")) { await getCollection("products").doc(id).delete(); showToast("تم الحذف 🗑️"); init(); } };
            window.delC = async (id) => { if (confirm("حذف القسم؟")) { await getCollection("categories").doc(id).delete(); showToast("تم الحذف 🗑️"); init(); } };
            window.delS = async (m, s) => { if (confirm("حذف الفرعي؟")) { await getCollection("categories").doc(m).update({ subs: firebase.firestore.FieldValue.arrayRemove(s) }); showToast("تم الحذف 🗑️"); init(); } };

            window.switchTab = (e, id) => {
                document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                if (e) e.target.classList.add('active'); else document.getElementById('btnProductsTab').classList.add('active');
                document.getElementById(id).classList.add('active');
            };

            window.toggleAccordion = (headerEl, groupClass) => {
                const content = headerEl.nextElementSibling;
                const isOpening = !content.classList.contains('open');

                document.querySelectorAll(`.${groupClass}`).forEach(el => {
                    el.classList.remove('open');
                    const arrow = el.previousElementSibling.querySelector('.arrow');
                    if (arrow) arrow.innerText = '▼';
                });

                if (isOpening) {
                    content.classList.add('open');
                    const myArrow = headerEl.querySelector('.arrow');
                    if (myArrow) myArrow.innerText = '▲';
                }
            };
            window.switchAdminMode = async function (mode) {
                adminMode = mode;

                document
                    .getElementById('adminEmbroideryTab')
                    .classList.toggle('active', mode === 'embroidery');

                document
                    .getElementById('adminPrintingTab')
                    .classList.toggle('active', mode === 'printing');

                document.getElementById('currentModeTitle').innerText =
                    mode === 'printing'
                        ? 'إدارة منتجات وأقسام الطباعة'
                        : 'إدارة منتجات وأقسام التطريز';

                // العودة تلقائيًا إلى تبويب المنتجات
                document.querySelectorAll('.tabs button')
                    .forEach(button => button.classList.remove('active'));

                document
                    .getElementById('btnProductsTab')
                    .classList.add('active');

                document.querySelectorAll('.tab-content')
                    .forEach(content => content.classList.remove('active'));

                document
                    .getElementById('productsTab')
                    .classList.add('active');

                // إعادة تحميل بيانات النوع المحدد
                await init();
            };
            let siteCategories = {};

            async function init() {
                try {
                    siteCategories = {};
                    // تحميل التصنيفات
                    const [cSnap, pSnap, rSnap] = await Promise.all([
                        getCollection("categories").get(),
                        getCollection("products").orderBy("timestamp", "desc").get(),
                        getCollection("reviews").orderBy("timestamp", "desc").get()
                    ]);
                    let catsArray = [];
                    cSnap.forEach(doc => {
                        let data = doc.data(); data.id = doc.id;
                        catsArray.push(data); siteCategories[doc.id] = data;
                    });
                    catsArray.sort((a, b) => (a.order || 0) - (b.order || 0));

                    const pM = document.getElementById('productMainCat'), sM = document.getElementById('mainCatForSub'), eM = document.getElementById('editMainCat');
                    pM.innerHTML = sM.innerHTML = eM.innerHTML = '<option value="">اختر القسم</option>';
                    catsArray.forEach(cat => {
                        const opt = `<option value="${cat.id}">${cat.id}</option>`;
                        pM.innerHTML += opt; sM.innerHTML += opt; eM.innerHTML += opt;
                    });

                    const cL = document.getElementById('categoriesAdminList');
                    let cHTML = '';
                    catsArray.forEach(cat => {
                        let subsHTML = (cat.subs || []).map(s => `
                        <div class="sub-tag">
                            <span>${s}</span>
                            <div>
                                <button onclick="editSub('${cat.id}','${s}')" style="background:none; border:none; color:var(--primary); font-size:18px; margin-left:10px;">✎</button>
                                <button onclick="delS('${cat.id}','${s}')" style="background:none; border:none; color:red; font-size:18px;">×</button>
                            </div>
                        </div>
                    `).join('');

                        cHTML += `
                    <div class="cat-sort-item" data-id="${cat.id}">
                        <div class="accordion-header" onclick="toggleAccordion(this, 'cat-acc')">
                            <div style="display:flex; align-items:center;">
                                <span class="drag-handle">☰</span>
                                <img src="${cat.imageUrl}" style="width:40px; height:40px; border-radius:5px; object-fit:cover; margin-left:10px;">
                                <strong>${cat.id}</strong>
                            </div>
                            <span class="arrow">▼</span>
                        </div>
                        <div class="accordion-content cat-acc">
                            
                            <div class="btn-group-large" style="margin-bottom: 15px;">
                                <button class="edit-btn" onclick="editCatName('${cat.id.replace(/'/g, "\\'")}')">تغيير الاسم ✎</button>
                                <button class="edit-btn" onclick="editCatImage('${cat.id.replace(/'/g, "\\'")}')">تغيير الصورة 🖼️</button>
                            </div>

                            <div style="border-top: 1px solid #333; margin: 15px 0; padding-top: 15px;">
                                <strong style="color:var(--primary); font-size:14px; margin-bottom:10px; display:block;">الأقسام الفرعية:</strong>
                                ${subsHTML || '<p style="color:#666; font-size:14px;">لا توجد فرعيات</p>'}
                            </div>

                            <button class="danger-btn" style="width:100%; padding:10px; margin-top:15px; border-radius:8px;" onclick="delC('${cat.id}')">حذف القسم بالكامل</button>
                        </div>
                    </div>`;
                    });
                    cL.innerHTML = cHTML;

                    if (typeof Sortable !== 'undefined') {
                        Sortable.create(cL, {
                            handle: '.drag-handle', animation: 150,
                            onEnd: async function () {
                                const items = document.querySelectorAll('.cat-sort-item');
                                const batch = db.batch();
                                items.forEach((item, index) => {
                                    batch.update(
                                        getCollection("categories").doc(item.getAttribute('data-id')),
                                        { order: index }
                                    );
                                });
                                await batch.commit();
                                showToast("تم تحديث الترتيب! ✅");
                            }
                        });
                    }

                    // تحميل المنتجات

                    let allProds = [];
                    pSnap.forEach(doc => { let d = doc.data(); d.id = doc.id; allProds.push(d); });

                    const pL = document.getElementById('productsList');
                    let pHTML = '';
                    catsArray.forEach(cat => {
                        let catProds = allProds.filter(p => p.mainCategory === cat.id);
                        if (catProds.length === 0) return;

                        let subsList = [...(cat.subs || []), "عام"];
                        let subsHTML = subsList.map(sub => {
                            let subProds = catProds.filter(p => p.subCategory === sub || (!p.subCategory && sub === "عام"));
                            if (subProds.length === 0) return '';

                            return `
                        <div class="accordion-header sub-header" onclick="toggleAccordion(this, 'sub-content')">
                            <strong>↳ ${sub}</strong> <span class="arrow">▼</span>
                        </div>
                        <div class="accordion-content sub-content">
                            ${subProds.map(p => `
                                <div class="list-item">
                                    <div class="item-row">
                                        <img src="${(p.imageURLs && p.imageURLs[0]) || p.imageUrl || ''}">
                                        <div><strong>${p.name}</strong></div>
                                    </div>
                                    <div class="btn-group-large">
                                        <button class="edit-btn" onclick="openEdit('${p.id}','${p.name.replace(/'/g, "\\'")}','${p.mainCategory}','${p.subCategory}','${encodeURIComponent(JSON.stringify(p.imageURLs || []))}')">تعديل</button>
                                        <button class="danger-btn" onclick="delP('${p.id}')">حذف</button>
                                    </div>
                                </div>`).join('')}
                        </div>`;
                        }).join('');

                        pHTML += `
                    <div style="margin-bottom:10px;">
                        <div class="accordion-header" onclick="toggleAccordion(this, 'prod-acc')">
                            <strong>📁 ${cat.id}</strong> <span class="arrow">▼</span>
                        </div>
                        <div class="accordion-content prod-acc" style="padding: 10px;">${subsHTML}</div>
                    </div>`;
                    });
                    pL.innerHTML = pHTML || '<p style="text-align:center;">لا توجد منتجات.</p>';

                    // تحميل التقييمات في صفحة الإدارة

                    let rHTML = '';
                    rSnap.forEach(doc => {
                        let r = doc.data();
                        rHTML += `
                        <div class="edit-img-wrap" style="margin-bottom:10px;">
                            <img src="${r.imageUrl}" style="width:100px; height:100px;">
                            <button class="delete-img-btn" onclick="delRev('${doc.id}')">×</button>
                        </div>
                    `;
                    });
                    document.getElementById('reviewsAdminList').innerHTML = rHTML || '<span style="color:#888;">لا توجد آراء مسجلة حتى الآن.</span>';

                } catch (e) { console.error("Error in init:", e); }
            }
