/* Sands & Vows prototype — shared behaviour. No libraries: every interaction
   here is CSS transitions + IntersectionObserver, so the site stays fast on phones. */
(function () {
  const doc = document.documentElement;
  doc.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const page = document.body.dataset.page || '';
  const WA = 'https://wa.me/918188881165?text=' + encodeURIComponent('Hi Sands & Vows, we are planning something in Goa and would like to check your availability.');

  const icon = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 8h18M3 16h18"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg>',
    chev: '<svg viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m1 1 5 5 5-5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 5v3M4.9 9.9l2 2M19.1 9.9l-2 2"/></svg>'
  };

  const nav = [
    ['weddings.html', 'Weddings', 'weddings'],
    ['pre-wedding.html', 'Pre-Weddings', 'prewed'],
    ['couples.html', 'Couples', 'couples'],
    ['corporate.html', 'Corporate', 'corporate'],
    ['index.html#goa', 'Our Goa', 'goa', 'hide-md']
  ];
  const more = [
    ['index.html#experiences', 'Celebrations', 'Birthdays, anniversaries, private parties', 'birthday'],
    ['index.html#experiences', 'Maternity & Family', 'Unhurried sessions at home or by the sea', 'family'],
    ['index.html#films', 'Films', 'Wedding films, reels and event edits', 'sea-arch'],
    ['index.html#pricing', 'Pricing', 'Starting prices for every experience', 'venue-lawn-web'],
    ['index.html#about', 'About us', 'The Goa team behind the camera', 'groom-white'],
    ['availability.html', 'Availability', 'Tell us your dates and we will reply on WhatsApp', 'sea-arch']
  ];

  /* ---------- Chrome: header, mobile sheet, action bar, footer ---------- */
  const hdr = document.createElement('header');
  hdr.className = 'hdr' + (document.body.dataset.hdr === 'light' ? ' solid' : '');
  hdr.innerHTML = `
    <div class="wrap">
      <a class="logo" href="index.html" aria-label="Sands & Vows home"><b>Sands <em>&amp;</em> Vows</b><small>Goa · Photography &amp; Films</small></a>
      <nav class="nav" aria-label="Main">
        ${nav.map(([h, t, k, c]) => `<a href="${h}" class="${c || ''}" ${k === page ? 'aria-current="page"' : ''}>${t}</a>`).join('')}
        <div class="more"><button type="button" aria-expanded="false" aria-haspopup="true">More ${icon.chev}</button>
          <div class="more-panel" role="menu">${more.map(([h, t, d, img]) => `<a role="menuitem" href="${h}"><img src="assets/img/${img}.jpg" alt="" width="64" height="64" loading="lazy"><div><b>${t}</b><span>${d}</span></div></a>`).join('')}</div>
        </div>
      </nav>
      <div class="hdr-cta">
        <a class="btn" href="availability.html">Book us</a>
        <button class="icon-btn menu-btn" type="button" aria-label="Open menu" aria-expanded="false">${icon.menu}</button>
      </div>
    </div>`;
  document.body.prepend(hdr);
  const bar = document.createElement('div'); bar.className = 'day-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.prepend(bar);
  const skip = document.createElement('a'); skip.className = 'skip'; skip.href = '#main'; skip.textContent = 'Skip to content';
  document.body.prepend(skip);

  const sheet = document.createElement('div');
  sheet.className = 'sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Menu');
  sheet.innerHTML = `
    <div class="sheet-top"><a class="logo" href="index.html"><b>Sands <em>&amp;</em> Vows</b><small>Goa · Photography &amp; Films</small></a>
      <button class="icon-btn sheet-x" type="button" aria-label="Close menu">${icon.x}</button></div>
    <nav aria-label="Mobile">
      <a href="weddings.html">Weddings <small>Multi-day</small></a>
      <a href="pre-wedding.html">Pre-Weddings <small>Across Goa</small></a>
      <a href="couples.html">Couples <small>60–120 min</small></a>
      <a href="corporate.html">Corporate <small>Offsites · events</small></a>
      <a href="index.html#goa">Our Goa <small>Locations</small></a>
    </nav>
    <div class="sub"><a href="index.html#experiences">Celebrations</a><a href="index.html#experiences">Maternity &amp; Family</a><a href="index.html#films">Films</a><a href="index.html#pricing">Pricing</a><a href="index.html#about">About</a></div>
    <div class="foot">
      <a class="btn block" href="availability.html">Book us <span class="arr">→</span></a>
      <a class="wa" style="justify-content:center;min-height:52px;color:var(--shell)" href="${WA}" target="_blank" rel="noopener">${icon.wa} WhatsApp +91 81888 81165</a>
    </div>`;
  document.body.appendChild(sheet);

  if (page !== 'availability') {
    const mbar = document.createElement('div'); mbar.className = 'mbar';
    mbar.innerHTML = `<a class="btn" href="availability.html">Book us <span class="arr">→</span></a>`;
    document.body.appendChild(mbar); document.body.classList.add('has-mbar');
    const hero = $('.hero');
    const showBar = () => mbar.classList.toggle('show', scrollY > (hero ? hero.offsetHeight * .7 : 300) && !nearFooter());
    const nearFooter = () => { const f = $('.ftr'); return f && f.getBoundingClientRect().top < innerHeight - 40; };
    addEventListener('scroll', showBar, { passive: true }); showBar();
  }

  const waf = document.createElement('a'); waf.className = 'wa-float'; waf.href = WA; waf.target = '_blank'; waf.rel = 'noopener';
  waf.setAttribute('aria-label', 'Chat with us on WhatsApp'); waf.innerHTML = icon.wa;
  document.body.appendChild(waf);

  const ftr = document.createElement('footer'); ftr.className = 'ftr';
  ftr.innerHTML = `
    <div class="wrap">
      <p class="big">Come to Goa.<br><em>Leave with the story.</em></p>
      <div class="row" style="margin-top:36px;gap:14px 28px"><a class="btn" href="availability.html">Book us <span class="arr">→</span></a><a class="wa" href="${WA}" target="_blank" rel="noopener">${icon.wa} WhatsApp us</a></div>
      <div class="cols">
        <div>
          <h4>Goa studio</h4>
          <p style="font-size:15px;line-height:1.7;color:#e5ddd0;max-width:30ch">House No. 1053 A, Morjim,<br>North Goa 403512</p>
          <p style="margin-top:14px;font-size:15px;color:#e5ddd0">Phone / WhatsApp <a class="sel num" href="tel:+918188881165">+91 81888 81165</a></p>
          <p style="font-size:15px;color:#e5ddd0">Email <a class="sel" href="mailto:sandsandvows@pkphotography.in">sandsandvows@pkphotography.in</a></p>
        </div>
        <div><h4>Experiences</h4><ul>
          <li><a href="weddings.html">Destination weddings</a></li><li><a href="pre-wedding.html">Pre-wedding shoots</a></li>
          <li><a href="couples.html">Couples &amp; honeymoons</a></li><li><a href="couples.html">Proposals</a></li>
          <li><a href="corporate.html">Corporate offsites</a></li><li><a href="index.html#experiences">Birthdays &amp; anniversaries</a></li>
          <li><a href="index.html#experiences">Maternity &amp; family</a></li></ul></div>
        <div><h4>Goa, by area</h4><ul>
          <li><a href="index.html#goa">Explore the Goa coast</a></li><li><a href="pre-wedding.html#moods">Find your location</a></li><li><a href="availability.html">Plan a route with us</a></li></ul></div>
        <div><h4>Plan</h4><ul>
          <li><a href="index.html#pricing">Pricing</a></li><li><a href="index.html#films">Films</a></li><li><a href="privacy.html">Privacy</a></li>
          <li><a href="weddings.html#faq">Questions</a></li><li><a href="index.html#about">About</a></li><li><a href="https://pikconnect.com/" target="_blank" rel="noopener">Client galleries ↗</a></li></ul></div>
        <div><h4>Start a conversation</h4><ul><li><a href="availability.html">Plan your celebration →</a></li><li><a href="${WA}" target="_blank" rel="noopener">Chat on WhatsApp ↗</a></li></ul></div>
      </div>
      <div class="base">
        <div class="family">A studio of <a href="https://pkphotography.in/" target="_blank" rel="noopener">PK Photography</a> · Galleries by <a href="https://pikconnect.com/" target="_blank" rel="noopener">PIK Connect</a></div>
        <div>© 2026 Sands &amp; Vows</div>
      </div>
    </div>`;
  document.body.appendChild(ftr);
  /* ---------- Homepage: in-page links (index.html#x) scroll instead of reloading ---------- */
  const onHome = page === 'home' || location.pathname === '/' || location.pathname === '/index.html';
  if (onHome) {
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href^="index.html#"]');
      if (!a || (a.target && a.target !== '_self')) return;
      const id = decodeURIComponent(a.getAttribute('href').slice('index.html#'.length));
      const el = id && document.getElementById(id);
      if (!el || el.closest('[hidden]')) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (history.pushState) history.pushState(null, '', '#' + id);
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    });
  }

  /* ---------- Header behaviour ---------- */
  const heroEl = $('.hero');
  const alwaysSolid = document.body.dataset.hdr === 'light';
  let lastY = scrollY;
  function onScroll() {
    const y = scrollY;
    if (!alwaysSolid) hdr.classList.toggle('solid', y > (heroEl ? heroEl.offsetHeight - 90 : 40));
    hdr.classList.toggle('hide', y > 400 && y > lastY + 4 && !sheet.hasAttribute('data-open'));
    if (y < lastY - 4) hdr.classList.remove('hide');
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const moreEl = $('.more', hdr), moreBtn = $('.more > button', hdr);
  const setMore = (o) => { o ? moreEl.setAttribute('data-open', '') : moreEl.removeAttribute('data-open'); moreBtn.setAttribute('aria-expanded', o); };
  moreBtn.addEventListener('click', (e) => { e.stopPropagation(); setMore(!moreEl.hasAttribute('data-open')); });
  moreEl.addEventListener('mouseenter', () => matchMedia('(hover:hover)').matches && setMore(true));
  moreEl.addEventListener('mouseleave', () => matchMedia('(hover:hover)').matches && setMore(false));
  document.addEventListener('click', () => setMore(false));

  const menuBtn = $('.menu-btn', hdr);
  let dialogReturn = null;
  function containDialog(dialog, open) {
    if (open) dialogReturn = document.activeElement;
    Array.from(document.body.children).forEach(el => {
      if (el !== dialog && !['SCRIPT', 'STYLE'].includes(el.tagName)) el.inert = open;
    });
    if (!open && dialogReturn && dialogReturn.isConnected) dialogReturn.focus();
  }
  document.addEventListener('keydown', e => {
    const activeDialog = $('.sheet[data-open], .modal[data-open]');
    if (!activeDialog || e.key !== 'Tab') return;
    const focusable = $$('a[href], button, video[controls], [tabindex="0"]', activeDialog).filter(el => !el.disabled && el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  const openSheet = (o) => {
    containDialog(sheet, o);
    o ? sheet.setAttribute('data-open', '') : sheet.removeAttribute('data-open');
    menuBtn.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : '';
    if (o) setTimeout(() => $('.sheet-x', sheet).focus(), 50); else menuBtn.focus();
  };
  menuBtn.addEventListener('click', () => openSheet(true));
  $('.sheet-x', sheet).addEventListener('click', () => openSheet(false));
  $$('a', sheet).forEach(a => a.addEventListener('click', () => openSheet(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (sheet.hasAttribute('data-open')) openSheet(false); setMore(false); closeModal(); } });

  /* ---------- Reveal on scroll (visible at rest if JS/IO absent) ---------- */
  const io = 'IntersectionObserver' in window && !reduce ? new IntersectionObserver((es) => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); e.target.classList.remove('pending'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  $$('.reveal, .reveal-img').forEach(el => {
    if (!io) { el.classList.add('in'); return; }
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight) { el.classList.add('in'); return; }
    if (el.classList.contains('reveal-img')) el.classList.add('pending');
    io.observe(el);
  });

  /* ---------- Hero crossfade ---------- */
  const slides = $$('.hero .slides figure');
  if (slides.length > 1) {
    const dots = $$('.hero-dots button'), caps = $$('.hero [data-cap]');
    let i = 0, timer;
    const go = (n) => {
      slides[i].classList.remove('on'); dots[i] && dots[i].setAttribute('aria-current', 'false'); caps[i] && (caps[i].hidden = true);
      i = (n + slides.length) % slides.length;
      slides[i].classList.add('on'); dots[i] && dots[i].setAttribute('aria-current', 'true'); caps[i] && (caps[i].hidden = false);
      const img = $('img', slides[(i + 1) % slides.length]); if (img) img.loading = 'eager';
    };
    const play = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => go(i + 1), 6500); };
    dots.forEach((d, n) => d.addEventListener('click', () => { go(n); play(); }));
    document.addEventListener('visibilitychange', () => document.hidden ? clearInterval(timer) : play());
    play();
  }

  /* ---------- Hero film: defer a large cinematic asset until the visitor asks for it ---------- */
  const hv = $('.hero-video');
  if (hv) {
    const pb = $('.hero-pause');
    const loadHeroFilm = () => {
      const portrait = matchMedia('(max-width: 860px) and (orientation: portrait)').matches;
      if (!hv.src) hv.src = portrait ? hv.dataset.mobile : hv.dataset.desktop;
      hv.play().catch(() => {});
      if (pb) { pb.innerHTML = '<i>❚❚</i>Pause film'; pb.setAttribute('aria-pressed', 'true'); }
    };
    if (pb) {
      pb.removeAttribute('hidden'); pb.innerHTML = '<i>▶</i>Play film'; pb.setAttribute('aria-pressed', 'false');
      pb.addEventListener('click', () => {
        if (!hv.src || hv.paused) { delete hv.dataset.paused; loadHeroFilm(); }
        else { hv.pause(); hv.dataset.paused = '1'; pb.innerHTML = '<i>▶</i>Play film'; pb.setAttribute('aria-pressed', 'false'); }
      });
    }
    if (reduce || saveData) { hv.removeAttribute('autoplay'); if (pb) pb.hidden = true; }
    document.addEventListener('visibilitychange', () => document.hidden ? hv.pause() : (!hv.dataset.paused && hv.src && hv.play().catch(() => {})));
  }

  /* ---------- Sticky chapters ---------- */
  const chapters = $$('.chapters li');
  chapters.forEach((chapter, n) => {
    const frame = $(`[data-ch="${n}"]`);
    if (!frame) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chapter-link';
    b.innerHTML = chapter.innerHTML; chapter.replaceChildren(b);
    b.addEventListener('click', () => frame.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }));
  });
  if (chapters.length && 'IntersectionObserver' in window) {
    const cio = new IntersectionObserver((es) => es.forEach(e => {
      if (e.isIntersecting) { const n = +e.target.dataset.ch; chapters.forEach((c, k) => c.classList.toggle('on', k === n));
        const on = chapters[n]; if (on && innerWidth < 860) on.parentElement.scrollTo({ left: on.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' }); }
    }), { rootMargin: '-45% 0px -45% 0px' });
    $$('[data-ch]').forEach(f => cio.observe(f));
  }

  /* ---------- Goa coast: cards ↔ pins ---------- */
  const places = $$('.place[data-pin]'), pins = $$('.coast-map .pin');
  const lightPin = (k) => pins.forEach(p => p.classList.toggle('on', p.dataset.pin === k));
  places.forEach(p => { p.addEventListener('mouseenter', () => lightPin(p.dataset.pin)); p.addEventListener('focusin', () => lightPin(p.dataset.pin)); });
  const scroller = $('.places');
  if (scroller) {
    $$('[data-scroll]').forEach(b => b.addEventListener('click', () => scroller.scrollBy({ left: +b.dataset.scroll * (scroller.clientWidth * .8), behavior: reduce ? 'auto' : 'smooth' })));
    scroller.addEventListener('scroll', () => {
      const x = scroller.getBoundingClientRect().left; let best = null, d = 1e9;
      places.forEach(p => { const dd = Math.abs(p.getBoundingClientRect().left - x); if (dd < d) { d = dd; best = p; } });
      best && lightPin(best.dataset.pin);
    }, { passive: true });
  }

  /* ---------- Story cursor ---------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const tag = document.createElement('div'); tag.className = 'cursor-tag'; tag.setAttribute('aria-hidden', 'true'); tag.textContent = 'View story';
    document.body.appendChild(tag);
    let x = 0, y = 0, raf;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(() => { tag.style.left = x + 'px'; tag.style.top = y + 'px'; raf = 0; }); }, { passive: true });
    $$('.story-card').forEach(c => { c.addEventListener('mouseenter', () => tag.classList.add('on')); c.addEventListener('mouseleave', () => tag.classList.remove('on')); });
  } else { $$('.story-card').forEach(c => c.style.cursor = 'pointer'); }

  /* ---------- Film: muted preview in view, full film in a modal ---------- */
  const modal = document.createElement('div'); modal.className = 'modal'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Film');
  modal.innerHTML = `<button class="x" type="button" aria-label="Close film">${icon.x}</button><video controls playsinline preload="none"></video>`;
  document.body.appendChild(modal);
  const mv = $('video', modal);
  function closeModal() { if (!modal.hasAttribute('data-open')) return; mv.pause(); modal.removeAttribute('data-open'); document.body.style.overflow = ''; containDialog(modal, false); }
  $('.x', modal).addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  $$('.film').forEach(f => {
    f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.click(); } });
    const v = $('video', f);
    if (v && 'IntersectionObserver' in window && !reduce && !saveData) {
      new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); } else v.pause();
      }), { threshold: .35 }).observe(f);
    }
    f.addEventListener('click', () => {
      containDialog(modal, true);
      mv.src = f.dataset.film; mv.poster = f.dataset.poster || '';
      modal.setAttribute('data-open', ''); document.body.style.overflow = 'hidden';
      mv.play().catch(() => {}); $('.x', modal).focus();
      if (mv.requestFullscreen && innerWidth < 860) mv.requestFullscreen().catch(() => {});
    });
  });
  $$('.film-list button').forEach(b => b.addEventListener('click', () => {
    $$('.film-list button').forEach(x => x.setAttribute('aria-current', x === b));
    const f = $('.film'); f.dataset.film = b.dataset.film; $('.film .cap .h4').textContent = b.dataset.title;
    const preview = $('video', f); if (preview) { preview.pause(); preview.src = b.dataset.film; if (!reduce && !saveData) preview.play().catch(() => {}); }
    const stamp = $('.cap .stamp', f); if (stamp) stamp.textContent = $('span', b).textContent;
  }));

  /* ---------- Testimonials ---------- */
  const tbtn = $$('.testi-nav button'), tsl = $$('.testi-slide');
  tbtn.forEach((b, n) => {
    b.id = `testimonial-tab-${n}`; b.setAttribute('aria-controls', `testimonial-panel-${n}`);
    b.setAttribute('aria-selected', n === 0); b.tabIndex = n === 0 ? 0 : -1;
    if (tsl[n]) { tsl[n].id = `testimonial-panel-${n}`; tsl[n].setAttribute('role', 'tabpanel'); tsl[n].setAttribute('aria-labelledby', b.id); }
    b.addEventListener('click', () => tbtn.forEach((x, k) => { x.setAttribute('aria-selected', k === n); x.tabIndex = k === n ? 0 : -1; }));
    b.addEventListener('keydown', e => {
      let next;
      if (e.key === 'ArrowRight') next = (n + 1) % tbtn.length;
      if (e.key === 'ArrowLeft') next = (n - 1 + tbtn.length) % tbtn.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tbtn.length - 1;
      if (next !== undefined) { e.preventDefault(); tbtn[next].click(); tbtn[next].focus(); }
    });
  });
  tbtn.forEach((b, n) => b.addEventListener('click', () => { tbtn.forEach((x, k) => x.setAttribute('aria-current', k === n)); tsl.forEach((s, k) => s.hidden = k !== n); }));

  /* ---------- Toggle chips (generic) ---------- */
  $$('[data-group]').forEach(g => $$('[aria-pressed]', g).forEach(b => b.addEventListener('click', () => {
    if (g.dataset.multi === undefined) $$('[aria-pressed]', g).forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', g.dataset.multi !== undefined ? String(b.getAttribute('aria-pressed') !== 'true') : 'true');
    g.dispatchEvent(new CustomEvent('pick', { detail: b.dataset.v }));
  })));

  /* ---------- Golden hour: approximate Goa sunset for any date ---------- */
  window.SV = window.SV || {};
  SV.sunset = function (dateStr) {
    const d = new Date(dateStr + 'T12:00:00'); if (isNaN(d)) return null;
    const start = new Date(d.getFullYear(), 0, 0), doy = Math.floor((d - start) / 864e5);
    // Goa (15.5°N): earliest sunset ≈ 17:58 (late Nov), latest ≈ 19:12 (late Jun)
    const h = 18.58 + 0.60 * Math.sin(2 * Math.PI * (doy - 81) / 365) + 0.07 * Math.sin(4 * Math.PI * (doy - 20) / 365);
    const fmt = (x) => { let hh = Math.floor(x), mm = Math.round((x - hh) * 60); if (mm === 60) { hh++; mm = 0; } return `${hh > 12 ? hh - 12 : hh}:${String(mm).padStart(2, '0')} pm`; };
    const monsoon = [6, 7, 8].includes(d.getMonth()) || (d.getMonth() === 5 && d.getDate() > 7);
    return { sunset: fmt(h), golden: fmt(h - 0.75), monsoon, label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
  };
  SV.sunIcon = icon.sun; SV.WA = WA; SV.waIcon = icon.wa;
  $$('[data-sun]').forEach(inp => {
    const out = $(inp.dataset.sun);
    const upd = () => { const s = SV.sunset(inp.value); if (!out) return;
      out.innerHTML = s ? `${icon.sun}<span>Golden hour on ${s.label} starts around <b>${s.golden}</b>; sunset ≈ ${s.sunset}.${s.monsoon ? ' Monsoon season: we plan covered back-ups.' : ''}</span>` : ''; };
    inp.addEventListener('input', upd); upd();
  });

  /* ---------- Quick availability (home / CTA bands) → full form ---------- */
  const serviceType = { weddings: 'Destination wedding', prewed: 'Pre-wedding shoot', couples: 'Couple / honeymoon / proposal', corporate: 'Corporate offsite / event' };
  $$('a[href="availability.html"]').forEach(a => a.addEventListener('click', () => {
    const data = { type: serviceType[page] || '', from: location.pathname };
    const length = $('.lengths [aria-pressed="true"] .m');
    if (length) data.length = length.textContent.replace(/\s/g, '').replace('min', '');
    try { sessionStorage.setItem('sv-prefill', JSON.stringify(data)); } catch (_) {}
  }));
  $$('form.quick').forEach(f => f.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.assign(Object.fromEntries(new FormData(f)), { from: location.pathname });
    try { sessionStorage.setItem('sv-prefill', JSON.stringify(data)); } catch (_) {}
    location.href = 'availability.html';
  }));
})();
