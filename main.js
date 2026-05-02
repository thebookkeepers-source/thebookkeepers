/* ============================================================
   TheBookkeepers — main.js
   Frontend logic: nav, animations, form submission via fetch()
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Announcement bar close ── */
  const closeBar = document.getElementById('closeBar');
  const annBar   = document.getElementById('announcementBar');
  if (closeBar && annBar) {
    closeBar.addEventListener('click', () => {
      annBar.style.maxHeight = '0';
      annBar.style.opacity   = '0';
      annBar.style.padding   = '0';
      annBar.style.overflow  = 'hidden';
    });
  }

  /* ── Navbar scroll shadow ── */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });

  /* ── Mobile hamburger ── */
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
      document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
    });
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ── Smooth scroll ── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = navbar ? navbar.offsetHeight + 8 : 70;
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
      }
    });
  });

  /* ── Scroll reveal ── */
  const revealEls = document.querySelectorAll(
    '.service-card,.feature-item,.stat-card,.pillar,.testimonial-card,.section-header'
  );
  revealEls.forEach(el => {
    el.classList.add('reveal');
    const siblings = [...el.parentElement.children].filter(c => c.classList.contains(el.classList[0]));
    const idx = siblings.indexOf(el);
    if (idx > 0) el.classList.add('reveal-delay-' + Math.min(idx, 4));
  });
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => revealObs.observe(el));

  /* ── Counter animation ── */
  const statNums = document.querySelectorAll('.stat-number[data-target]');
  const countObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const el     = e.target;
        const target = parseInt(el.getAttribute('data-target'), 10);
        const start  = performance.now();
        const tick   = now => {
          const p      = Math.min((now - start) / 2000, 1);
          const eased  = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(eased * target);
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = target;
        };
        requestAnimationFrame(tick);
        countObs.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  statNums.forEach(el => countObs.observe(el));

  /* ══════════════════════════════════════════
     CONTACT FORM — fetch() submission
  ══════════════════════════════════════════ */

  const formBtn      = document.getElementById('formBtn');
  const btnText      = document.getElementById('btn-text');
  const btnSpinner   = document.getElementById('btn-spinner');
  const successBanner = document.getElementById('form-success');
  const errorBanner  = document.getElementById('form-error');
  const errorText    = document.getElementById('form-error-text');

  const fields = {
    name:    { el: document.getElementById('f-name'),    err: document.getElementById('err-name') },
    email:   { el: document.getElementById('f-email'),   err: document.getElementById('err-email') },
    service: { el: document.getElementById('f-service'), err: document.getElementById('err-service') },
    msg:     { el: document.getElementById('f-msg'),     err: document.getElementById('err-msg') },
  };

  /* Live clear errors on input */
  Object.values(fields).forEach(({ el, err }) => {
    el.addEventListener('input', () => {
      el.classList.remove('error');
      err.textContent = '';
    });
  });

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validate() {
    let ok = true;

    if (!fields.name.el.value.trim()) {
      fields.name.el.classList.add('error');
      fields.name.err.textContent = 'Full name is required.';
      ok = false;
    }

    if (!fields.email.el.value.trim()) {
      fields.email.el.classList.add('error');
      fields.email.err.textContent = 'Email address is required.';
      ok = false;
    } else if (!validateEmail(fields.email.el.value.trim())) {
      fields.email.el.classList.add('error');
      fields.email.err.textContent = 'Please enter a valid email address.';
      ok = false;
    }

    if (!fields.service.el.value) {
      fields.service.el.classList.add('error');
      fields.service.err.textContent = 'Please select a service.';
      ok = false;
    }

    if (!fields.msg.el.value.trim()) {
      fields.msg.el.classList.add('error');
      fields.msg.err.textContent = 'Please tell us about your needs.';
      ok = false;
    }

    return ok;
  }

  function setLoading(loading) {
    formBtn.disabled   = loading;
    btnText.style.display    = loading ? 'none' : 'inline';
    btnSpinner.style.display = loading ? 'inline' : 'none';
  }

  function showSuccess() {
    successBanner.style.display = 'flex';
    errorBanner.style.display   = 'none';
    // Reset fields
    Object.values(fields).forEach(({ el }) => { el.value = ''; });
    // Scroll form into view
    successBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Hide after 6 seconds
    setTimeout(() => { successBanner.style.display = 'none'; }, 6000);
  }

  function showError(msg) {
    errorText.textContent       = msg || 'Something went wrong. Please try again.';
    errorBanner.style.display   = 'flex';
    successBanner.style.display = 'none';
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (formBtn) {
    formBtn.addEventListener('click', async () => {
      // Hide previous banners
      successBanner.style.display = 'none';
      errorBanner.style.display   = 'none';

      if (!validate()) return;

      setLoading(true);

      const payload = {
        fullName: fields.name.el.value.trim(),
        email:    fields.email.el.value.trim(),
        service:  fields.service.el.value,
        message:  fields.msg.el.value.trim(),
      };

      try {
        const response = await fetch('/submit-form', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          showSuccess();
        } else {
          showError(data.message || 'Submission failed. Please try again.');
        }
      } catch (err) {
        console.error('Form submission error:', err);
        showError('Network error. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    });
  }

});
