# TerraLens 6.6.2: upgrading a half-set-up database

If you already ran an older `schema.sql` and/or `003_admin.sql`, just run the NEW `supabase/schema.sql` once. It upgrades everything and repairs the admins table check. Tested: original schema -> old 003 file (with an edited email check) -> new schema.sql finishes with no errors and a second admin can be added.

# TerraLens 6.6.1: database setup made simple and tested

- **Run ONE file:** `supabase/schema.sql` already contains everything (migrations 002-005 are only for databases set up from an older version). It is now safe to run more than once.
- I tested the full schema on a real Postgres: fresh install, running it twice, and running the migrations on top all finish with no errors. Security rules were checked with simulated users (self-verify blocked, unconfirmed email blocked, fake likes reset, one like per user, likers hidden, admin-only functions).
- **Login goes to localhost?** In Supabase -> Authentication -> URL Configuration set Site URL to your live address and add `https://YOUR-ADDRESS/login.html` under Redirect URLs.

# TerraLens 6.6: photo categories, setup check, sign-in wall

- **Real photos on the home page categories** (no more emojis). Each tile shows a TerraLens place photo from that category when one exists, otherwise a photo fetched from Unsplash with your key (cached for a day), with photographer credit under the tiles. New route: `api/unsplash/categories.js`.
- **Admin -> "Check setup" button** (`api/health.js`, admin only): tests your Vercel variables for real (Supabase reachable, Google sign-in on, Email sign-in off, Unsplash key, DeepSeek key, SITE_URL format). It never shows secret values.
- **Sign-in wall (ON by default):** visitors are sent to the login page for everything except login, terms and privacy. To open browsing to the public again, add the Vercel variable `REQUIRE_LOGIN=false` and redeploy. This is a page-level wall; the database still allows public reads of published places.
- **Fixed a bug I introduced earlier:** the planner's AI button did not send the sign-in token, so it always failed. It now does.

# Earlier: 6.5 Google-only sign-in, photo likes, logo

## Do these first (in order)
1. **Google sign-in setup (once):**
   - Google Cloud Console -> APIs & Services -> Credentials -> Create OAuth client ID (Web application). Under "Authorized redirect URIs" add your Supabase callback: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (shown in Supabase -> Authentication -> Sign In / Providers -> Google).
   - Copy the Client ID and Client Secret into Supabase -> Authentication -> Sign In / Providers -> Google and enable it.
   - Supabase -> Authentication -> URL Configuration: set Site URL to your live domain and add `https://YOUR-DOMAIN/login.html` (and `http://localhost:3000/login.html` for testing) to Redirect URLs.
2. **Turn OFF the Email provider** (Authentication -> Sign In / Providers -> Email). Otherwise anyone can still create accounts through the API and bypass Google. This also removes the broken email-confirmation step.
3. **SQL editor:** run `supabase/migrations/005_photo_likes.sql` (after 004). Fresh installs: `schema.sql` has everything.
4. **Admin:** your admin email must be the email of your Google account. Sign in with Google once, then run the `insert into public.admins ...` line from `003_admin.sql` with that email.
5. Deploy. Set `SITE_URL` in Vercel so social previews get a full image URL.

## What changed
- **Google-only login:** the email/password form is gone. After Google returns you to the site, you are sent back to the page you came from (the old page left you stuck on the login screen). Google accounts always count as verified, so uploads, reports and likes work without the confirm-email step.
- **Photo likes:** every photo on a place page has a heart and count. One like per user per photo is enforced by the database (primary key), not just the button. Only published places can be liked, nobody can see who liked what, and a user can't like more than 300 times an hour. Uploaders can't give their own photos starting likes.
- **All photos now show:** the place page used to show only the first 3 photos; it now shows every photo in a gallery.
- **Your logo:** full logo, rounded app-icon version (header, footer, favicon, profile fallback) and a 1200x630 social-sharing image are in `assets/`.

## 6.5 test checklist
1. Open `login.html`: only the Google button shows. Sign in and you land back on the page you started from.
2. Like a photo, refresh: heart stays filled and count is 1. Tap again: it unlikes. Try liking from two accounts: count is 2.
3. In the browser console, try inserting the same like twice: the second one is rejected.
4. Sign out: the heart sends you to login instead of liking.
5. Share a place link in WhatsApp/Telegram: the logo preview appears (needs `SITE_URL`).

# Earlier: 6.4 moderation, verification and reports

## Do these first
1. **Supabase -> Authentication -> Sign In / Providers -> Email:** turn ON "Confirm email". If it is off, every new account counts as confirmed immediately and the upload rule does nothing.
2. **SQL editor:** run `supabase/migrations/004_moderation.sql` (after 002 and 003). Fresh installs: `schema.sql` has it all.
3. Deploy. The build regenerates `src/styles/tailwind.css`.

## What changed
- **Review before publishing:** new places from normal users get status `pending` and are invisible to the public until you approve them in `/admin.html` (Places tab, "Approve"). Verified contributors publish instantly. The admin page opens on the pending list when something is waiting.
- **Verification:** you tap Verify in the new Contributors tab. It shows approved photos, approved places and upheld reports (90 days) and marks users "Eligible" at 100+ approved photos, 10+ approved places and no upheld reports. Users cannot verify themselves (database trigger). Verified users get a badge on their places.
- **Reports:** a "Report this place" form on every place page (signed-in, confirmed email, one report per place, 10 per day). Admin Reports tab: Dismiss or Hide place / Delete comment.
- **Photo moderation:** open a place's Details in admin to see every photo and remove single photos.
- **Upload limits:** confirmed email required to upload; 5 new places per day (20 if verified); max 20 places waiting review; max 10 photos per place (enforced in the database, not just the form).
- **Photos shrink in the browser** to 2000px JPG before upload, which also strips GPS/EXIF data. Input files up to 25 MB are accepted.

# Earlier: 6.3 security, SEO and admin

## Do these first (in order)
1. **Supabase SQL editor:** run `supabase/migrations/002_security_hardening.sql`, then `003_admin.sql` (fresh installs: `schema.sql` already has both).
2. **Make yourself admin:** sign in with your email (confirm it), then run
   `insert into public.admins (email) values ('your-email@example.com') on conflict do nothing;`
3. **Vercel env vars:** `SITE_URL` (your domain), `UNSPLASH_ACCESS_KEY`, `DEEPSEEK_API_KEY`, plus the Supabase ones. Optional: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
4. **Add your logo** at `assets/terralens-logo.png`.
5. Deploy. The build now runs `npm install` and generates `src/styles/tailwind.css`.

## New in 6.3
- **Admin page `/admin.html`:** stats; search/filter places; change status (published/draft/hidden); toggle featured and sponsored; edit sponsor name and affiliate link; delete places; moderate comments; add Unsplash photos with credit.
  Security: access is decided by the database (`is_admin()` checks a confirmed email in `public.admins`). The page and nav link are only convenience; RLS blocks everyone else even if they open the page.
- **Server-rendered place pages** at `/place/:slug` (`api/place.js`): real title, description, Open Graph, canonical and JSON-LD in the HTML, 404 for unknown slugs. Sitemap now lists `/place/...` URLs.
- **Monetisation wired up:** sponsored badge and "Plan your trip" affiliate button (rel="sponsored") with disclosure on place pages.
- **Unsplash done properly:** admin photo picker, photographer credit shown on place pages, download tracking via `api/unsplash/download.js` (admin only).
- **Tailwind build step** replaces the dev-only CDN script (faster, works with CSP).
- **Content-Security-Policy + HSTS headers** in `vercel.json`.
- **Strict rate limits** when Upstash is configured (falls back to per-instance memory).

## From 6.2 (still in place)
Open redirect fix, locked-down uploads, protected revenue columns, `place_images` ownership, signed-in AI route, hardened Unsplash search, search-injection fix, sign-in/sign-up split, save toggle, not-found page, accessibility fixes, pinned versions.

## Known limits
- I could not run this against a live Supabase/Vercel project. Test the checklist below.
- CSP still allows `'unsafe-inline'` scripts because pages use inline module scripts. If anything breaks, check the browser console; to debug, rename the header key to `Content-Security-Policy-Report-Only`. Using a custom Supabase domain needs it added to `connect-src`.
- Deleting a place doesn't delete its files from Storage (orphans). Clean them in the Supabase dashboard.
- Admin changes are not logged (no audit trail).

## Test checklist
1. Signed-out or non-admin user opens `/admin.html` → "You don't have access" (and edits via the API fail).
2. Admin: set a place to hidden → it disappears from Explore and `/place/slug` returns 404.
3. Admin: mark sponsored + add an https affiliate link → badge and button appear on the place page.
4. `login.html?next=https://evil.site` → lands on `profile.html`.
5. Normal user tries to set `sponsored` on their own place → stays false.
6. `/api/ai/chat` without a token → 401.
7. View source of `/place/<slug>` → title, description and JSON-LD are present without JavaScript.

## 6.4 test checklist
1. Create a normal account, confirm the email, upload a place: you see "submitted for review" and it is NOT on Explore.
2. In admin, approve it: it appears on Explore and gets a `/place/slug` page.
3. Try uploading with an unconfirmed email: blocked.
4. Report a place from a second account: it shows in Admin -> Reports; Hide place hides it.
5. As a normal user, update your own profile with `verified: true` from the browser console: it stays false.
6. Try a 6th place within 24 hours: "Daily upload limit reached".

## Not done yet
Captcha on signup (Cloudflare Turnstile), automatic image-content scanning, visitor reports for individual comments, image CDN sizes, analytics, error monitoring, backups, final legal pages.
