-- Anonymous developer reports from the public /developers page: bug reports,
-- improvement ideas and security issues, with optional proof files
-- (screenshots, PDFs, short screen recordings).
--
-- Anonymous on purpose: no account is linked, even when the sender happens to
-- be signed in. A contact email is stored only if they choose to give one.
-- Rows are written by the server with the service role
-- (app/api/developer-reports) after validation and rate limiting - there is
-- no insert policy. Only administrators can read or update them.

create table if not exists public.developer_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  report_type text not null check (report_type in ('bug', 'improvement', 'security', 'other')),
  title text not null,
  description text not null,
  steps_to_reproduce text,
  page_url text,
  severity text check (severity in ('low', 'medium', 'high', 'critical')),
  contact_email text,
  -- Browser/device of the sender, for reproducing bugs.
  user_agent text,
  -- Storage paths in the private developer-reports bucket.
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'fixed', 'dismissed')),
  admin_notes text,
  updated_at timestamptz not null default now()
);

create index if not exists developer_reports_created_at_idx on public.developer_reports(created_at desc);
create index if not exists developer_reports_status_idx on public.developer_reports(status, created_at desc);

alter table public.developer_reports enable row level security;

drop policy if exists "Admins can view developer reports" on public.developer_reports;
create policy "Admins can view developer reports"
on public.developer_reports for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can update developer reports" on public.developer_reports;
create policy "Admins can update developer reports"
on public.developer_reports for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Private bucket for proof files; admins open them through short-lived signed
-- URLs. Senders upload straight to it with one-time signed upload links (see
-- app/api/developer-reports/uploads), and the bucket itself enforces the
-- limits too: 25 MB per file, images/PDF/MP4/WebM only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'developer-reports',
  'developer-reports',
  false,
  26214400,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can read developer report files" on storage.objects;
create policy "Admins can read developer report files"
on storage.objects for select to authenticated
using (bucket_id = 'developer-reports' and public.is_admin());
