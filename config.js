/* ============================================================
   BrightPath Tutoring - Configuration
   ------------------------------------------------------------
   Edit the values below. You do NOT need to touch index.html.

   WHERE TO FIND THESE:
   In your Supabase dashboard, go to:  Settings  ->  API
     - SUPABASE_URL      = the "Project URL"
     - SUPABASE_ANON_KEY = the "anon" / "public" key

   IS IT SAFE THAT ANYONE CAN READ THIS FILE?
   Yes. The anon key is meant to be public. It can do nothing on
   its own: every table is protected by Row Level Security in the
   database (see schema.sql), and login is handled by Supabase Auth
   (passwords are hashed by Supabase, never stored by us). Security
   is enforced in the database, not by hiding this file.
   ============================================================ */

window.BRIGHTPATH_CONFIG = {

  /* ---- Supabase connection (REQUIRED) ---- */
  SUPABASE_URL: "https://YOUR-PROJECT-ID.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",

  /* ---- Admin access ----
     There is no admin password here anymore. To become an admin:
       1. Sign up on the site with your email like any user.
       2. In Supabase SQL Editor, run:
          update profiles set role = 'admin' where email = 'you@example.com';
     See the bottom of schema.sql for details.                    */

  /* ---- Branding / copy you might want to tweak ---- */
  SITE_NAME: "BrightPath",
  CONTACT_EMAIL: "hello@brightpathtutoring.ca",
};
