/* Shared allowlist: browser controls and server validation use the same schema. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.ThemeSchema=value;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const fields=[];
function field(key,label,type,value,group,extra={}){fields.push({key,label,type,value,group,...extra});}
const number=(k,l,v,g,min,max)=>field(k,l,'number',v,g,{min,max});
const color=(k,l,v,g)=>field(k,l,'color',v,g);
const choice=(k,l,v,g,options)=>field(k,l,'select',v,g,{options});
const text=(k,l,v,g,max=100)=>field(k,l,'text',v,g,{max});
const yes=(k,l,v,g)=>field(k,l,'boolean',v,g);
let g='الواجهة الرئيسية';
text('title','العنوان الرئيسي','معارض أعمالنا',g);text('subtitle','العنوان الفرعي','إيش ودك تختار؟',g);
color('pageA','لون الخلفية الأول','#171110',g);color('pageB','لون الخلفية الثاني','#5e4a3f',g);
yes('pageGradient','دمج لوني الخلفية',true,g);number('pageAngle','اتجاه التدرج بالدرجات',120,g,0,360);
color('headingColor','لون العنوان','#fffaf5',g);color('subtitleColor','لون العبارة','#dfcdbf',g);
number('headingSize','حجم العنوان على الكمبيوتر',44,g,20,64);number('headingMobile','حجم العنوان على الجوال',30,g,18,44);
number('subtitleSize','حجم العبارة',19,g,12,28);number('headingGap','المسافة أسفل العنوان',28,g,8,72);
choice('font','خط الموقع','Tajawal',g,['Tajawal','Arial','Tahoma']);
number('gatewayWidth','عرض الشرائح الأقصى',900,g,500,1200);number('cardGap','المسافة بين الشرائح',22,g,6,50);
number('cardGapMobile','المسافة على الجوال',12,g,4,24);number('cardHeight','ارتفاع الشرائح على الكمبيوتر',470,g,280,700);
number('cardHeightMobile','ارتفاع الشرائح على الجوال',340,g,240,550);
choice('mobileColumns','عدد أعمدة الشرائح على الجوال','2',g,['1','2']);
yes('reverseOrder','تبديل ترتيب المتجرين',false,g);yes('motion','حركة التحويم',true,g);
for(const [prefix,name,bg,accent,logo] of [['e','التطريز','#171717','#d4aa6d','assets/athnta-logo.png'],['p','الطباعة','#5e4a3f','#f1dfd2','assets/lavinta-logo.jpeg']]){
 g='شريحة '+name;const f=(k)=>prefix+'_'+k;
 text(f('title'),'اسم المعرض',name,g);text(f('description'),'وصف قصير','',g,180);text(f('button'),'نص زر الاستكشاف','استكشف متجر '+name,g);
 color(f('bgA'),'لون الشريحة الأول',bg,g);color(f('bgB'),'لون الشريحة الثاني',bg,g);yes(f('gradient'),'دمج لونَي الشريحة',false,g);number(f('angle'),'زاوية الدمج',135,g,0,360);
 field(f('logo'),'رابط الشعار أو ارفع صورة','url',logo,g);
 choice(f('logoMode'),'طريقة عرض الشعار','background',g,['background','box','plain']);
 number(f('logoSize'),'عرض الشعار كنسبة من الشريحة',90,g,25,100);number(f('logoY'),'موضع الشعار الرأسي %',43,g,15,60);number(f('logoX'),'موضع الشعار الأفقي %',50,g,25,75);
 choice(f('logoFit'),'ملاءمة الشعار','contain',g,['contain','cover']);number(f('logoOpacity'),'وضوح الشعار %',100,g,15,100);
 color(f('boxColor'),'لون مربع الشعار',bg,g);color(f('boxBorder'),'لون إطار مربع الشعار',accent,g);number(f('boxRadius'),'استدارة مربع الشعار',16,g,0,70);number(f('boxBorderWidth'),'سماكة إطار مربع الشعار',1,g,0,6);
 color(f('overlayColor'),'لون الطبقة المعتمة','#000000',g);number(f('overlay'),'تعتيم الشريحة %',25,g,0,75);
 yes(f('border'),'إظهار إطار الشريحة',true,g);color(f('borderColor'),'لون الإطار',accent,g);number(f('borderWidth'),'سماكة الإطار',1,g,0,6);number(f('radius'),'استدارة الشريحة',26,g,0,60);number(f('shadow'),'قوة الظل %',25,g,0,70);
 color(f('textColor'),'لون اسم المعرض','#fffaf5',g);color(f('descriptionColor'),'لون الوصف','#e5d8cd',g);number(f('titleSize'),'حجم الاسم',30,g,16,46);number(f('titleMobile'),'حجم الاسم على الجوال',23,g,14,34);number(f('descriptionSize'),'حجم الوصف',15,g,11,22);
 choice(f('textAlign'),'محاذاة الكلام','center',g,['center','right','left']);number(f('contentY'),'بداية الكلام من أعلى الشريحة %',65,g,50,75);number(f('contentGap'),'المسافة بين الكلام والزر',12,g,4,24);
 yes(f('showTitle'),'إظهار اسم المعرض',true,g);yes(f('showDescription'),'إظهار الوصف',true,g);
 color(f('buttonColor'),'لون كتابة الزر',accent,g);color(f('buttonBg'),'لون خلفية الزر',bg,g);number(f('buttonOpacity'),'وضوح خلفية الزر %',60,g,0,100);yes(f('buttonBorder'),'إطار زر الاستكشاف',true,g);number(f('buttonRadius'),'استدارة الزر',30,g,0,50);number(f('buttonSize'),'حجم كتابة الزر',15,g,10,22);number(f('buttonWidth'),'عرض الزر %',94,g,50,100);
 g='داخل معرض '+name;
 color(f('storeBg'),'خلفية المعرض',bg,g);color(f('storeAccent'),'اللون البارز',accent,g);color(f('storeText'),'لون النصوص','#fffaf5',g);color(f('storeSurface'),'خلفية البطاقات',bg,g);
 text(f('sectionTitle'),'العبارة تحت الشعار','هنا أعمالنا المنفذة خصيصاً لكم',g,180);number(f('headerLogoSize'),'عرض شعار المعرض',230,g,100,320);
 number(f('categoryRadius'),'استدارة صور التصنيفات',20,g,0,50);yes(f('oddWide'),'آخر تصنيف فردي بعرض كامل',true,g);choice(f('categoryRatio'),'شكل التصنيفات','9/14',g,['9/14','1/1','3/4']);
 choice(f('productColumns'),'أعمدة المنتجات على الكمبيوتر','4',g,['2','3','4','5']);choice(f('productMobile'),'أعمدة المنتجات على الجوال','2',g,['1','2']);number(f('productRadius'),'استدارة بطاقات المنتجات',20,g,0,40);
 yes(f('scatteredReviews'),'تقييمات مبعثرة',true,g);yes(f('mixedReviews'),'أشكال تقييمات متنوعة',true,g);
}
// Background recipes share validated controls; old color keys stay compatible.
const backgrounds=[];
function background(id,label,first,second,enabled,angle,group){
 const original=fields.find(f=>f.key===first).value;
 if(!fields.some(f=>f.key===second))color(second,'اللون الثاني',original,group);
 if(!fields.some(f=>f.key===enabled))yes(enabled,'تفعيل دمج الألوان',false,group);
 if(!fields.some(f=>f.key===angle))number(angle,'اتجاه الدمج',135,group,0,360);
 const spec={id,label,first,second,enabled,angle,group};backgrounds.push(spec);
 choice(id+'Count','عدد الألوان','2',group,['2','3','4']);
 choice(id+'Kind','نوع الدمج','linear',group,['linear','radial']);
 color(id+'C','اللون الثالث',original,group);color(id+'D','اللون الرابع',original,group);
 for(let i=1;i<=4;i++)number(id+'Stop'+i,'موضع اللون '+i+' %',[0,100,70,100][i-1],group,0,100);
 number(id+'X','مركز الدمج الأفقي %',50,group,0,100);number(id+'Y','مركز الدمج الرأسي %',50,group,0,100);
}
background('page','خلفية الرئيسية','pageA','pageB','pageGradient','pageAngle','الواجهة الرئيسية');
yes('pageGlow','الإضاءة الذهبية والبنية الأصلية',true,'الواجهة الرئيسية');
for(const [p,name] of [['e','التطريز'],['p','الطباعة']]){
 const card='شريحة '+name,store='داخل معرض '+name;
 background(p+'_card','خلفية الشريحة',p+'_bgA',p+'_bgB',p+'_gradient',p+'_angle',card);
 for(const [key,label,group]of [['boxColor','مربع الشعار',card],['buttonBg','زر الاستكشاف',card],['overlayColor','الطبقة المعتمة',card],['storeBg','خلفية المعرض',store],['storeSurface','بطاقات المعرض',store]])
  background(p+'_'+key,label,p+'_'+key,p+'_'+key+'B',p+'_'+key+'Gradient',p+'_'+key+'Angle',group);
 yes(p+'_storeGlow','إضاءة الخلفية الأصلية',p==='p',store);
 for(const [key,label,value]of [['navBg','الشريط العلوي',p==='p'?'#5e4a3f':'#050505'],['dialogBg','نافذة المنتج',p==='p'?'#48352c':'#151515'],['controlsBg','أزرار المعرض والتواصل',p==='p'?'#6a574c':'#151515']]){
  color(p+'_'+key,label,value,store);background(p+'_'+key,label,p+'_'+key,p+'_'+key+'B',p+'_'+key+'Gradient',p+'_'+key+'Angle',store);
 }
}
const defaults=Object.fromEntries(fields.map(f=>[f.key,f.value]));
Object.assign(defaults,{pageA:'#050505',pageB:'#5e4a3f',pageAngle:115,pageCount:'3',pageC:'#15110f',pageStop2:100,pageStop3:44,e_storeBg:'#050505',p_storeBg:'#5e4a3f',p_storeBgB:'#45342d',p_storeBgGradient:true});
function paint(t,id,opacity=100){
 const s=backgrounds.find(s=>s.id===id);if(!s)throw Error('Unknown background');
 const alpha=c=>opacity===100?c:`rgba(${parseInt(c.slice(1,3),16)},${parseInt(c.slice(3,5),16)},${parseInt(c.slice(5,7),16)},${opacity/100})`;
 if(!t[s.enabled])return alpha(t[s.first]);
 const colors=[t[s.first],t[s.second],t[id+'C'],t[id+'D']];
 const stops=colors.slice(0,Number(t[id+'Count'])).map((c,i)=>({c,pos:t[id+'Stop'+(i+1)]})).sort((a,b)=>a.pos-b.pos).map(s=>alpha(s.c)+' '+s.pos+'%').join(',');
 return t[id+'Kind']==='radial'?`radial-gradient(ellipse at ${t[id+'X']}% ${t[id+'Y']}%,${stops})`:`linear-gradient(${t[s.angle]}deg,${stops})`;
}
function validURL(value){if(typeof value!=='string'||value.length>1500)return false;if(value==='')return true;if(/^assets\/[a-zA-Z0-9_./-]+$/.test(value)&&!value.includes('..'))return true;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
function normalize(input,strict=false){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('إعدادات الثيم غير صالحة');
 if(strict&&Object.keys(input).some(k=>!Object.hasOwn(defaults,k)))throw Error('إعداد غير معروف في الثيم');
 const out={};
 for(const f of fields){let v=Object.hasOwn(input,f.key)?input[f.key]:defaults[f.key];let ok=false;
 if(f.type==='number')ok=typeof v==='number'&&Number.isFinite(v)&&v>=f.min&&v<=f.max;
 if(f.type==='color')ok=typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
 if(f.type==='boolean')ok=typeof v==='boolean';
 if(f.type==='select')ok=f.options.includes(v);
 if(f.type==='text')ok=typeof v==='string'&&v.length<=f.max;
 if(f.type==='url')ok=validURL(v);
 if(!ok&&strict)throw Error('قيمة غير صالحة: '+f.label);
 out[f.key]=ok?v:defaults[f.key];
 }
 return out;
}
return Object.freeze({fields,defaults,normalize,validURL,backgrounds,paint});
});
