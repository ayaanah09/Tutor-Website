/* ============================================================
   VIEW SWITCHING (multi-role aware)
   ============================================================ */
let activeDashboard = null;   // 'user' | 'tutor' | 'admin'

function hideAllViews() {
  document.getElementById('public-view').style.display = 'none';
  document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
}
function showPublic() {
  hideAllViews();
  document.getElementById('public-view').style.display = 'block';
  document.getElementById('public-nav-links').style.visibility = 'visible';
  window.scrollTo(0, 0);
}
function goPublicSection(id) {
  showPublic();
  setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({behavior:'smooth'}); }, 30);
}

/* Which dashboards is this person allowed to see? Everyone has 'user';
   approved tutors add 'tutor'; admins add 'admin'. */
function availableDashboards() {
  const out = ['user'];
  if (isTutor()) out.push('tutor');
  if (isAdmin()) out.push('admin');
  return out;
}

function openDashboard(which) {
  const u = currentUser();
  if (!u) { openModal('login'); return; }
  const avail = availableDashboards();
  // Default to the most capable view available, unless a specific one is asked for.
  if (!which || avail.indexOf(which) === -1) {
    which = avail.indexOf('admin') !== -1 ? 'admin'
          : avail.indexOf('tutor') !== -1 ? 'tutor' : 'user';
  }
  activeDashboard = which;
  hideAllViews();
  if (which === 'admin') { document.getElementById('admin-dashboard').classList.add('active'); renderAdmin(); }
  else if (which === 'tutor') { document.getElementById('tutor-dashboard').classList.add('active'); renderTutorDash(); }
  else { document.getElementById('user-dashboard').classList.add('active'); renderUserDash(); }
  renderRoleSwitcher();
  window.scrollTo(0, 0);
}

/* If the user has more than one dashboard, show buttons to switch. */
function renderRoleSwitcher() {
  const avail = availableDashboards();
  document.querySelectorAll('.role-switch-mount').forEach(mount => {
    if (avail.length < 2) { mount.innerHTML = ''; return; }
    const label = { user: 'My Family', tutor: 'My Students', admin: 'Admin' };
    mount.innerHTML = `<div class="role-switch">` + avail.map(r =>
      `<button class="role-switch-btn${r === activeDashboard ? ' active' : ''}" onclick="openDashboard('${r}')">${label[r]}</button>`
    ).join('') + `</div>`;
  });
}

function syncAuthUI() {
  const u = currentUser();
  const navUser = document.getElementById('nav-user');
  const dashBtn = document.getElementById('nav-dashboard-btn');
  const loginBtn = document.getElementById('nav-login-btn');
  const ctaBtn = document.getElementById('nav-cta-btn');
  const logoutBtn = document.getElementById('nav-logout-btn');
  if (u) {
    navUser.style.display = 'flex';
    document.getElementById('nav-user-name').textContent = u.name || u.email || 'Account';
    // Show the most senior role as the badge.
    const badge = isAdmin() ? 'ADMIN' : isTutor() ? 'TUTOR' : 'MEMBER';
    document.getElementById('nav-user-role').textContent = badge;
    dashBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'inline-block';
    loginBtn.style.display = 'none';
    ctaBtn.style.display = 'none';
  } else {
    navUser.style.display = 'none';
    dashBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
    loginBtn.style.display = 'inline-block';
    ctaBtn.style.display = 'inline-block';
  }
  renderRegisterSection();
}
