/* ============================================================
   BrightPath Tutoring - front-end app
   Data is stored in a central Supabase database so all users
   share the same information. Connection settings live in config.js.
   ============================================================ */

/* ============================================================
   DATA LAYER - Supabase Auth + per-user loading
   ------------------------------------------------------------
   Login is handled by Supabase Auth (hashed passwords, secure
   tokens). On startup we load only the data relevant to the
   current viewer:
     - logged out : approved testimonials + subjects + open slots
     - a family   : the above + that family's own sessions
     - an admin   : everything
   The in-memory `DB` keeps the same shape the UI already expects.
   ============================================================ */

const CFG = window.BRIGHTPATH_CONFIG || {};
let supa = null;
try {
  if (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase
      && !CFG.SUPABASE_URL.includes('YOUR-PROJECT')) {
    supa = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  }
} catch (e) { console.error('Supabase init failed', e); }

function todayISO(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function uid(prefix) { return (prefix||'id') + '_' + Math.random().toString(36).slice(2, 9); }

let DB = null;          // in-memory view of the data the UI renders
let AUTH_USER = null;   // the Supabase Auth user object, or null

/* ---- row mappers: DB (snake_case) -> app shape ---- */
function mapProfileIn(r) {
  return { id: r.id, name: r.name, email: r.email,
           roles: Array.isArray(r.roles) ? r.roles : ['user'],
           child: r.child, grade: r.grade,
           tutorStatus: r.tutor_status || null, tutorSubjects: r.tutor_subjects || '', tutorBio: r.tutor_bio || '',
           ts: +new Date(r.created_at) };
}
function mapSessionIn(r) { return { id: r.id, userId: r.user_id, userName: r.user_name, userEmail: r.user_email, child: r.child, grade: r.grade, subject: r.subject, notes: r.notes, date: r.date, time: r.time, status: r.status, progressNote: r.progress_note || '', ts: +new Date(r.created_at) }; }
function mapTestiIn(r)   { return { id: r.id, authorId: r.author_id, name: r.name, role: r.role, body: r.body, approved: r.approved, ts: +new Date(r.created_at) }; }
function slotsRowsToMap(rows) {
  const map = {};
  (rows||[]).forEach(r => { (map[r.date] = map[r.date] || []).push({ id: r.id, time: r.time, bookedBy: r.booked_by }); });
  return map;
}
function isRealId(id) { return typeof id === 'string' && /^[0-9a-f]{8}-/.test(id); }

/* ---- role helpers ---- */
function userRoles() { return (DB && DB.profile && DB.profile.roles) || []; }
function hasRole(r) { return userRoles().indexOf(r) !== -1; }
function isAdmin() { return hasRole('admin'); }
function isTutor() { return hasRole('tutor'); }

/* ---- the current user, in the shape the UI expects ---- */
function currentUser() {
  if (!AUTH_USER) return null;
  const p = DB.profile;
  if (!p) return null;
  return { id: AUTH_USER.id, name: p.name, email: p.email || AUTH_USER.email,
           roles: p.roles, child: p.child, grade: p.grade,
           tutorStatus: p.tutorStatus, tutorSubjects: p.tutorSubjects, tutorBio: p.tutorBio };
}

/* ============================================================
   LOAD - only what this viewer is allowed/needs to see
   ============================================================ */
async function load() {
  DB = { profile: null, users: [], sessions: [], testimonials: [], subjects: [], slots: {},
         assignments: [], students: [], myStudentIds: [] };

  if (!supa) {
    toast('Setup needed', 'Add your Supabase keys to config.js to enable the site.', 'error');
    return;
  }

  // Who is logged in (if anyone)?
  try {
    const { data: { session } } = await supa.auth.getSession();
    AUTH_USER = session ? session.user : null;
  } catch (e) { AUTH_USER = null; }

  // Public data everyone needs.
  const publicReads = [
    supa.from('subjects').select('*').order('created_at', { ascending: true }),
    supa.from('slots').select('*').order('date', { ascending: true }),
    supa.from('testimonials').select('*').order('created_at', { ascending: true }),
  ];
  try {
    const [subjR, slotsR, testiR] = await Promise.all(publicReads);
    DB.subjects = (subjR.data || []).map(s => ({ id: s.id, icon: s.icon, name: s.name, detail: s.detail }));
    DB.slots = slotsRowsToMap(slotsR.data || []);
    DB.testimonials = (testiR.data || []).map(mapTestiIn);
  } catch (e) { console.error(e); }

  if (!AUTH_USER) return;

  // Load own profile first (roles drive what else we load).
  try {
    const { data: prof } = await supa.from('profiles').select('*').eq('id', AUTH_USER.id).single();
    if (prof) DB.profile = mapProfileIn(prof);
  } catch (e) { console.error(e); }

  if (isAdmin()) {
    // Admin: everything for the dashboards.
    try {
      const [allSess, allUsers, allTesti, allAssign] = await Promise.all([
        supa.from('sessions').select('*').order('created_at', { ascending: false }),
        supa.from('profiles').select('*').order('created_at', { ascending: false }),
        supa.from('testimonials').select('*').order('created_at', { ascending: false }),
        supa.from('assignments').select('*'),
      ]);
      DB.sessions = (allSess.data || []).map(mapSessionIn);
      DB.users = (allUsers.data || []).map(mapProfileIn);
      DB.testimonials = (allTesti.data || []).map(mapTestiIn);
      DB.assignments = allAssign.data || [];
    } catch (e) { console.error(e); }
  } else {
    // Family: only their own sessions.
    try {
      const { data: mine } = await supa.from('sessions').select('*').eq('user_id', AUTH_USER.id).order('created_at', { ascending: false });
      DB.sessions = (mine || []).map(mapSessionIn);
    } catch (e) { console.error(e); }
  }

  // Tutor (may also be admin): load assigned students and their sessions.
  if (isTutor()) {
    try {
      const { data: myAssign } = await supa.from('assignments').select('*').eq('tutor_id', AUTH_USER.id);
      DB.myStudentIds = (myAssign || []).map(a => a.student_id);
      if (DB.myStudentIds.length) {
        const [studs, studSess] = await Promise.all([
          supa.from('profiles').select('*').in('id', DB.myStudentIds),
          supa.from('sessions').select('*').in('user_id', DB.myStudentIds).order('created_at', { ascending: false }),
        ]);
        DB.students = (studs.data || []).map(mapProfileIn);
        // Merge student sessions into DB.sessions without duplicates.
        const seen = new Set(DB.sessions.map(s => s.id));
        (studSess.data || []).forEach(r => { if (!seen.has(r.id)) DB.sessions.push(mapSessionIn(r)); });
      }
    } catch (e) { console.error(e); }
  }
}

/* save() is kept as a no-op shim: every action now writes to Supabase
   directly at the point of change (see the action functions), which is
   the correct pattern under RLS. Leaving the name avoids touching the
   many call sites in the UI code. */
function save() { /* writes happen inline in each action */ }

/* ---- toast / email notifications ---- */
function toast(title, body, type) {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  const icon = type === 'email' ? '✉️' : type === 'error' ? '⚠️' : '✓';
  el.innerHTML = '<div class="toast-title">' + icon + ' ' + escapeHtml(title) + '</div>' +
                 (body ? '<div class="toast-body">' + escapeHtml(body) + '</div>' : '');
  wrap.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity 0.4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 4600);
}
function emailNotify(toName, subject, line) {
  toast('Email sent to ' + toName, subject + ' - ' + line, 'email');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

