# Moph

Personal site. Public page at `/`, admin at `/admin.html`.

## Setup

Vercel env vars:
- `ADMIN_KEY` — the key I type into admin
- `SUPABASE_URL` — project URL
- `SUPABASE_SERVICE_KEY` — service role key

Supabase:
- Tables: `site_content`, `site_projects`, `site_meta`
- Bucket: `site-images` (public read)
- SQL for all of it is in `supabase.sql`

## Deploy

Push to repo. Import to Vercel. Done.

## First run

1. Open `/admin.html`
2. Enter the admin key
3. Fill the sections, save
4. Add projects
5. Open `/`
