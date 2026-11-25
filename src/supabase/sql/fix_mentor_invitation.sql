-- Perbaikan alur pemulihan undangan Mentor.
-- Jalankan sekali melalui Supabase Dashboard > SQL Editor.
--
-- Fungsi ini memberi Administrator cara aman untuk mengaktifkan role Mentor
-- pada akun yang sudah terdaftar sebagai Member, tanpa membuat akun baru.
-- Pemeriksaan hak Administrator dilakukan di database, bukan hanya di UI.

create or replace function public.admin_activate_mentor(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak valid. Silakan login kembali.';
  end if;

  if p_user_id is null then
    raise exception 'ID pengguna wajib diisi.';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  ) then
    raise exception 'Hanya Administrator yang dapat mengaktifkan role Mentor.';
  end if;

  if not exists (
    select 1
    from auth.users au
    where au.id = p_user_id
  ) then
    raise exception 'Akun pengguna tidak ditemukan.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'admin'
  ) then
    raise exception 'Akun Administrator tidak dapat diubah menjadi Mentor.';
  end if;

  -- Idempotent: jika role Mentor sudah ada, tidak membuat baris duplikat.
  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'instructor'
  ) then
    return;
  end if;

  -- Mendukung dua pola skema user_roles:
  -- 1. Satu baris per user_id (role Member diubah menjadi instructor).
  -- 2. Beberapa baris per user_id (role instructor ditambahkan).
  begin
    insert into public.user_roles (user_id, role)
    values (p_user_id, 'instructor');
  exception
    when unique_violation then
      update public.user_roles
      set role = 'instructor'
      where user_id = p_user_id
        and role = 'member';

      if not found and not exists (
        select 1
        from public.user_roles ur
        where ur.user_id = p_user_id
          and ur.role = 'instructor'
      ) then
        raise exception 'Role pengguna tidak dapat diperbarui. Periksa constraint tabel user_roles.';
      end if;
  end;
end;
$$;

revoke all on function public.admin_activate_mentor(uuid) from public;
revoke all on function public.admin_activate_mentor(uuid) from anon;
grant execute on function public.admin_activate_mentor(uuid) to authenticated;

comment on function public.admin_activate_mentor(uuid) is
  'Mengaktifkan role instructor untuk akun yang dipilih Administrator, dengan pemeriksaan hak akses di database.';
