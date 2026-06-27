/* ============================================================
   PUBLIC: subjects, testimonials, register section
   ============================================================ */
function renderSubjectsPublic() {
  const grid = document.getElementById('subjects-grid');
  grid.innerHTML = DB.subjects.map(s => `
    <div class="subject-card">
      <div class="subject-icon">${escapeHtml(s.icon)}</div>
      <h4>${escapeHtml(s.name)}</h4>
      <p>${escapeHtml(s.detail || '')}</p>
    </div>`).join('');
  document.getElementById('stat-subject-count').textContent = DB.subjects.length;
}

function renderTestimonialsPublic() {
  const grid = document.getElementById('testi-grid');
  const approved = DB.testimonials.filter(t => t.approved);
  if (!approved.length) {
    grid.innerHTML = `<div class="testi-empty">No stories published yet. Be the first to share yours.</div>`;
    return;
  }
  grid.innerHTML = approved.map(t => `
    <div class="testi-card">
      <div class="quote-mark">"</div>
      <p class="body">${escapeHtml(t.body)}</p>
      <div class="testi-meta">
        <div class="testi-avatar">${escapeHtml((t.name||'?').charAt(0))}</div>
        <div>
          <div class="testi-name">${escapeHtml(t.name)}</div>
          <div class="testi-role">${escapeHtml(t.role||'')}</div>
        </div>
      </div>
    </div>`).join('');
}

function openTestimonialModal() { openModal('testimonial'); }
function testimonialModalHtml() {
  const u = currentUser();
  return `
    <button class="modal-close" onclick="closeModal()">×</button>
    <h3>Share your story</h3>
    <p class="modal-sub">Tell other Cambridge families about your experience. Stories are published after a quick review.</p>
    <div class="modal-error" id="modal-err"></div>
    <div class="form-group"><label>Your Name</label><input type="text" id="testi-name" placeholder="First name and last initial" value="${u?escapeHtml(u.name):''}"></div>
    <div class="form-group"><label>Your Role</label><input type="text" id="testi-role" placeholder="e.g. Parent of a Grade 6 student"></div>
    <div class="form-group"><label>Your Story</label><textarea id="testi-body" placeholder="What was your experience like?"></textarea></div>
    <button class="modal-btn" onclick="submitTestimonial()">Submit for Review</button>
  `;
}
async function submitTestimonial() {
  const name = val('testi-name'), role = val('testi-role'), body = val('testi-body');
  if (!name || !body) return modalErr('Please add your name and your story.');
  if (!supa) return modalErr('The site is not connected to its database yet.');
  if (!AUTH_USER) { closeModal(); toast('Please log in', 'Log in or sign up to share your story.', 'error'); openModal('login'); return; }
  const { data, error } = await supa.from('testimonials')
    .insert({ author_id: AUTH_USER.id, name, role: role || null, body, approved: false }).select();
  if (error || !data) { modalErr('Could not submit right now. Please try again.'); return; }
  DB.testimonials.push(mapTestiIn(data[0]));
  closeModal();
  emailNotify('the BrightPath team', 'New testimonial submitted', 'A story from ' + name + ' is awaiting approval.');
  toast('Thank you', 'Your story was submitted and will appear once approved.');
}

function renderRegisterSection() {
  const mount = document.getElementById('register-form-mount');
  const sub = document.getElementById('register-sub');
  const u = currentUser();
  if (u) {
    const firstName = (u.name || '').split(' ')[0] || 'there';
    sub.textContent = 'You are logged in. Open your dashboard to manage everything.';
    const volunteerLine = (!isTutor() && (!u.tutorStatus || u.tutorStatus === 'declined'))
      ? `<p style="font-size:14px;color:var(--navy);margin-top:18px">Want to help out? <a style="color:var(--mint);font-weight:700;cursor:pointer" onclick="openVolunteerModal()">Volunteer as a tutor</a>.</p>`
      : (u.tutorStatus === 'pending' ? `<p style="font-size:13px;color:#4A5C7A;margin-top:18px">Your tutor application is under review.</p>` : '');
    mount.innerHTML = `
      <div style="background:rgba(255,255,255,0.85);border-radius:14px;padding:32px;max-width:680px">
        <p style="font-size:15px;color:var(--navy);margin-bottom:18px">Welcome back, <strong>${escapeHtml(firstName)}</strong>.</p>
        <button class="btn-submit" style="max-width:280px" onclick="openDashboard()">Go to My Dashboard →</button>
        ${volunteerLine}
      </div>`;
  } else {
    sub.textContent = 'Create your account and book free weekend sessions, as many as you need based on availability.';
    const subjectOpts = DB.subjects.map(s => `<option>${escapeHtml(s.name)}</option>`).join('');
    mount.innerHTML = `
      <form class="register-form" onsubmit="quickRegister(event)">
        <div class="form-group"><label>Parent / Guardian Name</label><input type="text" id="q-name" placeholder="Jane Smith" required></div>
        <div class="form-group"><label>Email Address</label><input type="email" id="q-email" placeholder="jane@email.com" required></div>
        <div class="form-group"><label>Password</label><input type="password" id="q-pass" placeholder="Choose a password" required></div>
        <div class="form-group"><label>Child's Name</label><input type="text" id="q-child" placeholder="First name is fine"></div>
        <div class="form-group"><label>Current Grade</label>
          <select id="q-grade" required>
            <option value="">Select grade...</option>
            ${Array.from({length:10},(_,i)=>`<option>Grade ${i+1}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Subject Needed</label>
          <select id="q-subject"><option value="">Select subject...</option>${subjectOpts}<option>Multiple subjects</option></select>
        </div>
        <button type="submit" class="btn-submit">Create Account and Continue →</button>
        <p class="login-hint">Already have an account? <a onclick="openModal('login')">Log in</a></p>
      </form>`;
  }
}
async function quickRegister(e) {
  e.preventDefault();
  const name = val('q-name'), email = val('q-email').toLowerCase(), pass = val('q-pass');
  const child = val('q-child'), grade = val('q-grade');
  if (!name || !email || !pass) { toast('Missing info', 'Please fill in name, email, and password.', 'error'); return; }
  if (pass.length < 6) { toast('Password too short', 'Use at least 6 characters.', 'error'); return; }
  if (!supa) { toast('Not connected', 'The site is not connected to its database yet.', 'error'); return; }
  const { data, error } = await supa.auth.signUp({ email, password: pass, options: { data: { name, child, grade } } });
  if (error) { toast('Could not sign up', error.message, 'error'); return; }
  if (data.session) {
    await afterAuthChange();
    emailNotify(name, 'Welcome to BrightPath', 'Your account is ready. Pick a weekend time to book your free session.');
    openDashboard();
  } else {
    toast('Check your email', 'Confirm your address to finish creating your account.');
  }
}


