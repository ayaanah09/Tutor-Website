/* ============================================================
   USER DASHBOARD: calendar + booking + my sessions
   ============================================================ */
let calCursor = new Date();
let selectedDate = null;

function renderUserDash() {
  const u = currentUser();
  document.getElementById('user-dash-greeting').textContent = 'Hi ' + u.name.split(' ')[0] + ', here are your sessions';
  const mine = DB.sessions.filter(s => s.userId === u.id);
  const pending = mine.filter(s => s.status === 'pending').length;
  const accepted = mine.filter(s => s.status === 'accepted').length;
  document.getElementById('user-stat-row').innerHTML = `
    <div class="stat-box"><div class="big">${mine.length}</div><div class="lbl">Total requests</div></div>
    <div class="stat-box"><div class="big">${pending}</div><div class="lbl">Awaiting confirmation</div></div>
    <div class="stat-box"><div class="big">${accepted}</div><div class="lbl">Confirmed sessions</div></div>`;
  document.getElementById('user-session-count').textContent = mine.length;
  calCursor = new Date();
  selectedDate = null;
  document.getElementById('slot-section').style.display = 'none';
  renderCalendar();
  renderUserSessions();
}
function switchUserTab(tab) {
  document.querySelectorAll('[data-utab]').forEach(b => b.classList.toggle('active', b.dataset.utab === tab));
  document.getElementById('user-panel-book').classList.toggle('active', tab === 'book');
  document.getElementById('user-panel-sessions').classList.toggle('active', tab === 'sessions');
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function calMove(delta) {
  calCursor.setMonth(calCursor.getMonth() + delta);
  selectedDate = null;
  document.getElementById('slot-section').style.display = 'none';
  renderCalendar();
}
function renderCalendar() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  document.getElementById('cal-title').textContent = MONTHS[m] + ' ' + y;
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const grid = document.getElementById('cal-grid');
  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < startDow; i++) html += `<div class="cal-cell muted"></div>`;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(y, m, day);
    const iso = todayISO(dateObj);
    const slots = DB.slots[iso] || [];
    const openCount = slots.filter(s => !s.bookedBy).length;
    const isPast = dateObj < today;
    if (openCount > 0 && !isPast) {
      const sel = (selectedDate === iso) ? ' selected' : '';
      html += `<div class="cal-cell has-slots${sel}" onclick="pickDate('${iso}')">${day}<span class="dot"></span></div>`;
    } else {
      html += `<div class="cal-cell${isPast ? ' muted':''}">${day}</div>`;
    }
  }
  grid.innerHTML = html;
}
function pickDate(iso) {
  selectedDate = iso;
  renderCalendar();
  const sec = document.getElementById('slot-section');
  sec.style.display = 'block';
  const d = new Date(iso + 'T00:00:00');
  document.getElementById('slot-date-label').textContent = 'Available times on ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  const list = document.getElementById('slot-list');
  const slots = DB.slots[iso] || [];
  if (!slots.length) { list.innerHTML = `<div class="slot-empty">No times available on this day.</div>`; return; }
  list.innerHTML = slots.map((s, i) => s.bookedBy
    ? `<div class="slot-chip booked">${escapeHtml(s.time)}</div>`
    : `<div class="slot-chip" onclick="chooseSlot('${iso}', ${i})">${escapeHtml(s.time)}</div>`).join('');
}
function chooseSlot(iso, idx) {
  const subjectOpts = DB.subjects.map(s => `<option>${escapeHtml(s.name)}</option>`).join('');
  const box = document.getElementById('modal-box');
  const d = new Date(iso + 'T00:00:00');
  box.innerHTML = `
    <button class="modal-close" onclick="closeModal()">×</button>
    <h3>Request this session</h3>
    <p class="modal-sub">${MONTHS[d.getMonth()]} ${d.getDate()}, ${DB.slots[iso][idx].time}</p>
    <div class="modal-error" id="modal-err"></div>
    <div class="form-group"><label>Subject</label><select id="bk-subject">${subjectOpts}<option>Multiple subjects</option></select></div>
    <div class="form-group"><label>Notes for the tutor (optional)</label><textarea id="bk-notes" placeholder="Topics to focus on, location preference..."></textarea></div>
    <button class="modal-btn" onclick="confirmBooking('${iso}', ${idx})">Send Request</button>
  `;
  document.getElementById('modal-overlay').classList.add('open');
}
async function confirmBooking(iso, idx) {
  const u = currentUser();
  if (!u) { closeModal(); openModal('login'); return; }
  const slot = DB.slots[iso][idx];
  if (slot.bookedBy) { modalErr('Sorry, that time was just taken.'); return; }
  const subject = val('bk-subject'), notes = val('bk-notes');
  if (!supa) { modalErr('The site is not connected to its database yet.'); return; }

  // Insert the session (RLS allows because user_id = auth.uid()).
  const { data, error } = await supa.from('sessions').insert({
    user_id: u.id, user_name: u.name, user_email: u.email, child: u.child || null,
    grade: u.grade || null, subject, notes: notes || null, date: iso, time: slot.time, status: 'pending'
  }).select();
  if (error || !data) { modalErr('Could not book that slot. Please try again.'); return; }

  // Mark the slot booked under this user.
  const slotUpd = await supa.from('slots').update({ booked_by: u.id }).eq('id', slot.id).select();
  if (slotUpd.error) { modalErr('That time could not be reserved. Please try another.'); return; }

  DB.sessions.push(mapSessionIn(data[0]));
  slot.bookedBy = u.id;
  closeModal();
  emailNotify('the BrightPath team', 'New session request', u.name + ' requested ' + subject + ' on ' + iso + '.');
  emailNotify(u.name, 'Request received', 'We will confirm your ' + subject + ' session within 24 hours.');
  toast('Session requested', 'You will hear back once it is confirmed.');
  renderUserDash();
}

function renderUserSessions() {
  const u = currentUser();
  const mine = DB.sessions.filter(s => s.userId === u.id).sort((a,b) => b.ts - a.ts);
  const mount = document.getElementById('user-sessions-mount');
  if (!mine.length) {
    mount.innerHTML = `<div class="empty-state"><div class="big-emoji">📅</div>No sessions yet. Head to "Book a Session" to pick a time.</div>`;
    return;
  }
  mount.innerHTML = `<table class="data-table">
    <thead><tr><th>Date</th><th>Time</th><th>Subject</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${mine.map(s => `
      <tr>
        <td>${fmtDate(s.date)}</td>
        <td>${escapeHtml(s.time)}</td>
        <td>${escapeHtml(s.subject)}</td>
        <td>${statusPill(s.status)}</td>
        <td>${(s.status === 'pending' || s.status === 'accepted')
          ? `<button class="mini-btn mini-cancel" onclick="userCancel('${s.id}')">Cancel</button>` : '-'}</td>
      </tr>`).join('')}</tbody></table>`;
}
async function userCancel(sid) {
  const s = DB.sessions.find(x => x.id === sid);
  if (!s) return;
  s.status = 'cancelled';
  if (supa && isRealId(sid)) await supa.from('sessions').update({ status: 'cancelled' }).eq('id', sid);
  await freeSlot(s.date, s.time);
  emailNotify('the BrightPath team', 'Session cancelled', s.userName + ' cancelled their ' + s.subject + ' session on ' + s.date + '.');
  emailNotify(s.userName, 'Cancellation confirmed', 'Your ' + s.subject + ' session on ' + s.date + ' has been cancelled.');
  toast('Session cancelled', 'The time slot has been reopened.');
  renderUserDash();
}
async function freeSlot(iso, time) {
  const slots = DB.slots[iso]; if (!slots) return;
  const slot = slots.find(s => s.time === time);
  if (slot) {
    slot.bookedBy = null;
    if (supa && isRealId(slot.id)) await supa.from('slots').update({ booked_by: null }).eq('id', slot.id);
  }
}

function fmtDate(iso) { const d = new Date(iso + 'T00:00:00'); return MONTHS[d.getMonth()].slice(0,3) + ' ' + d.getDate(); }
function statusPill(st) {
  const map = { pending:'status-pending', accepted:'status-accepted', rejected:'status-rejected', cancelled:'status-cancelled' };
  const label = { pending:'Pending', accepted:'Accepted', rejected:'Rejected', cancelled:'Cancelled' };
  return `<span class="status-pill ${map[st]}">${label[st]}</span>`;
}


