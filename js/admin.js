/* Admin: safe DOM rendering, serialized writes, captured store, no credential storage. */
(function () {
    'use strict';
    const U = window.StoreUI, db = window.athntaDb, auth = window.athntaAuth;
    const $ = id => document.getElementById(id);
    const collections = {
        embroidery: { categories: 'categories', products: 'products', reviews: 'reviews' },
        printing: { categories: 'printCategories', products: 'printProducts', reviews: 'printReviews' }
    };
    let mode = 'embroidery', ready = false, busy = false, loading = false, generation = 0, sortable = null, lastActivity = Date.now();
    let cats = [], products = [], reviews = [], currentImages = [], editMode = null, activeTab = 'productsTab';
    const cache = new Map();
    const col = (type, selected = mode) => db.collection(collections[selected][type]);
    const data = snap => snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    const api = path => path;
    let toastTimer;
    function toast(text) {
        $('toast').textContent = text; $('toast').style.display = 'block';
        clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').style.display = 'none', 4500);
    }
    function name(value) {
        const text = String(value || '').trim();
        if (!text || text.length > 180) throw new Error('أدخل اسما من 1 إلى 180 حرفا');
        return text;
    }
    function categoryName(value) {
        const text = name(value);
        if (text.includes('/') || text === '.' || text === '..' || /^__.*__$/.test(text)) throw new Error('اسم القسم يحتوي رموزا غير مسموحة');
        return text;
    }
    function selections(mainId, subId, selected = '') {
        const main = $(mainId).value, select = $(subId);
        select.replaceChildren(new Option('(بدون فرعي)', ''));
        const cat = cats.find(c => c.id === main);
        for (const sub of (cat && Array.isArray(cat.subs) ? cat.subs : [])) select.add(new Option(sub, sub, false, sub === selected));
        if (selected && !Array.from(select.options).some(option => option.value === selected)) select.add(new Option(selected,selected,true,true));
    }
    window.loadSubCats = selections;
    window.logout = async () => {
        if (busy) { toast('انتظر اكتمال العملية الحالية'); return; }
        ready = false; cache.clear(); localStorage.removeItem('at');
        await auth.signOut(); location.replace('login.html');
    };
    for (const event of ['pointerdown','keydown','touchstart']) document.addEventListener(event, () => { lastActivity = Date.now(); }, { passive: true });
    setInterval(() => { if (ready && !busy && Date.now() - lastActivity > 3600000) window.logout(); }, 30000);
    async function run(task) {
        if (!ready || busy || loading) return;
        busy = true;
        const selected = mode;
        const controls = [...document.querySelectorAll('button, input, select')].filter(el => !el.disabled);
        controls.forEach(el => el.disabled = true);
        if (sortable) sortable.option('disabled', true);
        $('uploadProgress').style.display = 'block';
        $('pBar').style.width = '20%';
        try {
            await task(selected);
            cache.delete(selected);
            toast('تمت العملية بنجاح ✅');
        } catch (error) {
            toast(error.message || 'تعذر تنفيذ العملية');
            console.error('Admin operation failed:', error.code || error.name);
        } finally {
            busy = false;
            controls.forEach(el => { if (el.isConnected) el.disabled = false; });
            $('uploadProgress').style.display = 'none';
            if (sortable) sortable.option('disabled', false);
            await init(true);
        }
    }
    async function prepareImage(file) {
        if (!file || !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('اختر صورة JPG أو PNG أو WebP أو GIF');
        if (file.size > 16 * 1024 * 1024) throw new Error('الصورة كبيرة جدا. الحد قبل التحسين 16 ميجابايت');
        if (file.type === 'image/gif') {
            if (file.size > 4 * 1024 * 1024) throw new Error('GIF يجب ألا يتجاوز 4 ميجابايت');
            return file;
        }
        const url = URL.createObjectURL(file);
        try {
            const image = new Image();
            await new Promise((resolve,reject) => { image.onload=resolve; image.onerror=() => reject(new Error('تعذر فتح الصورة')); image.src=url; });
            const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
            if (scale === 1 && file.size < 600 * 1024) return file;
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.88));
            const result = blob && blob.size < file.size ? new File([blob], 'image.' + (blob.type === 'image/webp' ? 'webp' : 'png'), { type: blob.type }) : file;
            if (result.size > 4 * 1024 * 1024) throw new Error('حجم الصورة بعد التحسين يتجاوز 4 ميجابايت');
            return result;
        } finally { URL.revokeObjectURL(url); }
    }
    async function upload(file) {
        const optimized = await prepareImage(file);
        const token = await auth.currentUser.getIdToken();
        const body = new FormData(); body.append('image', optimized, optimized.name);
        const result = await U.fetchJSON(api('/api/upload-image'), { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body }, 45000);
        if (!result.url || !result.url.startsWith('https://i.ibb.co/')) throw new Error('رابط صورة غير صالح');
        return result.url;
    }
    async function uploadMany(files) {
        const list = Array.from(files);
        if (list.length > 12) throw new Error('اختر 12 صورة كحد أقصى في الدفعة');
        const urls = new Array(list.length);
        let next = 0, finished = 0;
        // Two workers, settle both before releasing the write lock after any failure.
        const worker = async () => {
            while (next < list.length) {
                const i = next++;
                urls[i] = await upload(list[i]);
                $('pBar').style.width = (20 + (++finished / list.length) * 65) + '%';
            }
        };
        const results = await Promise.allSettled([worker(), worker()]);
        const failed = results.find(r => r.status === 'rejected');
        if (failed) throw failed.reason;
        return urls;
    }
    window.previewMultiple = (input, target, zone) => {
        const container = $(target); container.replaceChildren();
        $(zone).classList.toggle('has-img', input.files.length > 0);
        Array.from(input.files).slice(0,12).forEach(file => {
            const url = URL.createObjectURL(file), image = document.createElement('img');
            image.alt = 'معاينة الصورة';
            image.onload = image.onerror = () => URL.revokeObjectURL(url);
            image.src = url; container.append(image);
        });
    };
    function clearUpload(input, target, zone) { $(input).value = ''; $(target).replaceChildren(); $(zone).classList.remove('has-img'); }
    const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
    window.saveProduct = () => run(async selected => {
        const n = name($('productName').value), m = $('productMainCat').value, s = $('productSubCat').value;
        if (!cats.some(c => c.id === m) || !$('productFile').files.length) throw new Error('اختر القسم وصور المنتج');
        const urls = await uploadMany($('productFile').files);
        await col('products',selected).add({ name:n, mainCategory:m, subCategory:s || 'عام', imageURLs:urls, timestamp:stamp() });
        $('productName').value = ''; clearUpload('productFile','prodPrevContainer','prodDZ');
    });
    window.saveMainCategory = () => run(async selected => {
        const n = categoryName($('newMainCat').value), ref = col('categories',selected).doc(n);
        if ((await ref.get()).exists) throw new Error('يوجد قسم بهذا الاسم بالفعل');
        const imageUrl = await upload($('catFile').files[0]);
        await db.runTransaction(async tx => {
            if ((await tx.get(ref)).exists) throw new Error('يوجد قسم بهذا الاسم بالفعل');
            tx.set(ref, { imageUrl, subs:[], order:cats.length });
        });
        $('newMainCat').value=''; clearUpload('catFile','catPrevContainer','catDZ');
    });
    window.saveSubCategory = () => run(async selected => {
        const main = $('mainCatForSub').value, sub = name($('newSubCat').value);
        if (!main) throw new Error('اختر القسم الرئيسي');
        await col('categories',selected).doc(main).update({ subs:firebase.firestore.FieldValue.arrayUnion(sub) });
        $('newSubCat').value='';
    });
    window.saveReviews = () => run(async selected => {
        if (!$('reviewFile').files.length) throw new Error('اختر صور الآراء');
        const urls = await uploadMany($('reviewFile').files), batch = db.batch();
        urls.forEach(imageUrl => batch.set(col('reviews',selected).doc(), { imageUrl, timestamp:stamp() }));
        await batch.commit(); clearUpload('reviewFile','revPrevContainer','revDZ');
    });
    window.delRev = id => { if (confirm('حذف هذا التقييم؟')) run(selected => col('reviews',selected).doc(id).delete()); };
    window.delP = id => { if (confirm('حذف هذا المنتج؟')) run(selected => col('products',selected).doc(id).delete()); };
    window.delC = id => {
        if (!confirm('حذف القسم الفارغ؟ يجب نقل منتجاته أو حذفها أولا')) return;
        run(async selected => {
            if (!(await col('products',selected).where('mainCategory','==',id).limit(1).get()).empty) throw new Error('القسم يحتوي منتجات. انقلها أو احذفها أولا');
            await col('categories',selected).doc(id).delete();
        });
    };
    function bounded(snapshot) { if (snapshot.size > 450) throw new Error('هذه العملية تشمل أكثر من 450 منتجا. يلزم ترحيل مخصص لتجنب التعديل الجزئي'); }
    window.delS = (main, sub) => {
        if (!confirm('حذف الفرعي ونقل منتجاته إلى عام؟')) return;
        run(async selected => {
            const snapshot = await col('products',selected).where('mainCategory','==',main).where('subCategory','==',sub).get();
            bounded(snapshot);
            const batch = db.batch();
            snapshot.forEach(doc => batch.update(doc.ref,{subCategory:'عام'}));
            batch.update(col('categories',selected).doc(main),{subs:firebase.firestore.FieldValue.arrayRemove(sub)});
            await batch.commit();
        });
    };
    window.editSub = (main, old) => {
        const next = prompt('اسم القسم الفرعي:',old);
        if (next == null || next === old) return;
        run(async selected => {
            const value = name(next), ref = col('categories',selected).doc(main);
            const [cat,snapshot] = await Promise.all([ref.get(),col('products',selected).where('mainCategory','==',main).where('subCategory','==',old).get()]);
            bounded(snapshot);
            const subs = cat.data().subs || [];
            if (subs.includes(value)) throw new Error('الاسم الجديد موجود بالفعل');
            const batch=db.batch();
            batch.update(ref,{subs:subs.map(s => s === old ? value : s)});
            snapshot.forEach(doc => batch.update(doc.ref,{subCategory:value}));
            await batch.commit();
        });
    };
    window.editCatName = old => {
        const next = prompt('اسم القسم الرئيسي:',old);
        if (next == null || next === old || !confirm('نقل المنتجات إلى الاسم الجديد؟')) return;
        run(async selected => {
            const value=categoryName(next), oldRef=col('categories',selected).doc(old), newRef=col('categories',selected).doc(value);
            if (value === old) return;
            const snapshot=await col('products',selected).where('mainCategory','==',old).get();
            bounded(snapshot);
            await db.runTransaction(async tx => {
                const source=await tx.get(oldRef), target=await tx.get(newRef);
                if (!source.exists || target.exists) throw new Error('القسم القديم غير موجود أو الاسم الجديد مستخدم');
                tx.set(newRef,source.data());
                snapshot.forEach(doc => tx.update(doc.ref,{mainCategory:value}));
                tx.delete(oldRef);
            });
        });
    };
    window.editCatImage = id => {
        if (busy) return;
        const selected=mode, input=document.createElement('input');
        input.type='file'; input.accept='image/jpeg,image/png,image/webp,image/gif';
        input.onchange=() => {
            if (!input.files[0] || selected !== mode) return;
            run(async () => col('categories',selected).doc(id).update({imageUrl:await upload(input.files[0])}));
        };
        input.click();
    };
    function renderEditImages() {
        $('editPrevContainer').replaceChildren(...currentImages.map((url,i) => {
            const wrap=U.node('div','edit-img-wrap');
            wrap.append(U.img(url,'صورة المنتج'),U.button('×','delete-img-btn',() => { if (!busy && confirm('إزالة الصورة من المنتج؟')) { currentImages.splice(i,1); renderEditImages(); } }));
            return wrap;
        }));
    }
    function openEdit(product) {
        if (busy) return;
        editMode=mode;
        $('editId').value=product.id; $('editName').value=product.name || ''; $('editMainCat').value=product.mainCategory;
        selections('editMainCat','editSubCat',product.subCategory);
        currentImages=[...U.images(product)]; renderEditImages();
        clearUpload('editFile','newEditPrevContainer','editDZ');
        $('editModal').classList.add('active');
    }
    window.closeModal=() => { if (!busy) { $('editModal').classList.remove('active'); editMode=null; } };
    window.updateProduct=() => run(async selected => {
        if (editMode !== selected) throw new Error('أعد فتح المنتج قبل تعديله');
        const n=name($('editName').value), m=$('editMainCat').value, s=$('editSubCat').value, id=$('editId').value;
        if (!cats.some(c=>c.id===m)) throw new Error('اختر القسم');
        const urls=[...currentImages,...await uploadMany($('editFile').files)];
        if (!urls.length || urls.length > 24) throw new Error('يجب وجود 1 إلى 24 صورة');
        await col('products',selected).doc(id).update({name:n,mainCategory:m,subCategory:s || 'عام',imageURLs:urls});
        $('editModal').classList.remove('active'); editMode=null;
    });
    window.switchTab=(e,id) => {
        activeTab=id;
        document.querySelectorAll('.tabs button').forEach(el=>el.classList.toggle('active',el=== (e ? e.currentTarget : $('btnProductsTab'))));
        document.querySelectorAll('.tab-content').forEach(el=>el.classList.toggle('active',el.id===id));
    };
    function accordion(title, group) {
        const wrap=U.node('div'), head=U.node('div','accordion-header'), content=U.node('div','accordion-content '+group);
        head.append(U.node('strong','',title),U.node('span','arrow','▼'));
        U.actionable(head,()=>{
            const open=!content.classList.contains('open');
            content.classList.toggle('open',open); head.querySelector('.arrow').textContent=open?'▲':'▼';
        });
        wrap.append(head,content); return {wrap,head,content};
    }
    function render() {
        for (const id of ['productMainCat','mainCatForSub','editMainCat']) {
            const el=$(id), old=el.value; el.replaceChildren(new Option('اختر القسم',''));
            cats.forEach(c=>el.add(new Option(c.id,c.id))); el.value=old;
        }
        selections('productMainCat','productSubCat');
        const categoryNodes=cats.map(cat=>{
            const a=accordion(cat.id,'cat-acc'); a.wrap.className='cat-sort-item'; a.wrap.dataset.id=cat.id;
            a.head.prepend(U.node('span','drag-handle','☰'), U.img(cat.imageUrl,cat.id));
            a.head.querySelector('img').style.cssText='width:40px;height:40px;object-fit:cover;border-radius:5px';
            const buttons=U.node('div','btn-group-large');
            buttons.append(U.button('تغيير الاسم ✎','edit-btn',()=>window.editCatName(cat.id)),U.button('تغيير الصورة 🖼️','edit-btn',()=>window.editCatImage(cat.id)));
            a.content.append(buttons);
            (Array.isArray(cat.subs)?cat.subs:[]).forEach(s=>{
                const tag=U.node('div','sub-tag');
                tag.append(U.node('span','',s),U.button('✎','edit-btn',()=>window.editSub(cat.id,s)),U.button('×','danger-btn',()=>window.delS(cat.id,s)));
                a.content.append(tag);
            });
            a.content.append(U.button('حذف القسم','danger-btn',()=>window.delC(cat.id))); return a.wrap;
        });
        if (sortable) { sortable.destroy(); sortable=null; }
        $('categoriesAdminList').replaceChildren(...categoryNodes);
        if (window.Sortable) sortable=new Sortable($('categoriesAdminList'),{handle:'.drag-handle',animation:150,onEnd:()=>run(async selected=>{
            const items=[...$('categoriesAdminList').children];
            if (items.length>450) throw new Error('عدد الأقسام أكبر من حد الترتيب دفعة واحدة');
            const batch=db.batch(); items.forEach((el,i)=>batch.update(col('categories',selected).doc(el.dataset.id),{order:i}));
            await batch.commit();
        })});
        const nodes=[];
        // Include orphaned/legacy products so they do not disappear from administration.
        for (const main of new Set(products.map(p=>p.mainCategory || 'بدون قسم'))) {
            const a=accordion('📁 '+main,'prod-acc');
            const group=products.filter(p=>(p.mainCategory || 'بدون قسم')===main);
            for (const sub of new Set(group.map(p=>p.subCategory || 'عام'))) {
                const b=accordion('↳ '+sub,'sub-content'); b.head.classList.add('sub-header');
                group.filter(p=>(p.subCategory || 'عام')===sub).forEach(p=>{
                    const card=U.node('div','list-item'), row=U.node('div','item-row'), actions=U.node('div','btn-group-large');
                    row.append(U.img(U.images(p)[0],p.name),U.node('strong','',p.name));
                    actions.append(U.button('تعديل','edit-btn',()=>openEdit(p)),U.button('حذف','danger-btn',()=>window.delP(p.id)));
                    card.append(row,actions); b.content.append(card);
                });
                a.content.append(b.wrap);
            }
            nodes.push(a.wrap);
        }
        $('productsList').replaceChildren(...nodes);
        if (!nodes.length) $('productsList').append(U.node('p','','لا توجد منتجات'));
        $('reviewsAdminList').replaceChildren(...reviews.map(r=>{
            const wrap=U.node('div','edit-img-wrap'), img=U.img(r.imageUrl,'رأي عميل');
            img.style.cssText='width:100px;height:100px;object-fit:cover';
            wrap.append(img,U.button('×','delete-img-btn',()=>window.delRev(r.id))); return wrap;
        }));
    }
    async function init(force=false) {
        const ticket=++generation, selected=mode;
        loading=true;
        try {
            let state=cache.get(selected);
            if (force || !state || Date.now()-state.time>60000) {
                const snapshots=await Promise.all(['categories','products','reviews'].map(type=>col(type,selected).get()));
                state={time:Date.now(),cats:data(snapshots[0]).sort((a,b)=>(a.order||0)-(b.order||0)),products:data(snapshots[1]),reviews:data(snapshots[2])};
                const time=p=>p.timestamp && p.timestamp.toMillis ? p.timestamp.toMillis():0;
                state.products.sort((a,b)=>time(b)-time(a)); state.reviews.sort((a,b)=>time(b)-time(a));
                cache.set(selected,state);
            }
            if (ticket!==generation || selected!==mode || !ready) return;
            cats=state.cats; products=state.products; reviews=state.reviews; render();
        } catch(error) { if(ticket===generation) toast('تعذر تحميل البيانات. تحقق من الشبكة وصلاحيات Firestore ثم أعد فتح الصفحة'); }
        finally { if(ticket===generation) loading=false; }
    }
    window.switchAdminMode=async next=>{
        if (busy || !ready || !Object.hasOwn(collections,next)) return;
        window.closeModal(); mode=next;
        ['Embroidery','Printing'].forEach(label=>$('admin'+label+'Tab').classList.toggle('active',mode===label.toLowerCase()));
        $('currentModeTitle').textContent=mode==='printing'?'إدارة منتجات وأقسام الطباعة':'إدارة منتجات وأقسام التطريز';
        window.switchTab(null,'productsTab');
        for(const id of ['productName','newMainCat','newSubCat']) $(id).value='';
        for(const args of [['productFile','prodPrevContainer','prodDZ'],['catFile','catPrevContainer','catDZ'],['reviewFile','revPrevContainer','revDZ']]) clearUpload(...args);
        for(const id of ['productsList','categoriesAdminList','reviewsAdminList']) $(id).replaceChildren();
        await init();
    };
    if (!auth || !db) { document.body.style.display='block'; toast('تعذر تشغيل Firebase. أعد تحميل الصفحة'); return; }
    auth.onAuthStateChanged(async user=>{
        const check=++generation;
        ready=false;
        if (!user) { location.replace('login.html'); return; }
        try {
            const token=await user.getIdToken();
            await U.fetchJSON(api('/api/admin-session'),{headers:{Authorization:'Bearer '+token}});
            if (check!==generation) return;
            ready=true; document.body.style.display='block'; await init();
        } catch {
            document.body.style.display='block';
            document.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
            const exit=document.querySelector('.logout-btn'); exit.disabled=false;
            toast('تعذر التحقق من صلاحية الإدارة. راجع اتصالك وإعداد ADMIN_UIDS ثم أعد تحميل الصفحة');
        }
    });
})();
