// ===========================================================
// SAM WATTS — interactions
// ===========================================================
document.addEventListener('DOMContentLoaded', () => {

  // year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ----- Admin-configured news (announcements) from localStorage -----
  try {
    const items = JSON.parse(localStorage.getItem('samwatts-news') || 'null');
    if (items && items.length) {
      const grid = document.querySelector('.news-grid');
      if (grid) {
        grid.innerHTML = '';
        items.forEach(n => {
          const art = document.createElement('article');
          art.className = 'news-card burnt-card';
          art.innerHTML = `
            <p class="news-date">${(n.date||'').replace(/[<>]/g,'')}</p>
            <h3 class="news-headline">${(n.title||'').replace(/[<>]/g,'')}</h3>
            <p class="news-body">${(n.body||'').replace(/[<>]/g,'')}</p>`;
          grid.appendChild(art);
        });
      }
    }
  } catch {}

  // ----- Admin-configured polaroids from localStorage -----
  try {
    const pols = JSON.parse(localStorage.getItem('samwatts-polaroids') || 'null');
    if (pols && pols.length) {
      const list = document.getElementById('polaroidList');
      if (list) {
        const tapeRots = ['-5','3','-2','6','-4','2','-6','5'];
        list.innerHTML = '';
        pols.slice(0, 8).forEach((p, i) => {
          const isVid = p.type === 'video';
          const thumb = p.thumb || (p.images && p.images[0]) || '';
          const videoSrc = p.videos && p.videos[0] || '';
          const fullsrc = isVid ? videoSrc : (p.images && p.images[0]) || thumb;
          const li = document.createElement('li');
          li.className = `polaroid p${i+1}`;
          li.setAttribute('tabindex', '0');
          li.dataset.type = p.type;
          li.dataset.caption = p.caption || '';
          li.dataset.date = p.date || '';
          li.dataset.fullsrc = fullsrc;
          if (isVid) {
            li.dataset.video = videoSrc;
            li.dataset.poster = thumb;
          }
          li.innerHTML = `
            <span class="polaroid-tape" style="--tape-r:${tapeRots[i]||0}deg"></span>
            <div class="polaroid-frame">
              <img class="polaroid-photo" src="${thumb.replace(/"/g,'&quot;')}" loading="lazy" alt="${(p.caption||'').replace(/[<>"]/g,'')}">
              ${isVid ? '<span class="polaroid-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>' : ''}
            </div>
            <p class="polaroid-caption">${(p.caption||'').replace(/[<>]/g,'')}</p>`;
          list.appendChild(li);
        });
      }
    }
  } catch {}

  // -------- mobile nav --------
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      const spans = toggle.querySelectorAll('span');
      const open = links.classList.contains('open');
      spans[0].style.transform = open ? 'rotate(45deg) translateY(6px)'  : '';
      spans[1].style.opacity   = open ? '0' : '1';
      spans[2].style.transform = open ? 'rotate(-45deg) translateY(-6px)' : '';
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      links.classList.remove('open');
      const spans = toggle.querySelectorAll('span');
      spans[0].style.transform = ''; spans[1].style.opacity = '1'; spans[2].style.transform = '';
    }));
  }

  // -------- hero unmute overlay --------
  const heroFrame = document.querySelector('.video-frame');
  const heroVideo = heroFrame?.querySelector('video');
  const unmuteBtn = document.getElementById('unmuteBtn');
  if (unmuteBtn && heroVideo) {
    unmuteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      heroVideo.muted = false;
      heroVideo.volume = 1;
      heroVideo.play().catch(() => {});
      unmuteBtn.classList.add('hidden');
      sessionStorage.setItem('sw-sound', '1');
    });
    if (sessionStorage.getItem('sw-sound') === '1') {
      heroVideo.muted = false;
      unmuteBtn.classList.add('hidden');
    }
  }

  // -------- polaroid section: hover-to-play (desktop) / tap-to-modal (mobile) --------
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const polaroids = Array.from(document.querySelectorAll('.polaroid[data-caption]'));

  polaroids.forEach(card => {
    const isVideo = card.dataset.type === 'video';

    if (canHover && isVideo) {
      // lazy-mount <video> on first hover; unmount on leave to save memory
      let mounted = null;
      card.addEventListener('pointerenter', () => {
        if (!mounted) {
          mounted = document.createElement('video');
          mounted.src = card.dataset.video;
          mounted.muted = true;
          mounted.loop = true;
          mounted.playsInline = true;
          mounted.preload = 'auto';
          mounted.setAttribute('playsinline', '');
          card.querySelector('.polaroid-frame').appendChild(mounted);
        }
        mounted.currentTime = 0;
        const p = mounted.play();
        if (p && p.catch) p.catch(() => {});
        card.classList.add('playing');
      });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('playing');
        if (mounted) { mounted.pause(); mounted.currentTime = 0; }
      });
    }

    // tap / click / enter → open lightbox
    const open = () => openLightbox(polaroids.indexOf(card));
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  // -------- LIGHTBOX --------
  const lb        = document.getElementById('lightbox');
  const lbStage   = document.getElementById('lbStage');
  const lbCaption = document.getElementById('lbCaption');
  const lbClose   = document.getElementById('lbClose');
  const lbPrev    = document.getElementById('lbPrev');
  const lbNext    = document.getElementById('lbNext');
  const lbSound   = document.getElementById('lbSound');
  const lbSoundL  = document.getElementById('lbSoundLabel');

  let lbIndex = 0;
  let lbSoundOn = sessionStorage.getItem('sw-sound') === '1';

  function renderSoundState() {
    if (!lbSound) return;
    lbSound.setAttribute('aria-pressed', lbSoundOn ? 'true' : 'false');
    if (lbSoundL) lbSoundL.textContent = lbSoundOn ? 'sound on' : 'sound off';
  }

  function openLightbox(index) {
    if (!lb) return;
    lbIndex = index;
    renderLightbox();
    lb.setAttribute('data-open', 'true');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderSoundState();
  }

  function closeLightbox() {
    if (!lb) return;
    lb.removeAttribute('data-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lbStage.innerHTML = '';
  }

  function renderLightbox() {
    const card = polaroids[lbIndex];
    if (!card) return;
    const isVideo = card.dataset.type === 'video';
    const cap = card.dataset.caption || '';
    const date = card.dataset.date || '';
    lbCaption.textContent = cap + (date ? `  ·  ${date}` : '');

    lbStage.innerHTML = '';
    if (isVideo) {
      const v = document.createElement('video');
      v.src = card.dataset.video;
      v.controls = true;
      v.autoplay = true;
      v.loop = true;
      v.muted = !lbSoundOn;
      v.volume = 1;
      v.playsInline = true;
      v.poster = card.dataset.poster || '';
      lbStage.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.src = card.dataset.fullsrc;
      img.alt = cap;
      lbStage.appendChild(img);
    }
  }

  function step(delta) {
    lbIndex = (lbIndex + delta + polaroids.length) % polaroids.length;
    renderLightbox();
  }

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbPrev)  lbPrev.addEventListener('click', () => step(-1));
  if (lbNext)  lbNext.addEventListener('click', () => step(1));
  if (lbSound) lbSound.addEventListener('click', () => {
    lbSoundOn = !lbSoundOn;
    sessionStorage.setItem('sw-sound', lbSoundOn ? '1' : '0');
    const v = lbStage?.querySelector('video');
    if (v) v.muted = !lbSoundOn;
    // also update hero video
    if (heroVideo) heroVideo.muted = !lbSoundOn;
    if (unmuteBtn && lbSoundOn) unmuteBtn.classList.add('hidden');
    renderSoundState();
  });

  // backdrop click closes
  if (lb) lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });

  // keyboard nav
  document.addEventListener('keydown', (e) => {
    if (lb?.getAttribute('data-open') !== 'true') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft')  step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  // swipe / drag nav
  let startX = 0, startY = 0, tracking = false;
  if (lb) {
    lb.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.lb-btn')) return;
      startX = e.clientX; startY = e.clientY; tracking = true;
    });
    lb.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        step(dx < 0 ? 1 : -1);
      } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
        closeLightbox(); // swipe down
      }
    });
  }

  // -------- OATH: swear checkbox → modal → success step --------
  const swearEl    = document.getElementById('oathSwear');
  const nextBtn    = document.getElementById('oathNextBtn');
  const oathForm   = document.getElementById('oathForm');
  const oathModal  = document.getElementById('oathModal');
  const oathClose  = document.getElementById('oathModalClose');
  const oathSteps  = document.querySelectorAll('.oath-step');

  const showStep = (n) => {
    oathSteps.forEach(s => s.toggleAttribute('data-active', Number(s.dataset.step) === n));
  };
  const openOathModal = () => {
    if (!oathModal) return;
    oathModal.setAttribute('data-open', 'true');
    oathModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => oathModal.querySelector('input[name=name]')?.focus(), 100);
  };
  const closeOathModal = () => {
    if (!oathModal) return;
    oathModal.removeAttribute('data-open');
    oathModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  if (swearEl && nextBtn) {
    swearEl.addEventListener('change', () => nextBtn.disabled = !swearEl.checked);
    nextBtn.addEventListener('click', () => {
      if (!swearEl.checked) return;
      openOathModal();
    });
  }
  if (oathClose) oathClose.addEventListener('click', closeOathModal);
  if (oathModal) {
    oathModal.addEventListener('click', (e) => { if (e.target === oathModal) closeOathModal(); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && oathModal?.getAttribute('data-open') === 'true') closeOathModal();
  });

  if (oathForm) {
    oathForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(oathForm).entries());
      if (!data.name || !data.email || !data.password) return;
      localStorage.setItem('samwatts-m8', JSON.stringify({
        name: data.name.trim(),
        email: data.email.trim(),
        phone: (data.phone || '').trim(),
        sworn_at: new Date().toISOString(),
      }));
      // straight to the dashboard — no extra confirm step
      window.location.href = 'dashboard.html';
    });
  }

  // -------- LOGIN (nav button → modal → dashboard) --------
  const loginOpen  = document.getElementById('loginOpen');
  const loginModal = document.getElementById('loginModal');
  const loginClose = document.getElementById('loginClose');
  const loginForm  = document.getElementById('loginForm');
  const openLogin  = () => { if (!loginModal) return; loginModal.setAttribute('data-open', 'true'); document.body.style.overflow = 'hidden'; setTimeout(() => loginModal.querySelector('input')?.focus(), 100); };
  const closeLogin = () => { if (!loginModal) return; loginModal.removeAttribute('data-open'); document.body.style.overflow = ''; };
  if (loginOpen)  loginOpen.addEventListener('click', (e) => { e.preventDefault(); openLogin(); });
  if (loginClose) loginClose.addEventListener('click', closeLogin);
  if (loginModal) loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeLogin(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && loginModal?.getAttribute('data-open') === 'true') closeLogin();
  });
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(loginForm).entries());
      if (!data.email || !data.password) return;
      // demo: accept any email/password, seed the m8 record if missing
      const existing = JSON.parse(localStorage.getItem('samwatts-m8') || 'null');
      if (!existing) {
        localStorage.setItem('samwatts-m8', JSON.stringify({
          name: data.email.trim().split('@')[0],
          email: data.email.trim(),
          phone: '',
          sworn_at: new Date().toISOString(),
        }));
      }
      window.location.href = 'dashboard.html';
    });
  }

  // -------- pause any playing polaroid video when off-screen --------
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      const v = e.target.querySelector('video');
      if (!v) return;
      if (e.isIntersecting) {
        if (!v.paused && canHover) return;
      } else {
        v.pause();
        e.target.classList.remove('playing');
      }
    });
  }, { threshold: 0.25 });
  polaroids.forEach(p => io.observe(p));

  // -------- fade-up cards --------
  const io2 = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = e.target.dataset.initialTransform || '';
        io2.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.news-card, .res-card, .social-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(14px)';
    el.style.transition = 'opacity .5s ease, transform .5s ease';
    io2.observe(el);
  });
});
