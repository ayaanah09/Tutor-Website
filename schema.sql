-- ============================================================
-- BrightPath Tutoring - Supabase schema
-- (Supabase Auth + multi-role + tutor/student assignments)
-- ------------------------------------------------------------
-- HOW TO USE:
--   1. Supabase project -> SQL Editor -> paste all -> Run.
--   2. Follow "MAKE YOURSELF ADMIN" at the bottom.
--
-- ROLES MODEL:
--   Each profile has a `roles` array. Everyone has 'user'. Admins
--   add 'admin'; approved volunteers add 'tutor'. A person can hold
--   several at once (e.g. ['user','tutor','admin']).
--
-- SECURITY (Row Level Security):
--   - public can read approved testimonials, subjects, open slots
--   - a family sees only their own sessions
--   - a tutor sees the students assigned to them and those students'
--     sessions, and can add progress notes
--   - admins see and manage everything
-- ============================================================


-- ============================================================
-- PROFILES (one per Auth user; multi-role)
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text,
  child       text,
  grade       text,
  roles       text[] not null default array['user'],   -- e.g. {user,tutor,admin}
  -- tutor application fields (filled when someone volunteers)
  tutor_status   text default null,                     -- null | 'pending' | 'approved' | 'declined'
  tutor_subjects text,                                  -- free text: subjects they can teach
  tutor_bio      text,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row on signup, copying signup metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, child, grade, roles)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'name',''),
    coalesce(new.raw_user_meta_data->>'child',''),
    coalesce(new.raw_user_meta_data->>'grade',''),
    array['user']
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- ASSIGNMENTS (which tutor teaches which student) - many to many
-- ============================================================
create table if not exists assignments (
  id          uuid primary key default gen_random_uuid(),
  tutor_id    uuid not null references profiles(id) on delete cascade,
  student_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (tutor_id, student_id)
);
create index if not exists idx_assign_tutor   on assignments(tutor_id);
create index if not exists idx_assign_student on assignments(student_id);


-- ============================================================
-- SESSIONS (+ progress notes added by tutors)
-- ============================================================
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id) on delete cascade,
  user_name     text, user_email text, child text, grade text,
  subject       text, notes text,
  date          text, time text,
  status        text not null default 'pending',
  progress_note text,                       -- written by the tutor afterwards
  progress_by   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_sessions_user   on sessions(user_id);
create index if not exists idx_sessions_status on sessions(status);

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  name text not null, role text, body text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  icon text, name text not null, detail text,
  created_at timestamptz not null default now()
);

create table if not exists slots (
  id uuid primary key default gen_random_uuid(),
  date text not null, time text not null,
  booked_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (date, time)
);
create index if not exists idx_slots_date on slots(date);


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
create or replace function public.has_role(r text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and r = any(roles));
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select public.has_role('admin');
$$;

-- True if the given student is assigned to the current tutor.
create or replace function public.teaches(student uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.assignments
                 where tutor_id = auth.uid() and student_id = student);
$$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles     enable row level security;
alter table assignments  enable row level security;
alter table sessions     enable row level security;
alter table testimonials enable row level security;
alter table subjects     enable row level security;
alter table slots        enable row level security;

-- ---- PROFILES ----
-- Read your own; admins read all; a tutor can read profiles of
-- students assigned to them.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or public.is_admin() or public.teaches(id));

-- Update your own profile; admins update any. (Volunteering to be a
-- tutor is a self-update that sets tutor_status='pending'.)
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert
  with check (id = auth.uid());

-- ---- ASSIGNMENTS ----
-- A tutor sees their own assignments; admins see all.
drop policy if exists assignments_select on assignments;
create policy assignments_select on assignments for select
  using (tutor_id = auth.uid() or public.is_admin());
-- Only admins create or remove assignments.
drop policy if exists assignments_write on assignments;
create policy assignments_write on assignments for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- SESSIONS ----
-- See your own; admins all; tutors see sessions of their students.
drop policy if exists sessions_select on sessions;
create policy sessions_select on sessions for select
  using (user_id = auth.uid() or public.is_admin() or public.teaches(user_id));

drop policy if exists sessions_insert on sessions;
create policy sessions_insert on sessions for insert
  with check (user_id = auth.uid());

-- Update your own (cancel); admins (accept/reject); tutors may update
-- sessions of their assigned students (to add progress notes).
drop policy if exists sessions_update on sessions;
create policy sessions_update on sessions for update
  using (user_id = auth.uid() or public.is_admin() or public.teaches(user_id));

-- ---- TESTIMONIALS ----
drop policy if exists testimonials_select on testimonials;
create policy testimonials_select on testimonials for select
  using (approved = true or public.is_admin());
drop policy if exists testimonials_insert on testimonials;
create policy testimonials_insert on testimonials for insert
  with check (author_id = auth.uid());
drop policy if exists testimonials_update on testimonials;
create policy testimonials_update on testimonials for update using (public.is_admin());
drop policy if exists testimonials_delete on testimonials;
create policy testimonials_delete on testimonials for delete using (public.is_admin());

-- ---- SUBJECTS ----
drop policy if exists subjects_select on subjects;
create policy subjects_select on subjects for select using (true);
drop policy if exists subjects_write on subjects;
create policy subjects_write on subjects for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- SLOTS ----
drop policy if exists slots_select on slots;
create policy slots_select on slots for select using (true);
drop policy if exists slots_update on slots;
create policy slots_update on slots for update
  using (public.is_admin() or booked_by is null or booked_by = auth.uid())
  with check (public.is_admin() or booked_by = auth.uid() or booked_by is null);
drop policy if exists slots_admin_write on slots;
create policy slots_admin_write on slots for all
  using (public.is_admin()) with check (public.is_admin());


-- ============================================================
-- STARTER DATA: subjects + weekend slots
-- ============================================================
insert into subjects (icon, name, detail) values
  ('📐','Mathematics','Gr. 1 to 10 · All units'),
  ('🧪','Science','Gr. 4 to 10 · All strands')
on conflict do nothing;

do $$
declare d date := current_date + 1; t text;
  times text[] := array['10:00 AM','11:30 AM','1:00 PM','2:30 PM','4:00 PM'];
begin
  while d <= current_date + 42 loop
    if extract(dow from d) in (0,6) then
      foreach t in array times loop
        insert into slots (date, time, booked_by)
        values (to_char(d,'YYYY-MM-DD'), t, null)
        on conflict (date, time) do nothing;
      end loop;
    end if;
    d := d + 1;
  end loop;
end $$;


-- ============================================================
-- MAKE YOURSELF ADMIN (once, after you sign up on the site):
--   update profiles set roles = array['user','admin']
--     where email = 'you@example.com';
--
-- To make yourself BOTH admin and tutor:
--   update profiles set roles = array['user','admin','tutor'],
--     tutor_status = 'approved'
--     where email = 'you@example.com';
-- ============================================================
