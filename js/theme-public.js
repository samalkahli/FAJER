(function(){
'use strict';
const S=window.ThemeSchema,preview=new URLSearchParams(location.search).get('themePreview')==='1'&&window.parent!==window;
let current=S.normalize(S.defaults);
const $=id=>document.getElementById(id);
const rgba=(hex,a)=>`rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a/100})`;
function variable(el,key,value){el.style.setProperty('--'+key,String(value));}
function apply(raw){
 current=S.normalize(raw);const t=current,g=$('store-gateway');if(!g)return;
 document.documentElement.style.setProperty('--font-ui',t.font==='Tajawal'?"'Tajawal', sans-serif":t.font+', sans-serif');
 $('gatewayTitle').textContent=t.title;$('themeSubtitle').textContent=t.subtitle;
 const bg=t.pageGradient?`linear-gradient(${t.pageAngle}deg,${t.pageA},${t.pageB})`:t.pageA;
 for(const [k,v]of Object.entries({gatewayBg:bg,headingColor:t.headingColor,subtitleColor:t.subtitleColor,headingSize:t.headingSize+'px',headingMobile:t.headingMobile+'px',subtitleSize:t.subtitleSize+'px',headingGap:t.headingGap+'px',gatewayWidth:t.gatewayWidth+'px',cardGap:t.cardGap+'px',cardGapMobile:t.cardGapMobile+'px',cardHeight:t.cardHeight+'px',cardHeightMobile:t.cardHeightMobile+'px',mobileColumns:t.mobileColumns}))variable(g,k,v);
 g.dataset.motion=String(t.motion);
 for(const [prefix,mode]of [['e','embroidery'],['p','printing']]){
  const card=$('themeCard-'+prefix),get=k=>t[prefix+'_'+k],logo=card.querySelector('.theme-card-logo');
  card.dataset.logoMode=get('logoMode');card.style.order=t.reverseOrder?(prefix==='e'?2:1):(prefix==='e'?1:2);
  logo.src=get('logo')||'';logo.hidden=!get('logo');
  card.querySelector('.theme-card-title').textContent=get('title');card.querySelector('.theme-card-title').hidden=!get('showTitle');
  card.querySelector('.theme-card-description').textContent=get('description');card.querySelector('.theme-card-description').hidden=!get('showDescription')||!get('description');
  card.querySelector('.theme-card-button-text').textContent=get('button');
  const vars={cardBg:get('gradient')?`linear-gradient(${get('angle')}deg,${get('bgA')},${get('bgB')})`:get('bgA'),logoSize:get('logoSize')+'%',logoY:get('logoY')+'%',logoX:get('logoX')+'%',logoOpacity:get('logoOpacity')/100,logoFit:get('logoFit'),boxColor:get('boxColor'),boxBorder:get('boxBorder'),boxRadius:get('boxRadius')+'px',boxBorderWidth:get('boxBorderWidth')+'px',overlay:rgba(get('overlayColor'),get('overlay')),cardBorder:get('border')?get('borderWidth')+'px solid '+get('borderColor'):'0px solid transparent',cardRadius:get('radius')+'px',cardShadow:rgba('#000000',get('shadow')),textColor:get('textColor'),descriptionColor:get('descriptionColor'),titleSize:get('titleSize')+'px',titleMobile:get('titleMobile')+'px',descriptionSize:get('descriptionSize')+'px',textAlign:get('textAlign'),contentY:get('contentY')+'%',contentGap:get('contentGap')+'px',buttonColor:get('buttonColor'),buttonBg:rgba(get('buttonBg'),get('buttonOpacity')),buttonBorder:get('buttonBorder')?'1px solid '+get('buttonColor'):'0px solid transparent',buttonRadius:get('buttonRadius')+'px',buttonSize:get('buttonSize')+'px',buttonWidth:get('buttonWidth')+'%'};
  for(const [k,v]of Object.entries(vars))variable(card,k,v);
 }
 applyStore();
}
function applyStore(){
 const t=current,b=document.body,mode=b.dataset.mode;
 if(mode==='gateway'){
  b.style.background=t.pageGradient?`linear-gradient(${t.pageAngle}deg,${t.pageA},${t.pageB})`:t.pageA;
  return;
 }
 const p=mode==='printing'?'p':'e',get=k=>t[p+'_'+k];
 b.style.background=get('storeBg');
 for(const [k,v]of Object.entries({'text-main':get('storeText'),heading:get('storeText'),accent:get('storeAccent'),surface:get('storeSurface'),'nav-background':get('storeBg'),'theme-category-radius':get('categoryRadius')+'px','theme-category-ratio':get('categoryRatio'),'theme-product-radius':get('productRadius')+'px','theme-product-columns':get('productColumns'),'theme-product-mobile':get('productMobile'),'theme-header-logo':get('headerLogoSize')+'px'}))variable(b,k,v);
 b.dataset.themeOdd=String(get('oddWide'));b.dataset.themeScattered=String(get('scatteredReviews'));b.dataset.themeMixed=String(get('mixedReviews'));
 if($('brandLogo')){$('brandLogo').src=get('logo')||'';$('brandLogo').hidden=!get('logo');}
 if($('mainSectionTitle'))$('mainSectionTitle').textContent=get('sectionTitle');
}
apply(current);
new MutationObserver(applyStore).observe(document.body,{attributes:true,attributeFilter:['data-mode']});
if(preview){
 window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='FAJER_THEME_PREVIEW')return;
  try{apply(S.normalize(event.data.theme,true));}catch{return;}
  const mode=event.data.mode;
  if(mode==='gateway')window.backToGateway?.({updateHistory:false});
  else if(['embroidery','printing'].includes(mode)&&document.body.dataset.mode!==mode)window.switchMode?.(mode,{updateHistory:false});
 });
 window.parent.postMessage({type:'FAJER_THEME_READY'},location.origin);
}else{
 try{const cache=JSON.parse(localStorage.getItem('fajer-theme-v1'));if(cache&&Date.now()-cache.time<86400000)apply(cache.theme);}catch{}
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),6000);
 fetch('/api/theme',{signal:control.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{apply(data.theme);try{localStorage.setItem('fajer-theme-v1',JSON.stringify({time:Date.now(),theme:current}));}catch{}}).catch(()=>{}).finally(()=>clearTimeout(timer));
}
})();
