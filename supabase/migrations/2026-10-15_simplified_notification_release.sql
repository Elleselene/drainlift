alter table public.notification_state
  add column if not exists release_armed boolean not null default true,
  add column if not exists full_override_active boolean not null default false,
  add column if not exists actual_fill_level int,
  add column if not exists released_at timestamptz,
  add column if not exists released_by text,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists reset_at timestamptz;

alter table public.notification_history
  add column if not exists status text,
  add column if not exists reset_at timestamptz;

alter table public.notification_state
  drop constraint if exists notification_state_notification_status_check;

create table if not exists public.motor_command (
  id int primary key default 1,
  command text,
  command_id bigint,
  created_at timestamptz default now(),
  constraint motor_command_single_row check (id = 1)
);

insert into public.motor_command (id) values (1) on conflict (id) do nothing;

update public.notification_history
set status = case
  when released_at is not null then 'RELEASED'
  else 'ACKNOWLEDGED'
end
where status is null;

update public.notification_state
set notification_status = 'NOT_SENT',
    notification_sent_at = null,
    acknowledged_at = null,
    released_at = null,
    released_by = null,
    reset_at = null,
    release_armed = true,
    waste_status = case when fill_level >= 100 then 'FULL' else 'NOT_FULL' end
where id = 1;
