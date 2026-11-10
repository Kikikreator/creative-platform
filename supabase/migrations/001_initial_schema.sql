create extension if not exists pgcrypto;

-- Authentication profile. Passwords are stored only by Supabase Auth, never here.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  legacy_user_id text unique not null,
  username text not null,
  username_normalized text unique not null,
  role text not null,
  full_name text,
  position text,
  auth_email text unique not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  legacy_row_order integer not null default 0
);

create table if not exists public.clients (
  id text primary key,
  name text,
  institution text,
  whatsapp text,
  created_at timestamptz not null default now(),
  legacy_row_order integer not null default 0
);

create table if not exists public.resellers (
  id text primary key,
  name text,
  institution text,
  whatsapp text,
  created_at timestamptz not null default now(),
  legacy_row_order integer not null default 0
);

create table if not exists public.orders (
  id text primary key,
  order_date date,
  client_id text,
  reseller_id text,
  title text,
  items jsonb not null default '[]'::jsonb,
  items_json_raw text,
  total_pcs numeric not null default 0,
  description text,
  deadline date,
  status text,
  total_price numeric not null default 0,
  dp numeric not null default 0,
  remaining_bill numeric not null default 0,
  fee_per_piece numeric not null default 0,
  created_at timestamptz not null default now(),
  legacy_row_order integer not null default 0
);

-- Settings retains the legacy Key / Value / Harga_Upah model.
create table if not exists public.settings (
  id text primary key default gen_random_uuid()::text,
  key text not null,
  value text,
  wage_price numeric,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id text primary key,
  date date not null,
  username text,
  employee_name text,
  status text,
  time_in text,
  time_out text,
  late_minutes integer not null default 0,
  overtime_status text,
  location_in text,
  location_out text,
  note text,
  created_at timestamptz not null default now(),
  legacy_row_order integer not null default 0
);

create table if not exists public.kasbon (
  id text primary key,
  date date,
  employee_name text,
  work_items jsonb not null default '[]'::jsonb,
  work_items_json_raw text,
  total_wage numeric not null default 0,
  advance_amount numeric not null default 0,
  remaining_wage numeric not null default 0,
  created_at timestamptz not null default now(),
  legacy_row_order integer not null default 0
);

create table if not exists public.payroll (
  id text primary key,
  date date,
  employee_name text,
  position text,
  base_salary numeric not null default 0,
  bonus numeric not null default 0,
  advance numeric not null default 0,
  deduction numeric not null default 0,
  total_received numeric not null default 0,
  created_at timestamptz not null default now(),
  legacy_row_order integer not null default 0
);

create table if not exists public.hpp (
  id text primary key,
  order_id text,
  item_index integer not null default 0,
  item_name text,
  order_qty numeric not null default 0,
  cost_components jsonb not null default '[]'::jsonb,
  cost_components_json_raw text,
  total_hpp numeric not null default 0,
  hpp_per_piece numeric not null default 0,
  total_sales numeric not null default 0,
  gross_profit numeric not null default 0,
  margin_percent numeric not null default 0,
  status text,
  updated_at text,
  legacy_row_order integer not null default 0
);

create table if not exists public.operational_expenses (
  id text primary key,
  date date,
  description text,
  category text,
  amount numeric not null default 0,
  note text,
  created_at text,
  legacy_row_order integer not null default 0
);

create table if not exists public.expense_categories (
  id text primary key,
  name text not null,
  created_at text,
  legacy_row_order integer not null default 0
);

create table if not exists public.investor_records (
  id text primary key,
  created_at text,
  payload jsonb,
  raw_payload text,
  legacy_row_order integer not null default 0
);

create table if not exists public.master_tukang (
  id text primary key,
  name text not null,
  order_index integer not null default 0
);

create table if not exists public.investor_projects (
  id text primary key,
  investment_date date,
  return_date date,
  investor_name text,
  principal_amount numeric not null default 0,
  dividend numeric not null default 0,
  total_return numeric not null default 0,
  order_index integer not null default 0
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  target_table text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_order_date on public.orders(order_date);
create index if not exists idx_orders_client_id on public.orders(client_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_attendance_date_username on public.attendance(date, username);
create index if not exists idx_attendance_date_employee on public.attendance(date, employee_name);
create index if not exists idx_kasbon_date on public.kasbon(date);
create index if not exists idx_payroll_date on public.payroll(date);
create index if not exists idx_hpp_order_item on public.hpp(order_id, item_index);
create index if not exists idx_expenses_date on public.operational_expenses(date);
create index if not exists idx_profiles_username on public.profiles(username_normalized);

-- Client-side direct table access is denied. The Vercel API validates the
-- Supabase Auth JWT before using its server-only service-role key.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','clients','resellers','orders','settings','attendance','kasbon',
    'payroll','hpp','operational_expenses','expense_categories',
    'investor_records','master_tukang','investor_projects','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=t and policyname='deny_direct_client_access'
    ) then
      execute format(
        'create policy deny_direct_client_access on public.%I for all to anon, authenticated using (false) with check (false)',
        t
      );
    end if;
  end loop;
end $$;

create or replace function public.replace_settings_by_key(p_key text, p_values jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.settings where key = p_key;
  insert into public.settings(key, value, wage_price, order_index)
  select
    p_key,
    item->>'value',
    nullif(item->>'wage_price', '')::numeric,
    coalesce((item->>'order_index')::integer, ordinality::integer)
  from jsonb_array_elements(coalesce(p_values, '[]'::jsonb))
       with ordinality as x(item, ordinality);
end;
$$;

create or replace function public.replace_investor_records(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.investor_records;
  insert into public.investor_records(id, created_at, payload, raw_payload, legacy_row_order)
  select
    coalesce(item->>'id', 'INV-' || ordinality::text),
    coalesce(item->>'created_at', now()::text),
    item->'payload',
    item->>'raw_payload',
    coalesce((item->>'legacy_row_order')::integer, ordinality::integer)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
       with ordinality as x(item, ordinality);
end;
$$;

create or replace function public.replace_master_tukang(p_names jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.master_tukang;
  insert into public.master_tukang(id, name, order_index)
  select 'T-' || ordinality::text, value #>> '{}', ordinality::integer
  from jsonb_array_elements(coalesce(p_names, '[]'::jsonb))
       with ordinality
  where nullif(trim(value #>> '{}'), '') is not null;
end;
$$;

create or replace function public.replace_investor_projects(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.investor_projects;
  insert into public.investor_projects(
    id, investment_date, return_date, investor_name,
    principal_amount, dividend, total_return, order_index
  )
  select
    coalesce(item->>'id', 'IP-' || ordinality::text),
    nullif(item->>'investment_date', '')::date,
    nullif(item->>'return_date', '')::date,
    item->>'investor_name',
    coalesce(nullif(item->>'principal_amount','')::numeric, 0),
    coalesce(nullif(item->>'dividend','')::numeric, 0),
    coalesce(nullif(item->>'total_return','')::numeric, 0),
    coalesce((item->>'order_index')::integer, ordinality::integer)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
       with ordinality as x(item, ordinality);
end;
$$;

revoke all on function public.replace_settings_by_key(text,jsonb) from public, anon, authenticated;
revoke all on function public.replace_investor_records(jsonb) from public, anon, authenticated;
revoke all on function public.replace_master_tukang(jsonb) from public, anon, authenticated;
revoke all on function public.replace_investor_projects(jsonb) from public, anon, authenticated;
grant execute on function public.replace_settings_by_key(text,jsonb) to service_role;
grant execute on function public.replace_investor_records(jsonb) to service_role;
grant execute on function public.replace_master_tukang(jsonb) to service_role;
grant execute on function public.replace_investor_projects(jsonb) to service_role;
