# TerraLens 7.1.1

- **Profile page:** the Creator stats box now comes before your posts (above them on a phone, on the left on a computer).
- Removed two extras I had added that you did not ask for: the pinned "Your uploads" row on Explore and the "My uploads" menu link. Load more on Explore, the profile and the admin list stays, so a huge number of places never needs endless scrolling.

# TerraLens 7.1

- **Generate plan now generates a real plan** (it used to print a placeholder). Add places (search, pick from your saved places, or tap Add to trip on a place), choose dates, budget and preferences, and tap Generate plan. It groups nearby places into days, adds the distance and travel time between places, and shows each place's best time, how to get there, entry fee and best season, with a warning if your dates fall outside the best season. Ask TerraLens AI is still there: it now improves the plan you generated and shows its answer below it instead of replacing it. Plan builder: `src/js/planner.js` (tested).
- **Admins can edit any upload at any time:** an Edit button on every place in the admin list and on place pages. No one-hour limit, no photo cap, and hidden places can be edited.
- **Your uploads come first, even with millions of places:** the profile page shows your uploads right under your header, newest first, 12 at a time with Load more; Explore pins a "Your uploads" row at the top and has Load more; the admin list has a My uploads filter and Load more; a "My uploads" link is in the menu.

# TerraLens 7.0.5: back button on every page

Every page now has a Back button at the top, except the home page (there is nothing before it). It is added automatically (`injectBack` in `src/js/app.js`), so any new page gets one too. Long reading pages (Terms, Privacy, Content Policy, About) and place pages also have the round arrow that stays in the corner. Arriving from another TerraLens page goes back one step; arriving any other way goes to the home page.

# TerraLens 7.0.4: back arrows

- **Back arrow on place pages:** a "Back" button at the top and a round arrow button that stays in the bottom-left corner while you scroll, so you can leave when you finish reading. Also on the edit page and on a collection page.
- **Goes back where you came from:** if you arrived from another TerraLens page it goes back one step; if you opened the link directly (for example from WhatsApp) it goes to Explore instead of doing nothing.
- **Explore remembers your place:** your search, category and country now stay in the address, and the list scrolls back to where you were when you return from a place.

# TerraLens 7.0.3: full information for every seeded place

`supabase/seed-places.sql` now fills, for each of the 95 places: full description (3+ sentences), name, country, region and city, how to get there, entry fee, best season, and best time of day. Fees and times are approximate and each fee says to confirm before you go.
Run it once. It adds missing places as drafts, upgrades places from the earlier shorter seed (only if you have not edited them), and skips places you added yourself. Tested: fresh database, upgrade, and skip-your-own all finish with no errors and no empty fields.

# TerraLens 7.0.2: seed skips places you already added

`supabase/seed-places.sql` now skips any place you added yourself, even if the name or spelling differs a little (Victoria Falls, Lake Malawi, Mount Cameroon, Anse Source d'Argent and Bwindi are matched). It adds 90 new draft places, so with your 6 you have 96. Safe to re-run.

# TerraLens 7.0.1: no more flash on place pages

The like hearts, the Save button, the "By name" line and the Edit button used to appear in their default state and then change a moment later. The place page now loads your stored session and your likes, saved state and the uploader in one parallel step before the first paint, so everything shows the right state straight away. Checked in a simulated browser for visitors, signed-in users, owners and pending places.

# TerraLens 7.0

## Do these first (in order)
1. **Vercel:** add `OPENROUTER_API_KEY` (create one at openrouter.ai/keys). Optional: `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`). You can delete `DEEPSEEK_API_KEY`. Redeploy.
2. **Supabase SQL editor:** if you have not yet, run `supabase/schema.sql` once (unchanged since 6.9).
3. **Seed 95 places:** sign in once with your admin Google account, then run `supabase/seed-places.sql` once. It adds 95 places (16 each for Waterfall, Mountain, Beach, Lake and Forest, 15 for Culture) as drafts.
4. **Open `/admin.html` and tap "Add photos to new places".** It finds a real Unsplash photo (with credit) for up to 40 places per tap and publishes each one. Unsplash's demo key allows about 50 searches an hour, so tap again after an hour for the rest (3 taps total).
5. **Contact email:** the legal pages show `asonganyirandy143@gmail.com` (the only email I have). Change it in `src/js/site.js` if you want a different public address.

## What changed
- **Cards:** every place card now has a **View** button, plus the uploader's name with the gold badge if they are verified. The word "Verified" is gone everywhere (comments, place page); only the badge shows. Place pages show "By name" for any uploader.
- **No more sign-in flash:** the header waits for your stored session instead of a network call, so you never see "Sign in" before your name. (If scripts fail it still appears after 1.8 seconds.)
- **Styled pop-ups:** the browser's grey alert, confirm and prompt boxes are replaced by site-styled dialogs and toasts (`src/js/ui.js`): new collection name, delete and remove confirmations, moderation actions.
- **Real legal pages:** full Terms of Service, Privacy Policy and a new Content Policy (`content-policy.html`), linked from every footer and the login page. I am not a lawyer: have them reviewed for your country before you rely on them.
- **AI now uses OpenRouter.** Admin -> Check setup tests the key and its credit.
- **95 starter places** with descriptions, coordinates and best seasons, spread across the categories.

# TerraLens 6.9: comments, simpler verified label

- **Comments on place pages** (there were none before): signed-in users can post, delete their own, and report others. Each comment shows the user's name, and verified users get the gold badge with the word "Verified" (no "photographer"). Signed-out visitors can read comments and see a sign-in button. Comments only exist on live places. Limit: 15 per hour per user. Admins moderate from the Comments and Reports tabs.
- **Verified label:** the place page now shows the uploader's name with the gold badge and "Verified".
- **Run the new `supabase/schema.sql` once** (safe to re-run). It tightens comment rules: comments on hidden or unreviewed places can no longer be read, and posting needs a live place.

# TerraLens 6.8.1: saved places are now reachable

Nothing on the site linked to the Saved page, so people could save places but never find them. Added a "Saved" link to the menu (desktop and hamburger), the footer, and the profile's Saved count. The Saved page now asks signed-out visitors to sign in, shows newest first, has a "Remove from saved" button, and explains when a saved place is hidden or under review.

# TerraLens 6.8: one-hour edit window, cleaner Explore filters

- **Edit window = 1 hour.** Uploaders can edit their place (details and photos) for one hour after uploading it. After that the Edit button disappears, the edit page explains why, and the database refuses the change. Admins are not limited, and owners can still delete their own place. Profile cards show "Edit · N min left". To change the length, edit `edit_window()` in `schema.sql` (and `EDIT_WINDOW_MS` in `src/js/app.js`).
- **Explore page:** the separate "Country" text box duplicated the search box. It is now a dropdown of countries that actually have places, so it no longer overlaps. Filters apply as soon as you pick one, and Enter runs the search.

**Run the new `supabase/schema.sql` once** (safe to re-run).

# TerraLens 6.7: edits, logout, gold badge, public browsing

- **Public browsing is back (default):** anyone can view pages. Uploading, editing, liking, saving, reporting and the AI assistant need Google sign-in. (The optional sign-in wall now only turns on if you set `REQUIRE_LOGIN=true`.) The Upload page shows a "Sign in to upload" box for visitors.
- **Sign out:** new `logout.html`, plus "Sign out" in the menu and on your profile page.
- **Hamburger menu:** a "Home" item is now first in the list on every page.
- **Edit your uploads (`edit.html`):** from your profile (each place has an Edit button and a status) or from the place page. Change details, add photos (max 10), remove your own photos. No time limit. Rules enforced in the database: unverified owners who change a LIVE place (details or a new photo) send it back to review; verified contributors edit live; places a moderator hid cannot be edited by the owner. Tested with simulated users.
- **Gold verified badge:** the Lucide `badge-check` icon, filled gold with a white check, shown on profiles, place pages and the admin contributor list.
- **AI assistant:** failures now give a clear message, and Admin -> Check setup has a new "DeepSeek has credit" line. A working key with no credit is the most common reason the assistant fails.

**Run the new `supabase/schema.sql` once** (it includes the edit rules; safe to re-run).

# TerraLens 6.6.3: tolerant environment variables

Keys pasted on a phone often include a hidden space, newline, quotes or a trailing slash. The server (and the build) now clean every value before using it. Admin -> Check setup also explains whether the server can see your Supabase variables at all.

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
