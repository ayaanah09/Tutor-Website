/* ============================================================
   AUTH
   ============================================================ */
function openModal(kind, prefill) {
  const box = document.getElementById('modal-box');
  if (kind === 'login') box.innerHTML = loginModalHtml();
  else if (kind === 'register') box.innerHTML = registerModalHtml(prefill);
  else if (kind === 'testimonial') box.innerHTML = testimonialModalHtml();
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') closeModal();
});

function loginModalHtml() {
  return `
    <button class="modal-close" onclick="closeModal()">×</button>
    <h3>Welcome back</h3>
    <p class="modal-sub">Log in to book sessions and track progress.</p>
    <div class="modal-error" id="modal-err"></div>
    <div class="form-group"><label>Email</label><input type="email" id="login-email" placeholder="you@email.com"></div>
    <div class="form-group"><label>Password</label><input type="password" id="login-pass" placeholder="Your password"></div>
    <button class="modal-btn" onclick="doLogin()">Log In</button>
    <p class="login-hint">No account yet? <a onclick="openModal('register')">Create one</a></p>
  `;
}
function registerModalHtml(prefill) {
  prefill = prefill || {};
  const subjectOpts = DB.subjects.map(s => `<option>${escapeHtml(s.name)}</option>`).join('');
  return `
    <button class="modal-close" onclick="closeModal()">×</button>
    <h3>Create your account</h3>
    <p class="modal-sub">Free to join. All weekend sessions are free, with no limit.</p>
    <div class="modal-error" id="modal-err"></div>
    <div class="form-group"><label>Parent / Guardian Name</label><input type="text" id="reg-name" placeholder="Jane Smith" value="${escapeHtml(prefill.name||'')}"></div>
    <div class="form-group"><label>Email</label><input type="email" id="reg-email" placeholder="jane@email.com" value="${escapeHtml(prefill.email||'')}"></div>
    <div class="form-group"><label>Password</label><input type="password" id="reg-pass" placeholder="Choose a password"></div>
    <div class="form-group"><label>Child's Name</label><input type="text" id="reg-child" placeholder="First name is fine"></div>
    <div class="form-group"><label>Current Grade</label>
      <select id="reg-grade">
        <option value="">Select grade...</option>
        ${Array.from({length:10},(_,i)=>`<option>Grade ${i+1}</option>`).join('')}
      </select>
    </div>
    <button class="modal-btn" onclick="doRegister()">Create Account</button>
    <p class="login-hint">Already registered? <a onclick="openModal('login')">Log in</a></p>
  `;
}
function modalErr(msg) {
  const el = document.getElementById('modal-err');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

async function doRegister() {
  const name = val('reg-name'), email = val('reg-email').toLowerCase(), pass = val('reg-pass');
  const child = val('reg-child'), grade = val('reg-grade');
  if (!name || !email || !pass) return modalErr('Please fill in name, email, and password.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return modalErr('Please enter a valid email address.');
  if (pass.length < 6) return modalErr('Please choose a password of at least 6 characters.');
  if (!supa) return modalErr('The site is not connected to its database yet.');

  const { data, error } = await supa.auth.signUp({
    email, password: pass,
    options: { data: { name, child, grade } }
  });
  if (error) return modalErr(error.message || 'Could not create your account.');

  // If email confirmation is OFF, a session exists now and we can go straight in.
  if (data.session) {
    await afterAuthChange();
    closeModal();
    emailNotify(name, 'Welcome to BrightPath', 'Your account is ready. Book your free weekend sessions anytime.');
    toast('Account created', 'You are now logged in.');
    openDashboard();
  } else {
    // Email confirmation is ON: tell them to confirm.
    closeModal();
    toast('Check your email', 'Confirm your address to finish creating your account.');
  }
}

async function doLogin() {
  const email = val('login-email').toLowerCase(), pass = val('login-pass');
  if (!supa) return modalErr('The site is not connected to its database yet.');
  const { error } = await supa.auth.signInWithPassword({ email, password: pass });
  if (error) return modalErr('Email or password is incorrect.');
  await afterAuthChange();
  closeModal();
  const u = currentUser();
  toast('Logged in', 'Welcome back' + (u ? ', ' + (u.name||'').split(' ')[0] : '') + '.');
  openDashboard();
}

async function logout() {
  if (supa) { try { await supa.auth.signOut(); } catch (e) {} }
  AUTH_USER = null;
  await load();
  syncAuthUI();
  renderTestimonialsPublic();
  renderSubjectsPublic();
  showPublic();
  toast('Logged out', 'See you next time.');
}

/* Reload everything for the new identity, then refresh the UI. */
async function afterAuthChange() {
  await load();
  syncAuthUI();
  renderSubjectsPublic();
  renderTestimonialsPublic();
}

function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ''; }

/* ---- Volunteer to become a tutor ---- */
function openVolunteerModal() {
  if (!AUTH_USER) { openModal('login'); return; }
  const box = document.getElementById('modal-box');
  const u = currentUser();
  if (u && u.tutorStatus === 'pending') {
    box.innerHTML = `
      <button class="modal-close" onclick="closeModal()">×</button>
      <h3>Application received</h3>
      <p class="modal-sub">Your tutor application is awaiting review. We will email you once it is approved.</p>
      <button class="modal-btn" onclick="closeModal()">Close</button>`;
  } else if (u && u.tutorStatus === 'approved') {
    box.innerHTML = `
      <button class="modal-close" onclick="closeModal()">×</button>
      <h3>You are a tutor</h3>
      <p class="modal-sub">Open your dashboard to see the students assigned to you.</p>
      <button class="modal-btn" onclick="closeModal(); openDashboard()">Go to Dashboard</button>`;
  } else {
    box.innerHTML = `
      <button class="modal-close" onclick="closeModal()">×</button>
      <h3>Volunteer as a tutor</h3>
      <p class="modal-sub">Help local students for free. Tell us what you can teach and an admin will review your application.</p>
      <div class="modal-error" id="modal-err"></div>
      <div class="form-group"><label>Subjects you can teach</label><input type="text" id="vol-subjects" placeholder="e.g. Math Gr 1-8, Science Gr 4-10"></div>
      <div class="form-group"><label>A short note about you</label><textarea id="vol-bio" placeholder="Experience, year of study, why you want to help..."></textarea></div>
      <button class="modal-btn" onclick="submitVolunteer()">Submit Application</button>`;
  }
  document.getElementById('modal-overlay').classList.add('open');
}

async function submitVolunteer() {
  if (!supa || !AUTH_USER) return modalErr('Please log in first.');
  const subjects = val('vol-subjects'), bio = val('vol-bio');
  if (!subjects) return modalErr('Please tell us at least one subject you can teach.');
  const { error } = await supa.from('profiles')
    .update({ tutor_status: 'pending', tutor_subjects: subjects, tutor_bio: bio })
    .eq('id', AUTH_USER.id);
  if (error) return modalErr('Could not submit right now. Please try again.');
  if (DB.profile) { DB.profile.tutorStatus = 'pending'; DB.profile.tutorSubjects = subjects; DB.profile.tutorBio = bio; }
  closeModal();
  emailNotify('the BrightPath team', 'New tutor application', 'A volunteer applied to tutor. Review it in the admin dashboard.');
  toast('Application submitted', 'We will review it and be in touch.');
  syncAuthUI();
}

