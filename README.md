# TransitOps — v0.1

## Setup

1. **Create a GitHub repo** and upload all these files (keep the folder structure — `lib/`, `pages/`, `styles/` must stay as folders).
2. **Get your Supabase keys**: in your Supabase project → Project Settings → API → copy the "Project URL" and the "anon public" key.
3. **In Vercel**: New Project → import your GitHub repo → before deploying, add two Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key
   Then deploy. Vercel auto-detects Next.js — no extra config needed.
4. **Create your first login**: in Supabase → Authentication → Users → Add user (enter your email + a password).
5. **Link that user to a profile**: in Supabase → Table Editor → `profiles` → Insert row:
   - `id` = the UUID of the user you just created (copy from Authentication → Users)
   - `full_name` = your name
   - `role` = `owner`
6. Visit your Vercel URL, log in with that email/password — you should land on the (currently placeholder) home page.

## What's here
- `pages/login.js` — sign-in screen
- `pages/index.js` — placeholder home page (checks you're logged in, shows your name/role, sign-out button). The control tower dashboard replaces this next.
- `lib/supabaseClient.js` — the one place the app talks to Supabase

## Local development (optional)
If you ever want to run it on your own PC instead of only via Vercel:
```
npm install
cp .env.local.example .env.local   # then fill in your real keys
npm run dev
```
