-- Anonymous tip-offs (whistleblowing) from the homepage: anyone can report a
-- registered organization for suspected fraud, misuse of donations, scams,
-- abuse or other illegal or suspicious activity, and the HelpLift team
-- investigates. Shown in the admin dashboard's Inquiries tab.
--
-- Anonymous on purpose: no account, IP address or device is stored, even when
-- the sender happens to be signed in. A contact email is kept only if they
-- choose to give one. Rows are written by the server with the service role
-- (app/api/tip-offs) after validation and rate limiting - there is no insert
-- policy. Only administrators can read or update them, and the organization
-- is never told.

create table if not exists public.tip_offs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- The organization reported: linked when picked from the list, otherwise
  -- just the name as typed.
  organization_id uuid references public.organizations(id) on delete set null,
  organization_name text not null,
  category text not null check (category in ('fraud', 'fake_organization', 'scam', 'abuse', 'corruption', 'other')),
  details text not null,
  -- When it happened, in the sender's own words (optional).
  occurred_at_text text,
  contact_email text,
  -- Storage paths in the private tip-off-evidence bucket.
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'investigating', 'action_taken', 'unfounded', 'closed')),
  admin_notes text,
  updated_at timestamptz not null default now()
);

create index if not exists tip_offs_created_at_idx on public.tip_offs(created_at desc);
create index if not exists tip_offs_status_idx on public.tip_offs(status, created_at desc);
create index if not exists tip_offs_organization_idx on public.tip_offs(organization_id);

alter table public.tip_offs enable row level security;

drop policy if exists "Admins can view tip-offs" on public.tip_offs;
create policy "Admins can view tip-offs"
on public.tip_offs for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can update tip-offs" on public.tip_offs;
create policy "Admins can update tip-offs"
on public.tip_offs for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Private bucket for evidence; admins open files through short-lived signed
-- URLs. Senders upload straight to it with one-time signed upload links (see
-- app/api/tip-offs/uploads). 25 MB per file, images/PDF/MP4/WebM only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tip-off-evidence',
  'tip-off-evidence',
  false,
  26214400,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can read tip-off evidence" on storage.objects;
create policy "Admins can read tip-off evidence"
on storage.objects for select to authenticated
using (bucket_id = 'tip-off-evidence' and public.is_admin());
