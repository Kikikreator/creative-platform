-- ============================================================
-- KIKI CREATOR CLASS
-- Chapter-level Mentor Draft & Publication Workflow
--
-- Prerequisite: 20261106_mentor_content_version_workflow.sql has been run.
-- This migration replaces per-item Mentor submissions in the application
-- with one complete Chapter submission (Bab + Materi Inti + Mini Materi).
-- The official learning tables remain Admin-controlled.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. PRIVATE WORKSPACE DRAFTS
-- ------------------------------------------------------------

create table if not exists public.mentor_chapter_drafts (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  section_id uuid not null,
  title text not null,
  payload jsonb not null,
  base_snapshot jsonb,
  is_deleted boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'revision_requested', 'approved')),
  admin_note text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_chapter_drafts_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint mentor_chapter_drafts_unique_owner_chapter
    unique (mentor_user_id, course_id, section_id)
);

create index if not exists mentor_chapter_drafts_course_idx
  on public.mentor_chapter_drafts (course_id, updated_at desc);

alter table public.mentor_chapter_drafts enable row level security;

drop policy if exists mentor_read_own_chapter_drafts on public.mentor_chapter_drafts;
create policy mentor_read_own_chapter_drafts
on public.mentor_chapter_drafts
for select
to authenticated
using (mentor_user_id = auth.uid() or public.is_platform_admin());

revoke all on public.mentor_chapter_drafts from public, anon, authenticated;
grant select on public.mentor_chapter_drafts to authenticated;

-- ------------------------------------------------------------
-- 2. IMMUTABLE SUBMISSION HISTORY
-- ------------------------------------------------------------

create table if not exists public.mentor_chapter_submissions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.mentor_chapter_drafts(id) on delete set null,
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  section_id uuid not null,
  title text not null,
  action text not null check (action in ('create', 'update', 'delete')),
  payload jsonb not null,
  base_snapshot jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'revision_requested')),
  mentor_note text,
  admin_note text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mentor_chapter_submissions_payload_object_check
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists mentor_chapter_submissions_mentor_idx
  on public.mentor_chapter_submissions (mentor_user_id, submitted_at desc);
create index if not exists mentor_chapter_submissions_status_idx
  on public.mentor_chapter_submissions (status, submitted_at asc);
create unique index if not exists mentor_chapter_submissions_one_pending_per_draft
  on public.mentor_chapter_submissions (draft_id)
  where status = 'pending' and draft_id is not null;

alter table public.mentor_chapter_submissions enable row level security;

drop policy if exists mentor_read_own_chapter_submissions on public.mentor_chapter_submissions;
create policy mentor_read_own_chapter_submissions
on public.mentor_chapter_submissions
for select
to authenticated
using (mentor_user_id = auth.uid() or public.is_platform_admin());

revoke all on public.mentor_chapter_submissions from public, anon, authenticated;
grant select on public.mentor_chapter_submissions to authenticated;

-- ------------------------------------------------------------
-- 3. BUILD A CONSISTENT SNAPSHOT OF ONE OFFICIAL CHAPTER
--    Shape: { section: {...}, lessons: [{..., contents: [...] }] }
-- ------------------------------------------------------------

create or replace function public.mentor_build_chapter_snapshot(
  p_course_id uuid,
  p_section_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'section', to_jsonb(s),
    'lessons', coalesce((
      select jsonb_agg(
        to_jsonb(l) || jsonb_build_object(
          'contents', coalesce((
            select jsonb_agg(to_jsonb(lc) order by lc.position, lc.created_at, lc.id)
            from public.lesson_contents lc
            where lc.lesson_id = l.id
          ), '[]'::jsonb)
        )
        order by l.position, l.created_at, l.id
      )
      from public.lessons l
      where l.section_id = s.id
    ), '[]'::jsonb)
  )
  from public.course_sections s
  where s.id = p_section_id
    and s.course_id = p_course_id;
$$;

revoke all on function public.mentor_build_chapter_snapshot(uuid, uuid) from public, anon, authenticated;

-- Bridge pending Chapter-create requests from the previous per-item workflow.
-- Preserve the Chapter draft so the Mentor can continue adding its contents.
insert into public.mentor_chapter_drafts (
  mentor_user_id, course_id, section_id, title, payload,
  base_snapshot, is_deleted, status, created_at, updated_at
)
select
  r.mentor_user_id,
  r.course_id,
  r.entity_id,
  coalesce(nullif(trim(r.payload ->> 'title'), ''), r.title),
  jsonb_build_object(
    'section', jsonb_build_object(
      'id', r.entity_id,
      'course_id', r.course_id,
      'title', coalesce(nullif(trim(r.payload ->> 'title'), ''), r.title),
      'description', nullif(trim(r.payload ->> 'description'), ''),
      'position', coalesce(nullif(r.payload ->> 'position', '')::integer, 0),
      'created_at', now()
    ),
    'lessons', '[]'::jsonb
  ),
  null,
  false,
  'draft',
  now(),
  now()
from public.mentor_publication_requests r
where r.status = 'pending'
  and r.entity_type = 'section'
  and r.action = 'create'
  and r.payload is not null
on conflict (mentor_user_id, course_id, section_id) do nothing;

-- All remaining old per-item requests must be resubmitted as complete Bab.
update public.mentor_publication_requests
set status = 'revision_requested',
    admin_note = coalesce(
      admin_note,
      'Alur publikasi telah berubah menjadi pengajuan satu Bab lengkap. Lengkapi draft Bab, lalu ajukan ulang dari menu Bab & Materi Mentor.'
    )
where status = 'pending';

create or replace function public.get_mentor_course_chapter_snapshots(
  p_course_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_assigned_course_mentor(p_course_id) then
    raise exception 'Kamu tidak memiliki akses Mentor pada kelas ini.';
  end if;

  select coalesce(
    jsonb_agg(
      public.mentor_build_chapter_snapshot(p_course_id, s.id)
      order by s.position, s.created_at, s.id
    ),
    '[]'::jsonb
  )
  into v_result
  from public.course_sections s
  where s.course_id = p_course_id;

  return v_result;
end;
$$;

revoke all on function public.get_mentor_course_chapter_snapshots(uuid) from public, anon;
grant execute on function public.get_mentor_course_chapter_snapshots(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. SAVE OR UPDATE A MENTOR'S CHAPTER DRAFT
--    p_base_snapshot is supplied from the data the Mentor originally loaded.
--    On first save, it is compared with the live Admin version to prevent
--    silently basing an old browser view on a newer official version.
-- ------------------------------------------------------------

create or replace function public.save_mentor_chapter_draft(
  p_course_id uuid,
  p_section_id uuid,
  p_payload jsonb,
  p_base_snapshot jsonb default null,
  p_is_deleted boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.mentor_chapter_drafts%rowtype;
  v_current_snapshot jsonb;
  v_section jsonb;
  v_lesson jsonb;
  v_content jsonb;
  v_lesson_id uuid;
  v_content_id uuid;
  v_title text;
  v_resource_path text;
  v_content_type text;
  v_lessons jsonb;
  v_contents jsonb;
  v_draft_id uuid;
begin
  if v_user_id is null then
    raise exception 'Login diperlukan untuk menyimpan draft Bab.';
  end if;
  if not public.is_assigned_course_mentor(p_course_id) then
    raise exception 'Kamu tidak memiliki akses Mentor pada kelas ini.';
  end if;
  if p_section_id is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Data draft Bab tidak valid.';
  end if;

  v_section := p_payload -> 'section';
  v_lessons := coalesce(p_payload -> 'lessons', '[]'::jsonb);
  if jsonb_typeof(v_section) <> 'object' or jsonb_typeof(v_lessons) <> 'array' then
    raise exception 'Draft harus memuat data Bab dan daftar Materi Inti.';
  end if;
  if nullif(trim(v_section ->> 'title'), '') is null then
    raise exception 'Nama Bab wajib diisi.';
  end if;
  if nullif(v_section ->> 'id', '')::uuid is distinct from p_section_id then
    raise exception 'ID Bab pada draft tidak sesuai.';
  end if;
  if nullif(v_section ->> 'course_id', '')::uuid is distinct from p_course_id then
    raise exception 'Kelas pada draft tidak sesuai.';
  end if;
  if coalesce(nullif(v_section ->> 'position', '')::integer, 0) < 0 then
    raise exception 'Urutan Bab tidak boleh kurang dari nol.';
  end if;
  if jsonb_array_length(v_lessons) > 100 then
    raise exception 'Satu Bab maksimal berisi 100 Materi Inti.';
  end if;
  for v_lesson in select value from jsonb_array_elements(v_lessons)
  loop
    v_lesson_id := nullif(v_lesson ->> 'id', '')::uuid;
    if v_lesson_id is null
       or nullif(v_lesson ->> 'section_id', '')::uuid is distinct from p_section_id
       or nullif(trim(v_lesson ->> 'title'), '') is null then
      raise exception 'Setiap Materi Inti harus memiliki ID, Bab tujuan, dan judul.';
    end if;
    if coalesce(nullif(v_lesson ->> 'duration_minutes', '')::integer, 0) < 0 then
      raise exception 'Durasi Materi Inti tidak boleh kurang dari nol.';
    end if;
    if coalesce(nullif(v_lesson ->> 'position', '')::integer, 0) < 0 then
      raise exception 'Urutan Materi Inti tidak boleh kurang dari nol.';
    end if;
    if coalesce(trim(v_lesson ->> 'video_url'), '') <> ''
       and v_lesson ->> 'video_url' !~* '^https?://' then
      raise exception 'URL video Materi Inti harus menggunakan http atau https.';
    end if;
    v_resource_path := nullif(trim(v_lesson ->> 'resource_path'), '');
    if v_resource_path is not null then
      if v_resource_path not like 'courses/' || p_course_id::text || '/lessons/' || v_lesson_id::text || '/%' then
        raise exception 'Lokasi file Materi Inti tidak sesuai dengan kelas dan materi.';
      end if;
      if not exists (
        select 1 from storage.objects so
        where so.bucket_id = 'learning-resources' and so.name = v_resource_path
      ) then
        raise exception 'File Materi Inti tidak ditemukan pada penyimpanan.';
      end if;
    end if;

    v_contents := coalesce(v_lesson -> 'contents', '[]'::jsonb);
    if jsonb_typeof(v_contents) <> 'array' then
      raise exception 'Daftar Mini Materi harus berbentuk array.';
    end if;
    if jsonb_array_length(v_contents) > 100 then
      raise exception 'Setiap Materi Inti maksimal berisi 100 Mini Materi.';
    end if;

    for v_content in select value from jsonb_array_elements(v_contents)
    loop
      v_content_id := nullif(v_content ->> 'id', '')::uuid;
      if v_content_id is null
         or nullif(v_content ->> 'lesson_id', '')::uuid is distinct from v_lesson_id
         or nullif(trim(v_content ->> 'title'), '') is null then
        raise exception 'Setiap Mini Materi harus memiliki ID, Materi Inti tujuan, dan judul.';
      end if;
      v_content_type := coalesce(v_content ->> 'content_type', '');
      if v_content_type not in ('text', 'tiktok', 'youtube', 'image', 'pdf', 'audio', 'link', 'callout') then
        raise exception 'Jenis Mini Materi tidak valid.';
      end if;
      if coalesce(nullif(v_content ->> 'position', '')::integer, 0) < 0 then
        raise exception 'Urutan Mini Materi tidak boleh kurang dari nol.';
      end if;
      if v_content_type in ('text', 'callout') and coalesce(trim(v_content ->> 'body'), '') = '' then
        raise exception 'Isi teks Mini Materi wajib diisi.';
      end if;
      if v_content_type in ('tiktok', 'youtube') and coalesce(trim(v_content ->> 'media_url'), '') = '' then
        raise exception 'URL video Mini Materi wajib diisi.';
      end if;
      if v_content_type = 'link' and coalesce(trim(v_content ->> 'link_url'), '') = '' then
        raise exception 'URL tautan Mini Materi wajib diisi.';
      end if;
      if v_content_type in ('image', 'pdf', 'audio')
         and coalesce(trim(v_content ->> 'resource_path'), '') = ''
         and coalesce(trim(v_content ->> 'media_url'), '') = '' then
        raise exception 'Mini Materi file harus memiliki file atau URL.';
      end if;
      if coalesce(trim(v_content ->> 'media_url'), '') <> ''
         and v_content ->> 'media_url' !~* '^https?://' then
        raise exception 'URL media Mini Materi harus menggunakan http atau https.';
      end if;
      if coalesce(trim(v_content ->> 'link_url'), '') <> ''
         and v_content ->> 'link_url' !~* '^https?://' then
        raise exception 'URL tautan Mini Materi harus menggunakan http atau https.';
      end if;
      v_resource_path := nullif(trim(v_content ->> 'resource_path'), '');
      if v_resource_path is not null then
        if v_resource_path not like 'courses/' || p_course_id::text || '/lessons/' || v_lesson_id::text || '/%' then
          raise exception 'Lokasi file Mini Materi tidak sesuai dengan kelas dan Materi Inti.';
        end if;
        if not exists (
          select 1 from storage.objects so
          where so.bucket_id = 'learning-resources' and so.name = v_resource_path
        ) then
          raise exception 'File Mini Materi tidak ditemukan pada penyimpanan.';
        end if;
      end if;
    end loop;
  end loop;

  select * into v_draft
  from public.mentor_chapter_drafts d
  where d.mentor_user_id = v_user_id
    and d.course_id = p_course_id
    and d.section_id = p_section_id
  for update;

  if found then
    if v_draft.status = 'pending' then
      raise exception 'Bab sedang menunggu pemeriksaan Admin dan tidak dapat diubah.';
    end if;
    if v_draft.base_snapshot is null and exists (
      select 1 from public.course_sections s
      where s.id = p_section_id and s.course_id = p_course_id
    ) then
      raise exception 'ID Bab draft sudah digunakan oleh materi resmi. Muat ulang halaman.';
    end if;
    update public.mentor_chapter_drafts
    set title = trim(v_section ->> 'title'),
        payload = p_payload,
        is_deleted = coalesce(p_is_deleted, false),
        status = case when status = 'revision_requested' then 'revision_requested' else 'draft' end,
        updated_at = now()
    where id = v_draft.id
    returning id into v_draft_id;
  else
    v_current_snapshot := public.mentor_build_chapter_snapshot(p_course_id, p_section_id);
    if v_current_snapshot is distinct from p_base_snapshot then
      raise exception 'Materi utama berubah sejak halaman dibuka. Muat ulang Bab sebelum menyimpan draft agar perubahan Admin tidak tertimpa.';
    end if;
    if p_is_deleted and v_current_snapshot is null then
      raise exception 'Bab baru yang belum dipublikasikan cukup dihapus sebagai draft.';
    end if;
    insert into public.mentor_chapter_drafts (
      mentor_user_id, course_id, section_id, title, payload,
      base_snapshot, is_deleted, status
    ) values (
      v_user_id, p_course_id, p_section_id, trim(v_section ->> 'title'), p_payload,
      p_base_snapshot, coalesce(p_is_deleted, false), 'draft'
    )
    returning id into v_draft_id;
  end if;

  return v_draft_id;
end;
$$;

revoke all on function public.save_mentor_chapter_draft(uuid, uuid, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_mentor_chapter_draft(uuid, uuid, jsonb, jsonb, boolean) to authenticated;

-- ------------------------------------------------------------
-- 5. DISCARD A NEW, NOT-YET-PUBLISHED CHAPTER DRAFT
-- ------------------------------------------------------------

create or replace function public.discard_mentor_chapter_draft(
  p_course_id uuid,
  p_section_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.mentor_chapter_drafts%rowtype;
begin
  if v_user_id is null or not public.is_assigned_course_mentor(p_course_id) then
    raise exception 'Akses Mentor tidak tersedia untuk kelas ini.';
  end if;
  select * into v_draft
  from public.mentor_chapter_drafts d
  where d.mentor_user_id = v_user_id
    and d.course_id = p_course_id
    and d.section_id = p_section_id
  for update;
  if not found then return; end if;
  if v_draft.status = 'pending' then
    raise exception 'Draft sedang menunggu pemeriksaan Admin.';
  end if;
  if v_draft.base_snapshot is not null then
    raise exception 'Bab ini sudah memiliki versi resmi. Untuk menghapusnya, ajukan penghapusan Bab kepada Admin.';
  end if;
  delete from public.mentor_chapter_drafts where id = v_draft.id;
end;
$$;

revoke all on function public.discard_mentor_chapter_draft(uuid, uuid) from public, anon;
grant execute on function public.discard_mentor_chapter_draft(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. SUBMIT ONE COMPLETE CHAPTER
-- ------------------------------------------------------------

create or replace function public.submit_mentor_chapter_draft(
  p_course_id uuid,
  p_section_id uuid,
  p_mentor_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.mentor_chapter_drafts%rowtype;
  v_action text;
  v_submission_id uuid;
  v_lesson_count integer;
begin
  if v_user_id is null then
    raise exception 'Login diperlukan untuk mengajukan Bab.';
  end if;
  if not public.is_assigned_course_mentor(p_course_id) then
    raise exception 'Kamu tidak memiliki akses Mentor pada kelas ini.';
  end if;

  select * into v_draft
  from public.mentor_chapter_drafts d
  where d.mentor_user_id = v_user_id
    and d.course_id = p_course_id
    and d.section_id = p_section_id
  for update;
  if not found then
    raise exception 'Simpan draft Bab terlebih dahulu sebelum mengajukan.';
  end if;
  if v_draft.status = 'pending' then
    raise exception 'Bab ini sudah berada dalam antrean pemeriksaan Admin.';
  end if;
  if v_draft.status = 'approved' then
    raise exception 'Belum ada perubahan draft baru untuk diajukan.';
  end if;

  if v_draft.is_deleted then
    if v_draft.base_snapshot is null then
      raise exception 'Bab baru yang belum dipublikasikan tidak perlu diajukan untuk dihapus.';
    end if;
    v_action := 'delete';
  elsif v_draft.base_snapshot is null then
    v_action := 'create';
    if public.mentor_build_chapter_snapshot(p_course_id, p_section_id) is not null then
      raise exception 'Bab dengan ID ini sudah ada pada kurikulum resmi. Muat ulang halaman.';
    end if;
    v_lesson_count := jsonb_array_length(coalesce(v_draft.payload -> 'lessons', '[]'::jsonb));
    if v_lesson_count < 1 then
      raise exception 'Tambahkan minimal satu Materi Inti sebelum mengajukan Bab.';
    end if;
  else
    v_action := 'update';
    if public.mentor_build_chapter_snapshot(p_course_id, p_section_id) is null then
      raise exception 'Bab resmi tidak ditemukan. Muat ulang halaman sebelum mengajukan.';
    end if;
    v_lesson_count := jsonb_array_length(coalesce(v_draft.payload -> 'lessons', '[]'::jsonb));
    if v_lesson_count < 1 then
      raise exception 'Bab harus memiliki minimal satu Materi Inti sebelum diajukan.';
    end if;
  end if;

  insert into public.mentor_chapter_submissions (
    draft_id, mentor_user_id, course_id, section_id, title,
    action, payload, base_snapshot, status, mentor_note
  ) values (
    v_draft.id, v_user_id, p_course_id, p_section_id, v_draft.title,
    v_action, v_draft.payload, v_draft.base_snapshot, 'pending',
    nullif(trim(coalesce(p_mentor_note, '')), '')
  )
  returning id into v_submission_id;

  update public.mentor_chapter_drafts
  set status = 'pending',
      submitted_at = now(),
      admin_note = null,
      updated_at = now()
  where id = v_draft.id;

  return v_submission_id;
end;
$$;

revoke all on function public.submit_mentor_chapter_draft(uuid, uuid, text) from public, anon;
grant execute on function public.submit_mentor_chapter_draft(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 7. ADMIN REVIEWS AND APPLIES THE COMPLETE CHAPTER SNAPSHOT
-- ------------------------------------------------------------

create or replace function public.review_mentor_chapter_submission(
  p_submission_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_submission public.mentor_chapter_submissions%rowtype;
  v_draft public.mentor_chapter_drafts%rowtype;
  v_current_snapshot jsonb;
  v_new_snapshot jsonb;
  v_section jsonb;
  v_lesson jsonb;
  v_content jsonb;
  v_section_id uuid;
  v_lesson_id uuid;
  v_content_id uuid;
  v_course_id uuid;
  v_lesson_ids uuid[] := '{}'::uuid[];
  v_content_ids uuid[] := '{}'::uuid[];
  v_resource_path text;
  v_content_type text;
begin
  if not public.is_platform_admin() then
    raise exception 'Hanya Admin yang dapat memeriksa pengajuan Bab.';
  end if;
  if p_decision not in ('approved', 'revision_requested') then
    raise exception 'Keputusan review tidak valid.';
  end if;
  if p_decision = 'revision_requested' and coalesce(trim(p_note), '') = '' then
    raise exception 'Catatan revisi wajib diisi.';
  end if;

  select * into v_submission
  from public.mentor_chapter_submissions s
  where s.id = p_submission_id
  for update;
  if not found then
    raise exception 'Pengajuan Bab tidak ditemukan.';
  end if;
  if v_submission.status <> 'pending' then
    raise exception 'Pengajuan ini sudah pernah diproses.';
  end if;

  if v_submission.draft_id is not null then
    select * into v_draft
    from public.mentor_chapter_drafts d
    where d.id = v_submission.draft_id
    for update;
  end if;

  if p_decision = 'revision_requested' then
    update public.mentor_chapter_submissions
    set status = 'revision_requested',
        admin_note = trim(p_note),
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_submission_id;

    if v_submission.draft_id is not null then
      update public.mentor_chapter_drafts
      set status = 'revision_requested',
          admin_note = trim(p_note),
          updated_at = now()
      where id = v_submission.draft_id;
    end if;
    return;
  end if;

  v_course_id := v_submission.course_id;
  v_section_id := v_submission.section_id;
  v_current_snapshot := public.mentor_build_chapter_snapshot(v_course_id, v_section_id);

  if v_submission.action = 'delete' then
    if v_current_snapshot is null or v_current_snapshot is distinct from v_submission.base_snapshot then
      raise exception 'Bab resmi berubah setelah pengajuan dibuat. Penghapusan dibatalkan agar perubahan Admin tidak tertimpa.';
    end if;

    delete from public.lesson_contents lc
    using public.lessons l
    where lc.lesson_id = l.id and l.section_id = v_section_id;
    delete from public.lessons where section_id = v_section_id;
    delete from public.course_sections
    where id = v_section_id and course_id = v_course_id;

    if v_submission.draft_id is not null then
      delete from public.mentor_chapter_drafts where id = v_submission.draft_id;
    end if;

  else
    if v_submission.action = 'create' then
      if v_current_snapshot is not null then
        raise exception 'Bab dengan ID ini sudah dibuat di kurikulum resmi. Pengajuan tidak diterapkan.';
      end if;
    elsif v_submission.action = 'update' then
      if v_current_snapshot is null or v_current_snapshot is distinct from v_submission.base_snapshot then
        raise exception 'Bab resmi berubah setelah pengajuan dibuat. Periksa kembali versi Admin sebelum menyetujui.';
      end if;
    else
      raise exception 'Jenis pengajuan Bab tidak dikenali.';
    end if;

    v_section := v_submission.payload -> 'section';
    if jsonb_typeof(v_section) <> 'object'
       or nullif(v_section ->> 'id', '')::uuid is distinct from v_section_id
       or nullif(v_section ->> 'course_id', '')::uuid is distinct from v_course_id
       or nullif(trim(v_section ->> 'title'), '') is null then
      raise exception 'Snapshot Bab tidak valid. Minta Mentor menyimpan dan mengajukan ulang.';
    end if;

    insert into public.course_sections (id, course_id, title, description, position)
    values (
      v_section_id,
      v_course_id,
      trim(v_section ->> 'title'),
      nullif(trim(v_section ->> 'description'), ''),
      coalesce(nullif(v_section ->> 'position', '')::integer, 0)
    )
    on conflict (id) do update
    set course_id = excluded.course_id,
        title = excluded.title,
        description = excluded.description,
        position = excluded.position;

    for v_lesson in
      select value from jsonb_array_elements(coalesce(v_submission.payload -> 'lessons', '[]'::jsonb))
    loop
      v_lesson_id := nullif(v_lesson ->> 'id', '')::uuid;
      if v_lesson_id is null
         or nullif(v_lesson ->> 'section_id', '')::uuid is distinct from v_section_id
         or nullif(trim(v_lesson ->> 'title'), '') is null then
        raise exception 'Snapshot berisi Materi Inti yang tidak valid.';
      end if;
      if exists (select 1 from public.lessons l where l.id = v_lesson_id and l.section_id <> v_section_id) then
        raise exception 'ID Materi Inti pada snapshot sudah digunakan oleh Bab lain.';
      end if;
      v_lesson_ids := array_append(v_lesson_ids, v_lesson_id);

      v_resource_path := nullif(trim(v_lesson ->> 'resource_path'), '');
      if v_resource_path is not null then
        if v_resource_path not like 'courses/' || v_course_id::text || '/lessons/' || v_lesson_id::text || '/%'
           or not exists (select 1 from storage.objects so where so.bucket_id = 'learning-resources' and so.name = v_resource_path) then
          raise exception 'File pada Materi Inti tidak valid atau sudah tidak tersedia.';
        end if;
      end if;

      insert into public.lessons (
        id, section_id, title, content, video_provider, video_url,
        resource_path, duration_minutes, is_preview, status, position,
        created_at, updated_at
      ) values (
        v_lesson_id,
        v_section_id,
        trim(v_lesson ->> 'title'),
        nullif(trim(v_lesson ->> 'content'), ''),
        coalesce(nullif(trim(v_lesson ->> 'video_provider'), ''), 'youtube'),
        nullif(trim(v_lesson ->> 'video_url'), ''),
        v_resource_path,
        coalesce(nullif(v_lesson ->> 'duration_minutes', '')::integer, 0),
        coalesce((v_lesson ->> 'is_preview')::boolean, false),
        'published',
        coalesce(nullif(v_lesson ->> 'position', '')::integer, 0),
        coalesce(nullif(v_lesson ->> 'created_at', '')::timestamptz, now()),
        now()
      )
      on conflict (id) do update
      set section_id = excluded.section_id,
          title = excluded.title,
          content = excluded.content,
          video_provider = excluded.video_provider,
          video_url = excluded.video_url,
          resource_path = excluded.resource_path,
          duration_minutes = excluded.duration_minutes,
          is_preview = excluded.is_preview,
          status = 'published',
          position = excluded.position,
          updated_at = now();

      for v_content in
        select value from jsonb_array_elements(coalesce(v_lesson -> 'contents', '[]'::jsonb))
      loop
        v_content_id := nullif(v_content ->> 'id', '')::uuid;
        if v_content_id is null
           or nullif(v_content ->> 'lesson_id', '')::uuid is distinct from v_lesson_id
           or nullif(trim(v_content ->> 'title'), '') is null then
          raise exception 'Snapshot berisi Mini Materi yang tidak valid.';
        end if;
        if exists (select 1 from public.lesson_contents lc where lc.id = v_content_id and lc.lesson_id <> v_lesson_id) then
          raise exception 'ID Mini Materi pada snapshot sudah digunakan oleh Materi Inti lain.';
        end if;

        v_content_type := coalesce(v_content ->> 'content_type', '');
        if v_content_type not in ('text', 'tiktok', 'youtube', 'image', 'pdf', 'audio', 'link', 'callout') then
          raise exception 'Jenis Mini Materi pada snapshot tidak valid.';
        end if;
        v_resource_path := nullif(trim(v_content ->> 'resource_path'), '');
        if v_resource_path is not null then
          if v_resource_path not like 'courses/' || v_course_id::text || '/lessons/' || v_lesson_id::text || '/%'
             or not exists (select 1 from storage.objects so where so.bucket_id = 'learning-resources' and so.name = v_resource_path) then
            raise exception 'File Mini Materi tidak valid atau sudah tidak tersedia.';
          end if;
        end if;

        v_content_ids := array_append(v_content_ids, v_content_id);
        insert into public.lesson_contents (
          id, lesson_id, title, content_type, body, media_url, resource_path,
          link_url, link_label, settings, position, status, created_at, updated_at
        ) values (
          v_content_id,
          v_lesson_id,
          trim(v_content ->> 'title'),
          v_content_type,
          nullif(trim(v_content ->> 'body'), ''),
          nullif(trim(v_content ->> 'media_url'), ''),
          v_resource_path,
          nullif(trim(v_content ->> 'link_url'), ''),
          nullif(trim(v_content ->> 'link_label'), ''),
          coalesce(v_content -> 'settings', '{}'::jsonb),
          coalesce(nullif(v_content ->> 'position', '')::integer, 0),
          'published',
          coalesce(nullif(v_content ->> 'created_at', '')::timestamptz, now()),
          now()
        )
        on conflict (id) do update
        set lesson_id = excluded.lesson_id,
            title = excluded.title,
            content_type = excluded.content_type,
            body = excluded.body,
            media_url = excluded.media_url,
            resource_path = excluded.resource_path,
            link_url = excluded.link_url,
            link_label = excluded.link_label,
            settings = excluded.settings,
            position = excluded.position,
            status = 'published',
            updated_at = now();
      end loop;
    end loop;

    -- Remove children omitted from the submitted full-Chapter snapshot.
    delete from public.lesson_contents lc
    using public.lessons l
    where lc.lesson_id = l.id
      and l.section_id = v_section_id
      and not (lc.id = any(v_content_ids));

    delete from public.lessons l
    where l.section_id = v_section_id
      and not (l.id = any(v_lesson_ids));

    v_new_snapshot := public.mentor_build_chapter_snapshot(v_course_id, v_section_id);
    if v_new_snapshot is null then
      raise exception 'Bab gagal diterapkan. Tidak ditemukan setelah proses penyimpanan.';
    end if;

    if v_submission.draft_id is not null then
      update public.mentor_chapter_drafts
      set title = trim(v_section ->> 'title'),
          payload = v_new_snapshot,
          base_snapshot = v_new_snapshot,
          is_deleted = false,
          status = 'approved',
          admin_note = null,
          submitted_at = null,
          updated_at = now()
      where id = v_submission.draft_id;
    end if;
  end if;

  update public.mentor_chapter_submissions
  set status = 'approved',
      admin_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_submission_id;
end;
$$;

revoke all on function public.review_mentor_chapter_submission(uuid, text, text) from public, anon;
grant execute on function public.review_mentor_chapter_submission(uuid, text, text) to authenticated;

commit;

-- Notes:
-- 1. Mentor saves changes only into mentor_chapter_drafts.
-- 2. One submission contains a complete Chapter snapshot.
-- 3. Admin review is atomic: Bab, Materi Inti, and Mini Materi are applied together.
-- 4. If Admin changes official content after the Mentor's baseline was captured,
--    approval fails with a conflict instead of overwriting the Admin's changes.
-- 5. Existing mentor_publication_requests history is preserved but is no longer
--    used for new Chapter submissions.
