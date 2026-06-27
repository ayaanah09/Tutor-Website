/* ============================================================
   TYPING ANIMATION + SCROLL REVEAL + INIT
   ============================================================ */
const typeSubjects = [
  "loading subject: Math Grade 7...",
  "loading subject: Science Grade 9...",
  "loading subject: Math Grade 5...",
  "loading subject: Science Grade 6...",
  "loading subject: Math Grade 10...",
  "loading subject: Science Grade 8...",
];
let si = 0, ci = 0, deleting = false;
function typeNext() {
  const el = document.getElementById('typing-text');
  if (!el) return;
  const current = typeSubjects[si];
  if (!deleting) {
    el.textContent = current.substring(0, ci++);
    if (ci > current.length) { deleting = true; setTimeout(typeNext, 1600); return; }
  } else {
    el.textContent = current.substring(0, ci--);
    if (ci < 0) { deleting = false; si = (si + 1) % typeSubjects.length; ci = 0; }
  }
  setTimeout(typeNext, deleting ? 28 : 52);
}

function initRevealObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'translateY(0)'; }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.grade-card, .step, .subject-card, .testi-card').forEach(el => {
    el.style.opacity = '0'; el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
    observer.observe(el);
  });
}

/* INIT */
async function init() {
  typeNext();               // start the hero animation immediately
  await load();             // pull only the data this viewer needs
  renderSubjectsPublic();
  renderTestimonialsPublic();
  syncAuthUI();
  initRevealObserver();
  // If a Supabase Auth session was restored, drop the user into their dashboard.
  if (AUTH_USER && currentUser()) openDashboard();
}
init();
