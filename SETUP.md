# TerraLens setup

## 1. Environment

Copy `.env.example` to `.env.local`.

Use:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `UNSPLASH_ACCESS_KEY`
- `DEEPSEEK_API_KEY`

Do not paste secret keys into HTML or JavaScript.

## 2. Supabase

Open the Supabase SQL editor and run `supabase/schema.sql`.

Enable Google under Authentication → Providers.

Set your redirect URL to the deployed TerraLens login callback:

`https://YOUR-DOMAIN/login.html`

Also add your local Vercel URL while testing.

## 3. Storage

The SQL creates a public `place-images` bucket and policies. Verify the bucket exists after running the script.

## 4. Vercel

Import the repository and add all four environment variables.

Use Vercel's serverless runtime for `/api`.

## 5. Important

The Unsplash integration is for discovery/seed imagery. The long-term community product should use TerraLens/Supabase Storage for user uploads.

Review Unsplash API attribution, hotlinking, caching and rate-limit rules before launch.

Review all legal text and payment/affiliate terms before monetization.

## Admin page (v6.3)
1. Run `supabase/migrations/002_security_hardening.sql`, then `003_admin.sql`, in the Supabase SQL editor.
2. Sign in to TerraLens with your email and confirm it (Google sign-in counts as confirmed).
3. In the SQL editor run: `insert into public.admins (email) values ('your-email@example.com') on conflict do nothing;` (lowercase).
4. Open `/admin.html`. An "Admin" link also appears in the nav for admins only.
Optional: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel for strict, shared rate limits.

## Sign-in (v6.5)
TerraLens uses Google sign-in only. See "Do these first" in CHANGES.md for the Google Cloud + Supabase setup, and disable the Email provider in Supabase.
