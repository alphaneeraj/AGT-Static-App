-- Airlines Group Travel – Supabase schema
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- What it sets up:
--   leads           quote-form submissions (anyone can INSERT, only admins can read/update/delete)
--   admins          emails allowed into /admin/
--   admin_settings  private key/value store (holds the GitHub token so admins log in only once)

create extension if not exists pgcrypto;

-- ---------- admins ----------
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select to authenticated using (public.is_admin());

-- ---------- leads ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 120 and email like '%@%'),
  phone text not null check (char_length(phone) between 5 and 30),
  trip_type text check (char_length(trip_type) <= 20),
  origin text check (char_length(origin) <= 80),
  destination text check (char_length(destination) <= 80),
  depart_date date,
  return_date date,
  passengers int check (passengers between 1 and 999),
  cabin text check (char_length(cabin) <= 30),
  message text check (char_length(message) <= 2000),
  page_url text check (char_length(page_url) <= 300),
  referrer text check (char_length(referrer) <= 300),
  utm text check (char_length(utm) <= 300),
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'booked', 'closed', 'spam')),
  notes text
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
alter table public.leads enable row level security;

-- Public site may only insert new leads, and cannot set status/notes.
drop policy if exists "public insert leads" on public.leads;
create policy "public insert leads" on public.leads for insert to anon, authenticated
  with check (status = 'new' and notes is null);

drop policy if exists "admins read leads" on public.leads;
create policy "admins read leads" on public.leads for select to authenticated using (public.is_admin());
drop policy if exists "admins update leads" on public.leads;
create policy "admins update leads" on public.leads for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete leads" on public.leads;
create policy "admins delete leads" on public.leads for delete to authenticated using (public.is_admin());

-- ---------- admin settings ----------
create table if not exists public.admin_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.admin_settings enable row level security;
drop policy if exists "admins manage settings" on public.admin_settings;
create policy "admins manage settings" on public.admin_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Only the operations above are granted.
revoke all on public.leads from anon;
grant insert on public.leads to anon;
grant select, insert, update, delete on public.leads to authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.admin_settings to authenticated;

-- ---------- add your admin(s) ----------
-- 1. Supabase → Authentication → Users → "Add user" (email + password, auto-confirm).
-- 2. Then allow that email into the admin portal:
-- insert into public.admins (email) values ('you@example.com') on conflict do nothing;
