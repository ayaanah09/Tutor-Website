/* ============================================================
   ADMIN DASHBOARD
   ============================================================ */
function renderAdmin() {
  const families = DB.users.filter(u => (u.roles||[]).indexOf('user') !== -1);
  const pending = DB.sessions.filter(s => s.status === 'pending');
  const pendingTesti = DB.testimonials.filter(t => !t.approved);
  const tutorApps = DB.users.filter(u => u.tutorStatus === 'pending');
  document.getElementById('admin-stat-row').innerHTML = `
    <div class="stat-box"><div class="big">${families.length}</div><div class="lbl">Registered users</div></div>
    <div class="stat-box"><div class="big">${pending.length}</div><div class="lbl">Pending requests</div></div>
    <div class="stat-box"><div class="big">${tutorApps.length}</div><div class="lbl">Tutor applications</div></div>
    <div class="stat-box"><div class="big">${pendingTesti.length}</div><div class="lbl">Stories to review</div></div>`;
  document.getElementById('admin-req-count').textContent = pending.length;
  document.getElementById('admin-user-count').textContent = families.length;
  document.getElementById('admin-testi-count').textContent = pendingTesti.length;
  const tc = document.getElementById('admin-tutor-count'); if (tc) tc.textContent = tutorApps.length;
  renderAdminRequests();
  renderAdminUsers();
  renderAdminTestimonials();
  renderAdminSubjects();
  renderAdminSlots();
  renderAdminTutors();
  renderAdminAssignments();
}
function switchAdminTab(tab) {
  document.querySelectorAll('[data-atab]').forEach(b => b.classList.toggle('active', b.dataset.atab === tab));
  ['requests','users','tutors','assignments','testimonials','subjects','slots'].forEach(t =>
    document.getElementById('admin-panel-' + t).classList.toggle('active', t === tab));
}

function renderAdminRequests() {
  const mount = document.getElementById('admin-requests-mount');
  const sessions = [...DB.sessions].sort((a,b) => b.ts - a.ts);
  if (!sessions.length) {
    mount.innerHTML = `<div class="empty-state"><div class="big-emoji">📨</div>No session requests yet.</div>`;
    return;
  }
  mount.innerHTML = `<table class="data-table">
    <thead><tr><th>Family</th><th>Child / Grade</th><th>Subject</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${sessions.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.userName)}</strong><br><span style="color:var(--gray-text);font-size:12px">${escapeHtml(s.userEmail)}</span></td>
        <td>${escapeHtml(s.child||'-')}${s.grade ? '<br><span style="color:var(--gray-text);font-size:12px">'+escapeHtml(s.grade)+'</span>':''}</td>
        <td>${escapeHtml(s.subject)}</td>
        <td>${fmtDate(s.date)}</td>
        <td>${escapeHtml(s.time)}</td>
        <td>${statusPill(s.status)}</td>
        <td>${adminSessionActions(s)}</td>
      </tr>`).join('')}</tbody></table>`;
}
function adminSessionActions(s) {
  if (s.status === 'pending')
    return `<button class="mini-btn mini-accept" onclick="adminAccept('${s.id}')">Accept</button>
            <button class="mini-btn mini-reject" onclick="adminReject('${s.id}')">Reject</button>`;
  if (s.status === 'accepted')
    return `<button class="mini-btn mini-cancel" onclick="adminCancel('${s.id}')">Cancel</button>`;
  return '-';
}
async function adminAccept(sid) {
  const s = DB.sessions.find(x => x.id === sid); if (!s) return;
  s.status = 'accepted';
  if (supa && isRealId(sid)) await supa.from('sessions').update({ status: 'accepted' }).eq('id', sid);
  emailNotify(s.userName, 'Session confirmed', 'Your ' + s.subject + ' session on ' + s.date + ' at ' + s.time + ' is confirmed.');
  toast('Request accepted', 'Confirmation email sent to ' + s.userName + '.');
  renderAdmin();
}
async function adminReject(sid) {
  const s = DB.sessions.find(x => x.id === sid); if (!s) return;
  s.status = 'rejected';
  if (supa && isRealId(sid)) await supa.from('sessions').update({ status: 'rejected' }).eq('id', sid);
  await freeSlot(s.date, s.time);
  emailNotify(s.userName, 'Session could not be scheduled', 'Unfortunately your ' + s.subject + ' request on ' + s.date + ' was not available. Please pick another time.');
  toast('Request rejected', 'Notice email sent and slot reopened.');
  renderAdmin();
}
async function adminCancel(sid) {
  const s = DB.sessions.find(x => x.id === sid); if (!s) return;
  s.status = 'cancelled';
  if (supa && isRealId(sid)) await supa.from('sessions').update({ status: 'cancelled' }).eq('id', sid);
  await freeSlot(s.date, s.time);
  emailNotify(s.userName, 'Session cancelled', 'Your ' + s.subject + ' session on ' + s.date + ' has been cancelled.');
  toast('Session cancelled', 'The family has been notified.');
  renderAdmin();
}

function renderAdminUsers() {
  const mount = document.getElementById('admin-users-mount');
  const users = DB.users.filter(u => (u.roles||[]).indexOf('user') !== -1).sort((a,b) => b.ts - a.ts);
  if (!users.length) {
    mount.innerHTML = `<div class="empty-state"><div class="big-emoji">👤</div>No registered users yet.</div>`;
    return;
  }
  mount.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Email</th><th>Child</th><th>Grade</th><th>Roles</th><th>Sessions</th><th>Joined</th></tr></thead>
    <tbody>${users.map(u => {
      const count = DB.sessions.filter(s => s.userId === u.id).length;
      const roleTags = (u.roles||[]).map(r => `<span class="tag ${r==='admin'?'highlight':''}">${escapeHtml(r)}</span>`).join(' ');
      return `<tr>
        <td><strong>${escapeHtml(u.name||'')}</strong></td>
        <td>${escapeHtml(u.email||'')}</td>
        <td>${escapeHtml(u.child||'-')}</td>
        <td>${escapeHtml(u.grade||'-')}</td>
        <td>${roleTags}</td>
        <td>${count}</td>
        <td>${new Date(u.ts).toLocaleDateString()}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

/* ---- Tutor applications ---- */
function renderAdminTutors() {
  const mount = document.getElementById('admin-tutors-mount');
  if (!mount) return;
  const apps = DB.users.filter(u => u.tutorStatus); // pending/approved/declined
  if (!apps.length) {
    mount.innerHTML = `<div class="empty-state"><div class="big-emoji">🙋</div>No tutor applications yet.</div>`;
    return;
  }
  apps.sort((a,b) => (a.tutorStatus==='pending'?-1:1) - (b.tutorStatus==='pending'?-1:1));
  mount.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Email</th><th>Can teach</th><th>About</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${apps.map(u => `
      <tr>
        <td><strong>${escapeHtml(u.name||'')}</strong></td>
        <td>${escapeHtml(u.email||'')}</td>
        <td style="white-space:normal;max-width:200px">${escapeHtml(u.tutorSubjects||'-')}</td>
        <td style="white-space:normal;max-width:240px">${escapeHtml(u.tutorBio||'-')}</td>
        <td>${tutorStatusPill(u.tutorStatus)}</td>
        <td>${u.tutorStatus === 'pending'
          ? `<button class="mini-btn mini-accept" onclick="approveTutor('${u.id}')">Approve</button>
             <button class="mini-btn mini-reject" onclick="declineTutor('${u.id}')">Decline</button>`
          : (u.tutorStatus === 'approved'
              ? `<button class="mini-btn mini-cancel" onclick="revokeTutor('${u.id}')">Revoke</button>`
              : `<button class="mini-btn mini-accept" onclick="approveTutor('${u.id}')">Approve</button>`)}
        </td>
      </tr>`).join('')}</tbody></table>`;
}
function tutorStatusPill(st) {
  if (st === 'approved') return '<span class="status-pill status-accepted">Approved</span>';
  if (st === 'declined') return '<span class="status-pill status-rejected">Declined</span>';
  return '<span class="status-pill status-pending">Pending</span>';
}
async function approveTutor(uid2) {
  const u = DB.users.find(x => x.id === uid2); if (!u) return;
  const newRoles = Array.from(new Set([...(u.roles||['user']), 'tutor']));
  if (supa) await supa.from('profiles').update({ tutor_status: 'approved', roles: newRoles }).eq('id', uid2);
  u.tutorStatus = 'approved'; u.roles = newRoles;
  emailNotify(u.name || u.email, 'You are approved as a tutor', 'Welcome aboard. An admin will assign students to you soon.');
  toast('Tutor approved', (u.name||'They') + ' can now access the tutor dashboard.');
  renderAdmin();
}
async function declineTutor(uid2) {
  const u = DB.users.find(x => x.id === uid2); if (!u) return;
  if (supa) await supa.from('profiles').update({ tutor_status: 'declined' }).eq('id', uid2);
  u.tutorStatus = 'declined';
  toast('Application declined', '');
  renderAdmin();
}
async function revokeTutor(uid2) {
  const u = DB.users.find(x => x.id === uid2); if (!u) return;
  const newRoles = (u.roles||[]).filter(r => r !== 'tutor');
  if (supa) {
    await supa.from('profiles').update({ tutor_status: 'declined', roles: newRoles }).eq('id', uid2);
    await supa.from('assignments').delete().eq('tutor_id', uid2);
  }
  u.tutorStatus = 'declined'; u.roles = newRoles;
  DB.assignments = DB.assignments.filter(a => a.tutor_id !== uid2);
  toast('Tutor access revoked', '');
  renderAdmin();
}

/* ---- Assignments: link students to tutors ---- */
function renderAdminAssignments() {
  const mount = document.getElementById('admin-assignments-mount');
  if (!mount) return;
  const tutors = DB.users.filter(u => (u.roles||[]).indexOf('tutor') !== -1);
  const students = DB.users.filter(u => (u.roles||[]).indexOf('user') !== -1);
  if (!tutors.length) {
    mount.innerHTML = `<div class="info-banner">Approve at least one tutor (in the Tutor Applications tab) before assigning students.</div>`;
    return;
  }
  const tutorOpts = tutors.map(t => `<option value="${t.id}">${escapeHtml(t.name || t.email)}</option>`).join('');
  const studentOpts = students.map(s => `<option value="${s.id}">${escapeHtml((s.child? s.child+' (' : '') + (s.name||s.email) + (s.child? ')' : ''))}</option>`).join('');
  mount.innerHTML = `
    <div class="info-banner">Connect students to a tutor. A tutor sees the sessions and progress of every student assigned to them. One tutor can have many students.</div>
    <div class="subj-add-row" style="margin-bottom:24px">
      <div class="form-group" style="flex:1"><label>Tutor</label><select id="assign-tutor">${tutorOpts}</select></div>
      <div class="form-group" style="flex:1"><label>Student</label><select id="assign-student">${studentOpts}</select></div>
      <button class="mini-btn mini-ghost" style="height:44px;padding:0 18px" onclick="addAssignment()">Assign</button>
    </div>
    ${tutors.map(t => {
      const links = DB.assignments.filter(a => a.tutor_id === t.id);
      return `<div class="assign-block">
        <div class="assign-tutor-name">${escapeHtml(t.name || t.email)} <span class="tag highlight">${links.length} student${links.length===1?'':'s'}</span></div>
        ${links.length ? `<div class="assign-chips">${links.map(a => {
          const st = DB.users.find(u => u.id === a.student_id);
          const label = st ? ((st.child ? st.child + ' · ' : '') + (st.name||st.email)) : a.student_id;
          return `<span class="assign-chip">${escapeHtml(label)} <button onclick="removeAssignment('${a.id}')" title="Remove">×</button></span>`;
        }).join('')}</div>` : `<div class="note-empty">No students yet.</div>`}
      </div>`;
    }).join('')}`;
}
async function addAssignment() {
  const tutorId = document.getElementById('assign-tutor').value;
  const studentId = document.getElementById('assign-student').value;
  if (!tutorId || !studentId) { toast('Pick both', 'Choose a tutor and a student.', 'error'); return; }
  if (DB.assignments.some(a => a.tutor_id === tutorId && a.student_id === studentId)) {
    toast('Already assigned', 'That student is already with this tutor.', 'error'); return;
  }
  if (supa) {
    const { data, error } = await supa.from('assignments').insert({ tutor_id: tutorId, student_id: studentId }).select();
    if (error || !data) { toast('Could not assign', 'Please try again.', 'error'); return; }
    DB.assignments.push(data[0]);
  } else {
    DB.assignments.push({ id: uid('a'), tutor_id: tutorId, student_id: studentId });
  }
  toast('Student assigned', 'The tutor can now see this student.');
  renderAdminAssignments();
}
async function removeAssignment(aid) {
  if (supa && isRealId(aid)) await supa.from('assignments').delete().eq('id', aid);
  DB.assignments = DB.assignments.filter(a => a.id !== aid);
  toast('Assignment removed', '');
  renderAdminAssignments();
}

function renderAdminTestimonials() {
  const mount = document.getElementById('admin-testi-mount');
  const all = [...DB.testimonials].sort((a,b) => (a.approved===b.approved) ? b.ts-a.ts : (a.approved?1:-1));
  if (!all.length) { mount.innerHTML = `<div class="empty-state"><div class="big-emoji">💬</div>No testimonials yet.</div>`; return; }
  mount.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Role</th><th>Story</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${all.map(t => `
      <tr>
        <td><strong>${escapeHtml(t.name)}</strong></td>
        <td>${escapeHtml(t.role||'-')}</td>
        <td style="max-width:340px;white-space:normal">${escapeHtml(t.body)}</td>
        <td>${t.approved ? '<span class="status-pill status-accepted">Published</span>' : '<span class="status-pill status-pending">Pending</span>'}</td>
        <td>${t.approved
          ? `<button class="mini-btn mini-cancel" onclick="unpublishTesti('${t.id}')">Unpublish</button>`
          : `<button class="mini-btn mini-accept" onclick="approveTesti('${t.id}')">Approve</button>
             <button class="mini-btn mini-reject" onclick="deleteTesti('${t.id}')">Delete</button>`}
        </td>
      </tr>`).join('')}</tbody></table>`;
}
async function approveTesti(id) {
  const t = DB.testimonials.find(x => x.id === id); if (!t) return;
  t.approved = true;
  if (supa && isRealId(id)) await supa.from('testimonials').update({ approved: true }).eq('id', id);
  emailNotify(t.name, 'Your story is live', 'Thanks for sharing. Your story now appears on the BrightPath site.');
  toast('Testimonial approved', 'It is now visible on the public site.');
  renderAdmin(); renderTestimonialsPublic();
}
async function unpublishTesti(id) {
  const t = DB.testimonials.find(x => x.id === id); if (!t) return;
  t.approved = false;
  if (supa && isRealId(id)) await supa.from('testimonials').update({ approved: false }).eq('id', id);
  toast('Testimonial unpublished', 'It no longer appears publicly.');
  renderAdmin(); renderTestimonialsPublic();
}
async function deleteTesti(id) {
  DB.testimonials = DB.testimonials.filter(x => x.id !== id);
  if (supa && isRealId(id)) await supa.from('testimonials').delete().eq('id', id);
  toast('Testimonial deleted', '');
  renderAdmin(); renderTestimonialsPublic();
}

/* ---- subject editing ---- */
function renderAdminSubjects() {
  const mount = document.getElementById('admin-subjects-mount');
  mount.innerHTML = `
    <div class="info-banner">Add, rename, or remove the subjects offered. Changes appear instantly across the site and in every booking form.</div>
    <div class="subj-editor-list">
      ${DB.subjects.map(s => `
        <div class="subj-editor-row">
          <input class="emoji-in" value="${escapeHtml(s.icon)}" onchange="updateSubject('${s.id}','icon',this.value)">
          <input class="name-in" value="${escapeHtml(s.name)}" onchange="updateSubject('${s.id}','name',this.value)">
          <input class="name-in" value="${escapeHtml(s.detail||'')}" placeholder="Short detail" onchange="updateSubject('${s.id}','detail',this.value)">
          <button class="mini-btn mini-reject" onclick="removeSubject('${s.id}')">Remove</button>
        </div>`).join('')}
    </div>
    <div class="subj-add-row">
      <div class="form-group" style="width:80px"><label>Icon</label><input id="new-subj-icon" placeholder="📘"></div>
      <div class="form-group" style="flex:1"><label>Subject name</label><input id="new-subj-name" placeholder="e.g. Geography"></div>
      <div class="form-group" style="flex:1"><label>Detail</label><input id="new-subj-detail" placeholder="e.g. Gr. 7 to 10"></div>
      <button class="mini-btn mini-ghost" style="height:44px;padding:0 18px" onclick="addSubject()">Add subject</button>
    </div>`;
}
async function updateSubject(id, field, value) {
  const s = DB.subjects.find(x => x.id === id); if (!s) return;
  s[field] = value;
  if (supa && isRealId(id)) await supa.from('subjects').update({ [field]: value }).eq('id', id);
  renderSubjectsPublic();
  toast('Subject updated', '');
}
async function removeSubject(id) {
  DB.subjects = DB.subjects.filter(x => x.id !== id);
  if (supa && isRealId(id)) await supa.from('subjects').delete().eq('id', id);
  renderAdminSubjects(); renderSubjectsPublic();
  toast('Subject removed', '');
}
async function addSubject() {
  const icon = val('new-subj-icon') || '📘', name = val('new-subj-name'), detail = val('new-subj-detail');
  if (!name) { toast('Add a name', 'Subjects need a name.', 'error'); return; }
  if (supa) {
    const { data, error } = await supa.from('subjects').insert({ icon, name, detail: detail || null }).select();
    if (error || !data) { toast('Could not add', 'Please try again.', 'error'); return; }
    DB.subjects.push({ id: data[0].id, icon: data[0].icon, name: data[0].name, detail: data[0].detail });
  } else {
    DB.subjects.push({ id: uid('s'), icon, name, detail });
  }
  renderAdminSubjects(); renderSubjectsPublic();
  toast('Subject added', name + ' is now offered.');
}

/* ---- slot management ---- */
function renderAdminSlots() {
  const mount = document.getElementById('admin-slots-mount');
  const dates = Object.keys(DB.slots).filter(iso => {
    const d = new Date(iso + 'T00:00:00'); const today = new Date(); today.setHours(0,0,0,0); return d >= today;
  }).sort();
  mount.innerHTML = `
    <div class="info-banner">Open weekend time slots families can book. Add a new slot on a Saturday or Sunday, or remove one. Booked slots show who reserved them.</div>
    <div class="subj-add-row" style="margin-bottom:24px">
      <div class="form-group" style="flex:1"><label>Date</label><input type="date" id="new-slot-date" min="${todayISO()}"></div>
      <div class="form-group" style="flex:1"><label>Time</label><input id="new-slot-time" placeholder="e.g. 5:00 PM"></div>
      <button class="mini-btn mini-ghost" style="height:44px;padding:0 18px" onclick="addSlot()">Add slot</button>
    </div>
    ${dates.length ? `<table class="data-table">
      <thead><tr><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${dates.map(iso => DB.slots[iso].map((slot, i) => `
        <tr>
          <td>${fmtDate(iso)}</td>
          <td>${escapeHtml(slot.time)}</td>
          <td>${slot.bookedBy ? '<span class="status-pill status-accepted">Booked</span>' : '<span class="status-pill status-pending">Open</span>'}</td>
          <td><button class="mini-btn mini-reject" onclick="removeSlot('${iso}', ${i})">Remove</button></td>
        </tr>`).join('')).join('')}</tbody></table>`
      : `<div class="empty-state"><div class="big-emoji">🗓️</div>No upcoming slots. Add one above.</div>`}`;
}
async function addSlot() {
  const date = val('new-slot-date'), time = val('new-slot-time');
  if (!date || !time) { toast('Missing info', 'Pick a date and enter a time.', 'error'); return; }
  const dow = new Date(date + 'T00:00:00').getDay();
  if (dow !== 0 && dow !== 6) { toast('Weekends only', 'Sessions run on Saturdays and Sundays. Pick a weekend date.', 'error'); return; }
  if (!DB.slots[date]) DB.slots[date] = [];
  if (DB.slots[date].some(s => s.time === time)) { toast('Already exists', 'That time is already listed.', 'error'); return; }
  if (supa) {
    const { data, error } = await supa.from('slots').insert({ date, time, booked_by: null }).select();
    if (error || !data) { toast('Could not add', 'Please try again.', 'error'); return; }
    DB.slots[date].push({ id: data[0].id, time: data[0].time, bookedBy: null });
  } else {
    DB.slots[date].push({ id: uid('slot'), time, bookedBy: null });
  }
  renderAdminSlots();
  toast('Slot added', time + ' on ' + date + ' is now open.');
}
async function removeSlot(iso, idx) {
  const slot = DB.slots[iso][idx];
  if (slot && slot.bookedBy) { toast('Cannot remove', 'This slot is booked. Cancel the session first.', 'error'); return; }
  if (supa && slot && isRealId(slot.id)) await supa.from('slots').delete().eq('id', slot.id);
  DB.slots[iso].splice(idx, 1);
  if (!DB.slots[iso].length) delete DB.slots[iso];
  renderAdminSlots();
  toast('Slot removed', '');
}

