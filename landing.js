(() => {
  const byId = id => document.getElementById(id);
  const hero = document.querySelector('.hero');
  const stage = document.querySelector('.hero-stage');
  const copy = document.querySelector('.hero-copy');
  const header = document.querySelector('.site-header');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // The cover is decorative, never blocks input, and dissolves without waiting for media.
  const intro = byId('entry-intro');
  let introTimer;
  function finishIntro() {
    clearTimeout(introTimer);
    intro?.remove();
    document.documentElement.classList.remove('entry-playing');
  }
  if (intro && !motion.matches && !window.scrollY && (!location.hash || location.hash === '#top')) {
    intro.querySelector('.entry-wordmark').textContent = header.querySelector('.logo').textContent;
    intro.hidden = false;
    document.documentElement.classList.add('entry-playing');
    intro.addEventListener('animationend', event => {
      if (event.target === intro) finishIntro();
    });
    introTimer = setTimeout(finishIntro, 2300);
  } else {
    finishIntro();
  }
  let frame = 0;
  const nativeScrollMotion = CSS.supports('animation-timeline', 'scroll(root block)') && CSS.supports('animation-range', '0px 24svh');
  let heroTop = 0;
  let heroTravel = 1;
  function measureHero() {
    heroTop = hero.getBoundingClientRect().top + window.scrollY;
    heroTravel = Math.max(1, hero.offsetHeight - stage.offsetHeight);
  }
  measureHero();

  document.documentElement.classList.add('motion-ready');
  document.documentElement.classList.toggle('native-scroll-motion', nativeScrollMotion);

  // Pin briefly, then let normal page scrolling carry the watch out of view.
  function updateScroll() {
    frame = 0;
    const progress = motion.matches ? 0 : Math.min(1, Math.max(0, window.scrollY - heroTop) / heroTravel);
    // Follow the current position exactly; never continue zooming after scroll stops.
    const easedProgress = progress * progress * (3 - 2 * progress);
    const opacity = Math.max(0, 1 - easedProgress * 1.3);
    if(!nativeScrollMotion){
      hero.style.setProperty('--copy-y', `${-easedProgress * 40}px`);
      hero.style.setProperty('--copy-opacity', String(opacity));
    }
    copy.inert = opacity < .05;
    // Switch the background and all navigation colours together on any scroll.
    header.classList.toggle('is-scrolled', window.scrollY > 0);
    if (window.scrollY > 0) finishIntro();
  }
  function scheduleScroll() {
    if (!frame) frame = requestAnimationFrame(updateScroll);
  }
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', () => {measureHero();scheduleScroll();});
  if('ResizeObserver' in window) new ResizeObserver(() => {measureHero();scheduleScroll();}).observe(hero);
  motion.addEventListener('change', () => {
    if (motion.matches) finishIntro();
    scheduleScroll();
  });
  // Reveal each card as it enters view, rather than revealing the entire grid at once.
  const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }
  }, { threshold: .08, rootMargin: '0px 0px -24px 0px' }) : null;
  function prepareReveal(element, card = false, delay = 0) {
    element.classList.add(card ? 'reveal-card' : 'reveal');
    element.style.setProperty('--reveal-delay', `${delay}ms`);
    if (!revealObserver || motion.matches || element.getBoundingClientRect().bottom <= 0) {
      element.classList.add('is-visible');
    } else {
      revealObserver.observe(element);
    }
  }
  for (const element of document.querySelectorAll('.section-top .eyebrow, .section-top h2, .section-note, .collection-tabs, .collection-toolbar, .editorial .eyebrow, .editorial h2, .editorial > p, .faq-section > .eyebrow, .faq-section > h2, .faq-list > details, .faq-section > button, footer > div')) {
    prepareReveal(element);
  }
  const productsPanel = byId('products');
  function prepareCards() {
    const columns = getComputedStyle(productsPanel).gridTemplateColumns.split(' ').length;
    for (const [index, card] of [...productsPanel.children].entries()) {
      if (card.tagName !== 'ARTICLE') continue;
      prepareReveal(card, true, (index % columns) * 80);
      // Begin the dissolve only when the layers are loaded, including on slow connections.
      const pictures = [...card.querySelectorAll('.product-image img')];
      Promise.all(pictures.map(picture => new Promise(resolve => {
        if (picture.complete) return resolve();
        picture.addEventListener('load', resolve, { once: true });
        picture.addEventListener('error', () => {
          // A missing backdrop must not leave an empty hole in the product photo.
          if (picture.classList.contains('watch-backdrop')) {
            card.querySelector('.watch-context')?.remove();
            picture.remove();
          }
          resolve();
        }, { once: true });
      }))).then(() => card.classList.add('watch-ready'));
    }
  }
  prepareCards();
  // Filters and collection tabs replace the cards; register their new elements too.
  if (revealObserver && 'MutationObserver' in window) new MutationObserver(records => {
    for (const record of records) for (const node of record.removedNodes) {
      if (node.nodeType === 1) revealObserver.unobserve(node);
    }
    prepareCards();
  }).observe(productsPanel, { childList: true });
  document.addEventListener('focusin', event => {
    const target = event.target.closest('.reveal, .reveal-card');
    if (target) {
      target.classList.add('is-visible');
      revealObserver?.unobserve(target);
    }
  });
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    for (const element of document.querySelectorAll('.reveal, .reveal-card')) element.classList.add('is-visible');
    revealObserver?.disconnect();
  });
  updateScroll();

  const menu = byId('menu-dialog');
  const menuToggle = byId('menu-toggle');
  menuToggle.addEventListener('click', () => {
    menu.showModal();
    menuToggle.setAttribute('aria-expanded', 'true');
  });
  menu.addEventListener('close', () => menuToggle.setAttribute('aria-expanded', 'false'));
  for (const link of menu.querySelectorAll('a')) link.addEventListener('click', () => menu.close());
  for (const button of document.querySelectorAll('[data-close-dialog]')) {
    button.addEventListener('click', () => button.closest('dialog').close());
  }

  const search = byId('search-dialog');
  const input = byId('watch-search');
  const data = window.MeridianStore;
  function renderSearch() {
    const query = input.value.trim().toLocaleLowerCase();
    const products = data.load().products.filter(product => product.active && `${product.name} ${product.style} ${product.description}`.toLocaleLowerCase().includes(query));
    byId('search-status').textContent = products.length ? `${products.length} ${products.length === 1 ? 'watch' : 'watches'}` : 'No watches found.';
    byId('search-results').innerHTML = products.map(product => `<button class="search-result" data-search-product="${data.escape(product.id)}"><img src="${data.escape(product.image)}" alt=""><span><strong>${data.escape(product.name)}</strong><small>${data.escape(product.style)}<br>${data.money(product.price)}</small></span></button>`).join('');
  }
  byId('search-toggle').addEventListener('click', () => {
    renderSearch();
    search.showModal();
    input.focus();
  });
  input.addEventListener('input', renderSearch);
  byId('search-results').addEventListener('click', event => {
    const result = event.target.closest('[data-search-product]');
    if (!result) return;
    search.close();
    window.showDetails(result.dataset.searchProduct);
  });
})();

