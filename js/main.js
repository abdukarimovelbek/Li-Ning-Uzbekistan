/* ============================================
   LI NING STORE — MAIN JAVASCRIPT
   All interactivity: cursor, cart, filters,
   reviews, animations, form validation
   ============================================ */

'use strict';

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
            <button onclick="window.cartChangeQty('${item.id}','${item.size}',-1)" style="width:24px;height:24px;background:var(--gray-100);border:1px solid var(--gray-100);border-radius:4px;font-size:1rem;display:flex;align-items:center;justify-content:center;cursor:pointer">−</button>
            <span style="font-size:.85rem;font-weight:600;min-width:20px;text-align:center">${item.qty}</span>
            <button onclick="window.cartChangeQty('${item.id}','${item.size}',1)" style="width:24px;height:24px;background:var(--gray-100);border:1px solid var(--gray-100);border-radius:4px;font-size:1rem;display:flex;align-items:center;justify-content:center;cursor:pointer">+</button>
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
  window.Cart = { add, remove, clear, changeQty, getTotal, getItems };
  window.cartRemove = remove;
  window.cartChangeQty = changeQty;

  updateUI();
  return { updateUI };
})();


/* ─── 3. CART DRAWER ────────────────────────── */
const CartDrawer = (() => {
  const overlay = document.querySelector('.cart-overlay');
  const drawer  = document.querySelector('.cart-drawer');
  const openBtns  = document.querySelectorAll('.cart-btn, [data-open-cart]');
  const closeBtns = document.querySelectorAll('.cart-close');

  const open = () => {
    overlay?.classList.add('open');
    drawer?.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    overlay?.classList.remove('open');
    drawer?.classList.remove('open');
    document.body.style.overflow = '';
  };

  openBtns.forEach(btn => btn.addEventListener('click', open));
  closeBtns.forEach(btn => btn.addEventListener('click', close));
  overlay?.addEventListener('click', close);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  window.CartDrawer = { open, close };
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
      // Highlight on hover — extra class for additional effects
      card.addEventListener('mouseenter', () => card.classList.add('is-hovered'));
      card.addEventListener('mouseleave', () => card.classList.remove('is-hovered'));

      // Quick-add button
      const addBtn = card.querySelector('.btn-addcart');
      if (addBtn) {
        addBtn.addEventListener('click', e => {
          e.stopPropagation();
          console.log('card article:', card.dataset.article, 'productId:', card.dataset.productId);
          const data = {
            id:      card.dataset.productId || Math.random().toString(36).slice(2),
            article: card.dataset.article || card.dataset.productId,
            name:    card.querySelector('.product-name')?.textContent || 'Товар',
            price:   parseInt(card.dataset.price || '0'),
            size:    card.dataset.defaultSize || '42',
            emoji:   card.querySelector('.product-img')?.textContent?.trim() || '👟',
          };
          Cart.add(data);
          // Animate button
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
          const isWished = wishBtn.dataset.wished === 'true';
          wishBtn.dataset.wished = (!isWished).toString();
          wishBtn.textContent = isWished ? '♡' : '♥';
          Toast.show(isWished ? 'Убрано из желаемого' : 'Добавлено в желаемое', '', 'warning');
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
  document.addEventListener('DOMContentLoaded', init);
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

    document.querySelectorAll('.product-card').forEach(card => {
      const brand = card.dataset.brand?.toLowerCase() || '';
      const price = parseInt(card.dataset.price || '0');
      const sizes = (card.dataset.sizes || '').split(',');

      const brandOk = checkedBrands.length === 0 || checkedBrands.includes(brand);
      const priceOk = price <= maxPrice;
      const sizeOk  = !activeSize || sizes.includes(activeSize);

      card.style.display = (brandOk && priceOk && sizeOk) ? '' : 'none';
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
  document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar');

    // Active link highlighting
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const params = new URLSearchParams(window.location.search);
    const gender = params.get('gender');

    document.querySelectorAll('.nav-links a').forEach(link => {
      const href = link.getAttribute('href') || '';
      const linkParams = new URLSearchParams(href.split('?')[1] || '');
      const linkGender = linkParams.get('gender');
      const linkPage = href.split('?')[0];

      if (gender && linkGender === gender && linkPage === currentPage) {
        link.classList.add('active');
      } else if (!gender && href === currentPage) {
        link.classList.add('active');
      }
    });

    // Mobile menu toggle
    const mobileBtn  = document.querySelector('.mobile-menu-btn');
    const mobileNav  = document.querySelector('.mobile-nav');
    mobileBtn?.addEventListener('click', () => mobileNav?.classList.toggle('open'));

    // Live search
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
  });
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
      'shoes.html':   'Обувь',
      'clothing.html':'Одежда',
      'running.html': 'Бег',
      'training.html':'Тренировка',
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

    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
      link.addEventListener('click', e => {
        e.preventDefault();
        document.body.style.opacity = '0';
        setTimeout(() => window.location.href = href, 300);
      });
    });
  });
})();

/* ─── SUPABASE CONFIG ───────────────────────── */
const SB_URL = 'https://dgyirginrefvjsbhhooi.supabase.co';
const SB_KEY = 'sb_publishable_OJBupDTCJGVIJpkoV8q3gg_mcvRddQb';

const CACHE_KEY = 'lining_products_cache';
const CACHE_TTL = 5 * 60 * 1000;

async function fetchProducts(filter = '') {
  const cacheKey = CACHE_KEY + filter;
  
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, time } = JSON.parse(cached);
      if (Date.now() - time < CACHE_TTL) {
        console.log('Из кэша ⚡');
        return data;
      }
    }
  } catch(e) {}

  const res = await fetch(
    `${SB_URL}/rest/v1/products?is_active=eq.true${filter}&order=created_at.desc`,
    {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`
      }
    }
  );
  const data = await res.json();

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ data, time: Date.now() }));
  } catch(e) {}

  return data;
}

/* ─── LOAD PRODUCTS FROM SUPABASE ───────────── */
const buildCard = (p) => {
  const images = Array.isArray(p.images) ? p.images : (p.images || []);
  const sizes  = Array.isArray(p.sizes)  ? p.sizes  : (p.sizes  || []);
  const imgHtml = images[0]
    ? `<img src="${images[0]}" style="width:100%;height:100%;object-fit:cover">`
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
      data-rating="5"
      data-category="${p.category||''}"
      data-gender="${p.gender||'uni'}"
      data-subcategory="${p.subcategory||''}"
      data-href="product.html?id=${p.id}"
      onclick="if(!event.target.closest('button')) window.location.href='product.html?id=${p.id}'">
      <div class="product-img-wrap">
        ${badge}
        <div class="product-img" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">
          ${imgHtml}
        </div>
        <div class="product-actions">
          <button class="btn-addcart">+ В корзину</button>
          <button class="btn-wishlist" data-wished="false">♡</button>
        </div>
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

document.addEventListener('DOMContentLoaded', async () => {
  // Ждём инициализации ProductCards
  await new Promise(r => setTimeout(r, 0));

  // Главная страница — последние 4 товара
  const homeGrid = document.getElementById('home-products');
  if (homeGrid) {
    try {
      const products = await fetchProducts('&limit=4');
      if (products.length > 0) {
        homeGrid.innerHTML = products.map(buildCard).join('');
        if (window.ProductCards) ProductCards.init();
      } else {
        homeGrid.innerHTML = '<div style="padding:3rem;text-align:center;color:#aaa">Товары скоро появятся</div>';
      }
    } catch(e) { console.error(e); }
  }

  // Каталог — все товары
  const catalogGrid = document.getElementById('catalog-products');
  if (catalogGrid) {
    try {
      const products = await fetchProducts();
      if (products.length > 0) {
        catalogGrid.innerHTML = products.map(buildCard).join('');
        if (window.ProductCards) ProductCards.init();
        // Обновляем счётчик
        const countEl = document.querySelector('.catalog-count strong');
        if (countEl) countEl.textContent = products.length;
      } else {
        catalogGrid.innerHTML = '<div style="padding:3rem;text-align:center;color:#aaa">Товары скоро появятся</div>';
      }
    } catch(e) { console.error(e); }
  }

  // Страница обуви
  const shoesGrid = document.getElementById('shoes-products');
  if (shoesGrid) {
    try {
      const products = await fetchProducts('&category=eq.shoes');
      shoesGrid.innerHTML = products.length > 0
        ? products.map(buildCard).join('')
        : '<div style="padding:3rem;text-align:center;color:#aaa">Товары скоро появятся</div>';
      if (window.ProductCards) ProductCards.init();;
    } catch(e) { console.error(e); }
  }

  const clothingGrid = document.getElementById('clothing-products');
  if (clothingGrid) {
    try {
      const products = await fetchProducts('&category=eq.clothing');
      clothingGrid.innerHTML = products.map(buildCard).join('');
      if (window.ProductCards) ProductCards.init();;
    } catch(e) { console.error(e); }
  }

  const runningGrid = document.getElementById('running-products');
  if (runningGrid) {
    try {
      const products = await fetchProducts('&category=eq.running');
      runningGrid.innerHTML = products.map(buildCard).join('');
      if (window.ProductCards) ProductCards.init();;
    } catch(e) { console.error(e); }
  }

  const trainingGrid = document.getElementById('training-products');
  if (trainingGrid) {
    try {
      const products = await fetchProducts('&category=eq.training');
      trainingGrid.innerHTML = products.map(buildCard).join('');
      if (window.ProductCards) ProductCards.init();;
    } catch(e) { console.error(e); }
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
        `${SB_URL}/rest/v1/slides?is_active=eq.true&order=sort_order.asc`,
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

    // Очищаем
    container.innerHTML = '';
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
        <div style="position:relative;z-index:2;width:100%;min-height:calc(100vh - var(--nav-h) - 36px);display:flex;flex-direction:column;justify-content:center;padding:0 4rem">
          <div class="hero-tag" style="color:rgba(255,255,255,0.7)">${slide.subtitle || ''}</div>
          <h1 class="hero-h1" style="color:${slide.text_color || '#fff'};font-size:clamp(4rem,10vw,9rem)">
            ${(slide.title || '').replace(/\n/g,'<br>')}
          </h1>
          <div class="hero-cta" style="margin-top:2rem">
            ${slide.button_text ? `<a href="${slide.button_link || '#'}" class="btn btn-primary">${slide.button_text}</a>` : ''}
          </div>
        </div>
      `;
      container.appendChild(el);

      // Создаём точку
      const dot = document.createElement('div');
      dot.className = `slider-dot ${i === 0 ? 'active' : ''}`;
      dot.onclick = () => goToSlide(i);
      dotsContainer.appendChild(dot);
    });

    startTimer();
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
  };

  const startTimer = () => {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), 4000);
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('hero-slider')) {
      loadSlides();
    }
  });

  window.goToSlide = (i) => { goTo(i); startTimer(); };
  window.nextSlide = () => { goTo(current + 1); startTimer(); };
  window.prevSlide = () => { goTo(current - 1); startTimer(); };
})();

(function() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  const hasSlider = !!document.querySelector('.hero-slider');

  function updateNav() {
    if (hasSlider && window.scrollY < nav.offsetHeight) {
      nav.classList.remove('scrolled');
    } else {
      nav.classList.add('scrolled');
    }
  }
  updateNav();
  window.addEventListener('scroll', updateNav, { passive: true });
})();

// Мегаменю top — динамически под navbar
(function() {
  const navbar = document.querySelector('.navbar');
  const style  = document.createElement('style');
  document.head.appendChild(style);

  function updateMegaTop() {
    const navBottom = navbar ? navbar.getBoundingClientRect().bottom : 96;
    style.textContent = `.mega-menu { top: ${navBottom}px !important; }`;
  }

  updateMegaTop();
  window.addEventListener('scroll', updateMegaTop, { passive: true });
  window.addEventListener('resize', updateMegaTop);
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
  const subcatLabels = { sneakers: 'Кроссовки', slippers: 'Сланцы / Сабо', sneakers_low: 'Кеды', sandals: 'Сандали' };
  const subcategory = params.get('subcategory');

  if (extra) {
    let html = '';
    if (gender) html += `<span>/</span><a href="catalog.html?gender=${gender}">${genderLabels[gender] || gender}</a>`;
    if (cat)    html += `<span>/</span><a href="catalog.html?gender=${gender||''}&category=${cat}">${catLabels[cat] || cat}</a>`;
    if (subcategory) html += `<span>/</span><span>${subcatLabels[subcategory] || subcategory}</span>`;
    extra.innerHTML = html;
  }

  // Заголовок
  const pageTitle = document.getElementById('catalog-page-title');
  if (pageTitle) {
    if (subcategory) pageTitle.textContent = `${genderLabels[gender]||''} — ${subcatLabels[subcategory]||subcategory}`.trim();
    else if (gender && cat) pageTitle.textContent = `${genderLabels[gender]} — ${catLabels[cat]}`;
    else if (gender) pageTitle.textContent = genderLabels[gender] || 'Каталог';
    else if (cat)    pageTitle.textContent = catLabels[cat] || 'Каталог';
  }

  // Применяем фильтры
  if (cat || gender) {
    applyCatalogFilters(cat, gender);
  }
});

function applyCatalogFilters(cat, gender) {
  const params = new URLSearchParams(window.location.search);
  const subcategory = params.get('subcategory');

  document.querySelectorAll('.product-card').forEach(card => {
    const cardCat    = card.dataset.category || '';
    const cardGender = card.dataset.gender || 'uni';
    const cardSub    = card.dataset.subcategory || '';

    const catOk    = !cat         || cardCat === cat;
    const genderOk = !gender      || cardGender === gender || (cardGender === 'uni' && cardCat === cat);
    const subOk    = !subcategory || cardSub === subcategory;

    card.style.display = (catOk && genderOk && subOk) ? '' : 'none';
  });

  const visible = document.querySelectorAll('.product-card:not([style*="none"])').length;
  const countEl = document.querySelector('.catalog-count strong');
  if (countEl) countEl.textContent = visible;
}
window.applyCatalogFilters = applyCatalogFilters;

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

/* ── MEGA MENU FIX ── */
document.querySelectorAll('.nav-item-mega').forEach(item => {
  let hideTimer = null;

  const show = () => {
    clearTimeout(hideTimer);
    item.querySelector('.mega-menu').style.display = 'grid';
  };

  const hide = () => {
    hideTimer = setTimeout(() => {
      item.querySelector('.mega-menu').style.display = '';
    }, 200);
  };

  item.addEventListener('mouseenter', show);
  item.addEventListener('mouseleave', hide);

  const menu = item.querySelector('.mega-menu');
  if (menu) {
    menu.addEventListener('mouseenter', show);
    menu.addEventListener('mouseleave', hide);
  }
});