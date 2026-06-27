# BrightPath - Setup and Keep-Alive Guide

This covers (A) connecting Supabase, (B) keeping the free database
awake with BOTH methods you asked for, and (C) going live.

------------------------------------------------------------
## A. Connect Supabase (once)

1. Create a project at supabase.com.
2. Open the SQL Editor, paste all of `schema.sql`, and click Run.
   This builds the tables, the security rules, and the starter
   subjects and weekend slots.
3. Go to Settings -> API and copy:
   - Project URL
   - anon public key
4. Paste both into `config.js`.
5. Make yourself admin:
   - Open your site and SIGN UP with your own email.
   - Back in the SQL Editor, run (with your email):
       update profiles set role = 'admin' where email = 'you@example.com';
   - Log out and back in. You now get the admin dashboard.

Note on signup emails: by default Supabase may require users to
confirm their email before they can log in. To allow instant
sign-in during testing, go to Authentication -> Providers -> Email
and turn OFF "Confirm email". Turn it back on for real use if you
want verified addresses.

------------------------------------------------------------
## B. Keep the free database awake (two layers)

A free Supabase project pauses after 7 days with no activity. You
asked for both methods below. Running both is belt-and-suspenders;
either one alone is enough.

### Method 1: GitHub Actions (lives in your repo)

Already included: `.github/workflows/keep-alive.yml`.

1. Push your project to a GitHub repository.
2. In the repo: Settings -> Secrets and variables -> Actions ->
   New repository secret. Add two secrets (exact names):
     SUPABASE_URL       = your Project URL
     SUPABASE_ANON_KEY  = your anon public key
3. That's it. It runs every 3 days automatically. You can also run
   it on demand from the repo's "Actions" tab (handy to test it).

Why secrets instead of reading config.js? The workflow runs on
GitHub's servers, not in a browser, so it pulls the values from
repo secrets. This keeps the workflow self-contained.

### Method 2: Uptime Robot (external monitor)

1. Create a free account at uptimerobot.com.
2. Add New Monitor:
     - Monitor Type: HTTP(s)
     - Friendly Name: BrightPath Supabase
     - URL: https://YOUR-PROJECT-ID.supabase.co/rest/v1/subjects?select=id&limit=1
     - Monitoring interval: every 5 minutes (or the free minimum)
3. Open "Advanced" / custom HTTP headers and add:
     apikey: YOUR-ANON-PUBLIC-KEY
   (Some plans label this "Custom HTTP Headers". If you cannot add
   a header, the request may return 401, which STILL counts as
   activity and keeps the project awake, so it works either way.)
4. Save. Uptime Robot now pings every few minutes around the clock.

------------------------------------------------------------
## C. Go live

Upload these together to your static host (GitHub Pages, Netlify,
Cloudflare Pages, etc.), keeping them in the same folder:
   - index.html
   - config.js
   - .github/workflows/keep-alive.yml   (only needed on GitHub)

On GitHub Pages: push the repo, then Settings -> Pages -> Deploy
from branch -> main. Your site appears at
https://yourusername.github.io/reponame/

Point your custom domain at the host from your domain provider's
DNS settings when you are ready.

------------------------------------------------------------
## Files in this project

- index.html   The website shell (markup + styles).
- js/          The JavaScript, split into modules:
    data.js, auth.js, views.js, public.js,
    dashboard-user.js, dashboard-tutor.js,
    dashboard-admin.js, app.js
- config.js    Your Supabase URL and key. The only file you edit.
- schema.sql   Run once in Supabase to build tables and security.
- .github/workflows/keep-alive.yml   GitHub Actions keep-alive.
- SETUP.md     This guide.

## Security summary

- Login uses Supabase Auth: passwords are hashed, never stored by us.
- Row Level Security means the public anon key cannot read other
  families' data. A user sees only their own bookings; only admins
  see everything.
- It is fine that config.js is public; the anon key is designed to
  be, and the database enforces all access rules.
