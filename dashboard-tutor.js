/* ============================================================
   TUTOR DASHBOARD - assigned students + their sessions + notes
   ============================================================ */
function renderTutorDash() {
  const u = currentUser();
  const students = DB.students || [];
  const studentIds = new Set((students).map(s => s.id));
  const studentSessions = DB.sessions.filter(s => studentIds.has(s.userId));

  document.getElementById('tutor-dash-greeting').textContent =
    'Hi ' + ((u.name||'').split(' ')[0] || 'there') + ', here are your students';

  const upcoming = studentSessions.filter(s => s.status === 'accepted').length;
  document.getElementById('tutor-stat-row').innerHTML = `
    <div class="stat-box"><div class="big">${students.length}</div><div class="lbl">Assigned students</div></div>
    <div class="stat-box"><div class="big">${studentSessions.length}</div><div class="lbl">Their sessions</div></div>
    <div class="stat-box"><div class="big">${upcoming}</div><div class="lbl">Confirmed upcoming</div></div>`;

  const mount = document.getElementById('tutor-students-mount');
  if (!students.length) {
    mount.innerHTML = `<div class="empty-state"><div class="big-emoji">🎓</div>No students assigned to you yet. An admin will connect you with students to help.</div>`;
    return;
  }

  mount.innerHTML = students.map(st => {
    const sess = studentSessions.filter(s => s.userId === st.id).sort((a,b) => b.ts - a.ts);
    return `
      <div class="student-card">
        <div class="student-head">
          <div class="student-avatar">${escapeHtml((st.child || st.name || '?').charAt(0))}</div>
          <div>
            <div class="student-name">${escapeHtml(st.child || 'Student')}</div>
            <div class="student-sub">${escapeHtml(st.grade || 'Grade not set')} · Parent: ${escapeHtml(st.name || '')}</div>
          </div>
        </div>
        ${sess.length ? `
          <table class="data-table" style="margin-top:14px">
            <thead><tr><th>Date</th><th>Time</th><th>Subject</th><th>Status</th><th>Progress note</th></tr></thead>
            <tbody>${sess.map(s => `
              <tr>
                <td>${fmtDate(s.date)}</td>
                <td>${escapeHtml(s.time)}</td>
                <td>${escapeHtml(s.subject)}</td>
                <td>${statusPill(s.status)}</td>
                <td>
                  ${s.progressNote ? `<div class="note-text">${escapeHtml(s.progressNote)}</div>` : `<span class="note-empty">No note yet</span>`}
                  <button class="mini-btn mini-ghost" style="margin-top:6px" onclick="openProgressNote('${s.id}')">${s.progressNote ? 'Edit note' : 'Add note'}</button>
                </td>
              </tr>`).join('')}</tbody>
          </table>` : `<p class="note-empty" style="margin-top:12px">No sessions booked by this student yet.</p>`}
      </div>`;
  }).join('');
}

function openProgressNote(sessionId) {
  const s = DB.sessions.find(x => x.id === sessionId);
  if (!s) return;
  const box = document.getElementById('modal-box');
  box.innerHTML = `
    <button class="modal-close" onclick="closeModal()">×</button>
    <h3>Progress note</h3>
    <p class="modal-sub">${escapeHtml(s.subject)} · ${fmtDate(s.date)} ${escapeHtml(s.time)}</p>
    <div class="modal-error" id="modal-err"></div>
    <div class="form-group"><label>What did you work on? How is the student doing?</label>
      <textarea id="progress-text" placeholder="Topics covered, strengths, what to practice next...">${escapeHtml(s.progressNote || '')}</textarea></div>
    <button class="modal-btn" onclick="saveProgressNote('${s.id}')">Save Note</button>`;
  document.getElementById('modal-overlay').classList.add('open');
}

async function saveProgressNote(sessionId) {
  const s = DB.sessions.find(x => x.id === sessionId);
  if (!s) return;
  const text = val('progress-text');
  if (!supa) return modalErr('Not connected to the database.');
  const { error } = await supa.from('sessions')
    .update({ progress_note: text, progress_by: AUTH_USER.id })
    .eq('id', sessionId);
  if (error) return modalErr('Could not save the note. Please try again.');
  s.progressNote = text;
  closeModal();
  toast('Note saved', 'The progress note has been recorded.');
  renderTutorDash();
}
