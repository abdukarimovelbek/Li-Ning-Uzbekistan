/* ============================================================
   LI NING — CINEMATIC DEMO ENGINE
   ============================================================ */
'use strict';
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ───────────────────────── STATE ───────────────────────── */
const state = { cart:[], wish:new Set(), currentVariant:1, intthroDone:false };

/* ════════════════════════ LOADER ════════════════════════ */
const Loader = (()=>{
  const root=$('#loader'), logo=$('#loaderLogo'), sub=$('#loaderSub'),
        num=$('#loaderNum'), bar=$('#loaderBarFill'), status=$('#loaderStatus'),
        curtain=$('#loaderCurtain'), swoosh=$('#loaderSwoosh'),
        pA=$('#swooshA'), pB=$('#swooshB');
  const statuses=['Подготовка коллекции','Загрузка витрины','Полировка пикселей','Почти готово'];
  let raf;

  function reset(){
    cancelAnimationFrame(raf);
    root.classList.remove('done');
    root.style.opacity='1'; root.style.display='flex';
    document.body.classList.add('locked');
    // reset mark
    logo.style.transition='none';
    logo.style.clipPath='inset(0 100% 0 0)'; logo.style.opacity='0';
    logo.style.transform='none'; logo.style.filter='invert(1) brightness(1.6)';
    sub.style.transition='none'; sub.style.opacity='0'; sub.style.transform='translateY(8px)';
    swoosh.style.opacity='0';
    [pA,pB].forEach(p=>{ const L=p.getTotalLength(); p.style.transition='none'; p.style.strokeDasharray=L; p.style.strokeDashoffset=L; });
    [...curtain.children].forEach(s=>{ s.style.transition='none'; s.style.transform='translateY(0)'; });
    num.textContent='0'; bar.style.transition='none'; bar.style.width='0%'; status.textContent=statuses[0];
    void root.offsetWidth;
  }

  function counter(dur,cb){
    const t0=performance.now();
    (function tick(now){
      const p=Math.min((now-t0)/dur,1);
      const eased=1-Math.pow(1-p,3);
      const v=Math.round(eased*100);
      num.textContent=v; bar.style.width=v+'%';
      status.textContent=statuses[Math.min(3,Math.floor(p*4))];
      if(p<1) raf=requestAnimationFrame(tick); else cb&&cb();
    })(t0);
  }

  let revealed=false;
  function revealSite(){
    if(revealed)return; revealed=true;
    document.body.classList.remove('locked');
    [...curtain.children].forEach((s,i)=>{
      s.style.transition=`transform .75s cubic-bezier(.76,0,.24,1) ${i*0.07}s`;
      s.style.transform='translateY(-101%)';
    });
    setTimeout(()=>{ root.classList.add('done'); root.style.opacity='0'; },300);
    setTimeout(()=>{ root.style.display='none'; },1100);
    setTimeout(()=>{ Hero.intro(); $('#introReplay').classList.add('show'); },650);
    state.introDone=true;
  }

  function play(variant){
    state.currentVariant=variant; reset(); revealed=false;
    bar.style.transition='none';
    // watchdog: rAF can be throttled in background tabs — never let intro hang
    clearTimeout(play._wd); play._wd=setTimeout(()=>{ num.textContent='100'; bar.style.width='100%'; revealSite(); }, variant===3?3600:3200);
    // shared sub fade
    setTimeout(()=>{ sub.style.transition='opacity .8s ease,transform .8s var(--ease)'; sub.style.opacity='1'; sub.style.transform='none'; },700);

    if(variant===1){ // INK — logo wipes in, counter, curtain
      setTimeout(()=>{
        logo.style.transition='clip-path 1.1s cubic-bezier(.76,0,.24,1),opacity .5s ease';
        logo.style.clipPath='inset(0 0 0 0)'; logo.style.opacity='1';
      },150);
      bar.style.transition='width .1s linear';
      counter(2000,()=>setTimeout(revealSite,260));
    }
    else if(variant===2){ // CURTAIN — logo scales/fades, then panels split
      logo.style.transition='none'; logo.style.transform='scale(1.25)'; logo.style.clipPath='inset(0 0 0 0)';
      setTimeout(()=>{
        logo.style.transition='transform 1.3s var(--ease),opacity .9s ease';
        logo.style.opacity='1'; logo.style.transform='scale(1)';
      },120);
      bar.style.transition='width .1s linear';
      counter(1900,()=>setTimeout(revealSite,200));
    }
    else { // STROKE — swoosh draws, logo fades after
      swoosh.style.opacity='1';
      [pA,pB].forEach((p,i)=>{ setTimeout(()=>{ p.style.transition=`stroke-dashoffset 1.1s cubic-bezier(.76,0,.24,1)`; p.style.strokeDashoffset='0'; }, 200+i*350); });
      setTimeout(()=>{
        logo.style.clipPath='inset(0 0 0 0)';
        logo.style.transition='opacity .9s ease,transform .9s var(--ease)';
        logo.style.opacity='1'; logo.style.transform='translateY(-4px)';
      },1250);
      bar.style.transition='width .1s linear';
      counter(2300,()=>setTimeout(revealSite,260));
    }
  }
  return { play };
})();

/* ════════════════════════ NAV + SCROLL ════════════════════════ */
const nav=$('#nav'), progress=$('#scrollProgress');
function onScroll(){
  const y=scrollY;
  nav.classList.toggle('solid', y>60 || $('#view-home').classList.contains('active')===false);
  nav.classList.toggle('transparent', y<=60 && $('#view-home').classList.contains('active'));
  const h=document.documentElement.scrollHeight-innerHeight;
  progress.style.width=(h>0? (y/h*100):0)+'%';
  Hero.parallax(y);
  manualReveal();
}
// IO is the primary driver, but a manual viewport pass guarantees reveals even
// if IntersectionObserver is throttled/unavailable (some webviews, bg tabs)
function manualReveal(){
  const view=$('.view.active'); if(!view)return;
  view.querySelectorAll('[data-reveal]:not(.in),.reveal-line:not(.in)').forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.top < innerHeight*0.9 && r.bottom > 0){ activateReveal(el); io.unobserve(el); }
  });
}
addEventListener('scroll',onScroll,{passive:true});

/* ════════════════════════ REVEAL OBSERVER ════════════════════════ */
const io=new IntersectionObserver((ents)=>{
  ents.forEach(e=>{ if(e.isIntersecting){ activateReveal(e.target); io.unobserve(e.target);} });
},{threshold:0.15, rootMargin:'0px 0px -8% 0px'});

function activateReveal(elm){
  elm.classList.add('in');
  if(elm.dataset.count!==undefined) countUp(elm);
  if(elm.classList.contains('rev-summary')) animBars();
}
function observeReveals(scope=document){
  $$('[data-reveal],.reveal-line',scope).forEach(el=>{
    if(el.classList.contains('in'))return;
    const r=el.getBoundingClientRect();
    // already on-screen (or scrolled past) at observe time → reveal now, don't wait for IO
    if(r.top < innerHeight*0.94 && r.bottom > -40){ activateReveal(el); }
    else io.observe(el);
  });
  // fail-safe: if a view-switch happened mid-transition and IO missed its first callback,
  // force-reveal anything still hidden but within view once things settle
  clearTimeout(observeReveals._t);
  observeReveals._t=setTimeout(()=>{
    $$('[data-reveal]:not(.in),.reveal-line:not(.in)',scope).forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.top < innerHeight && r.bottom > 0){ activateReveal(el); io.unobserve(el); }
    });
  },600);
}
function countUp(el){
  const target=parseFloat(el.dataset.count), dec=+(el.dataset.dec||0), t0=performance.now(), dur=1400;
  (function tick(now){
    const p=Math.min((now-t0)/dur,1), e=1-Math.pow(1-p,3), v=(target*e).toFixed(dec);
    el.textContent=v; if(p<1)requestAnimationFrame(tick); else el.textContent=target.toFixed(dec);
  })(t0);
}
function animBars(){ $$('#revBars .rev-bar i').forEach(i=>{ i.style.width=i.dataset.w+'%'; }); }

/* ════════════════════════ ROUTER + WIPE ════════════════════════ */
const wipe=$('#wipe'), wipeLogo=$('.wipe-logo',wipe), wipePanels=[...wipe.querySelectorAll('span')];
function showView(name,{instant=false}={}){
  const cur=$('.view.active'), next=$('#view-'+name);
  if(!next || (cur===next && !instant)) { if(cur===next){scrollTo({top:0,behavior:'smooth'});return;} }
  $$('.nav-links a').forEach(a=>a.classList.toggle('active', a.dataset.nav===name));

  const swap=()=>{
    cur&&cur.classList.remove('active'); next.classList.add('active');
    scrollTo({top:0}); onScroll();
    // (re)build dynamic content per view
    Build.forView(name);
    observeReveals(next);
  };

  if(instant||reduce){ swap(); return; }
  // wipe in
  wipePanels.forEach((s,i)=>{ s.style.transition=`transform .42s cubic-bezier(.76,0,.24,1) ${i*0.05}s`; s.style.transformOrigin='bottom'; s.style.transform='scaleY(1)'; });
  wipeLogo.style.transition='opacity .3s ease .2s'; wipeLogo.style.opacity='1';
  setTimeout(swap,440);
  // wipe out
  setTimeout(()=>{
    wipeLogo.style.opacity='0';
    wipePanels.forEach((s,i)=>{ s.style.transition=`transform .5s cubic-bezier(.76,0,.24,1) ${i*0.05}s`; s.style.transformOrigin='top'; s.style.transform='scaleY(0)'; });
  },560);
}

/* ════════════════════════ HERO ════════════════════════ */
const Hero=(()=>{
  const media=$('#heroMedia'), content=$('#heroContent'), dots=$('#heroDots'), markBg=$('#heroMarkBg');
  let idx=0, timer, built=false;

  function build(){
    if(built)return; built=true;
    media.innerHTML=HERO_SLIDES.map((s,i)=>`
      <div class="hero-slide ${i===0?'active':''}" data-i="${i}">
        <div class="bg" style="background-image:url('${s.bg}');background-color:${s.tint};${s.fit==='contain'?'background-size:contain;background-repeat:no-repeat;background-position:center right;':''}"></div>
      </div>`).join('');
    dots.innerHTML=HERO_SLIDES.map((s,i)=>`<button data-i="${i}" class="${i===0?'active':''}"></button>`).join('');
    dots.onclick=e=>{ const b=e.target.closest('button'); if(b) go(+b.dataset.i); };
    render(0,true);
  }
  function render(i,first){
    const s=HERO_SLIDES[i];
    content.innerHTML=`
      <div class="hero-tag">${s.tag}</div>
      <h1 class="hero-h1">
        <span class="cn">${s.cn}</span>
        ${s.h1.map(l=>`<span class="reveal-line"><span>${l}</span></span>`).join('')}
      </h1>
      <p class="hero-desc reveal-line"><span>${s.desc}</span></p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#" data-nav="catalog">В каталог <span class="ic">→</span></a>
        <a class="btn btn-ghost" href="#" data-nav="stores">Магазины</a>
      </div>
      <div class="hero-stats">${s.stats.map(st=>`<div class="hero-stat"><div class="n">${st[0]}</div><div class="l">${st[1]}</div></div>`).join('')}</div>`;
    markBg.textContent='0'+(i+1);
    if(!first) requestAnimationFrame(()=>animateContent());
  }
  function animateContent(){
    $$('.reveal-line',content).forEach((l,i)=>{ l.style.transitionDelay=(i*0.08)+'s'; requestAnimationFrame(()=>l.classList.add('in')); });
    const tag=$('.hero-tag',content), cta=$('.hero-cta',content), stats=$('.hero-stats',content);
    [tag,cta,stats].forEach((el,i)=>{ if(!el)return; el.style.opacity='0'; el.style.transform='translateY(20px)'; el.style.transition=`all .9s var(--ease) ${0.25+i*0.12}s`; requestAnimationFrame(()=>{el.style.opacity='1';el.style.transform='none';}); });
  }
  function go(i){ if(i===idx)return; $$('.hero-slide',media).forEach(s=>s.classList.toggle('active',+s.dataset.i===i)); $$('button',dots).forEach(b=>b.classList.toggle('active',+b.dataset.i===i)); idx=i; render(i); restart(); }
  function next(){ go((idx+1)%HERO_SLIDES.length); }
  function restart(){ clearInterval(timer); timer=setInterval(next,6500); }
  function intro(){ build(); animateContent(); restart(); }
  function parallax(y){
    if(!$('#view-home').classList.contains('active'))return;
    const bg=$('.hero-slide.active .bg',media); if(bg&&y<innerHeight) bg.style.transform=`scale(1.06) translateY(${y*0.18}px)`;
    if(content&&y<innerHeight) content.style.transform=`translateY(${y*0.12}px)`, content.style.opacity=Math.max(0,1-y/(innerHeight*0.75));
  }
  return { build, intro, parallax, go };
})();

/* ════════════════════════ BUILDERS ════════════════════════ */
function star(r){ const f=Math.round(r); return '★★★★★'.slice(0,f)+'☆☆☆☆☆'.slice(0,5-f); }

function productCard(p,i){
  const fav=state.wish.has(p.id);
  const badge = p.badge? `<div class="pcard-badge ${p.badge==='new'?'new':p.badge==='hot'?'hot':''}">${p.badge==='sale'?'SALE':p.badge==='new'?'NEW':'HIT'}</div>`:'';
  return `<div class="pcard" data-reveal data-pid="${p.id}" style="transition-delay:${(i%4)*0.08}s">
    ${badge}
    <button class="pcard-fav ${fav?'on':''}" data-fav="${p.id}" title="В избранное">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    </button>
    <div class="pcard-img" data-open="${p.id}">
      <img class="img-a" src="${p.imgA}" alt="${p.name}" loading="lazy">
      <img class="img-b" src="${p.imgB}" alt="" loading="lazy">
      <div class="pcard-quick">Быстрый просмотр</div>
    </div>
    <div class="pcard-body" data-open="${p.id}">
      <div class="pcard-cat">${p.cat}</div>
      <div class="pcard-name">${p.name}</div>
      <div class="pcard-price"><span class="cur">${money(p.price)}</span>${p.old?`<span class="old">${money(p.old)}</span>`:''}</div>
      <div class="pcard-stars">${star(+p.rating)} <span style="color:var(--g500);font-size:.72rem">${p.rating}</span></div>
    </div>
  </div>`;
}

const Build=(()=>{
  let homeDone=false, storesDone=false;

  function home(){
    if(homeDone)return; homeDone=true;
    // marquee
    const m='ANYTHING IS POSSIBLE · 一切皆有可能 · LI-NING UZBEKISTAN · RUN · TRAIN · BALL · ';
    $('#marqueeTrack').innerHTML='<span>'+m.repeat(2)+'</span><span>'+m.repeat(2)+'</span>';
    // collections
    const cols=[
      {nm:'БАСКЕТБОЛ',meta:'40+ моделей',img:A+'collections/basketball.png',badge:'Wade'},
      {nm:'БЕГ',meta:'Speed series',img:A+'collections/Running.png'},
      {nm:'ФИТНЕС',meta:'Training',img:A+'collections/Fitness.png'},
      {nm:'WADE',meta:'Signature',img:A+'collections/wade.png',badge:'New'},
      {nm:'SPORTSTYLE',meta:'Lifestyle',img:A+'collections/Sportstyle.png'},
    ];
    $('#collections').innerHTML=
      `<a class="col-side" href="#" data-nav="catalog" data-reveal="left">
        <span class="vtext">ВСЕ<span class="dash">—</span>КОЛЛЕКЦИИ</span>
        <span class="go">Смотреть все →</span>
      </a>`+
      cols.map((c,i)=>`<a class="col-card" href="#" data-nav="catalog" data-reveal>
        <span class="col-idx">0${i+1}</span>
        ${c.badge?`<span class="badge-tl">${c.badge}</span>`:''}
        <img src="${c.img}" alt="${c.nm}" loading="lazy">
        <div class="col-label"><div class="nm">${c.nm}</div><div class="meta">${c.meta}</div></div>
      </a>`).join('');
    // popular
    $('#popularGrid').innerHTML=PRODUCTS.slice(0,8).map(productCard).join('');
    // reviews
    $('#revBars').innerHTML=REVIEW_BARS.map(([s,w])=>`<div class="rev-bar-row"><span class="lab">${s} ★</span><div class="rev-bar"><i data-w="${w}"></i></div><span>${w}%</span></div>`).join('');
    $('#revGrid').innerHTML=REVIEWS.map((r,i)=>`<div class="rev-card" data-reveal style="transition-delay:${i*0.08}s">
      <div class="stars">${star(r.r)}</div><p>«${r.t}»</p>
      <div class="who"><div class="av">${r.n[0]}</div><div><div class="nm">${r.n}</div><div class="dt">${r.d}</div></div></div>
    </div>`).join('');
    Hero.build();
  }

  function catalog(){
    $('#filters').innerHTML=`
      <div class="filter-group"><h4>Категория</h4><div class="filter-list">
        ${['Все товары','Обувь','Одежда','Аксессуары'].map((c,i)=>`<label><input type="checkbox" ${i===0?'checked':''}>${c}</label>`).join('')}
      </div></div>
      <div class="filter-group"><h4>Коллекция</h4><div class="filter-list">
        ${['Баскетбол','Бег','Фитнес','Wade','Lifestyle'].map(c=>`<label><input type="checkbox">${c}</label>`).join('')}
      </div></div>
      <div class="filter-group"><h4>Размер</h4><div class="size-chips">
        ${[39,40,41,42,43,44,45,46].map(s=>`<button>${s}</button>`).join('')}
      </div></div>
      <div class="filter-group"><h4>Цена</h4><div class="filter-list" style="color:var(--g500);font-size:.82rem">690 000 — 1 200 000 сум</div></div>`;
    $('#catalogGrid').innerHTML=PRODUCTS.map(productCard).join('');
    $('#catCount').textContent=PRODUCTS.length;
    $$('.size-chips button',$('#filters')).forEach(b=>b.onclick=()=>b.classList.toggle('on'));
  }

  function product(id){
    const p=PRODUCTS.find(x=>x.id===id)||PRODUCTS[0];
    const imgs=[p.imgA,p.imgB,p.imgA];
    const fav=state.wish.has(p.id);
    $('#productWrap').innerHTML=`
      <div class="pgal" data-reveal="left">
        <div class="pgal-thumbs">${imgs.map((im,i)=>`<div class="pgal-thumb ${i===0?'on':''}" data-thumb="${i}"><img src="${im}" alt=""></div>`).join('')}</div>
        <div class="pgal-main"><img id="pgalMain" src="${imgs[0]}" alt="${p.name}"><div class="pgal-zoom">⤢ Наведите для зума</div></div>
      </div>
      <div class="pdetail" data-reveal="right">
        <div class="pd-cat">${p.cat}</div>
        <h1>${p.name}</h1>
        <div class="pd-stars">${star(+p.rating)} <span>${p.rating} · ${p.reviews} отзывов</span></div>
        <div class="pd-price"><span class="cur">${money(p.price)}</span>${p.old?`<span class="old">${money(p.old)}</span><span class="save">−${Math.round((1-p.price/p.old)*100)}%</span>`:''}</div>
        <div class="pd-block">
          <div class="lab"><span>Размер (EU)</span><a href="#" style="color:var(--g500);text-transform:none;letter-spacing:0">Таблица размеров</a></div>
          <div class="pd-sizes" id="pdSizes">${p.sizes.map(s=>`<button data-size="${s.s}" ${s.ok?'':'disabled'}>${s.s}</button>`).join('')}</div>
        </div>
        <div class="pd-block">
          <div class="pd-actions">
            <button class="btn btn-primary" id="pdAdd" data-pid="${p.id}">В корзину <span class="ic">→</span></button>
            <button class="pd-fav ${fav?'on':''}" data-fav="${p.id}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>
          </div>
        </div>
        <div class="pd-block">
          <div class="pd-feats">
            <div class="pd-feat"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div><div class="t">Доставка 1–2 дня</div></div>
            <div class="pd-feat"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 12l2 2 4-4M12 3l8 4v5c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7z"/></svg></div><div class="t">Оригинал · гарантия</div></div>
            <div class="pd-feat"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0zM3 12h4M17 12h4"/></svg></div><div class="t">Обмен 14 дней</div></div>
          </div>
        </div>
      </div>`;
    $('#relatedGrid').innerHTML=PRODUCTS.filter(x=>x.id!==p.id).slice(0,4).map(productCard).join('');
    // gallery + size interactions
    $$('#productWrap .pgal-thumb').forEach(t=>t.onclick=()=>{ $$('#productWrap .pgal-thumb').forEach(x=>x.classList.remove('on')); t.classList.add('on'); const m=$('#pgalMain'); m.style.opacity='0'; setTimeout(()=>{ m.src=imgs[+t.dataset.thumb]; m.style.opacity='1'; },180); });
    let chosen=null;
    $$('#pdSizes button:not([disabled])').forEach(b=>b.onclick=()=>{ $$('#pdSizes button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); chosen=b.dataset.size; });
    $('#pdAdd').onclick=()=>{ if(!chosen){ toast('Выберите размер','warn'); $('#pdSizes').animate([{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'none'}],{duration:300}); return;} Cart.add(p,chosen); };
  }

  function stores(){
    if(!storesDone){
      storesDone=true;
      // stylized map background
      const c=$('#mapCanvas');
      c.innerHTML=`<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0">
        <rect width="100" height="100" fill="#e7ece9"/>
        ${Array.from({length:10},(_,i)=>`<line x1="${i*11}" y1="0" x2="${i*11}" y2="100" stroke="#d4dcd7" stroke-width="${i%3?0.3:0.7}"/>`).join('')}
        ${Array.from({length:10},(_,i)=>`<line x1="0" y1="${i*11}" x2="100" y2="${i*11}" stroke="#d4dcd7" stroke-width="${i%3?0.3:0.7}"/>`).join('')}
        <path d="M-5 70 C 25 55, 45 80, 70 60 S 110 55, 110 45" fill="none" stroke="#bcd3e8" stroke-width="3.4" opacity=".8"/>
        <path d="M10 -5 C 30 25, 20 50, 45 70 S 60 105, 75 110" fill="none" stroke="#cfe0d2" stroke-width="6" opacity=".7"/>
        ${[[20,20],[60,15],[75,30],[30,45],[55,55],[80,65],[25,75],[68,80]].map(([x,y])=>`<rect x="${x}" y="${y}" width="9" height="7" rx="1" fill="#dde3df"/>`).join('')}
      </svg>`;
      STORES.forEach((s,i)=>{
        const pin=document.createElement('div'); pin.className='map-pin'; pin.dataset.i=i;
        pin.style.left=s.x+'%'; pin.style.top=s.y+'%';
        pin.innerHTML=`<div class="pulse"></div><div class="dot"><span>${i+1}</span></div>`;
        pin.onclick=()=>focusStore(i);
        c.appendChild(pin);
      });
      $('#storeList').innerHTML=STORES.map((s,i)=>`<div class="store-card" data-i="${i}">
        <div class="store-num">${i+1}</div>
        <div class="store-info">
          <div class="nm">${s.n}</div><div class="addr">${s.addr}</div>
          <div class="meta"><span class="${s.open?'open':''}">${s.open?'● Открыто':'○ Закрыто'}</span><span>${s.hours}</span></div>
        </div></div>`).join('');
      $$('#storeList .store-card').forEach(card=>card.onclick=()=>focusStore(+card.dataset.i));
      focusStore(0,true);
    }
  }
  function focusStore(i,silent){
    $$('.map-pin').forEach(p=>p.classList.toggle('active',+p.dataset.i===i));
    $$('#storeList .store-card').forEach(c=>c.classList.toggle('active',+c.dataset.i===i));
    if(!silent){ const card=$(`#storeList .store-card[data-i="${i}"]`); card&&card.scrollIntoView?card.parentElement.scrollTo({top:card.offsetTop-120,behavior:'smooth'}):0; }
  }

  function wishlist(){
    const items=PRODUCTS.filter(p=>state.wish.has(p.id));
    $('#wishSub').textContent=items.length+' товаров';
    $('#wishGrid').innerHTML = items.length
      ? items.map(productCard).join('')
      : `<div class="empty" style="grid-column:1/-1"><div class="ic"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div><h3>ПОКА ПУСТО</h3><p>Добавляйте понравившиеся товары — нажмите ♥ на карточке.</p><a class="btn btn-dark" href="#" data-nav="catalog" style="margin-top:.6rem">В каталог</a></div>`;
  }

  function orders(){
    $('#ordersWrap').innerHTML=ORDERS.map((o,oi)=>`
      <div class="order-card" data-reveal style="transition-delay:${oi*0.08}s">
        <div class="order-head">
          <div><div class="order-id">${o.id}</div><div class="order-date">${o.date}</div></div>
          <div class="order-status st-${o.status}">${o.stLabel}</div>
        </div>
        <div class="order-items">
          ${o.items.map(it=>`<div class="order-item"><img src="${it.p.imgA}" alt=""><div><div class="oi-nm">${it.p.name}</div><div class="oi-meta">Размер ${it.size} · ${it.qty} шт.</div></div><div class="oi-price">${money(it.p.price*it.qty)}</div></div>`).join('')}
        </div>
        <div class="order-foot">
          <div class="track">${TRACK_STEPS.map((t,si)=>`
            <div class="track-node ${si<=o.step?'done':''}"><div class="ball">${si<o.step?'✓':si+1}</div><div class="tl">${t}</div></div>
            ${si<TRACK_STEPS.length-1?`<div class="track-line ${si<o.step?'done':''}"><i></i></div>`:''}`).join('')}</div>
          <div class="tot">Итого:<b>${money(o.items.reduce((s,it)=>s+it.p.price*it.qty,0))}</b></div>
        </div>
      </div>`).join('');
    // animate track lines on reveal
    setTimeout(()=>{ $$('#ordersWrap .track-line.done i').forEach((i,k)=>setTimeout(()=>i.style.width='100%',200+k*120)); },300);
  }

  function forView(name){
    if(name==='home')home();
    else if(name==='catalog')catalog();
    else if(name==='stores')stores();
    else if(name==='wishlist')wishlist();
    else if(name==='orders')orders();
    else if(name==='product'&&!$('#productWrap').children.length)product(PRODUCTS[0].id);
  }
  return { forView, home, product, wishlist };
})();

/* ════════════════════════ CART ════════════════════════ */
const Cart=(()=>{
  const drawer=$('#cartDrawer'), overlay=$('#cartOverlay'), body=$('#cartBody'), badge=$('#cartBadge'), total=$('#cartTotal');
  function open(){ overlay.classList.add('open'); drawer.classList.add('open'); }
  function close(){ overlay.classList.remove('open'); drawer.classList.remove('open'); }
  function add(p,size){
    const key=p.id+'-'+size, ex=state.cart.find(i=>i.key===key);
    if(ex)ex.qty++; else state.cart.push({key,p,size,qty:1});
    render(); bump(); toast(p.name+' в корзине'); open();
  }
  function bump(){ const n=state.cart.reduce((s,i)=>s+i.qty,0); badge.textContent=n; badge.classList.toggle('show',n>0);
    badge.animate([{transform:'scale(.4)'},{transform:'scale(1.3)'},{transform:'scale(1)'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'}); }
  function render(){
    if(!state.cart.length){ body.innerHTML=`<div class="cart-empty"><div class="ic"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div><p>Корзина пуста</p></div>`; $('#cartFoot').style.display='none'; return; }
    $('#cartFoot').style.display='block';
    body.innerHTML=state.cart.map((it,i)=>`<div class="cart-item" style="animation-delay:${i*0.05}s" data-key="${it.key}">
      <img src="${it.p.imgA}" alt="">
      <div style="flex:1">
        <div class="ci-nm">${it.p.name}</div><div class="ci-meta">Размер ${it.size}</div>
        <div class="ci-price">${money(it.p.price*it.qty)}</div>
        <div class="cart-qty"><button data-q="-" data-key="${it.key}">−</button><span>${it.qty}</span><button data-q="+" data-key="${it.key}">+</button></div>
      </div>
      <button class="cart-rm" data-rm="${it.key}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>`).join('');
    total.textContent=money(state.cart.reduce((s,i)=>s+i.p.price*i.qty,0));
  }
  body.addEventListener('click',e=>{
    const q=e.target.closest('[data-q]'), rm=e.target.closest('[data-rm]');
    if(q){ const it=state.cart.find(i=>i.key===q.dataset.key); if(!it)return; it.qty+=q.dataset.q==='+'?1:-1; if(it.qty<1)state.cart=state.cart.filter(i=>i!==it); render(); bump(); }
    if(rm){ const card=rm.closest('.cart-item'); card.classList.add('removing'); setTimeout(()=>{ state.cart=state.cart.filter(i=>i.key!==rm.dataset.rm); render(); bump(); },300); }
  });
  return { add, open, close, render };
})();

/* ════════════════════════ WISHLIST TOGGLE ════════════════════════ */
function toggleWish(id,btn){
  const on=state.wish.has(id);
  if(on)state.wish.delete(id); else state.wish.add(id);
  $$(`[data-fav="${id}"]`).forEach(b=>b.classList.toggle('on',!on));
  if(btn){ btn.animate([{transform:'scale(.6)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'}); }
  const n=state.wish.size; const wb=$('#wishBadge'); wb.textContent=n; wb.classList.toggle('show',n>0);
  toast(on?'Удалено из избранного':'Добавлено в избранное ♥');
  if($('#view-wishlist').classList.contains('active'))Build.wishlist();
}

/* ════════════════════════ TOAST ════════════════════════ */
let toastT;
function toast(msg){
  const w=$('#toastWrap');
  const t=document.createElement('div'); t.className='toast';
  t.innerHTML=`<span class="tk"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span>${msg}`;
  w.appendChild(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),400); },2200);
}

/* ════════════════════════ DELEGATED EVENTS ════════════════════════ */
document.addEventListener('click',e=>{
  const navEl=e.target.closest('[data-nav]');
  if(navEl){ e.preventDefault(); showView(navEl.dataset.nav); return; }
  const fav=e.target.closest('[data-fav]');
  if(fav){ e.preventDefault(); e.stopPropagation(); toggleWish(fav.dataset.fav,fav); return; }
  const open=e.target.closest('[data-open]');
  if(open){ Build.product(open.dataset.open); showView('product'); return; }
});
$('#cartBtn').onclick=()=>Cart.open();
$('#cartCloseBtn').onclick=()=>Cart.close();
$('#cartOverlay').onclick=()=>Cart.close();
$('#searchBtn').onclick=()=>toast('Поиск — демо');
addEventListener('keydown',e=>{ if(e.key==='Escape')Cart.close(); });

// intro replay control (Ink)
$('#replayIntro').addEventListener('click',()=>{ scrollTo({top:0}); Loader.play(1); });

/* ════════════════════════ INIT ════════════════════════ */
function init(){
  Build.home();
  observeReveals($('#view-home'));
  onScroll();
  if(reduce){ $('#loader').style.display='none'; document.body.classList.remove('locked'); $('#introReplay').classList.add('show'); Hero.build(); Hero.intro(); }
  else Loader.play(1);
}
init();
