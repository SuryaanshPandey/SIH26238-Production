-- SIH26238 v25 FREE deployment setup
-- Run this in the Supabase SQL Editor after creating the project.
-- The Operations service uses Prisma against the same Postgres database.
-- The Verification service creates its JSONB tables automatically at startup.

-- Create the private document bucket used by the Verification API.
insert into storage.buckets (id, name, public)
values ('sih26238-documents', 'sih26238-documents', false)
on conflict (id) do nothing;

-- No public storage policies are created intentionally.
-- The Verification backend uses SUPABASE_SERVICE_ROLE_KEY server-side to upload
-- objects, so documents are not anonymously readable from the client.

-- For the Operations service, no hand-written table SQL is necessary.
-- Its Prisma schema is configured for PostgreSQL and the Render start command
-- runs `prisma db push` against DATABASE_URL.
