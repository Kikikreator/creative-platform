-- ============================================================
-- KIKI CREATOR CLASS
-- Mentor revenue agreements, earnings ledger, and withdrawals
-- Additive migration: does not drop or rewrite existing business tables.
-- Prerequisites: public.courses, public.orders, public.order_items,
-- public.enrollments, public.course_task_mentors, public.user_roles,
-- public.profiles, and public.is_platform_admin().
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. ADMIN-DEFINED REVENUE AGREEMENTS
-- Exactly one mentor can hold an active revenue agreement per class.
-- That mentor receives 80% and the platform receives 20%.
-- ------------------------------------------------------------

create table if not exists public.course_mentor_revenue_agreements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  mentor_share_percent numeric(5,2) not null default 80.00
    check (mentor_share_percent = 80.00),
  platform_percent numeric(5,2) not null default 20.00
    check (platform_percent = 20.00),
  is_active boolean not null default true,
  agreed_by uuid references auth.users(id) on delete set null,
  agreed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_mentor_revenue_agreements_unique
    unique (course_id, mentor_user_id)
);

create index if not exists course_mentor_revenue_agreements_mentor_idx
  on public.course_mentor_revenue_agreements (mentor_user_id, is_active, course_id);

create unique index if not exists course_mentor_revenue_one_active_per_course
  on public.course_mentor_revenue_agreements (course_id)
  where is_active = true;

alter table public.course_mentor_revenue_agreements enable row level security;

 drop policy if exists course_mentor_revenue_agreements_read on public.course_mentor_revenue_agreements;
create policy course_mentor_revenue_agreements_read
on public.course_mentor_revenue_agreements
for select to authenticated
using (mentor_user_id = auth.uid() or public.is_platform_admin());

drop policy if exists course_mentor_revenue_agreements_admin_insert on public.course_mentor_revenue_agreements;
drop policy if exists course_mentor_revenue_agreements_admin_update on public.course_mentor_revenue_agreements;
drop policy if exists course_mentor_revenue_agreements_admin_delete on public.course_mentor_revenue_agreements;

-- Admin changes agreements only through the SECURITY DEFINER setup RPC.
-- Mentors and Admins receive read-only table access from the client.
revoke all on public.course_mentor_revenue_agreements from public, anon, authenticated;
grant select on public.course_mentor_revenue_agreements to authenticated;

-- Mentor/class assignments are also changed only through the Admin RPC.
-- Existing SELECT access remains available for the relevant workspace pages.
revoke insert, update, delete on public.course_task_mentors from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2. IMMUTABLE EARNINGS LEDGER
-- Rows are created only when an order is paid AND the matching
-- enrollment is active. No client-side insert/update is permitted.
-- basis_amount is the proportional share of the actual order total after
-- discounts for each class item. The single agreed mentor receives 80%;
-- payment-provider fees are not subtracted by this migration.
-- ------------------------------------------------------------

create table if not exists public.mentor_course_earnings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  mentor_user_id uuid not null references auth.users(id) on delete restrict,
  member_user_id uuid not null references auth.users(id) on delete restrict,
  currency text not null default 'IDR',
  basis_amount numeric(14,2) not null check (basis_amount >= 0),
  mentor_amount numeric(14,2) not null check (mentor_amount >= 0),
  platform_amount numeric(14,2) not null check (platform_amount >= 0),
  status text not null default 'available'
    check (status in ('available', 'reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_course_earnings_unique_item_mentor
    unique (order_item_id, mentor_user_id)
);

create index if not exists mentor_course_earnings_mentor_idx
  on public.mentor_course_earnings (mentor_user_id, status, created_at desc);
create index if not exists mentor_course_earnings_order_idx
  on public.mentor_course_earnings (order_id);

alter table public.mentor_course_earnings enable row level security;

drop policy if exists mentor_course_earnings_read on public.mentor_course_earnings;
create policy mentor_course_earnings_read
on public.mentor_course_earnings
for select to authenticated
using (mentor_user_id = auth.uid() or public.is_platform_admin());

revoke all on public.mentor_course_earnings from public, anon, authenticated;
grant select on public.mentor_course_earnings to authenticated;

-- ------------------------------------------------------------
-- 3. WITHDRAWAL REQUESTS
-- Mentors can read their own requests. All writes go through RPCs.
-- ------------------------------------------------------------

create table if not exists public.mentor_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete restrict,
  full_name_snapshot text not null,
  bank_name text not null,
  account_number text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'IDR',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'rejected')),
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz
);

create index if not exists mentor_withdrawal_requests_mentor_idx
  on public.mentor_withdrawal_requests (mentor_user_id, requested_at desc);
create index if not exists mentor_withdrawal_requests_status_idx
  on public.mentor_withdrawal_requests (status, requested_at asc);

alter table public.mentor_withdrawal_requests enable row level security;

drop policy if exists mentor_withdrawal_requests_read on public.mentor_withdrawal_requests;
create policy mentor_withdrawal_requests_read
on public.mentor_withdrawal_requests
for select to authenticated
using (mentor_user_id = auth.uid() or public.is_platform_admin());

revoke all on public.mentor_withdrawal_requests from public, anon, authenticated;
grant select on public.mentor_withdrawal_requests to authenticated;


-- ------------------------------------------------------------
-- 4A. ATOMIC ADMIN SETUP FOR COURSE ASSIGNMENTS + 80:20 AGREEMENT
-- This keeps mentor assignment management in one place and prevents
-- client-side manipulation of the mentor/course mapping.
-- ------------------------------------------------------------

create or replace function public.admin_save_mentor_course_setup(
  p_mentor_user_id uuid,
  p_course_ids uuid[] default '{}'::uuid[],
  p_agreed_course_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_course_ids uuid[] := coalesce(p_course_ids, '{}'::uuid[]);
  v_agreed_ids uuid[] := coalesce(p_agreed_course_ids, '{}'::uuid[]);
  v_course_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Hanya Admin yang dapat mengatur penugasan dan kesepakatan Mentor.';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_mentor_user_id and ur.role = 'instructor'
  ) then
    raise exception 'Akun yang dipilih belum memiliki role Mentor.';
  end if;

  if cardinality(v_agreed_ids) <> (select count(distinct agreed_course_id)::integer from unnest(v_agreed_ids) as agreed(agreed_course_id)) then
    raise exception 'Kelas bagi hasil dipilih lebih dari satu kali.';
  end if;

  if exists (
    select 1 from unnest(v_agreed_ids) as agreed(agreed_course_id)
    where not (agreed.agreed_course_id = any(v_course_ids))
  ) then
    raise exception 'Kesepakatan bagi hasil hanya dapat diberikan pada kelas yang ditugaskan.';
  end if;

  select count(*)::integer into v_course_count
  from public.courses c
  where c.id = any(v_course_ids);
  if v_course_count <> cardinality(v_course_ids) then
    raise exception 'Satu atau lebih kelas tidak ditemukan atau dipilih lebih dari sekali.';
  end if;

  if exists (
    select 1
    from public.course_mentor_revenue_agreements a
    where a.course_id = any(v_agreed_ids)
      and a.is_active = true
      and a.mentor_user_id <> p_mentor_user_id
  ) then
    raise exception 'Kelas ini sudah memiliki Mentor penerima bagi hasil 80%%. Nonaktifkan kesepakatan Mentor sebelumnya terlebih dahulu.';
  end if;

  delete from public.course_task_mentors ctm
  where ctm.mentor_user_id = p_mentor_user_id
    and not (ctm.course_id = any(v_course_ids));

  insert into public.course_task_mentors (course_id, mentor_user_id, assigned_by)
  select selected.selected_course_id, p_mentor_user_id, auth.uid()
  from unnest(v_course_ids) as selected(selected_course_id)
  on conflict (course_id, mentor_user_id) do nothing;

  update public.course_mentor_revenue_agreements a
  set is_active = false,
      updated_at = now()
  where a.mentor_user_id = p_mentor_user_id
    and a.is_active = true
    and not (a.course_id = any(v_agreed_ids));

  insert into public.course_mentor_revenue_agreements (
    course_id, mentor_user_id, mentor_share_percent, platform_percent,
    is_active, agreed_by, agreed_at, updated_at
  )
  select selected.selected_course_id, p_mentor_user_id, 80.00, 20.00,
         true, auth.uid(), now(), now()
  from unnest(v_agreed_ids) as selected(selected_course_id)
  on conflict (course_id, mentor_user_id) do update
  set mentor_share_percent = 80.00,
      platform_percent = 20.00,
      is_active = true,
      agreed_by = auth.uid(),
      agreed_at = case
        when public.course_mentor_revenue_agreements.is_active then public.course_mentor_revenue_agreements.agreed_at
        else now()
      end,
      updated_at = now();
end;
$$;

revoke all on function public.admin_save_mentor_course_setup(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.admin_save_mentor_course_setup(uuid, uuid[], uuid[]) to authenticated;

-- ------------------------------------------------------------
-- 4B. MENTOR-ONLY CLASS PARTICIPANT LIST
-- Returns only the participant's display name and enrollment date.
-- The mentor must be assigned to the requested course.
-- ------------------------------------------------------------

create or replace function public.get_mentor_course_participants(p_course_id uuid)
returns table (
  user_id uuid,
  full_name text,
  enrolled_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_assigned_course_mentor(p_course_id) then
    raise exception 'Kamu tidak memiliki akses Mentor pada kelas ini.';
  end if;

  return query
  select
    e.user_id,
    coalesce(nullif(trim(p.full_name), ''), 'Peserta') as full_name,
    coalesce(e.granted_at, e.created_at) as enrolled_at
  from public.enrollments e
  left join public.profiles p on p.id = e.user_id
  where e.course_id = p_course_id
    and e.status = 'active'
  order by coalesce(e.granted_at, e.created_at) desc nulls last;
end;
$$;

revoke all on function public.get_mentor_course_participants(uuid) from public, anon;
grant execute on function public.get_mentor_course_participants(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. RECONCILE ONE PAID ORDER INTO THE EARNINGS LEDGER
-- The amount collected after discount is allocated proportionally to
-- each order item. The single active mentor agreement for that class
-- receives 80% at payment confirmation time; the platform receives 20%.
-- ------------------------------------------------------------

create or replace function public.sync_mentor_earnings_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_agreement record;
  v_total_basis numeric(14,2);
  v_mentor_amount numeric(14,2);
  v_platform_amount numeric(14,2);
begin
  select * into v_order
  from public.orders o
  where o.id = p_order_id;

  if not found then
    return;
  end if;

  if v_order.status is distinct from 'paid' then
    update public.mentor_course_earnings
    set status = 'reversed', updated_at = now()
    where order_id = p_order_id and status = 'available';
    return;
  end if;

  -- Revoke an available ledger row if its order item was removed or the
  -- participant no longer has an active enrollment for that class.
  update public.mentor_course_earnings e
  set status = 'reversed', updated_at = now()
  where e.order_id = p_order_id
    and e.status = 'available'
    and (
      not exists (
        select 1 from public.order_items oi
        where oi.id = e.order_item_id
          and oi.order_id = e.order_id
          and oi.course_id = e.course_id
      )
      or not exists (
        select 1 from public.enrollments en
        where en.user_id = e.member_user_id
          and en.course_id = e.course_id
          and en.status = 'active'
      )
    );

  for v_item in
    select oi.id, oi.course_id, oi.line_total
    from public.order_items oi
    where oi.order_id = v_order.id
    order by oi.id
  loop
    -- An order only generates mentor income after the participant has
    -- an active enrollment for the purchased course.
    if not exists (
      select 1 from public.enrollments e
      where e.user_id = v_order.user_id
        and e.course_id = v_item.course_id
        and e.status = 'active'
    ) then
      continue;
    end if;

    select a.mentor_user_id into v_agreement
    from public.course_mentor_revenue_agreements a
    join public.course_task_mentors ctm
      on ctm.course_id = a.course_id
     and ctm.mentor_user_id = a.mentor_user_id
    where a.course_id = v_item.course_id
      and a.is_active = true
      and a.agreed_at <= coalesce(v_order.updated_at, v_order.created_at)
    order by a.agreed_at desc
    limit 1;

    if not found then
      continue;
    end if;

    if coalesce(v_order.subtotal, 0) > 0 then
      v_total_basis := round(
        coalesce(v_order.total, 0) * coalesce(v_item.line_total, 0)
        / v_order.subtotal,
        2
      );
    else
      v_total_basis := round(coalesce(v_item.line_total, 0), 2);
    end if;

    if v_total_basis <= 0 then
      continue;
    end if;

    v_mentor_amount := round(v_total_basis * 0.80, 2);
    v_platform_amount := v_total_basis - v_mentor_amount;

    insert into public.mentor_course_earnings (
      order_id, order_item_id, course_id, mentor_user_id, member_user_id,
      currency, basis_amount, mentor_amount, platform_amount, status
    ) values (
      v_order.id, v_item.id, v_item.course_id, v_agreement.mentor_user_id, v_order.user_id,
      coalesce(nullif(v_order.currency, ''), 'IDR'),
      v_total_basis, v_mentor_amount, v_platform_amount, 'available'
    )
    on conflict (order_item_id, mentor_user_id) do update
    set basis_amount = excluded.basis_amount,
        mentor_amount = excluded.mentor_amount,
        platform_amount = excluded.platform_amount,
        member_user_id = excluded.member_user_id,
        currency = excluded.currency,
        status = 'available',
        updated_at = now()
    where public.mentor_course_earnings.status = 'reversed';
  end loop;
end;
$$;

revoke all on function public.sync_mentor_earnings_for_order(uuid) from public, anon, authenticated;

create or replace function public.sync_mentor_earnings_on_order_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sync_mentor_earnings_for_order(new.id);
  return new;
end;
$$;

revoke all on function public.sync_mentor_earnings_on_order_change() from public, anon, authenticated;

drop trigger if exists trg_sync_mentor_earnings_on_order_change on public.orders;
create trigger trg_sync_mentor_earnings_on_order_change
after update of status on public.orders
for each row
when (old.status is distinct from new.status)
execute function public.sync_mentor_earnings_on_order_change();

create or replace function public.sync_mentor_earnings_on_enrollment_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_course_id uuid;
  v_order_id uuid;
begin
  -- If an enrollment is removed, deactivated, or moved, reverse its
  -- available earnings unless another active enrollment still exists.
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_course_id := old.course_id;
  elsif tg_op = 'UPDATE' then
    if old.user_id is distinct from new.user_id
       or old.course_id is distinct from new.course_id
       or new.status is distinct from 'active' then
      v_user_id := old.user_id;
      v_course_id := old.course_id;
    end if;
  end if;

  if v_user_id is not null and v_course_id is not null
     and not exists (
       select 1 from public.enrollments e
       where e.user_id = v_user_id
         and e.course_id = v_course_id
         and e.status = 'active'
     ) then
    update public.mentor_course_earnings
    set status = 'reversed', updated_at = now()
    where member_user_id = v_user_id
      and course_id = v_course_id
      and status = 'available';
  end if;

  -- New or reactivated enrollments may complete the paid + active pair.
  if tg_op <> 'DELETE' then
    if new.status = 'active' then
      for v_order_id in
        select distinct o.id
        from public.orders o
        join public.order_items oi on oi.order_id = o.id
        where o.user_id = new.user_id
          and oi.course_id = new.course_id
          and o.status = 'paid'
      loop
        perform public.sync_mentor_earnings_for_order(v_order_id);
      end loop;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public.sync_mentor_earnings_on_enrollment_change() from public, anon, authenticated;

drop trigger if exists trg_sync_mentor_earnings_on_enrollment_change on public.enrollments;
create trigger trg_sync_mentor_earnings_on_enrollment_change
after insert or update of status, user_id, course_id or delete on public.enrollments
for each row
execute function public.sync_mentor_earnings_on_enrollment_change();


create or replace function public.sync_mentor_earnings_on_order_item_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_mentor_earnings_for_order(old.order_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.order_id is distinct from new.order_id then
    perform public.sync_mentor_earnings_for_order(old.order_id);
  end if;

  perform public.sync_mentor_earnings_for_order(new.order_id);
  return new;
end;
$$;

revoke all on function public.sync_mentor_earnings_on_order_item_change() from public, anon, authenticated;

drop trigger if exists trg_sync_mentor_earnings_on_order_item_change on public.order_items;
create trigger trg_sync_mentor_earnings_on_order_item_change
after insert or update of order_id, course_id, line_total or delete on public.order_items
for each row
execute function public.sync_mentor_earnings_on_order_item_change();

-- Backfill orders that were already paid before this migration was applied.
-- The same eligibility checks and idempotency constraints are used.
do $$
declare
  v_order_id uuid;
begin
  for v_order_id in
    select distinct o.id
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.enrollments e
      on e.user_id = o.user_id
     and e.course_id = oi.course_id
     and e.status = 'active'
    where o.status = 'paid'
    order by o.id
  loop
    perform public.sync_mentor_earnings_for_order(v_order_id);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 5. SECURE MENTOR WITHDRAWAL REQUEST RPC
-- Balance is calculated in PostgreSQL. Pending, processing, and paid
-- requests reserve or consume funds; rejected requests release funds.
-- A per-user advisory lock prevents simultaneous over-withdrawals.
-- ------------------------------------------------------------

create or replace function public.request_mentor_withdrawal(
  p_full_name text,
  p_bank_name text,
  p_account_number text,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_bank_name text := trim(coalesce(p_bank_name, ''));
  v_account_number text := regexp_replace(coalesce(p_account_number, ''), '[^0-9]', '', 'g');
  v_earned numeric(14,2);
  v_reserved numeric(14,2);
  v_available numeric(14,2);
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Silakan login kembali sebelum mengajukan penarikan.';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id and ur.role = 'instructor'
  ) then
    raise exception 'Hanya akun Mentor yang dapat mengajukan penarikan.';
  end if;

  if length(v_full_name) < 3 then
    raise exception 'Nama pemilik rekening wajib diisi.';
  end if;
  if length(v_bank_name) < 2 then
    raise exception 'Nama bank wajib diisi.';
  end if;
  if length(v_account_number) < 6 or length(v_account_number) > 30 then
    raise exception 'Nomor rekening harus berisi 6 sampai 30 digit.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal penarikan harus lebih besar dari nol.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select coalesce(sum(e.mentor_amount), 0)
  into v_earned
  from public.mentor_course_earnings e
  where e.mentor_user_id = v_user_id
    and e.status = 'available';

  select coalesce(sum(w.amount), 0)
  into v_reserved
  from public.mentor_withdrawal_requests w
  where w.mentor_user_id = v_user_id
    and w.status in ('pending', 'processing', 'paid');

  v_available := greatest(v_earned - v_reserved, 0);

  if p_amount > v_available then
    raise exception 'Nominal melebihi saldo yang dapat ditarik. Saldo tersedia: %', v_available;
  end if;

  insert into public.mentor_withdrawal_requests (
    mentor_user_id, full_name_snapshot, bank_name,
    account_number, amount, currency, status
  ) values (
    v_user_id, v_full_name, v_bank_name,
    v_account_number, round(p_amount, 2), 'IDR', 'pending'
  ) returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.request_mentor_withdrawal(text, text, text, numeric) from public, anon;
grant execute on function public.request_mentor_withdrawal(text, text, text, numeric) to authenticated;

-- ------------------------------------------------------------
-- 6. ADMIN-ONLY WITHDRAWAL REVIEW RPC
-- Valid transitions: pending -> processing/rejected;
-- processing -> paid/rejected. Terminal states cannot be changed.
-- ------------------------------------------------------------

create or replace function public.admin_review_mentor_withdrawal(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.mentor_withdrawal_requests%rowtype;
  v_earned numeric(14,2);
  v_reserved_other numeric(14,2);
  v_available numeric(14,2);
begin
  if not public.is_platform_admin() then
    raise exception 'Hanya Admin yang dapat memproses penarikan Mentor.';
  end if;

  if p_decision is null or p_decision not in ('processing', 'paid', 'rejected') then
    raise exception 'Keputusan penarikan tidak valid.';
  end if;

  select * into v_request
  from public.mentor_withdrawal_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Pengajuan penarikan tidak ditemukan.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_request.mentor_user_id::text, 0));

  if p_decision in ('processing', 'paid') then
    select coalesce(sum(e.mentor_amount), 0)
    into v_earned
    from public.mentor_course_earnings e
    where e.mentor_user_id = v_request.mentor_user_id
      and e.status = 'available';

    select coalesce(sum(w.amount), 0)
    into v_reserved_other
    from public.mentor_withdrawal_requests w
    where w.mentor_user_id = v_request.mentor_user_id
      and w.id <> p_request_id
      and w.status in ('pending', 'processing', 'paid');

    v_available := greatest(v_earned - v_reserved_other, 0);
    if v_request.amount > v_available then
      raise exception 'Saldo mentor berubah atau tidak lagi mencukupi untuk membayar pengajuan ini.';
    end if;
  end if;

  if v_request.status = 'pending' and p_decision not in ('processing', 'rejected') then
    raise exception 'Pengajuan harus diproses atau ditolak terlebih dahulu.';
  end if;
  if v_request.status = 'processing' and p_decision not in ('paid', 'rejected') then
    raise exception 'Pengajuan yang diproses hanya dapat ditandai dibayar atau ditolak.';
  end if;
  if v_request.status not in ('pending', 'processing') then
    raise exception 'Pengajuan ini sudah berada pada status akhir.';
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_note), '') = '' then
    raise exception 'Catatan penolakan wajib diisi.';
  end if;

  update public.mentor_withdrawal_requests
  set status = p_decision,
      admin_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      paid_at = case when p_decision = 'paid' then now() else paid_at end
  where id = p_request_id;
end;
$$;

revoke all on function public.admin_review_mentor_withdrawal(uuid, text, text) from public, anon;
grant execute on function public.admin_review_mentor_withdrawal(uuid, text, text) to authenticated;

commit;

-- IMPORTANT:
-- 1. Run this migration only after a production backup.
-- 2. Mentor revenue is created only after both paid order and active enrollment.
-- 3. The actual paid order total (after discounts) is allocated proportionally
--    across order_items. Payment-provider fees are not deducted here.
-- 4. One active mentor agreement is allowed per class: that mentor receives
--    80% of the allocated paid amount and the platform receives 20%.
-- 5. No client can directly create earnings or change withdrawal status/balance.
