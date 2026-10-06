-- Private staging bucket for file uploads.
--
-- Vercel rejects any request to our server larger than 4.5 MB, so files can't
-- be sent inside a form to the API. Instead the browser uploads each file
-- straight here with a one-time signed upload link (app/api/uploads/sign,
-- lib/stage-uploads.ts), and the API route that receives the form reads it
-- back with the service role, validates it against that upload's real limits
-- (lib/upload-limits.ts), stores it in its usual bucket, and deletes the staged
-- copy (lib/staged-uploads.ts). Anything never picked up is removed after two
-- days.
--
-- No storage policies: signed upload links work without them, and only the
-- server (service role) ever reads or deletes from this bucket.

insert into storage.buckets (id, name, public, file_size_limit)
values ('upload-staging', 'upload-staging', false, 52428800)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit;
