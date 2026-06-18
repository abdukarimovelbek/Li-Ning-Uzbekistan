/* ============================================
   LI NING STORE — MAIN JAVASCRIPT
   All interactivity: cursor, cart, filters,
   reviews, animations, form validation
   ============================================ */

'use strict';

/* ─── SUPABASE CONFIG ───────────────────────── */
const SB_URL = 'https://dgyirginrefvjsbhhooi.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRneWlyZ2lucmVmdmpzYmhob29pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MDUzNjgsImV4cCI6MjA5MzI4MTM2OH0.A-ueG5j_wcxZ7joJM645hrImLwFYjz_SM4ATLTc0cfU';

/* ─── LOAD COMPONENTS ───────────────────────── */
async function loadComponents() {
  const components = [
    { id: 'navbar-placeholder', file: 'components/navbar.html' },
    { id: 'footer-placeholder', file: 'components/footer.html' },
    { id: 'modals-placeholder', file: 'components/modals.html' },
  ];
  for (const c of components) {
    const el = document.getElementById(c.id);
    if (!el) continue;
    const res = await fetch(c.file);
    el.innerHTML = await res.text();
  }
  // После загрузки всех компонентов — инициализируем навбар
  initMegaMenu();
  window.Auth?.initAuthBtn();
  window.Auth?.updateNavUI();
  window._initNavbar?.();
  CartDrawer.init();
  Cart.updateUI();
  highlightWishlist();
  window._updateMegaTop?.();
  initNavbarScroll();
  // Bind auth modal close — модал загружен только сейчас
  document.getElementById('auth-modal-close')?.addEventListener('click', () => window.Auth?.closeModal());
  document.getElementById('auth-overlay')?.addEventListener('click', () => window.Auth?.closeModal());
}
loadComponents();

/* ─── SITE FEATURE FLAGS ─────────────────────── */
const SITE_CONFIG = {
  auth_enabled:     true,
  cart_enabled:     true,
  wishlist_enabled: true,
  orders_enabled:   true,
};
(async () => {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/site_settings?id=eq.main`,
      { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } });
    const data = await res.json();
    if (data?.[0]) Object.assign(SITE_CONFIG, {
      auth_enabled:     data[0].auth_enabled     ?? true,
      cart_enabled:     data[0].cart_enabled     ?? true,
      wishlist_enabled: data[0].wishlist_enabled ?? true,
      orders_enabled:   data[0].orders_enabled   ?? true,
    });
  } catch(e) {}
})();


const CACHE_KEY = 'lining_products_cache';
const CACHE_TTL = 5 * 60 * 1000;


/* ─── TELEGRAM MINI APP ─────────────────────── */
const tg = window.Telegram?.WebApp;

if (tg) {
  // Инициализируем
  tg.ready();
  tg.expand(); // Раскрываем на весь экран

  // Убираем тикер в Telegram (экономим место)
  const ticker = document.querySelector('.ticker');
  if (ticker) ticker.style.display = 'none';

  // Цвет хедера под цвет навбара
  tg.setHeaderColor('#1A1A1A');
  tg.setBackgroundColor('#FAF8F5');

  // Кнопка "Назад" в Telegram вместо браузерной
  tg.BackButton.onClick(() => window.history.back());
}

// Утилита — открыт ли сайт в Telegram
function isTelegram() {
  return !!window.Telegram?.WebApp?.initData;
}

/* ─── AUTH MODULE ────────────────────────────── */
// Вставить в main.js ПЕРЕД секцией Cart (перед /* ─── 2. CART STATE & MANAGER ─── */)

const Auth = (() => {
  const SB_AUTH = `${SB_URL}/auth/v1`;
  let _user = null;
  let _pendingAction = null; // действие которое выполним после логина

  // ── Тихое обновление токена через refresh_token ──
  const _silentRefresh = async (refreshToken) => {
    try {
      const res = await fetch(`${SB_AUTH}/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      if (!res.ok) {
        localStorage.removeItem('lining_session');
        return;
      }
      const data = await res.json();
      data.expires_at = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
      localStorage.setItem('lining_session', JSON.stringify(data));
      _user = data.user;
      updateNavUI();
      document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: _user } }));
    } catch(e) {
      localStorage.removeItem('lining_session');
    }
  };

  // ── Получаем текущего пользователя из localStorage ──
  const loadUser = () => {
    try {
      const session = JSON.parse(localStorage.getItem('lining_session') || 'null');
      if (!session?.access_token) { _user = null; return null; }

      if (session.expires_at > Date.now() / 1000) {
        _user = session.user;
        return _user;
      }

      // Токен истёк — пробуем тихо обновить через refresh_token
      if (session.refresh_token) {
        _silentRefresh(session.refresh_token);
      }
    } catch(e) {}
    _user = null;
    return null;
  };

  // ── Текущий пользователь ──
  const getUser = () => _user;

  // ── Проверка авторизации ──
  const isLoggedIn = () => !!_user;

  // ── Если не вошёл — открываем модал, запоминаем действие ──
  const requireAuth = (action) => {
    if (isLoggedIn()) {
      action?.();
      return true;
    }
    _pendingAction = action;
    openModal();
    return false;
  };

  // ── Регистрация ──
  const signUp = async (email, password, name) => {
    const res = await fetch(`${SB_AUTH}/signup`, {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, data: { full_name: name } })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Ошибка регистрации');
    
    // Создаём профиль сразу после регистрации
    if (data.user?.id && data.session?.access_token) {
      await fetch(`${SB_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${data.session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          id: data.user.id,
          email: email,
          full_name: name
        })
      });
    }
    
    return data;
  };

  // ── Вход ──
  const signIn = async (email, password) => {
    const res = await fetch(`${SB_AUTH}/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Неверный email или пароль');
    
    data.expires_at = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
    localStorage.setItem('lining_session', JSON.stringify(data));
    _user = data.user;
    onLogin();
    return data;
  };

  // ── Выход ──
  const signOut = async () => {
    const session = JSON.parse(localStorage.getItem('lining_session') || 'null');
    if (session?.access_token) {
      await fetch(`${SB_AUTH}/logout`, {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${session.access_token}` }
      }).catch(() => {});
    }
    localStorage.removeItem('lining_session');
    _user = null;
    updateNavUI();
    window.Toast?.show('Вы вышли из аккаунта', '', '');
    closeModal();
  };

  // ── После успешного входа ──
  const onLogin = () => {
    updateNavUI();
    closeModal();
    window.Toast?.show(`Добро пожаловать! 👋`, _user?.user_metadata?.full_name || _user?.email || '', 'success');
    document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: _user } }));
    if (_pendingAction) {
      setTimeout(() => { _pendingAction?.(); _pendingAction = null; }, 300);
    }
  };

  // ── Обновляем иконку человечка ──
  const updateNavUI = () => {
    const btn = document.getElementById('auth-btn');
    if (!btn) return;
    if (_user) {
      const name = _user.user_metadata?.full_name || _user.email || '';
      const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
      btn.innerHTML = `<span style="width:26px;height:26px;border-radius:50%;background:var(--red);color:#fff;font-size:0.65rem;font-weight:700;display:flex;align-items:center;justify-content:center">${initials}</span>`;
      btn.title = name;
    } else {
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      btn.title = 'Войти';
    }
  };

  // ── Открыть/закрыть модал ──
  const openModal = (tab = 'login') => {
    const modal = document.getElementById('auth-modal');
    const overlay = document.getElementById('auth-overlay');
    if (!modal) return;

    // Скрыть табы "Войти/Регистрация" если открываем кабинет
    const tabsEl = modal.querySelector('.auth-tabs');
    if (tabsEl) tabsEl.style.display = tab === 'account' ? 'none' : '';

    // Заполнить данные пользователя в кабинете
    if (tab === 'account' && _user) {
      const name = _user.user_metadata?.full_name || _user.email || '';
      const initials = name.split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?';
      const avatarEl = document.getElementById('auth-avatar-big');
      const nameEl   = document.getElementById('auth-account-name');
      const emailEl  = document.getElementById('auth-account-email');
      if (avatarEl) avatarEl.textContent = initials;
      if (nameEl)   nameEl.textContent   = name || 'Пользователь';
      if (emailEl)  emailEl.textContent  = _user.email || '';
    }

    modal.style.display = 'block';
    requestAnimationFrame(() => { modal.classList.add('open'); overlay.classList.add('open'); });
    switchTab(tab);
  };

  const closeModal = () => {
    const modal = document.getElementById('auth-modal');
    const overlay = document.getElementById('auth-overlay');
    if (!modal) return;
    modal.classList.remove('open');
    overlay.classList.remove('open');
    setTimeout(() => { modal.style.display = 'none'; }, 250);
    clearErrors();
  };

  const switchTab = (tab) => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === `auth-form-${tab}`));
  };

  const clearErrors = () => {
    document.querySelectorAll('.auth-error').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
    document.querySelectorAll('.auth-input').forEach(inp => inp.classList.remove('error'));
  };

  const showError = (formId, msg) => {
    const err = document.querySelector(`#${formId} .auth-error`);
    if (err) { err.textContent = msg; err.style.display = 'block'; }
  };

  // ── Обработчики форм ──
  const initForms = () => {
    document.addEventListener('submit', async e => {
      const form = e.target;

      // ── Вход ──
      if (form.id === 'auth-form-login') {
        e.preventDefault();
        clearErrors();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = form.querySelector('.auth-submit');
        btn.textContent = 'Входим...'; btn.disabled = true;
        try {
          await signIn(email, password);
        } catch(err) {
          showError('auth-form-login', err.message);
          btn.textContent = 'Войти'; btn.disabled = false;
        }
      }

      // ── Регистрация ──
      if (form.id === 'auth-form-register') {
        e.preventDefault();
        clearErrors();
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const btn = form.querySelector('.auth-submit');

        if (password.length < 6) { showError('auth-form-register', 'Пароль минимум 6 символов'); return; }
        btn.textContent = 'Регистрируем...'; btn.disabled = true;

        try {
          await signUp(email, password, name);
          const loginData = await signIn(email, password);
          if (loginData?.access_token && loginData?.user?.id) {
            await fetch(`${SB_URL}/rest/v1/profiles`, {
              method: 'POST',
              headers: {
                'apikey': SB_KEY,
                'Authorization': `Bearer ${loginData.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=ignore-duplicates,return=minimal'
              },
              body: JSON.stringify({
                id: loginData.user.id,
                email: email,
                full_name: name
              })
            });
          }
        } catch(err) {
          showError('auth-form-register', err.message);
          btn.textContent = 'Зарегистрироваться'; btn.disabled = false;
        }
      }
    });

    // Кнопка выхода в кабинете
    document.getElementById('auth-signout-btn')?.addEventListener('click', signOut);
  };

  // ── Иконка человечка ──
  const initAuthBtn = () => {
    const btn = document.getElementById('auth-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!SITE_CONFIG.auth_enabled) {
        showFeatureDisabledModal('auth');
        return;
      }
      if (isLoggedIn()) {
        openModal('account');
      } else {
        openModal('login');
      }
    });
  };


  document.addEventListener('DOMContentLoaded', () => {
    loadUser();
    initForms();

    document.addEventListener('click', e => {
      const tab = e.target.closest('.auth-tab');
      if (tab) switchTab(tab.dataset.tab);
    });

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  });

  window.Auth = { getUser, isLoggedIn, requireAuth, signOut, openModal, closeModal, initAuthBtn, updateNavUI };

  return { getUser, isLoggedIn, requireAuth };
})();

/* ─── 2. CART STATE & MANAGER ───────────────── */
const Cart = (() => {
  let items = JSON.parse(localStorage.getItem('lining_cart') || '[]');

  const save = () => localStorage.setItem('lining_cart', JSON.stringify(items));

  const updateUI = (animate = false) => {
    const total = items.reduce((s, i) => s + i.qty, 0);
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = total;
      el.style.display = total > 0 ? 'flex' : 'none';
      if (animate) {
        el.classList.remove('count-animating');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => el.classList.add('count-animating'));
        });
        setTimeout(() => el.classList.remove('count-animating'), 400);
      }
    });

    if (animate) {
      document.querySelectorAll('.cart-btn').forEach(btn => {
        btn.classList.remove('cart-animating');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => btn.classList.add('cart-animating'));
        });
        setTimeout(() => btn.classList.remove('cart-animating'), 700);
      });
    }

    renderCartBody();
  };

  const add = (product) => {
    const existing = items.find(i => i.id === product.id && i.size === product.size);
    if (existing) {
      existing.qty++;
    } else {
      items.push({ ...product, qty: 1 });
    }
    save();
    updateUI(true);
    window.Toast?.show(`${product.name} добавлен в корзину`, 'В корзине: ' + items.reduce((s,i)=>s+i.qty,0) + ' товара', 'success');
    window.CartDrawer?.open();
    // GA4 событие
    trackEvent('add_to_cart', {
      currency: 'UZS',
      value: product.price,
      items: [{ item_id: product.article || product.id, item_name: product.name, price: product.price }]
    });
  };

  const remove = (id, size) => {
    items = items.filter(i => !(i.id === id && i.size === size));
    save();
    updateUI();
  };


  const clear = () => { 
    items = []; 
    save(); 
    updateUI(); 
  };
  
  const changeQty = (id, size, delta) => {
    const existing = items.find(i => i.id === id && i.size === size);
    if (!existing) return;
    existing.qty += delta;
    if (existing.qty <= 0) {
      items = items.filter(i => !(i.id === id && i.size === size));
    }
    save();
    updateUI();
  };

  const getTotal = () => items.reduce((s, i) => s + i.price * i.qty, 0);

  const getItems = () => items;

  const renderCartBody = () => {
    const body = document.querySelector('.cart-body');
    if (!body) return;

    if (items.length === 0) {
      body.innerHTML = `<div class="cart-empty">
        <div class="empty-icon">🛒</div>
        <p>Корзина пуста</p>
        <a href="catalog.html" class="btn btn-primary" style="margin-top:.5rem;text-align:center;display:block">Перейти в каталог</a>
      </div>`;
      } else {
      body.innerHTML = items.map(item => `
        <div class="cart-item">
          <div class="cart-item-img" style="overflow:hidden;flex-shrink:0">
            ${item.image
              ? `<img src="${item.image}" style="width:100%;height:100%;object-fit:cover;display:block">`
              : '👟'}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-meta">Размер: ${item.size}</div>
          <div style="display:flex;align-items:center;gap:.5rem;margin-top:.4rem">
            <button onclick="window.cartChangeQty('${item.id}','${item.size}',-1)" style="width:44px;height:44px;background:var(--gray-100);border:1px solid var(--gray-100);border-radius:6px;font-size:1.1rem;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">−</button>
            <span style="font-size:.9rem;font-weight:700;min-width:24px;text-align:center">${item.qty}</span>
            <button onclick="window.cartChangeQty('${item.id}','${item.size}',1)" style="width:44px;height:44px;background:var(--gray-100);border:1px solid var(--gray-100);border-radius:6px;font-size:1.1rem;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">+</button>
          </div>
          <div class="cart-item-price" style="margin-top:.4rem">${(item.price * item.qty).toLocaleString('ru-RU')} сум</div>
        </div>
        <button class="cart-item-remove" onclick="window.cartRemove('${item.id}','${item.size}')">✕</button>
      </div>
    `).join('');
    }

    const totalEl = document.querySelector('.cart-total strong');
    if (totalEl) totalEl.textContent = getTotal().toLocaleString('ru-RU') + ' сум';
  };

  // Expose globally
  window.Cart = { add, remove, clear, changeQty, getTotal, getItems, updateUI};
  window.cartRemove = remove;
  window.cartChangeQty = changeQty;

  updateUI();
  return { updateUI };
})();


/* ─── 3. CART DRAWER ────────────────────────── */
const CartDrawer = (() => {
  let overlay, drawer;

  const open = () => {
    if (!SITE_CONFIG.cart_enabled) {
      showFeatureDisabledModal('cart');
      return;
    }
    overlay = overlay || document.querySelector('.cart-overlay');
    drawer  = drawer  || document.querySelector('.cart-drawer');
    overlay?.classList.add('open');
    drawer?.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('.tabbar .tab').forEach(t=>t.classList.remove('active'));
    document.querySelector('.tabbar .tab[data-tab="cart"]')?.classList.add('active');
  };

  const close = () => {
    overlay = overlay || document.querySelector('.cart-overlay');
    drawer  = drawer  || document.querySelector('.cart-drawer');
    overlay?.classList.remove('open');
    drawer?.classList.remove('open');
    document.body.style.overflow = '';
    document.querySelector('.tabbar .tab[data-tab="cart"]')?.classList.remove('active');
  };

  const init = () => {
    overlay = document.querySelector('.cart-overlay');
    drawer  = document.querySelector('.cart-drawer');
    document.querySelectorAll('.cart-btn, [data-open-cart]')
      .forEach(btn => btn.addEventListener('click', open));
    document.querySelectorAll('.cart-close')
      .forEach(btn => btn.addEventListener('click', close));
    overlay?.addEventListener('click', close);
  };

  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  return window.CartDrawer = { open, close, init };
})();



/* ─── 4. TOAST NOTIFICATIONS ────────────────── */
const Toast = (() => {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const show = (title, msg = '', type = '') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-title">${title}</div>${msg ? `<div class="toast-msg">${msg}</div>` : ''}`;
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  };

  window.Toast = { show };
})();


/* ─── 5. PRODUCT CARD INTERACTIONS ─────────────*/
const ProductCards = (() => {
  const init = () => {
    document.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('mouseenter', () => card.classList.add('is-hovered'));
      card.addEventListener('mouseleave', () => card.classList.remove('is-hovered'));

      // Quick-add button
      const addBtn = card.querySelector('.btn-addcart');
      if (addBtn) {
        addBtn.addEventListener('click', e => {
          e.stopPropagation();
          const data = {
            id:      card.dataset.productId || Math.random().toString(36).slice(2),
            article: card.dataset.article || card.dataset.productId,
            name:    card.querySelector('.product-name')?.textContent || 'Товар',
            price:   parseInt(card.dataset.price || '0'),
            size:    card.dataset.defaultSize || '42',
            emoji:   card.querySelector('.product-img')?.textContent?.trim() || '👟',
          };
          if (window.Auth) {
            window.Auth.requireAuth(() => Cart.add(data));
          } else {
            Cart.add(data);
          }
          addBtn.textContent = '✓ Добавлено';
          addBtn.style.background = '#22c55e';
          setTimeout(() => {
            addBtn.textContent = '+ В корзину';
            addBtn.style.background = '';
          }, 1600);
        });
      }

      // Wishlist toggle
      const wishBtn = card.querySelector('.btn-wishlist');
      if (wishBtn) {
        wishBtn.addEventListener('click', e => {
          e.stopPropagation();
          e.preventDefault();
          if (window.Auth) {
            window.Auth.requireAuth(async () => {
              const user = window.Auth.getUser();
              const productId = card.dataset.productId;
              const isWished = wishBtn.dataset.wished === 'true';

              const session = JSON.parse(localStorage.getItem('lining_session') || 'null');
              const token = session?.access_token || SB_KEY;

              if (isWished) {
                await fetch(
                  `${SB_URL}/rest/v1/wishlists?user_id=eq.${user.id}&product_id=eq.${productId}`,
                  { method: 'DELETE', headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${token}` } }
                );
                wishBtn.dataset.wished = 'false';
                wishBtn.textContent = '♡';
                window.Toast?.show('Убрано из избранного', '', '');
                const _wb = document.getElementById('wishBadge');
                if (_wb) _wb.textContent = Math.max(0, parseInt(_wb.textContent || '0') - 1);
              } else {
                await fetch(`${SB_URL}/rest/v1/wishlists`, {
                  method: 'POST',
                  headers: {
                    'apikey': SB_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=ignore-duplicates,return=minimal'
                  },
                  body: JSON.stringify({ user_id: user.id, product_id: productId })
                });
                wishBtn.dataset.wished = 'true';
                wishBtn.textContent = '♥';
                const _wb = document.getElementById('wishBadge');
                if (_wb) _wb.textContent = parseInt(_wb.textContent || '0') + 1;
                wishBtn.classList.remove('heart-pop');
                requestAnimationFrame(() => requestAnimationFrame(() => wishBtn.classList.add('heart-pop')));
                setTimeout(() => wishBtn.classList.remove('heart-pop'), 420);
                const hRect = wishBtn.getBoundingClientRect();
                const hParticle = document.createElement('span');
                hParticle.className = 'heart-particle';
                hParticle.textContent = '♥';
                hParticle.style.cssText = `top:${hRect.top + window.scrollY - 8}px;left:${hRect.left + hRect.width / 2}px`;
                document.body.appendChild(hParticle);
                setTimeout(() => hParticle.remove(), 650);
                window.Toast?.show('Добавлено в избранное', '', 'success');
              }
            });
          }
        });
      }

      // Click → product page
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const href = card.dataset.href;
        if (href) window.location.href = href;
      });
    });
  };

  window.ProductCards = { init };
})();
  

/* ─── 6. FILTER SIDEBAR ─────────────────────── */
const FilterSidebar = (() => {
  const init = () => {
    // Toggle filter block open/close
    document.querySelectorAll('.filter-block-head').forEach(head => {
      head.addEventListener('click', () => {
        const body   = head.nextElementSibling;
        const toggle = head.querySelector('.toggle');
        body?.classList.toggle('open');
        toggle?.classList.toggle('open');
      });
      // Open first two blocks by default
      const body = head.nextElementSibling;
      body?.classList.add('open');
      head.querySelector('.toggle')?.classList.add('open');
    });

    // Size button selection
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.size-grid');
        group?.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilters();
      });
    });

    // Brand checkboxes
    document.querySelectorAll('.filter-brand-item input').forEach(cb => {
      cb.addEventListener('change', applyFilters);
    });

    // Promo checkboxes
    document.querySelectorAll('.filter-promo-item input').forEach(cb => {
      cb.addEventListener('change', applyFilters);
    });


    // Price slider sync
    const slider = document.querySelector('#price-slider');
    const maxInput = document.querySelector('#price-max');
    if (slider && maxInput) {
      slider.addEventListener('input', () => {
        maxInput.value = parseInt(slider.value).toLocaleString('ru-RU');
        applyFilters();
      });
      maxInput.addEventListener('input', () => {
        slider.value = maxInput.value.replace(/\D/g,'');
        applyFilters();
      });
    }

    // Apply button
    document.querySelector('.filter-apply-btn')?.addEventListener('click', () => {
      applyFilters();
      Toast.show('Фильтры применены');
    });

    // Clear button
    document.querySelector('.filter-clear-btn')?.addEventListener('click', () => {
      document.querySelectorAll('.filter-brand-item input').forEach(cb => cb.checked = false);
      document.querySelectorAll('.filter-promo-item input').forEach(cb => cb.checked = false);
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      if (slider) slider.value = slider.max;
      if (maxInput) maxInput.value = parseInt(slider?.max || 0).toLocaleString('ru-RU');
      applyFilters();
      Toast.show('Фильтры сброшены');
    });
  };

  const applyFilters = () => {
    const checkedBrands = [...document.querySelectorAll('.filter-brand-item input:checked')].map(cb => cb.value);
    const activeSize    = document.querySelector('.size-btn.active')?.dataset.size;
    const maxPrice      = parseInt(document.querySelector('#price-slider')?.value || Infinity);
    const checkedPromos = [...document.querySelectorAll('.filter-promo-item input:checked')].map(cb => cb.value);

    document.querySelectorAll('.product-card').forEach(card => {
      const brand = card.dataset.brand?.toLowerCase() || '';
      const price = parseInt(card.dataset.price || '0');
      const sizes = (card.dataset.sizes || '').split(',');
      const badge = card.dataset.badge || '';

      const brandOk = checkedBrands.length === 0 || checkedBrands.includes(brand);
      const priceOk = price <= maxPrice;
      const sizeOk  = !activeSize || sizes.includes(activeSize);
      const promoOk = checkedPromos.length === 0 || checkedPromos.includes(badge);

      card.style.display = (brandOk && priceOk && sizeOk && promoOk) ? '' : 'none';
    });

    updateCount();
  };


  const updateCount = () => {
    const visible = document.querySelectorAll('.product-card:not([style*="none"])').length;
    const countEl = document.querySelector('.catalog-count strong');
    if (countEl) countEl.textContent = visible;
  };

  document.addEventListener('DOMContentLoaded', init);
})();


/* ─── 7. CATALOG SORT ───────────────────────── */
const CatalogSort = (() => {
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.querySelector('.catalog-sort select');
    if (!select) return;

    select.addEventListener('change', () => {
      const val  = select.value;
      const grid = document.querySelector('.products-grid');
      if (!grid) return;

      const cards = [...grid.querySelectorAll('.product-card')];

      cards.sort((a, b) => {
        const pa = parseInt(a.dataset.price || '0');
        const pb = parseInt(b.dataset.price || '0');
        const ra = parseFloat(a.dataset.rating || '0');
        const rb = parseFloat(b.dataset.rating || '0');

        if (val === 'price-asc')  return pa - pb;
        if (val === 'price-desc') return pb - pa;
        if (val === 'rating')     return rb - ra;
        if (val === 'new')        return (b.dataset.isNew === 'true') - (a.dataset.isNew === 'true');
        return 0;
      });

      cards.forEach(card => grid.appendChild(card));
    });
  });
})();


/* ─── 8. PRODUCT DETAIL — SIZE SELECTION ───── */
const ProductDetail = (() => {
  document.addEventListener('DOMContentLoaded', () => {
    // Size buttons
    document.querySelectorAll('.detail-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.detail-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Gallery thumbnails
    document.querySelectorAll('.gallery-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        const main = document.querySelector('.gallery-main');
        if (main) {
          main.textContent = thumb.textContent;
          main.style.fontSize = '12rem';
          main.style.transform = 'scale(0.9)';
          setTimeout(() => { main.style.transform = 'scale(1)'; main.style.transition = 'transform 0.3s ease'; }, 10);
        }
      });
    });
    
  });
})();


/* ─── 9. ORDER FORM VALIDATION ──────────────── */
const OrderForm = (() => {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#order-form');
    if (!form) return;

    // Delivery options
    document.querySelectorAll('.delivery-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.delivery-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input[type=radio]').checked = true;
      });
    });

    // Payment options
    document.querySelectorAll('.pay-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input[type=radio]').checked = true;
      });
    });

    // Phone mask
    const phoneInput = document.querySelector('#phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', e => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.startsWith('998')) val = '+' + val;
        else if (val.length > 0) val = '+998' + val;
        e.target.value = val.slice(0, 13);
      });
    }

    // Validate single field
    const validateField = (input) => {
      const errorEl = input.parentElement.querySelector('.form-error');
      let valid = true;

      if (input.required && !input.value.trim()) {
        input.classList.add('error');
        if (errorEl) { errorEl.textContent = 'Это поле обязательно'; errorEl.classList.add('show'); }
        valid = false;
      } else if (input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
        input.classList.add('error');
        if (errorEl) { errorEl.textContent = 'Введите корректный email'; errorEl.classList.add('show'); }
        valid = false;
      } else {
        input.classList.remove('error');
        if (errorEl) errorEl.classList.remove('show');
      }
      return valid;
    };

    form.querySelectorAll('.form-input, .form-select').forEach(input => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => {
        if (input.classList.contains('error')) validateField(input);
      });
    });

    // Submit
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const inputs = form.querySelectorAll('.form-input, .form-select');
      let allValid = true;
      inputs.forEach(input => { if (!validateField(input)) allValid = false; });

      if (!allValid) {
        window.Toast?.show('Проверьте форму', 'Заполните все обязательные поля', '');
        return;
      }

      const submitBtn = form.querySelector('.submit-order') || form.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Оформляем заказ...';
        submitBtn.disabled = true;
      }

      // Собираем товары из корзины
      const cartItems = window.Cart.getItems();
      const orderItems = cartItems.map(item => ({
        article:  item.article || item.id,
        name:     item.name,
        price:    item.price,
        quantity: item.qty,
        size:     item.size,
        color:    item.color || null,
        image:    item.image || null,
      }));

      const orderData = {
        first_name:      document.getElementById('first-name').value.trim(),
        last_name:       document.getElementById('last-name').value.trim(),
        phone:           document.getElementById('phone').value.trim(),
        email:           document.getElementById('email')?.value.trim() || null,
        delivery_type:   document.querySelector('.delivery-option.selected input')?.value || null,
        pickup_store:    document.querySelector('input[name=pickup_store]:checked')?.value || null, // ← добавь
        address:         document.getElementById('address').value.trim(),
        city:            document.getElementById('city').value.trim(),
        comment:         document.getElementById('comment')?.value.trim() || null,
        payment_method:  document.querySelector('.pay-option.selected input')?.value || null,
        items:           orderItems,
        total:           window.Cart.getTotal(),
        status:          'new',
        source:          'website',
      };

      try {
        const res = await fetch(`${SB_URL}/rest/v1/orders`, {
          method: 'POST',
          headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(orderData)
        });

        if (res.ok) {
          const data = await res.json();
          const orderId = data[0]?.id?.slice(0, 8).toUpperCase() || 'XXXXXX';
          trackEvent('purchase', {
            transaction_id: data[0]?.id || orderId,
            value: orderData.total,
            currency: 'UZS',
            items: orderItems.map(i => ({
              item_id:   i.article,
              item_name: i.name,
              price:     i.price,
              quantity:  i.quantity
            }))
          });
          window.Toast?.show('🎉 Заказ принят!', `Номер заказа: ${orderId}`, 'success');
          window.Cart.clear();
          submitBtn.textContent = '✓ Заказ оформлен';
          setTimeout(() => window.location.href = 'index.html', 2500);
        } else {
          const err = await res.text();
          console.error('Ошибка заказа:', err);
          window.Toast?.show('Ошибка', 'Попробуйте снова', '');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Оформить заказ';
        }
      } catch(e) {
        console.error(e);
        window.Toast?.show('Ошибка соединения', 'Проверьте интернет', '');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Оформить заказ';
      }
    });
  });
})();


/* ─── 10. NAVBAR — SCROLL & MOBILE ─────────── */
const Navbar = (() => {
  const init = () => {
    const navbar = document.querySelector('.navbar');

    // Active link highlighting
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const params = new URLSearchParams(window.location.search);
    const gender = params.get('gender');
    const urlCategory = params.get('category');

    document.querySelectorAll('.nav-links > li > a').forEach(link => {
      const href = link.getAttribute('href') || '';
      const linkParams = new URLSearchParams(href.split('?')[1] || '');
      const linkGender = linkParams.get('gender');
      const linkCategory = linkParams.get('category');
      const linkPage = href.split('?')[0];
      link.classList.remove('active');
      if (urlCategory === 'accessories' && linkCategory === 'accessories' && !linkGender) {
        link.classList.add('active');
      } else if (gender && linkGender === gender && !linkCategory && linkPage === currentPage) {
        link.classList.add('active');
      } else if (!gender && !urlCategory && href === currentPage) {
        link.classList.add('active');
      }
    });

    const mobileBtn = document.querySelector('.nav-burger');
    mobileBtn?.addEventListener('click', openMobileMenu);

    function openMobileMenu() {
      document.getElementById('mobileNav')?.classList.add('open');
      document.getElementById('menuOverlay')?.classList.add('open');
      document.body.classList.add('menu-open');
    }
    function closeMobileMenu() {
      document.getElementById('mobileNav')?.classList.remove('open');
      document.getElementById('menuOverlay')?.classList.remove('open');
      document.body.classList.remove('menu-open');
    }
    window.closeMobileMenu = closeMobileMenu;
    window.openMobileMenu  = openMobileMenu;

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMobileMenu();
    });

    const mobileCityEl = document.getElementById('mobile-selected-city');
    const desktopCityEl = document.getElementById('selected-city');
    if (mobileCityEl && desktopCityEl) {
      const obs = new MutationObserver(() => {
        mobileCityEl.textContent = desktopCityEl.textContent;
      });
      obs.observe(desktopCityEl, { childList: true, characterData: true, subtree: true });
      mobileCityEl.textContent = desktopCityEl.textContent;
    }

    const searchInput = document.querySelector('.nav-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase();
        if (q.length < 2) {
          document.querySelectorAll('.product-card').forEach(c => c.style.display = '');
          return;
        }
        document.querySelectorAll('.product-card').forEach(card => {
          const name = card.querySelector('.product-name')?.textContent.toLowerCase() || '';
          const brand = card.querySelector('.product-brand')?.textContent.toLowerCase() || '';
          card.style.display = (name.includes(q) || brand.includes(q)) ? '' : 'none';
        });
      });
    }
  };
  window._initNavbar = init;
})();



/* ─── 11. SCROLL ANIMATIONS ─────────────────── */
const ScrollAnimator = (() => {
  const animate = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver(animate, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    const targets = document.querySelectorAll('.product-card, .cat-card, .review-card, .section-head, .promo-banner');
    targets.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = `opacity 0.5s ease ${i * 0.05}s, transform 0.5s ease ${i * 0.05}s`;
      observer.observe(el);
    });
  });
})();


/* ─── 12. REVIEW CARDS — RATING STARS ──────── */
const Reviews = (() => {
  const renderStars = (rating) => {
    const full  = Math.floor(rating);
    const half  = rating % 1 >= 0.5;
    let stars = '★'.repeat(full);
    if (half) stars += '½';
    stars += '☆'.repeat(5 - full - (half ? 1 : 0));
    return stars;
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.review-card[data-rating]').forEach(card => {
      const starsEl = card.querySelector('.review-stars');
      if (starsEl) starsEl.textContent = renderStars(parseFloat(card.dataset.rating));
    });
  });

  window.Reviews = { renderStars };
})();


/* ─── 13. BREADCRUMB AUTO-BUILDER ──────────── */
const Breadcrumb = (() => {
  document.addEventListener('DOMContentLoaded', () => {
    const bc = document.querySelector('.breadcrumb');
    if (!bc || bc.dataset.manual) return;

    const pages = {
      'index.html':   'Главная',
      'catalog.html': 'Каталог',
      'product.html': 'Товар',
      'order.html':   'Оформление заказа',
      'sale.html':    'Скидки',
    };
    const current = window.location.pathname.split('/').pop() || 'index.html';
    const pageName = pages[current] || current;

    bc.innerHTML = `
      <a href="index.html">Главная</a>
      <span>/</span>
      <span>${pageName}</span>
    `;
  });
})();


/* ─── 14. SMOOTH PAGE TRANSITIONS ──────────── */
const PageTransition = (() => {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.35s ease';
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.style.opacity = '1'));
  });
})();

async function fetchProducts(filter = '') {
  const cacheKey = CACHE_KEY + filter;
  
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, time } = JSON.parse(cached);
      if (Date.now() - time < CACHE_TTL) {
        return data;
      }
    }
  } catch(e) {}

  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/products?is_active=eq.true${filter}&order=created_at.desc`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`
        }
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, time: Date.now() }));
    } catch(e) {}

    return data;
  } catch(e) {
    console.error('fetchProducts error:', e);
    return [];
  }
}

function updatePromoFilterVisibility() {
  const block = document.getElementById('promo-filter-block');
  if (!block) return;
  const map = {'1=3':'promo-filter-1eq3', '-50%':'promo-filter-50pct', '-70%':'promo-filter-70pct'};
  let anyVisible = false;
  for (const [badge, id] of Object.entries(map)) {
    const item = document.getElementById(id);
    if (!item) continue;
    const has = document.querySelectorAll(`.product-card[data-badge="${badge}"]`).length > 0;
    item.style.display = has ? '' : 'none';
    if (has) anyVisible = true;
  }
  block.style.display = anyVisible ? '' : 'none';
}

/* ─── SKELETON & FADE-IN ────────────────────── */
function buildSkeletons(n = 8) {
  return Array.from({length: n}, () => `
    <div class="product-card skeleton-card">
      <div class="product-img-wrap">
        <div class="skeleton-block" style="width:100%;height:100%"></div>
      </div>
      <div class="product-info" style="padding:1rem 1.2rem">
        <div class="skeleton-block" style="height:11px;width:50%;margin-bottom:.6rem"></div>
        <div class="skeleton-block" style="height:15px;width:85%;margin-bottom:.5rem"></div>
        <div class="skeleton-block" style="height:15px;width:70%;margin-bottom:.8rem"></div>
        <div class="skeleton-block" style="height:18px;width:45%"></div>
      </div>
    </div>`).join('');
}

function initScrollFadeIn() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      card.classList.add('card-animate');
      card.addEventListener('animationend', () => {
        card.classList.remove('card-animate');
        card.style.opacity = '';
      }, { once: true });
      io.unobserve(card);
    });
  }, { threshold: 0.06 });

  const observe = () => {
    document.querySelectorAll('.product-card:not([data-fade])').forEach((card, i) => {
      card.dataset.fade = '1';
      card.style.opacity = '0';
      card.style.setProperty('--card-delay', `${(i % 4) * 0.07}s`);
      io.observe(card);
    });
  };

  new MutationObserver(observe).observe(document.body, { childList: true, subtree: true });
  observe();
}


/* ─── LOAD PRODUCTS FROM SUPABASE ───────────── */
const buildCard = (p) => {
  const images = Array.isArray(p.images) ? p.images : (p.images || []);
  const sizes  = Array.isArray(p.sizes)  ? p.sizes  : (p.sizes  || []);
  const hasHover = images.length > 1;
  const imgHtml = images[0]
    ? `<img class="img-main" src="${images[0]}" style="width:100%;height:100%;object-fit:cover;display:block">
       ${hasHover ? `<img class="img-hover" src="${images[1]}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0">` : ''}`
    : `<span style="font-size:5rem">👟</span>`;


  const badge = p.badge
    ? `<span class="product-badge badge-${p.badge.toLowerCase().replace('%','').replace('=','eq')}">${p.badge}</span>`
    : '';

  const oldPrice = p.old_price
    ? `<span class="old-price">${p.old_price.toLocaleString('ru-RU')}</span>`
    : '';

  return `
    <div class="product-card"
      data-product-id="${p.id}"
      data-article="${p.article || ''}"
      data-price="${p.price}"
      data-brand="${(p.brand||'').toLowerCase()}"
      data-sizes="${sizes.join(',')}"
      data-badge="${p.badge || ''}"
      data-rating="5"
      data-category="${p.category||''}"
      data-gender="${p.gender||'uni'}"
      data-subcategory="${p.subcategory||''}"
      data-collection="${p.collection||''}"
      data-href="product.html?id=${p.id}"
      onclick="if(!event.target.closest('button')){trackEvent('view_product_card',{item_id:'${p.article||p.id}',item_name:'${p.name.replace(/'/g,'')}',item_category:'${p.category||''}',currency:'UZS',value:${p.price}});window.location.href='product.html?id=${p.id}'}">
      ${badge}      
      <div class="product-img-wrap">
        <div class="product-img${hasHover ? ' has-hover-img' : ''}" style="width:100%;height:100%;${images[0] ? 'position:relative;overflow:hidden' : 'display:flex;align-items:center;justify-content:center'}">
          ${imgHtml}
        </div>
          <button class="btn-wishlist mob-visible" data-wished="false">♡</button>
          <button class="quick-view-btn" onclick="event.stopPropagation();openQuickView('${p.id}')">Быстрый просмотр</button>
      </div>
      <div class="product-info">
        <div class="product-brand">${p.brand || 'Li Ning'}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-footer">
          <div class="product-price">${oldPrice}${p.price.toLocaleString('ru-RU')} сум</div>
          <div class="product-rating">★★★★★</div>
        </div>
      </div>
    </div>`;
};

/* ─── QUICK VIEW ────────────────────────────── */
const openQuickView = async (productId) => {
  let overlay = document.getElementById('qv-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'qv-overlay';
    overlay.className = 'qv-overlay';
    overlay.innerHTML = `
      <div class="qv-modal">
        <button class="qv-close" onclick="closeQuickView()" aria-label="Закрыть">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <div class="qv-img">
          <span class="qv-badge" id="qv-badge" style="display:none"></span>
          <img id="qv-img" src="" alt="">
          <div class="qv-thumbs" id="qv-thumbs"></div>
        </div>
        <div class="qv-body">
          <div class="qv-brand" id="qv-brand"></div>
          <div class="qv-name" id="qv-name"></div>
          <div class="qv-rating" id="qv-rating" style="display:none"></div>
          <div class="qv-prices">
            <span class="cur" id="qv-price"></span>
            <span class="old" id="qv-old" style="display:none"></span>
            <span class="save" id="qv-save" style="display:none"></span>
          </div>
          <div id="qv-colors-wrap" style="display:none">
            <div class="qv-opt-label">Цвет <span class="hint" id="qv-color-name"></span></div>
            <div class="qv-colors" id="qv-colors"></div>
          </div>
          <div>
            <div class="qv-opt-label">Размер (EU) <span class="hint">Подбор по таблице</span></div>
            <div class="qv-size-grid" id="qv-sizes"></div>
          </div>
          <div class="qv-cta">
            <div class="qv-row">
              <button class="qv-add-btn" id="qv-add-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <span class="qv-add-txt">Добавить в корзину</span>
              </button>
              <button class="qv-fav" id="qv-fav" aria-label="В избранное"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>
            </div>
            <button class="qv-open-link" id="qv-open-link">Открыть полную страницу товара →</button>
          </div>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeQuickView(); });
    document.body.appendChild(overlay);
  }

  overlay.classList.add('open');
  requestAnimationFrame(() => overlay.classList.add('visible'));

  let p = null;
  try {
    const cacheKeys = Object.keys(sessionStorage).filter(k => k.startsWith('lining_products_cache'));
    for (const key of cacheKeys) {
      const cached = JSON.parse(sessionStorage.getItem(key));
      const found = cached?.data?.find(item => item.id === productId);
      if (found) { p = found; break; }
    }
  } catch(e) {}

  if (!p) {
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/products?id=eq.${productId}&select=*`,
        { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
      );
      const data = await res.json();
      if (data?.length) p = data[0];
    } catch(e) {}
  }

  if (!p) return;

  const images = Array.isArray(p.images) ? p.images : [];
  const sizes  = Array.isArray(p.sizes)  ? p.sizes  : [];

    // ── изображение + миниатюры ──
    const mainImg = document.getElementById('qv-img');
    mainImg.src = images[0] || '';
    const thumbsWrap = document.getElementById('qv-thumbs');
    if (images.length > 1) {
      thumbsWrap.innerHTML = images.slice(0,4).map((src,i) =>
        `<div class="qv-thumb ${i===0?'active':''}" data-src="${src}"><img src="${src}" alt=""></div>`).join('');
      thumbsWrap.querySelectorAll('.qv-thumb').forEach(t => t.onclick = () => {
        thumbsWrap.querySelectorAll('.qv-thumb').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        mainImg.style.opacity = '0';
        setTimeout(() => { mainImg.src = t.dataset.src; mainImg.style.opacity = '1'; }, 160);
      });
    } else { thumbsWrap.innerHTML = ''; }

    // ── бренд / название ──
    document.getElementById('qv-brand').textContent = (p.brand || 'Li-Ning');
    document.getElementById('qv-name').textContent = p.name || '';

    // ── рейтинг (показывается, только если есть p.rating) ──
    const ratingEl = document.getElementById('qv-rating');
    if (p.rating) {
      const r = Math.round(p.rating);
      ratingEl.innerHTML = `<span class="stars">${'★'.repeat(r)}${'☆'.repeat(5-r)}</span> ${(+p.rating).toFixed(1)}${p.reviews_count ? ` · ${p.reviews_count} отзывов` : ''}`;
      ratingEl.style.display = '';
    } else { ratingEl.style.display = 'none'; }

    // ── цена / скидка / бейдж ──
    const priceEl = document.getElementById('qv-price');
    const oldEl   = document.getElementById('qv-old');
    const saveEl  = document.getElementById('qv-save');
    const badgeEl = document.getElementById('qv-badge');
    if (p.price) {
      priceEl.textContent = p.price.toLocaleString('ru-RU') + ' сум';
      if (p.old_price && p.old_price > p.price) {
        const pct = Math.round((1 - p.price / p.old_price) * 100);
        oldEl.textContent = p.old_price.toLocaleString('ru-RU') + ' сум'; oldEl.style.display = '';
        saveEl.textContent = '−' + pct + '%'; saveEl.style.display = '';
        badgeEl.textContent = '−' + pct + '% · SALE'; badgeEl.style.display = '';
      } else { oldEl.style.display = 'none'; saveEl.style.display = 'none'; badgeEl.style.display = 'none'; }
    } else {
      priceEl.textContent = 'Цена по запросу';
      oldEl.style.display = 'none'; saveEl.style.display = 'none'; badgeEl.style.display = 'none';
    }

    // ── цвета (показываются, только если есть массив p.colors: [{name, hex}]) ──
    const colorsWrap = document.getElementById('qv-colors-wrap');
    const colorsBox  = document.getElementById('qv-colors');
    const colorName  = document.getElementById('qv-color-name');
    const colors = Array.isArray(p.colors) ? p.colors : [];
    if (colors.length) {
      colorName.textContent = colors[0].name || '';
      colorsBox.innerHTML = colors.map((c,i) =>
        `<div class="qv-color ${i===0?'active':''}" data-name="${c.name||''}"><span class="sw" style="background:${c.hex||'#ccc'}"></span><span class="nm">${c.name||''}</span></div>`).join('');
      colorsBox.querySelectorAll('.qv-color').forEach(c => c.onclick = () => {
        colorsBox.querySelectorAll('.qv-color').forEach(x => x.classList.remove('active'));
        c.classList.add('active'); colorName.textContent = c.dataset.name;
      });
      colorsWrap.style.display = '';
    } else { colorsWrap.style.display = 'none'; }

    // ── размеры ──
    const sizeGrid = document.getElementById('qv-sizes');
    sizeGrid.innerHTML = sizes.length
      ? sizes.map(s => `<button class="qv-size-btn" data-size="${s}">${s}</button>`).join('')
      : '<span style="color:var(--gray-500);font-size:.84rem">Размеры уточняйте у менеджера</span>';
    sizeGrid.querySelectorAll('.qv-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sizeGrid.querySelectorAll('.qv-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sizeGrid.classList.remove('qv-size-err');
      });
    });

    // ── избранное (визуальный тоггл; при наличии своего API можно вызвать его здесь) ──
    const favBtn = document.getElementById('qv-fav');
    if (favBtn) favBtn.onclick = () => {
      favBtn.classList.toggle('on');
      favBtn.animate([{transform:'scale(.7)'},{transform:'scale(1.2)'},{transform:'scale(1)'}], {duration:360, easing:'cubic-bezier(.22,1,.36,1)'});
    };

    // ── добавить в корзину ──
    document.getElementById('qv-add-btn').onclick = () => {
      const sel = sizeGrid.querySelector('.qv-size-btn.active');
      if (!sel && sizes.length) {
        sizeGrid.classList.remove('qv-size-err'); void sizeGrid.offsetWidth; // перезапуск анимации
        sizeGrid.classList.add('qv-size-err');
        setTimeout(() => sizeGrid.classList.remove('qv-size-err'), 600);
        return;
      }
      window.Cart.add({ id: p.id, article: p.article || p.id, name: p.name,
        brand: p.brand || 'Li Ning', price: p.price,
        size: sel?.dataset.size || '', image: images[0] || null, qty: 1 });
      closeQuickView();
    };  

  
    document.getElementById('qv-open-link').onclick = () => {
    window.location.href = `product.html?id=${p.id}`;
  };
};

window.openQuickView = openQuickView;

const closeQuickView = () => {
  const overlay = document.getElementById('qv-overlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  setTimeout(() => overlay.classList.remove('open'), 480);
};
window.closeQuickView = closeQuickView;

// Загружаем избранное пользователя и подсвечиваем карточки
async function highlightWishlist() {
  const user = window.Auth?.getUser();
  if (!user) return;

  try {
    const session = JSON.parse(localStorage.getItem('lining_session') || 'null');
    const token = session?.access_token || SB_KEY;

    const res = await fetch(
      `${SB_URL}/rest/v1/wishlists?user_id=eq.${user.id}&select=product_id`,
      { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const wishedIds = new Set(data.map(w => w.product_id));
    const _wb = document.getElementById('wishBadge');
    if (_wb) _wb.textContent = wishedIds.size;

    document.querySelectorAll('.product-card').forEach(card => {
      const btn = card.querySelector('.btn-wishlist');
      if (btn && wishedIds.has(card.dataset.productId)) {
        btn.dataset.wished = 'true';
        btn.textContent = '♥';
      }
    });
  } catch(e) {
    console.error('highlightWishlist error:', e);
  }
}

window.highlightWishlist = highlightWishlist;

document.addEventListener('DOMContentLoaded', initScrollFadeIn);

document.addEventListener('DOMContentLoaded', async () => {
  // Ждём инициализации ProductCards
  await new Promise(r => setTimeout(r, 0));


  // Главная страница — популярные товары за последние 2 недели
  const homeGrid = document.getElementById('home-products');
  if (homeGrid) {
    try {
      // Дата 2 недели назад
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const dateStr = twoWeeksAgo.toISOString();

      // Получаем заказы за последние 2 недели
      const ordersRes = await fetch(
        `${SB_URL}/rest/v1/orders?created_at=gte.${dateStr}&select=items`,
        { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
      );
      const orders = await ordersRes.json();

      // Считаем сколько раз каждый товар заказывали
      const productCount = {};
      orders.forEach(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach(item => {
          const id = item.article || item.id;
          if (!id) return;
          productCount[id] = (productCount[id] || 0) + (item.quantity || 1);
        });
      });

      // Сортируем по количеству заказов
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const topArticles = Object.entries(productCount)
          .filter(([id]) => !uuidRegex.test(id))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([id]) => id);

      let products = [];

      if (topArticles.length > 0) {
        // Загружаем топ товары по article
        const res = await fetch(
          `${SB_URL}/rest/v1/products?article=in.(${topArticles.join(',')})&is_active=eq.true&limit=8`,
          { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
        );
        products = await res.json();

        // Сортируем в том же порядке что и topArticles
        products.sort((a, b) => {
          const ai = topArticles.indexOf(a.article);
          const bi = topArticles.indexOf(b.article);
          return ai - bi;
        });
      }

      // Если заказов нет — показываем просто последние товары
      if (products.length === 0) {
        products = await fetchProducts('&limit=8');
      }

      if (products.length > 0) {
        homeGrid.innerHTML = products.map(buildCard).join('');
        window.ProductCards?.init();
        highlightWishlist();
      } else {
        homeGrid.innerHTML = '<div style="padding:3rem;text-align:center;color:#aaa">Товары скоро появятся</div>';
      }
    } catch(e) {
      console.error(e);
      try {
        const products = await fetchProducts('&limit=8');
        if (products?.length) {
          homeGrid.innerHTML = products.map(buildCard).join('');
          window.ProductCards?.init();
        } else {
          homeGrid.innerHTML = '<div style="padding:3rem;text-align:center;color:#aaa">Товары скоро появятся</div>';
        }
      } catch(e2) {
        homeGrid.innerHTML = '<div style="padding:3rem;text-align:center;color:#aaa">Товары скоро появятся</div>';
      }
    }
  }

  // Каталог — все товары
  const catalogGrid = document.getElementById('catalog-products');
  if (catalogGrid) {
    try {
      catalogGrid.innerHTML = buildSkeletons(8);
      const products = await fetchProducts();
      if (products.length > 0) {
        catalogGrid.innerHTML = products.map(buildCard).join('');
        window.ProductCards?.init();
        highlightWishlist();
        updatePromoFilterVisibility();


        // Применяем фильтры из URL ПОСЛЕ загрузки карточек
        const urlParams = new URLSearchParams(window.location.search);
        const urlCat = urlParams.get('category');
        const urlGender = urlParams.get('gender');
        const urlSearch = urlParams.get('search');
        const urlCollection = urlParams.get('collection');

        if (urlSearch) {
          const searchInput = document.getElementById('nav-search-input');
          if (searchInput) searchInput.value = urlSearch;
          const catalogInput = document.getElementById('catalog-search-input');
          if (catalogInput) catalogInput.value = urlSearch;
          const q = urlSearch.toLowerCase();
          document.querySelectorAll('.product-card').forEach(card => {
            const name = card.querySelector('.product-name')?.textContent.toLowerCase() || '';
            const brand = card.querySelector('.product-brand')?.textContent.toLowerCase() || '';
            card.style.display = (name.includes(q) || brand.includes(q)) ? '' : 'none';
          });
          const visible = document.querySelectorAll('.product-card:not([style*="none"])').length;
          const countEl = document.querySelector('.catalog-count strong');
          if (countEl) countEl.textContent = visible;
        } 
        else if (urlCollection) {
          document.querySelectorAll('.product-card').forEach(card => {
          const cardCollection = card.dataset.collection || '';
          let show = false;
          if (urlCollection === 'Sportlife') {
          show = ['Sportlife', 'Professional Sport', 'Extreme Sports'].includes(cardCollection);
        } 
        else {
          show = cardCollection === urlCollection;
        }
        card.style.display = show ? '' : 'none';
        });
          const visible = document.querySelectorAll('.product-card:not([style*="none"])').length;
          const countEl = document.querySelector('.catalog-count strong');
          if (countEl) countEl.textContent = visible;
          const pageTitle = document.getElementById('catalog-page-title');
          if (pageTitle) pageTitle.textContent = urlCollection.toUpperCase();
        } else if (urlCat || urlGender) {
          applyCatalogFilters(urlCat, urlGender);
        } else {
          const countEl = document.querySelector('.catalog-count strong');
          if (countEl) countEl.textContent = products.length;
        }
        } else {
          catalogGrid.innerHTML = '<div style="padding:3rem;text-align:center;color:#aaa">Товары скоро появятся</div>';
        }
    } catch(e) { console.error(e); }
  }

  // Отзывы на главной странице
  const reviewsGrid = document.getElementById('reviews-grid');
  if (reviewsGrid) {
    const avatarColors = ['var(--red)', 'var(--gold)', '#4a90d9', '#22c55e', '#9b59b6', '#e67e22'];

    const buildReviewCard = (r, i) => {
      const words = (r.customer_name || 'A').trim().split(/\s+/);
      const initials = words.map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const color = avatarColors[i % avatarColors.length];
      const rating = Math.min(5, Math.max(1, r.rating || 5));
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      const date = new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      return `
        <div class="review-card" data-rating="${rating}">
          <div class="review-quote-mark">"</div>
          <div class="review-header">
            <div class="reviewer-info">
              <div class="reviewer-avatar" style="background:${color}">${initials}</div>
              <div>
                <div class="reviewer-name">${r.customer_name}</div>
                <div class="reviewer-date">${date}</div>
              </div>
            </div>
            <div class="review-stars">${stars}</div>
          </div>
          ${r.product_name ? `<div class="review-product">${r.product_name}</div>` : ''}
          <div class="review-text">${r.text}</div>
          ${r.is_verified ? '<div class="review-verified">✓ Проверенная покупка</div>' : ''}
        </div>`;
    };

    const updateReviewsSummary = (reviews) => {
      const total = reviews.length;
      const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let sum = 0;
      reviews.forEach(r => {
        const rt = Math.min(5, Math.max(1, r.rating || 5));
        counts[rt]++;
        sum += rt;
      });
      const avg = total ? (sum / total).toFixed(1) : '—';
      const avgRounded = total ? Math.round(sum / total) : 0;

      const bigEl = document.getElementById('rating-big-value');
      if (bigEl && avg !== '—') {
        const tgt = parseFloat(avg), t0 = performance.now();
        (function tk(now){ const p=Math.min((now-t0)/1200,1), e=1-Math.pow(1-p,3);
          bigEl.textContent=(tgt*e).toFixed(1); if(p<1) requestAnimationFrame(tk); else bigEl.textContent=avg; })(t0);
      } else if (bigEl) { bigEl.textContent = avg; }

      const starsEl = document.getElementById('rating-stars-big');
      if (starsEl) starsEl.textContent = '★'.repeat(avgRounded) + '☆'.repeat(5 - avgRounded);

      const countEl = document.getElementById('rating-count-text');
      if (countEl) countEl.textContent = total
        ? `На основе ${total} ${total === 1 ? 'отзыва' : total < 5 ? 'отзывов' : 'отзывов'}`
        : 'Отзывов пока нет';

      // Анимированное заполнение баров — небольшая задержка чтобы transition успел сработать
      setTimeout(() => {
        for (let star = 5; star >= 1; star--) {
          const pct = total ? Math.round((counts[star] / total) * 100) : 0;
          const fillEl = document.getElementById(`bar-fill-${star}`);
          const pctEl  = document.getElementById(`bar-pct-${star}`);
          if (fillEl) fillEl.style.width = pct + '%';
          if (pctEl)  pctEl.textContent  = total ? pct + '%' : '—';
        }
      }, 150);
    };

    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/reviews?order=created_at.desc&limit=9`,
        { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
      );
      if (!res.ok) throw new Error('no_table');
      const reviews = await res.json();
      updateReviewsSummary(reviews);
      if (reviews?.length) {
        reviewsGrid.innerHTML = reviews.map(buildReviewCard).join('');
      } else {
        reviewsGrid.innerHTML = `<div style="grid-column:1/-1;padding:3rem;text-align:center;color:var(--gray-400);font-size:.9rem">
          Отзывы скоро появятся ✨
        </div>`;
      }
    } catch(e) {
      updateReviewsSummary([]);
      reviewsGrid.innerHTML = `<div style="grid-column:1/-1;padding:3rem;text-align:center;color:var(--gray-400);font-size:.9rem">
        Отзывы скоро появятся ✨
      </div>`;
    }
  }

});

/* ─── SEARCH TOGGLE ─────────────────────────── */
function toggleSearch() {
  const bar = document.getElementById('nav-search-bar');
  const input = document.getElementById('nav-search-input');
  if (!bar) return;
  bar.classList.toggle('open');
  if (bar.classList.contains('open')) {
    setTimeout(() => input?.focus(), 100);
  }
}

// Обработчик поиска — при нажатии Enter переходим в каталог
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('nav-search-input');
  if (!input) return;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q.length > 0) {
        trackEvent('search', { search_term: q.toLowerCase() });
        if (window.catalogSearchFilter) {
          window.catalogSearchFilter(q);
          toggleSearch();
        } else {
          window.location.href = `catalog.html?search=${encodeURIComponent(q)}`;
        }
      }
    }
  });
});

// Закрытие поиска при клике вне — вне DOMContentLoaded,
// getElementById вызывается в момент клика когда navbar уже загружен
document.addEventListener('click', e => {
  const bar = document.getElementById('nav-search-bar');
  const searchBtn = document.getElementById('searchBtn');
  if (!bar || !bar.classList.contains('open')) return;
  if (!bar.contains(e.target) && !searchBtn?.contains(e.target)) {
    bar.classList.remove('open');
  }
});

window.toggleSearch = toggleSearch;

/* ─── CITY SELECTOR ─────────────────────────── */
function openCityModal() {
  document.getElementById('city-modal-overlay')?.classList.add('open');
  const modal = document.getElementById('city-modal');
  if (modal) {
    modal.style.display = 'block';
    requestAnimationFrame(() => modal.classList.add('open'));
  }
  setTimeout(() => document.getElementById('city-search-input')?.focus(), 200);
}

function closeCityModal() {
  document.getElementById('city-modal-overlay')?.classList.remove('open');
  const modal = document.getElementById('city-modal');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.style.display = 'none', 250);
  }
}

function selectCity(el) {
  document.querySelectorAll('.city-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  const city = el.textContent;
  document.getElementById('selected-city').textContent = city;
  localStorage.setItem('lining_city', city);
  setTimeout(closeCityModal, 300);
}

function filterCities(q) {
  const all = document.querySelectorAll('#all-cities .city-item');
  all.forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

// Восстанавливаем выбранный город
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('lining_city');
  if (saved) {
    const cityEl = document.getElementById('selected-city');
    if (cityEl) cityEl.textContent = saved;
    document.querySelectorAll('.city-item').forEach(i => {
      if (i.textContent === saved) i.classList.add('active');
      else i.classList.remove('active');
    });
  }
});

window.openCityModal = openCityModal;
window.closeCityModal = closeCityModal;
window.selectCity = selectCity;
window.filterCities = filterCities;

/* ─── HERO SLIDER ────────────────────────────── */
const HeroSlider = (() => {
  let slides = [];
  let current = 0;
  let timer = null;

  const loadSlides = async () => {
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/slides?device_type=eq.${window.innerWidth <= 768 ? 'mobile' : 'desktop'}&is_active=eq.true&order=sort_order.asc`,
        { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        slides = data;
        renderSlides(data);
      }
    } catch(e) { console.log('Слайды не загружены:', e); }
  };

  const renderSlides = (data) => {
    const container = document.getElementById('hero-slider');
    const dotsContainer = document.getElementById('slider-dots');
    // Убираем skeleton
    const skeleton = document.getElementById('slider-skeleton');
    if (skeleton) skeleton.remove();

    // Очищаем только слайды, controls оставляем
    const controls = document.getElementById('slider-controls');
    container.querySelectorAll('.hero-slide').forEach(el => el.remove());
    dotsContainer.innerHTML = '';

    data.forEach((slide, i) => {
      // Создаём слайд
      const el = document.createElement('div');
      el.className = `hero-slide ${i === 0 ? 'active' : ''}`;
      el.style.background = slide.bg_color || '#1a1a1a';
      el.style.color = slide.text_color || '#fff';

      el.innerHTML = `
        ${slide.bg_image ? `
          <div class="hero-slide-bg" style="background-image:url('${slide.bg_image}')"></div>
          <div class="hero-slide-bg-overlay"></div>
        ` : ''}
        <div class="hero-content">
          <div class="hero-tag" style="color:rgba(255,255,255,0.7)">${slide.subtitle || ''}</div>
          <h1 class="hero-h1 ln-words" style="color:${slide.text_color || '#fff'};font-size:clamp(4rem,10vw,9rem)">
            ${(slide.title || '').replace(/\n/g,'<br>')}
          </h1>
          <div class="hero-cta" style="margin-top:2rem">
            ${slide.button_text ? `<a href="${slide.button_link || '#'}" class="btn btn-primary">${slide.button_text}</a>` : ''}
          </div>
        </div>
      `;
      container.insertBefore(el, controls);

      // Создаём точку
      const dot = document.createElement('div');
      dot.className = `slider-dot ${i === 0 ? 'active' : ''}`;
      dot.onclick = () => goToSlide(i);
      dotsContainer.appendChild(dot);
    });

    startTimer();
    lnReveal(container.querySelector('.hero-slide.active'));
    const _nav = document.querySelector('.navbar');
    if (_nav && slides[0]) _nav.classList.toggle('is-dark-slide', !!slides[0].text_dark);
  };


  // проиграть word-reveal на заголовке слайда (первый раз — разбить, далее — повторить)
  const lnReveal = (slideEl) => {
    const h1 = slideEl && slideEl.querySelector('.hero-h1');
    if (!h1 || !window.lnWords) return;
    if (h1.dataset.lnW) {
      h1.classList.remove('in');
      void h1.offsetWidth; // форсируем reflow
      requestAnimationFrame(() => requestAnimationFrame(() => h1.classList.add('in')));
    } else {
      window.lnWords(h1);
    }
  };

  const goTo = (index) => {
    const slideEls = document.querySelectorAll('.hero-slide');
    const dotEls   = document.querySelectorAll('.slider-dot');
    if (!slideEls.length) return;

    slideEls[current]?.classList.remove('active');
    dotEls[current]?.classList.remove('active');

    current = (index + slideEls.length) % slideEls.length;

    slideEls[current]?.classList.add('active');
    dotEls[current]?.classList.add('active');
    lnReveal(slideEls[current]);
    const _nav = document.querySelector('.navbar');
    if (_nav && slides[current]) _nav.classList.toggle('is-dark-slide', !!slides[current].text_dark);
  };

  const startTimer = () => {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), 4000);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('hero-slider');
    if (slider) {
      loadSlides();
      let _tx = 0;
      slider.addEventListener('touchstart', e => {
        _tx = e.touches[0].clientX;
      }, { passive: true });
      slider.addEventListener('touchend', e => {
        const d = _tx - e.changedTouches[0].clientX;
        if (Math.abs(d) > 50) { goTo(current + (d > 0 ? 1 : -1)); startTimer(); }
      }, { passive: true });
    }
  });


  window.goToSlide = (i) => { goTo(i); startTimer(); };
  window.nextSlide = () => { goTo(current + 1); startTimer(); };
  window.prevSlide = () => { goTo(current - 1); startTimer(); };
})();

function initNavbarScroll() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;

  const isTransparentPage =
    document.getElementById('navbar-placeholder')?.dataset.transparent === 'true';

  if (!isTransparentPage) return; // остальные страницы — всегда чёрный, ничего не делаем

  // Главная страница: прозрачный → чёрный при скролле
  function updateNav() {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
      nav.classList.remove('is-transparent');
    } else {
      nav.classList.remove('scrolled');
      nav.classList.add('is-transparent');
    }
  }

  nav.classList.add('is-transparent');
  updateNav();
  window.addEventListener('scroll', updateNav, { passive: true });
}
window.initNavbarScroll = initNavbarScroll;


// Мегаменю top — динамически под navbar
(function() {
  const style = document.createElement('style');
  document.head.appendChild(style);

  function updateMegaTop() {
    const navbar = document.querySelector('.navbar');
    const navBottom = navbar ? navbar.getBoundingClientRect().bottom : 68;
    style.textContent = `.mega-menu { top: ${navBottom}px !important; }`;
  }

  updateMegaTop();
  window.addEventListener('scroll', updateMegaTop, { passive: true });
  window.addEventListener('resize', updateMegaTop);
  window._updateMegaTop = updateMegaTop;
})();


// Читаем категорию из URL при загрузке каталога
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('catalog-products')) return;

  const params = new URLSearchParams(window.location.search);
  const cat    = params.get('category');
  const gender = params.get('gender');

  // Хлебные крошки
  const genderLabels = { male: 'Мужчины', female: 'Женщины', uni: 'Унисекс' };
  const catLabels = { shoes: 'Обувь', clothing: 'Одежда', running: 'Бег', training: 'Тренировка', accessories: 'Аксессуары' };
  const extra = document.getElementById('breadcrumb-extra');
  const subcatLabels = {
    sneakers: 'Кроссовки',
    slippers: 'Сланцы / Сабо',
    sneakers_low: 'Кеды',
    sandals: 'Сандали',
    tshirts: 'Футболки',
    shorts: 'Шорты',
    pants: 'Брюки',
    longsleeves: 'Лонгсливы',
    bags: 'Рюкзаки и сумки',
    caps: 'Кепки и шапки',
    socks: 'Носки',
    balls: 'Мячи',
    gloves: 'Перчатки',
    bands: 'Повязки и напульсники'
  };
  const subcategory = params.get('subcategory');

  if (extra) {
    let html = '';
    if (gender) html += `<span>/ </span><a href="catalog.html?gender=${gender}">${genderLabels[gender] || gender}</a>`;
    if (cat)    html += `<span>/ </span><a href="catalog.html?gender=${gender||''}&category=${cat}">${catLabels[cat] || cat}</a>`;
    if (subcategory) html += `<span>/ </span><span>${subcatLabels[subcategory] || subcategory}</span>`;
    extra.innerHTML = html;
  }

  // Заголовок
  const pageTitle = document.getElementById('catalog-page-title');
  if (pageTitle) {
    if (subcategory) {
      const genderPart = genderLabels[gender] || '';
      const subcatPart = subcatLabels[subcategory] || subcategory;
      pageTitle.textContent = genderPart ? `${genderPart} — ${subcatPart}` : subcatPart;
    }
    else if (gender && cat) pageTitle.textContent = `${genderLabels[gender]} — ${catLabels[cat]}`;
    else if (gender) pageTitle.textContent = genderLabels[gender] || 'Каталог';
    else if (cat)    pageTitle.textContent = catLabels[cat] || 'Каталог';
  }

  // фильтры применяются после загрузки карточек в блоке catalogGrid
});

function applyCatalogFilters(cat, gender) {
  const params = new URLSearchParams(window.location.search);
  const subcategory = params.get('subcategory');

  document.querySelectorAll('.product-card').forEach(card => {
    const cardCat    = card.dataset.category || '';
    const cardGender = card.dataset.gender || 'uni';
    const cardSub    = card.dataset.subcategory || '';

    const catOk    = !cat         || cardCat === cat;
    const genderOk = !gender || cardGender === gender || (cardGender === 'uni' && cardCat === cat && cardGender !== 'kids');
    const subOk    = !subcategory || cardSub === subcategory;

    card.style.display = (catOk && genderOk && subOk) ? '' : 'none';
  });

  const visible = document.querySelectorAll('.product-card:not([style*="none"])').length;
  const countEl = document.querySelector('.catalog-count strong');
  if (countEl) countEl.textContent = visible;
}
window.applyCatalogFilters = applyCatalogFilters;

function catalogSearchFilter(q) {
  q = q.toLowerCase().trim();
  if (q.length >= 2) {
    trackEvent('search', { search_term: q, search_location: 'catalog_sidebar' });
  }
  document.querySelectorAll('.product-card').forEach(card => {
    const name = card.querySelector('.product-name')?.textContent.toLowerCase() || '';
    const brand = card.querySelector('.product-brand')?.textContent.toLowerCase() || '';
    card.style.display = (!q || name.includes(q) || brand.includes(q)) ? '' : 'none';
  });
  const visible = document.querySelectorAll('.product-card:not([style*="none"])').length;
  const countEl = document.querySelector('.catalog-count strong');
  if (countEl) countEl.textContent = visible;
}
window.catalogSearchFilter = catalogSearchFilter;

function setCategoryFilter(cat) {
  // Подсвечиваем активную кнопку
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  // Фильтруем карточки
  document.querySelectorAll('.product-card').forEach(card => {
    if (!cat || card.dataset.category === cat) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
  // Обновляем счётчик
  const visible = document.querySelectorAll('.product-card:not([style*="none"])').length;
  const countEl = document.querySelector('.catalog-count strong');
  if (countEl) countEl.textContent = visible;
}
window.setCategoryFilter = setCategoryFilter;

/* ─── WISHLIST NAV ───────────────────────────── */
function openWishlist() {
  if (!SITE_CONFIG.wishlist_enabled) {
    showFeatureDisabledModal('wishlist');
    return;
  }
  if (window.Auth?.isLoggedIn()) {
    window.location.href = 'wishlist.html';
  } else {
    window.Auth?.requireAuth(() => {
      window.location.href = 'wishlist.html';
    });
  }
}
window.openWishlist = openWishlist;

/* ── MEGA MENU FIX ── */
function initMegaMenu() {
  document.querySelectorAll('.nav-item-mega').forEach(item => {
    let hideTimer = null;
    const megaMenu = item.querySelector('.mega-menu');
    if (!megaMenu) return;

    const show = () => { clearTimeout(hideTimer); megaMenu.style.display = 'grid'; };
    const hide = () => { hideTimer = setTimeout(() => { megaMenu.style.display = ''; }, 200); };

    item.addEventListener('mouseenter', show);
    item.addEventListener('mouseleave', hide);
    megaMenu.addEventListener('mouseenter', show);
    megaMenu.addEventListener('mouseleave', hide);
  });

  // Бургер-кнопка — привязываем здесь, т.к. navbar загружается асинхронно
  document.querySelector('.nav-burger')
    ?.addEventListener('click', () => window.openMobileMenu?.());
}
window.initMegaMenu = initMegaMenu;

/* ─── GOOGLE ANALYTICS EVENTS ───────────────── */
function trackEvent(eventName, params = {}) {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, params);
  }
}
window.trackEvent = trackEvent;

/* ─── FEATURE DISABLED MODAL ────────────────── */
function showFeatureDisabledModal(feature) {
  document.getElementById('feature-modal')?.remove();
  const messages = {
    auth:     'Регистрация и вход пользователей',
    cart:     'Корзина и оформление заказов',
    wishlist: 'Список избранного',
    orders:   'История заказов',
  };
  const overlay = document.createElement('div');
  overlay.id = 'feature-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
  overlay.innerHTML = `
    <div style="background:var(--white);max-width:460px;width:90%;padding:2.5rem 2rem;border-radius:var(--radius-lg);text-align:center;position:relative">
      <button onclick="document.getElementById('feature-modal').remove()"
        style="position:absolute;top:1rem;right:1rem;background:var(--gray-100);border:none;width:32px;height:32px;border-radius:50%;font-size:1rem;cursor:pointer">✕</button>
      <div style="font-size:3rem;margin-bottom:1rem">🏪</div>
      <div style="font-family:var(--font-display);font-size:1.6rem;letter-spacing:2px;margin-bottom:1rem;color:var(--gray-900)">РЕЖИМ КАТАЛОГА</div>
      <p style="color:var(--gray-500);font-size:0.88rem;line-height:1.8;margin-bottom:1.5rem">
        Сайт работает в режиме каталога для ознакомления с продукцией Li Ning.<br><br>
        <strong style="color:var(--gray-700)">${messages[feature] || 'Эта функция'}</strong> будут доступны в ближайшее время.
      </p>
      <a href="catalog.html" class="btn btn-primary" style="display:inline-flex">Перейти в каталог →</a>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}
window.showFeatureDisabledModal = showFeatureDisabledModal;

/* ─── SCROLL TO TOP ─────────────────────────── */
(function () {
  const btn = document.createElement('button');
  btn.className = 'scroll-top-btn';
  btn.setAttribute('aria-label', 'Наверх');
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>`;
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 380);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// LI-NING MOTION (reveal + progress)
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  document.documentElement.classList.add('ln-mo');

  // прогресс-бар
  var bar=document.createElement('div'); bar.className='ln-prog'; document.body.appendChild(bar);
  function prog(){ var h=document.documentElement.scrollHeight-innerHeight; bar.style.width=(h>0?(scrollY/h*100):0)+'%'; }

  // ЧТО анимируем (настраивай список под себя; product-card НЕ трогаем — у него свой card-animate)
  var SEL='.section-label,.section-title,.section-head,.see-all,.reviews-summary,.review-card,.store-card,.wishlist-header,.breadcrumb';
  var els=[].slice.call(document.querySelectorAll(SEL));
  els.forEach(function(el){ el.classList.add('ln-rev'); });

  function show(el){ el.classList.add('in'); }
  function inView(el){ var r=el.getBoundingClientRect(); return r.top<innerHeight*0.92 && r.bottom>-40; }

  var io=('IntersectionObserver' in window) ? new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ show(e.target); io.unobserve(e.target); } });
  },{threshold:.12, rootMargin:'0px 0px -7% 0px'}) : null;

  els.forEach(function(el){ if(inView(el)) show(el); else if(io) io.observe(el); });

  // ручной фолбэк (если IO недоступен/притормозил) + обновление прогресса
  function onScroll(){ prog(); els.forEach(function(el){ if(!el.classList.contains('in') && inView(el)){ show(el); if(io) io.unobserve(el); } }); }
  addEventListener('scroll', onScroll, {passive:true});
  prog();
  setTimeout(onScroll, 1200);   // подстраховка
  addEventListener('load', onScroll);
})();

// PAGE WIPE
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  var w=document.createElement('div'); w.className='ln-wipe';
  w.innerHTML='<span></span><span></span><span></span><span></span><span></span><div class="ln-wipe-logo"><img src="logo.jpg" alt=""></div>';
  document.body.appendChild(w);
  var panels=[].slice.call(w.querySelectorAll('span')), logo=w.querySelector('.ln-wipe-logo');

  // приехали на страницу через wipe → раскрываем шторку
  if(sessionStorage.getItem('ln_wipe_in')){
    sessionStorage.removeItem('ln_wipe_in');
    panels.forEach(function(s){ s.style.transition='none'; s.style.transformOrigin='top'; s.style.transform='scaleY(1)'; });
    logo.style.opacity='1';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      logo.style.transition='opacity .3s'; logo.style.opacity='0';
      panels.forEach(function(s,i){ s.style.transition='transform .5s cubic-bezier(.76,0,.24,1) '+(i*0.05)+'s'; s.style.transform='scaleY(0)'; });
    });});
  }

  function leave(href){
    sessionStorage.setItem('ln_wipe_in','1');
    panels.forEach(function(s,i){ s.style.transformOrigin='bottom'; s.style.transition='transform .42s cubic-bezier(.76,0,.24,1) '+(i*0.05)+'s'; s.style.transform='scaleY(1)'; });
    logo.style.transition='opacity .3s ease .15s'; logo.style.opacity='1';
    setTimeout(function(){ location.href=href; }, 560);
  }

  document.addEventListener('click', function(e){
    if(e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if(e.target.closest('button,[data-no-wipe]')) return;  // клики по кнопкам (корзина/❤/размеры) — без шторки
    var a=e.target.closest('a[href]'); if(!a) return;
    if(a.target==='_blank' || a.hasAttribute('download')) return;
    var href=a.getAttribute('href');
    if(!href || href.charAt(0)==='#' || /^(javascript:|mailto:|tel:)/i.test(href)) return;
    var url; try{ url=new URL(href, location.href); }catch(_){ return; }
    if(url.origin!==location.origin) return;                        // внешние ссылки (Telegram/Instagram) — обычный переход
    if(url.pathname===location.pathname && url.search===location.search) return; // та же страница
    e.preventDefault(); leave(url.href);
  }, true);
})();

// Word reveal + count-up
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  /* ── 1. Заголовок по словам ── */
  function lnWords(el){
    if(!el || el.dataset.lnW) return; el.dataset.lnW='1';
    var units=[];
    [].forEach.call(el.childNodes,function(n){
      if(n.nodeType===3){ n.textContent.split(/(\s+)/).forEach(function(t){ units.push(t.trim()===''?{sp:t}:{word:t}); }); }
      else if(n.nodeType===1){ n.tagName==='BR' ? units.push({br:1}) : units.push({el:n}); }
    });
    el.innerHTML=''; var i=0;
    units.forEach(function(u){
      if(u.sp!=null){ el.appendChild(document.createTextNode(u.sp)); return; }
      if(u.br){ el.appendChild(document.createElement('br')); return; }
      var w=document.createElement('span'); w.className='ln-w';
      var inner=document.createElement('i'); inner.style.setProperty('--d',(i*0.07)+'s');
      if(u.word!=null) inner.textContent=u.word; else inner.appendChild(u.el);
      w.appendChild(inner); el.appendChild(w); i++;
    });
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('in'); }); });
  }
  window.lnWords=lnWords;
  [].forEach.call(document.querySelectorAll('.ln-words'), lnWords);

  /* ── 2. Count-up для цифр ── */
  function lnCount(el){
    if(el.dataset.lnC) return; el.dataset.lnC='1';
    var target=parseFloat(el.getAttribute('data-count'))||0,
        dec=parseInt(el.getAttribute('data-dec')||'0',10),
        pre=el.getAttribute('data-pre')||'', suf=el.getAttribute('data-suf')||'',
        t0=performance.now(), DUR=1400;
    function fmt(v){ return dec ? v.toFixed(dec) : Math.round(v).toLocaleString('ru-RU'); }
    function tk(now){ var p=Math.min((now-t0)/DUR,1), e=1-Math.pow(1-p,3);
      el.textContent=pre+fmt(target*e)+suf;
      if(p<1) requestAnimationFrame(tk); else el.textContent=pre+fmt(target)+suf;
    }
    requestAnimationFrame(tk);
  }
  var counters=[].slice.call(document.querySelectorAll('[data-count]'));
  function inView(el){ var r=el.getBoundingClientRect(); return r.top<innerHeight*0.9 && r.bottom>0; }
  var io=('IntersectionObserver' in window)?new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ lnCount(e.target); io.unobserve(e.target);} });
  },{threshold:.3}):null;
  counters.forEach(function(el){ if(inView(el)) lnCount(el); else if(io) io.observe(el); else lnCount(el); });
  addEventListener('scroll',function(){ counters.forEach(function(el){ if(!el.dataset.lnC && inView(el)) lnCount(el); }); },{passive:true});
})();

/* ── Mobile tab bar: активная вкладка + бейдж корзины ── */
(function(){
  function markActiveTab(){
    const bar = document.getElementById('tabbar'); if (!bar) return;
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const map = {
      'index.html':'home', '':'home',
      'catalog.html':'catalog', 'sale.html':'catalog', 'product.html':'catalog',
      'stores.html':'stores',
      'profile.html':'profile', 'account.html':'profile', 'login.html':'profile',
      'order.html':'cart'
    };
    const active = map[page] || '';
    bar.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === active));
  }
  function syncCartBadge(){
    const badge = document.getElementById('tab-cart-badge'); if (!badge) return;
    // берём количество из твоего хедер-бейджа корзины, если он есть
    const src = document.querySelector('.cart-count, #cart-count, .nav-cart-badge');
    const n = src ? parseInt(src.textContent.trim() || '0', 10) : 0;
    badge.textContent = n; badge.style.display = n > 0 ? 'flex' : 'none';
  }
  // навбар грузится асинхронно — подождём его появления
  const iv = setInterval(() => {
    if (document.getElementById('tabbar')) { clearInterval(iv); markActiveTab(); syncCartBadge(); }
  }, 100);
  setTimeout(() => clearInterval(iv), 5000);
  // обновлять бейдж при изменениях корзины
  document.addEventListener('click', () => setTimeout(syncCartBadge, 300));
})();