/* ==========================================================================
   ZION — лендинг digital-агентства
   Ванильный JS (ES6+), без зависимостей
   ========================================================================== */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;

  /* ----------------------------------------------------------------------
     0. ПРЕЛОАДЕР (не дольше 1.2s)
  ---------------------------------------------------------------------- */
  (function initPreloader() {
    const preloader = document.getElementById('preloader');
    const percent = document.getElementById('preloaderPercent');
    if (!preloader) return;

    if (prefersReducedMotion) {
      preloader.remove();
      return;
    }

    const start = performance.now();
    let value = 0;

    const tick = () => {
      const elapsed = performance.now() - start;
      // Доводим до 100% не дольше ~900ms, затем скрываем (всего <= 1.2s)
      value = Math.min(100, Math.round((elapsed / 900) * 100));
      percent.textContent = value + '%';
      if (value < 100) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          preloader.classList.add('preloader--hidden');
          setTimeout(() => preloader.remove(), 650);
        }, 100);
      }
    };
    requestAnimationFrame(tick);
  })();

  /* ----------------------------------------------------------------------
     1. REVEAL-АНИМАЦИИ (текст по строкам + появление секций)
  ---------------------------------------------------------------------- */
  (function initReveal() {
    const revealEls = document.querySelectorAll('.reveal');
    const fadeEls = document.querySelectorAll('.fade-up');

    if (prefersReducedMotion) {
      revealEls.forEach(el => el.classList.add('reveal--in'));
      fadeEls.forEach(el => el.classList.add('fade-up--in'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    revealEls.forEach(el => io.observe(el));

    const ioFade = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-up--in');
          ioFade.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    fadeEls.forEach(el => ioFade.observe(el));
  })();

  /* ----------------------------------------------------------------------
     2. СЧЁТЧИКИ СТАТИСТИКИ (набор числа от 0, 1.4s, ease-out)
  ---------------------------------------------------------------------- */
  (function initCounters() {
    const counters = document.querySelectorAll('[data-count]');

    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const runCounter = (el) => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      if (prefersReducedMotion) {
        el.textContent = target + suffix;
        return;
      }
      const duration = 1400;
      const startTime = performance.now();

      const step = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        el.textContent = Math.round(easeOut(p) * target) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    // threshold 0 — счётчики могут быть частично прижаты к нижней границе
    // вьюпорта крупными заголовками, реагируем на любое пересечение
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0 });

    counters.forEach(el => io.observe(el));
  })();

  /* ----------------------------------------------------------------------
     3. ХЕДЕР: скрытие при скролле вниз, возврат при скролле вверх
        Порог — 120px. При открытом модалном окне блокируется.
  ---------------------------------------------------------------------- */
  const headerController = (function initHeader() {
    const header = document.getElementById('header');
    let lastY = window.scrollY;
    let locked = false;

    const onScroll = () => {
      if (locked) return;
      const y = window.scrollY;

      header.classList.toggle('header--shadow', y > 8);

      if (y > 120 && y > lastY + 4) {
        header.classList.add('header--hidden');
      } else if (y < lastY - 4 || y <= 120) {
        header.classList.remove('header--hidden');
      }
      lastY = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return {
      setLocked(v) {
        locked = v;
        header.classList.toggle('header--locked', v);
        if (!v) header.classList.remove('header--hidden');
      }
    };
  })();

  /* ----------------------------------------------------------------------
     4. МОБИЛЬНОЕ МЕНЮ (бургер → полноэкранная панель)
  ---------------------------------------------------------------------- */
  (function initBurger() {
    const burger = document.getElementById('burger');
    const nav = document.getElementById('mainNav');
    if (!burger || !nav) return;

    const close = () => {
      burger.classList.remove('burger--open');
      nav.classList.remove('nav--open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Открыть меню');
      document.body.classList.remove('is-locked');
    };

    burger.addEventListener('click', () => {
      const isOpen = nav.classList.contains('nav--open');
      if (isOpen) {
        close();
      } else {
        burger.classList.add('burger--open');
        nav.classList.add('nav--open');
        burger.setAttribute('aria-expanded', 'true');
        burger.setAttribute('aria-label', 'Закрыть меню');
        document.body.classList.add('is-locked');
      }
    });

    nav.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('click', () => {
        if (nav.classList.contains('nav--open')) close();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('nav--open')) close();
    });
  })();

  /* ----------------------------------------------------------------------
     5. КАРТОЧКИ КЕЙСОВ: видео по ховеру + ленивая загрузка во вьюпорте
  ---------------------------------------------------------------------- */
  (function initCaseCards() {
    const cards = document.querySelectorAll('.case-card');
    if (!cards.length) return;

    // Ленивая подстановка src у видео только когда карточка во вьюпорте
    const ioLazy = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const video = entry.target.querySelector('video[data-src]');
        if (video) {
          video.src = video.dataset.src;
          video.removeAttribute('data-src');
          video.load();
        }
        ioLazy.unobserve(entry.target);
      });
    }, { rootMargin: '200px' });

    cards.forEach(card => {
      ioLazy.observe(card);

      // На тач-устройствах видео не запускается — только постер
      if (isTouch || prefersReducedMotion) return;

      const video = card.querySelector('video');
      if (!video) return;

      card.addEventListener('mouseenter', () => {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          // Игнорируем ошибки autoplay (например, если файл-заглушка отсутствует)
          playPromise.catch(() => {});
        }
      });

      card.addEventListener('mouseleave', () => {
        video.pause();
      });
    });
  })();

  /* ----------------------------------------------------------------------
     6. КАРУСЕЛЬ КЕЙСОВ: стрелки + scroll-snap
  ---------------------------------------------------------------------- */
  (function initCasesCarousel() {
    const wrap = document.querySelector('.cases__track-wrap');
    const prev = document.getElementById('casesPrev');
    const next = document.getElementById('casesNext');
    if (!wrap || !prev || !next) return;

    const getStep = () => {
      const card = wrap.querySelector('.case-card');
      if (!card) return 400;
      return card.getBoundingClientRect().width + 24; // ширина карточки + gap
    };

    prev.addEventListener('click', () => {
      wrap.scrollBy({ left: -getStep(), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
    next.addEventListener('click', () => {
      wrap.scrollBy({ left: getStep(), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  })();

  /* ----------------------------------------------------------------------
     7. FAQ-АККОРДЕОН: открыт только один блок за раз
  ---------------------------------------------------------------------- */
  (function initFaq() {
    const items = document.querySelectorAll('.faq__item');

    const closeAll = (except) => {
      items.forEach(item => {
        const btn = item.querySelector('.faq__question');
        const answer = item.querySelector('.faq__answer');
        if (item === except) return;
        btn.setAttribute('aria-expanded', 'false');
        answer.style.maxHeight = '0px';
        answer.classList.remove('faq__answer--open');
      });
    };

    items.forEach(item => {
      const btn = item.querySelector('.faq__question');
      const answer = item.querySelector('.faq__answer');

      btn.addEventListener('click', () => {
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        closeAll(item);
        if (isOpen) {
          btn.setAttribute('aria-expanded', 'false');
          answer.style.maxHeight = '0px';
          answer.classList.remove('faq__answer--open');
        } else {
          btn.setAttribute('aria-expanded', 'true');
          answer.classList.add('faq__answer--open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    });

    window.addEventListener('resize', () => {
      items.forEach(item => {
        const answer = item.querySelector('.faq__answer');
        if (answer.classList.contains('faq__answer--open')) {
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    });
  })();

  /* ----------------------------------------------------------------------
     8. МОДАЛЬНОЕ ОКНО ЗАЯВКИ
        Открытие/закрытие, фокус-трап, возврат фокуса, блокировка body
  ---------------------------------------------------------------------- */
  const modalController = (function initModal() {
    const modal = document.getElementById('requestModal');
    const panel = document.getElementById('modalPanel');
    const successView = document.getElementById('modalSuccess');
    const formView = document.getElementById('modalFormWrap');
    if (!modal || !panel) return null;

    let initiator = null;
    let isOpen = false;

    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusables = () =>
      Array.from(panel.querySelectorAll(FOCUSABLE)).filter(el => {
        // Исключаем скрытые элементы и нативные selects
        return el.offsetParent !== null && !el.closest('[hidden]');
      });

    const open = (triggerEl) => {
      if (isOpen) return;
      isOpen = true;
      initiator = triggerEl || document.activeElement;

      modal.hidden = false;
      // Форсируем reflow, чтобы transition сработал
      void modal.offsetWidth;
      modal.classList.add('modal--open');

      document.body.classList.add('is-locked');
      headerController.setLocked(true);

      // Фокус на первое поле
      setTimeout(() => {
        const first = formView.hidden
          ? panel.querySelector('.modal__success-btn')
          : document.getElementById('fName');
        if (first) first.focus();
      }, 50);
    };

    const close = () => {
      if (!isOpen) return;
      isOpen = false;

      modal.classList.remove('modal--open');
      document.body.classList.remove('is-locked');
      headerController.setLocked(false);

      const finish = () => {
        modal.hidden = true;
        // Если был показан экран успеха — возвращаем форму к следующему открытию
        if (formView.hidden) {
          formView.hidden = false;
          successView.hidden = true;
        }
      };

      if (prefersReducedMotion) {
        finish();
      } else {
        setTimeout(finish, 600);
      }

      // Возврат фокуса на кнопку-инициатор
      if (initiator && typeof initiator.focus === 'function') {
        initiator.focus();
      }
    };

    // Все CTA
    document.querySelectorAll('[data-modal-open]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        open(btn);
      });
    });

    // Закрытие: крестик, оверлей, кнопка «Закрыть» на успехе
    modal.querySelectorAll('[data-modal-close]').forEach(el => {
      el.addEventListener('click', close);
    });

    // Esc + фокус-трап
    document.addEventListener('keydown', (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = getFocusables();
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    return {
      close,
      showSuccess() {
        formView.hidden = true;
        successView.hidden = false;
        const btn = successView.querySelector('.modal__success-btn');
        if (btn) btn.focus();
      },
      resetToShowForm() {
        formView.hidden = false;
        successView.hidden = true;
      },
      isOpen: () => isOpen
    };
  })();

  /* ----------------------------------------------------------------------
     9. ФОРМА ЗАЯВКИ: валидация, телефон-маска, селект, счётчик, отправка
  ---------------------------------------------------------------------- */
  (function initForm() {
    const form = document.getElementById('requestForm');
    if (!form || !modalController) return;

    /* --- 9.1 Маска телефона +7 (999) 999-99-99 --- */
    const phoneInput = document.getElementById('fPhone');

    const formatPhone = (digits) => {
      // digits: только цифры, начинаем с 7
      let out = '+7';
      if (digits.length > 1) out += ' (' + digits.slice(1, 4);
      if (digits.length >= 4) out += ') ' + digits.slice(4, 7);
      if (digits.length >= 7) out += '-' + digits.slice(7, 9);
      if (digits.length >= 9) out += '-' + digits.slice(9, 11);
      return out;
    };

    phoneInput.addEventListener('input', (e) => {
      let digits = e.target.value.replace(/\D/g, '');
      if (!digits.startsWith('7')) {
        digits = digits.startsWith('8') ? '7' + digits.slice(1) : '7' + digits;
      }
      digits = digits.slice(0, 11);
      e.target.value = formatPhone(digits);
      validateField('phone');
      updateFieldState('phone');
    });

    phoneInput.addEventListener('focus', () => {
      if (!phoneInput.value) phoneInput.value = '+7 (';
      setActive('phone', true);
    });

    phoneInput.addEventListener('blur', () => {
      if (phoneInput.value === '+7 (') phoneInput.value = '';
      setActive('phone', false);
      validateField('phone');
    });

    /* --- 9.2 Общее управление состоянием полей --- */
    const fields = {
      name: { el: document.getElementById('fName'), wrap: form.querySelector('[data-field="name"]') },
      phone: { el: phoneInput, wrap: form.querySelector('[data-field="phone"]') },
      email: { el: document.getElementById('fEmail'), wrap: form.querySelector('[data-field="email"]') },
      project: { wrap: form.querySelector('[data-field="project"]') },
      budget: { wrap: form.querySelector('[data-field="budget"]') },
      message: { el: document.getElementById('fMsg'), wrap: form.querySelector('[data-field="message"]') },
      agree: { el: document.getElementById('fAgree'), wrap: form.querySelector('[data-field="agree"]') }
    };

    function setActive(key, on) {
      const f = fields[key];
      if (!f || !f.wrap) return;
      f.wrap.classList.toggle('is-active', on);
    }

    function setError(key, msg) {
      const f = fields[key];
      if (!f || !f.wrap) return;
      // Для согласия текст ошибки живёт в отдельном <p> вне обёртки label
      const errEl = key === 'agree'
        ? form.querySelector('.form__error--check')
        : f.wrap.querySelector('.form__error');
      f.wrap.classList.add('is-error');
      f.wrap.classList.remove('is-valid');
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = msg;
      }
      if (f.el) f.el.setAttribute('aria-invalid', 'true');
    }

    function clearError(key) {
      const f = fields[key];
      if (!f || !f.wrap) return;
      const errEl = key === 'agree'
        ? form.querySelector('.form__error--check')
        : f.wrap.querySelector('.form__error');
      f.wrap.classList.remove('is-error');
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = '';
      }
      if (f.el) f.el.removeAttribute('aria-invalid');
    }

    function markValid(key) {
      const f = fields[key];
      if (!f || !f.wrap) return;
      f.wrap.classList.add('is-valid');
    }

    function updateFieldState(key) {
      const f = fields[key];
      if (!f || !f.el) return;
      setActive(key, f.el.value.trim() !== '' || document.activeElement === f.el);
    }

    /* --- 9.3 Валидаторы --- */
    const validators = {
      name: () => {
        const v = fields.name.el.value.trim();
        if (!v) return 'Укажите имя';
        if (v.length < 2) return 'Имя минимум 2 символа';
        return '';
      },
      phone: () => {
        const digits = fields.phone.el.value.replace(/\D/g, '');
        if (digits.length < 11) return 'Введите телефон полностью';
        return '';
      },
      email: () => {
        const v = fields.email.el.value.trim();
        if (!v) return ''; // необязательное
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Некорректный email';
        return '';
      },
      project: () => {
        const native = fields.project.wrap.querySelector('.select__native');
        if (!native.value) return 'Выберите тип проекта';
        return '';
      },
      budget: () => '',
      message: () => {
        if (fields.message.el.value.length > 600) return 'Максимум 600 символов';
        return '';
      },
      agree: () => {
        if (!fields.agree.el.checked) return 'Необходимо согласие на обработку данных';
        return '';
      }
    };

    function validateField(key) {
      const msg = validators[key]();
      if (msg) {
        setError(key, msg);
        return false;
      }
      clearError(key);
      const f = fields[key];
      const hasValue = f.el ? f.el.value.trim() !== '' :
                       (key === 'project' ? !!f.wrap.querySelector('.select__native').value : false);
      if (hasValue) markValid(key);
      return true;
    }

    /* --- 9.4 Слушатели для text-inputs --- */
    ['name', 'email'].forEach(key => {
      const el = fields[key].el;
      el.addEventListener('focus', () => setActive(key, true));
      el.addEventListener('blur', () => {
        setActive(key, el.value.trim() !== '');
        validateField(key);
      });
      el.addEventListener('input', () => {
        setActive(key, true);
        if (fields[key].wrap.classList.contains('is-error')) validateField(key);
        else if (el.value.trim()) markValid(key);
      });
    });

    /* --- 9.5 Textarea + счётчик символов --- */
    const msgEl = fields.message.el;
    const counter = document.getElementById('msgCounter');
    const MAX = 600;

    msgEl.addEventListener('input', () => {
      const len = msgEl.value.length;
      counter.textContent = len + ' / ' + MAX;
      counter.classList.toggle('is-warn', len > MAX * 0.85);
      setActive('message', len > 0);
    });
    msgEl.addEventListener('focus', () => setActive('message', true));
    msgEl.addEventListener('blur', () => setActive('message', msgEl.value.length > 0));

    /* --- 9.6 Кастомный селект --- */
    function initSelect(wrap) {
      const btn = wrap.querySelector('.select__btn');
      const list = wrap.querySelector('.select__list');
      const valueEl = wrap.querySelector('.select__value');
      const native = wrap.querySelector('.select__native');
      const options = Array.from(list.querySelectorAll('.select__option'));
      let highlight = -1;

      const openList = () => {
        list.hidden = false;
        wrap.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        highlight = options.findIndex(o => o.getAttribute('aria-selected') === 'true');
        if (highlight < 0) highlight = 0;
        setHighlight(highlight);
      };

      const closeList = () => {
        list.hidden = true;
        wrap.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        options.forEach(o => o.classList.remove('is-highlighted'));
      };

      const setHighlight = (i) => {
        options.forEach(o => o.classList.remove('is-highlighted'));
        highlight = Math.max(0, Math.min(options.length - 1, i));
        options[highlight].classList.add('is-highlighted');
        options[highlight].scrollIntoView({ block: 'nearest' });
      };

      const choose = (opt) => {
        options.forEach(o => o.setAttribute('aria-selected', 'false'));
        opt.setAttribute('aria-selected', 'true');
        native.value = opt.dataset.value;
        valueEl.textContent = opt.textContent;
        valueEl.classList.remove('is-empty');
        closeList();
        btn.focus();
        const key = wrap.closest('[data-field]').dataset.field;
        validateField(key);
      };

      btn.addEventListener('click', () => {
        list.hidden ? openList() : closeList();
      });

      options.forEach(opt => {
        opt.addEventListener('click', () => choose(opt));
      });

      btn.addEventListener('keydown', (e) => {
        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (list.hidden) openList();
            else if (highlight >= 0) choose(options[highlight]);
            break;
          case 'Escape':
            if (!list.hidden) { closeList(); }
            break;
          case 'ArrowDown':
            e.preventDefault();
            if (list.hidden) openList();
            else setHighlight(highlight + 1);
            break;
          case 'ArrowUp':
            e.preventDefault();
            if (!list.hidden) setHighlight(highlight - 1);
            break;
          case 'Tab':
            closeList();
            break;
        }
      });

      document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target) && !list.hidden) closeList();
      });
    }

    initSelect(fields.project.wrap.querySelector('.select'));
    initSelect(fields.budget.wrap.querySelector('.select'));

    /* --- 9.7 Чекбокс --- */
    fields.agree.el.addEventListener('change', () => {
      validateField('agree');
    });

    /* --- 9.8 Отправка --- */
    const submitBtn = document.getElementById('submitBtn');
    const submitLabel = submitBtn.querySelector('.form__submit-label');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitBtn.disabled) return;

      const order = ['name', 'phone', 'email', 'project', 'message', 'agree'];
      let firstInvalid = null;

      order.forEach(key => {
        const ok = validateField(key);
        if (!ok && !firstInvalid) firstInvalid = fields[key];
      });

      if (firstInvalid) {
        const target = firstInvalid.el ||
                       firstInvalid.wrap.querySelector('.select__btn');
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
        return;
      }

      // Демо-отправка
      submitBtn.disabled = true;
      submitLabel.innerHTML = '<span class="spinner" aria-hidden="true"></span>';

      // TODO: заменить на реальный POST в CRM
      await new Promise(r => setTimeout(r, 600));

      const ticket = 'ZN-' + String(Math.floor(1000 + Math.random() * 9000));
      document.getElementById('ticketNo').textContent = ticket;

      modalController.showSuccess();

      // Сброс формы «под капотом», чтобы при повторном открытии была чистая
      form.reset();
      counter.textContent = '0 / ' + MAX;
      submitBtn.disabled = false;
      submitLabel.textContent = 'Отправить';
      Object.keys(fields).forEach(key => {
        clearError(key);
        if (fields[key].wrap) fields[key].wrap.classList.remove('is-valid', 'is-active');
      });
      form.querySelectorAll('.select__value').forEach(v => {
        v.textContent = v.closest('#selProject') ? 'Выберите тип' : 'Не важно';
        v.classList.add('is-empty');
      });
      form.querySelectorAll('.select__option').forEach(o => o.setAttribute('aria-selected', 'false'));

      // Вид формы будет возвращён модальным контроллером при закрытии окна
    });
  })();

  /* ----------------------------------------------------------------------
     10. COOKIE-БАННЕР
  ---------------------------------------------------------------------- */
  (function initCookie() {
    const banner = document.getElementById('cookieBanner');
    const acceptBtn = document.getElementById('cookieAccept');
    if (!banner || !acceptBtn) return;

    const KEY = 'zion_cookie_choice';

    let stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) { /* приватный режим */ }

    if (stored) return; // выбор уже сделан — не показываем

    setTimeout(() => {
      banner.hidden = false;
      void banner.offsetWidth;
      banner.classList.add('cookie--visible');
    }, 1500);

    acceptBtn.addEventListener('click', () => {
      try { localStorage.setItem(KEY, 'accepted'); } catch (e) { /* noop */ }
      banner.classList.remove('cookie--visible');
      setTimeout(() => { banner.hidden = true; }, 600);
    });
  })();

  /* ----------------------------------------------------------------------
     11. Ссылка «Политика обработки данных» — заглушка (демо-режим)
  ---------------------------------------------------------------------- */
  document.querySelectorAll('[data-policy]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      // TODO: на следующих этапах — страница/модалка политики
    });
  });

})();
