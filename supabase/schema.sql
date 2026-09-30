-- DrainLift — Supabase schema
--
-- Paano gamitin: i-paste ang buong file na ito sa Supabase dashboard mo, sa
-- "SQL Editor" (kaliwang sidebar) -> "New query", tapos i-click ang "Run".
-- Isang beses mo lang ito kailangang patakbuhin (sa unang setup).

-- =========================================================
-- 1. PROFILES — extra info ng bawat barangay official / admin
--    (ang email at password mismo ay hawak na ng Supabase Auth,
--    dito lang ang name, phone, role)
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Admin User',
  phone text not null default '',
  role text not null default 'Facility Admin',
  created_at timestamptz not null default now()
);

-- Awtomatikong gumawa ng profile row tuwing may bagong nag-sign up na user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- 2. NOTIFICATION_STATE — iisang row lang, ito ang "kasalukuyang buhay"
--    na estado ng waste compartment at ng notification cycle
-- =========================================================
create table if not exists public.notification_state (
  id int primary key default 1,
  waste_status text not null default 'NOT_FULL',
  fill_level int not null default 0,
  notification_status text not null default 'NOT_SENT',
  notification_sent_at timestamptz,
  acknowledged_at timestamptz,
  actuator_active boolean not null default false,
  released_at timestamptz,
  released_by text,
  constraint single_row check (id = 1)
);

-- Simulahan ang iisang row (kung wala pa)
insert into public.notification_state (id)
values (1)
on conflict (id) do nothing;

-- =========================================================
-- 3. NOTIFICATION_HISTORY — audit trail, isang row bawat resolved na
--    notification cycle (acknowledged, released, o auto-expired)
-- =========================================================
create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  notification_sent_at timestamptz not null,
  acknowledged_at timestamptz,
  released_at timestamptz,
  released_by text,
  fill_level int,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 4. ROW LEVEL SECURITY
--    Ang mga WRITE (sensor reading, acknowledge, release) ay dumadaan sa
--    server routes gamit ang service_role key, na naka-bypass sa RLS —
--    kaya hindi na kailangan ng "insert/update" policy dito para roon.
--    Ang mga policy sa baba ay para lang sa direktang pagbasa/pag-edit
--    mula sa browser (profile, at pagtingin ng estado/history).
-- =========================================================
alter table public.profiles enable row level security;
alter table public.notification_state enable row level security;
alter table public.notification_history enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Authenticated users can read notification state" on public.notification_state;
create policy "Authenticated users can read notification state"
  on public.notification_state for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read notification history" on public.notification_history;
create policy "Authenticated users can read notification history"
  on public.notification_history for select
  using (auth.role() = 'authenticated');
