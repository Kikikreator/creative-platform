-- ============================================================
-- CREATIVE PLATFORM
-- Mentor Content Version Workflow
--
-- Tujuan:
-- 1. Mentor mengajukan snapshot perubahan, bukan mengubah materi utama.
-- 2. Admin dapat melihat snapshot, meminta revisi, atau menerapkan proposal.
-- 3. Admin tetap memiliki kendali penuh melalui /admin/materi.
-- 4. Persetujuan tidak boleh menimpa perubahan Admin yang terjadi setelah
--    proposal dibuat (optimistic concurrency melalui base_snapshot).
--
-- Migration ini mempertahankan data materi yang sudah ada.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. PERLUAS TABEL PENGAJUAN YANG SUDAH ADA
-- ------------------------------------------------------------

alter table public.mentor_publication_requests
  add column if not exists action text not null default 'create',
  add column if not exists payload jsonb,
  add column if not exists base_snapshot jsonb;

alter table public.mentor_publication_requests
  drop constraint if exists mentor_publication_requests_entity_type_check;

alter table public.mentor_publication_requests
  add constraint mentor_publication_requests_entity_type_check
  check (entity_type in ('section', 'lesson', 'lesson_content'));

alter table public.mentor_publication_requests
  drop constraint if exists mentor_publication_requests_action_check;

alter table public.mentor_publication_requests
  add constraint mentor_publication_requests_action_check
  check (action in ('create', 'update', 'delete'));

-- Pengajuan lama hanya menyimpan metadata, bukan salinan isi materi.
-- Jangan pernah menerbitkan atau mengubah materi utama dari pengajuan lama ini.
update public.mentor_publication_requests
set status = 'revision_requested',
    admin_note = coalesce(
      admin_note,
      'Pengajuan versi lama belum menyimpan snapshot isi materi. Silakan ajukan ulang dari halaman Materi Mentor.'
    )
where status = 'pending'
  and payload is null;

create index if not exists mentor_publication_course_pending_idx
  on public.mentor_publication_requests (course_id, submitted_at desc)
  where status = 'pending';

-- ------------------------------------------------------------
-- 2. MENTOR HANYA BOLEH MEMBACA MATERI UTAMA
--    Semua perubahan materi utama hanya melalui RPC pengajuan.
-- ------------------------------------------------------------

drop policy if exists mentor_manage_assigned_sections on public.course_sections;
drop policy if exists mentor_manage_assigned_lessons on public.lessons;
drop policy if exists mentor_manage_assigned_lesson_contents on public.lesson_contents;

drop policy if exists mentor_read_assigned_sections on public.course_sections;
create policy mentor_read_assigned_sections
on public.course_sections
for select
to authenticated
using (public.is_assigned_course_mentor(course_id));

drop policy if exists mentor_read_assigned_lessons on public.lessons;
create policy mentor_read_assigned_lessons
on public.lessons
for select
to authenticated
using (
  exists (
    select 1
    from public.course_sections s
    where s.id = lessons.section_id
      and public.is_assigned_course_mentor(s.course_id)
  )
);

drop policy if exists mentor_read_assigned_lesson_contents on public.lesson_contents;
create policy mentor_read_assigned_lesson_contents
on public.lesson_contents
for select
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    join public.course_sections s on s.id = l.section_id
    where l.id = lesson_contents.lesson_id
      and public.is_assigned_course_mentor(s.course_id)
  )
);

-- ------------------------------------------------------------
-- 3. TABEL PENGAJUAN HANYA DITULIS MELALUI RPC TERVALIDASI
-- ------------------------------------------------------------

drop policy if exists mentor_submit_assigned_publication_requests
  on public.mentor_publication_requests;

revoke insert, update, delete
  on public.mentor_publication_requests
  from public, anon, authenticated;

grant select
  on public.mentor_publication_requests
  to authenticated;

-- ------------------------------------------------------------
-- 4. BATASI STORAGE MATERI MENTOR
--    Mentor tetap dapat mengunggah file proposal dan membacanya pada kelas
--    yang ditugaskan, tetapi tidak dapat mengubah/menghapus file materi utama.
-- ------------------------------------------------------------

drop policy if exists mentor_update_assigned_learning_resources on storage.objects;
drop policy if exists mentor_delete_assigned_learning_resources on storage.objects;

-- Policy INSERT dan SELECT mentor yang sudah ada tetap digunakan.

-- ------------------------------------------------------------
-- 5. RPC PENGAJUAN VERSI MATERI
-- ------------------------------------------------------------

create or replace function public.submit_mentor_content_proposal(
  p_course_id uuid,
  p_entity_type text,
  p_action text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_mentor_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_base_snapshot jsonb := null;
  v_title text;
  v_parent_id uuid;
  v_position integer;
  v_content_type text;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Login diperlukan untuk mengajukan materi.';
  end if;

  if not public.is_assigned_course_mentor(p_course_id) then
    raise exception 'Kamu tidak memiliki akses Mentor pada kelas ini.';
  end if;

  if p_entity_type is null or p_entity_type not in ('section', 'lesson', 'lesson_content') then
    raise exception 'Jenis materi yang diajukan tidak valid.';
  end if;

  if p_action is null or p_action not in ('create', 'update', 'delete') then
    raise exception 'Jenis perubahan tidak valid.';
  end if;

  if p_entity_id is null then
    raise exception 'ID materi tidak valid.';
  end if;

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Data pengajuan materi tidak valid.';
  end if;

  -- Ambil snapshot materi utama untuk perubahan/hapus.
  if p_action in ('update', 'delete') then
    if p_entity_type = 'section' then
      select to_jsonb(s), s.title
      into v_base_snapshot, v_title
      from public.course_sections s
      where s.id = p_entity_id
        and s.course_id = p_course_id;
    elsif p_entity_type = 'lesson' then
      select to_jsonb(l), l.title
      into v_base_snapshot, v_title
      from public.lessons l
      join public.course_sections s on s.id = l.section_id
      where l.id = p_entity_id
        and s.course_id = p_course_id;
    else
      select to_jsonb(lc), lc.title
      into v_base_snapshot, v_title
      from public.lesson_contents lc
      join public.lessons l on l.id = lc.lesson_id
      join public.course_sections s on s.id = l.section_id
      where lc.id = p_entity_id
        and s.course_id = p_course_id;
    end if;

    if v_base_snapshot is null then
      raise exception 'Materi yang akan diubah tidak ditemukan pada kelas ini.';
    end if;
  else
    -- ID untuk entitas baru dibuat di sisi aplikasi dan belum boleh ada di tabel utama.
    if p_entity_type = 'section' and exists (
      select 1 from public.course_sections where id = p_entity_id
    ) then
      raise exception 'ID Bab sudah digunakan. Muat ulang lalu coba kembali.';
    elsif p_entity_type = 'lesson' and exists (
      select 1 from public.lessons where id = p_entity_id
    ) then
      raise exception 'ID Materi Inti sudah digunakan. Muat ulang lalu coba kembali.';
    elsif p_entity_type = 'lesson_content' and exists (
      select 1 from public.lesson_contents where id = p_entity_id
    ) then
      raise exception 'ID Mini Materi sudah digunakan. Muat ulang lalu coba kembali.';
    end if;
  end if;

  if p_action <> 'delete' then
    v_title := nullif(trim(coalesce(v_payload ->> 'title', '')), '');
    if v_title is null then
      raise exception 'Judul materi wajib diisi.';
    end if;

    v_position := coalesce(nullif(v_payload ->> 'position', '')::integer, 0);
    if v_position < 0 then
      raise exception 'Urutan materi tidak boleh kurang dari nol.';
    end if;

    if p_entity_type = 'lesson' then
      v_parent_id := nullif(v_payload ->> 'section_id', '')::uuid;
      if v_parent_id is null or not exists (
        select 1 from public.course_sections s
        where s.id = v_parent_id and s.course_id = p_course_id
      ) then
        raise exception 'Bab tujuan tidak ditemukan pada kelas ini.';
      end if;

      if coalesce(nullif(v_payload ->> 'duration_minutes', '')::integer, 0) < 0 then
        raise exception 'Durasi materi tidak boleh kurang dari nol.';
      end if;
      if coalesce(trim(v_payload ->> 'video_url'), '') <> ''
         and v_payload ->> 'video_url' !~* '^https?://' then
        raise exception 'URL Materi Inti harus menggunakan http atau https.';
      end if;

    elsif p_entity_type = 'lesson_content' then
      v_parent_id := nullif(v_payload ->> 'lesson_id', '')::uuid;
      if v_parent_id is null or not exists (
        select 1
        from public.lessons l
        join public.course_sections s on s.id = l.section_id
        where l.id = v_parent_id and s.course_id = p_course_id
      ) then
        raise exception 'Materi Inti tujuan tidak ditemukan pada kelas ini.';
      end if;

      v_content_type := coalesce(v_payload ->> 'content_type', '');
      if v_content_type not in ('text', 'tiktok', 'youtube', 'image', 'pdf', 'audio', 'link', 'callout') then
        raise exception 'Jenis Mini Materi tidak valid.';
      end if;
      if coalesce(trim(v_payload ->> 'media_url'), '') <> ''
         and v_payload ->> 'media_url' !~* '^https?://' then
        raise exception 'URL media Mini Materi harus menggunakan http atau https.';
      end if;
      if coalesce(trim(v_payload ->> 'link_url'), '') <> ''
         and v_payload ->> 'link_url' !~* '^https?://' then
        raise exception 'URL tautan Mini Materi harus menggunakan http atau https.';
      end if;
      if v_content_type in ('text', 'callout')
         and coalesce(trim(v_payload ->> 'body'), '') = '' then
        raise exception 'Isi Mini Materi wajib diisi.';
      elsif v_content_type in ('tiktok', 'youtube')
         and coalesce(trim(v_payload ->> 'media_url'), '') = '' then
        raise exception 'URL video Mini Materi wajib diisi.';
      elsif v_content_type = 'link'
         and coalesce(trim(v_payload ->> 'link_url'), '') = '' then
        raise exception 'URL tautan Mini Materi wajib diisi.';
      elsif v_content_type in ('image', 'pdf', 'audio')
         and coalesce(trim(v_payload ->> 'resource_path'), '') = ''
         and coalesce(trim(v_payload ->> 'media_url'), '') = '' then
        raise exception 'File atau URL Mini Materi wajib diisi.';
      end if;
      if coalesce(trim(v_payload ->> 'resource_path'), '') <> '' then
        if v_payload ->> 'resource_path' not like
           'courses/' || p_course_id::text || '/lessons/' || v_parent_id::text || '/%' then
          raise exception 'Lokasi file Mini Materi tidak sesuai dengan kelas dan materi tujuan.';
        end if;
        if not exists (
          select 1 from storage.objects so
          where so.bucket_id = 'learning-resources'
            and so.name = v_payload ->> 'resource_path'
        ) then
          raise exception 'File Mini Materi tidak ditemukan pada penyimpanan.';
        end if;
      end if;

      if v_payload ? 'settings'
         and v_payload -> 'settings' is not null
         and jsonb_typeof(v_payload -> 'settings') not in ('object', 'null') then
        raise exception 'Pengaturan Mini Materi tidak valid.';
      end if;
    end if;
  end if;

  if exists (
    select 1
    from public.mentor_publication_requests r
    where r.entity_type = p_entity_type
      and r.entity_id = p_entity_id
      and r.status = 'pending'
  ) then
    raise exception 'Masih ada pengajuan untuk materi ini yang menunggu Admin.';
  end if;

  insert into public.mentor_publication_requests (
    mentor_user_id,
    course_id,
    entity_type,
    entity_id,
    title,
    status,
    mentor_note,
    action,
    payload,
    base_snapshot,
    submitted_at
  )
  values (
    v_user_id,
    p_course_id,
    p_entity_type,
    p_entity_id,
    coalesce(v_title, v_base_snapshot ->> 'title', 'Materi'),
    'pending',
    nullif(trim(p_mentor_note), ''),
    p_action,
    v_payload,
    v_base_snapshot,
    now()
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.submit_mentor_content_proposal(uuid, text, text, uuid, jsonb, text) from public;
grant execute on function public.submit_mentor_content_proposal(uuid, text, text, uuid, jsonb, text) to authenticated;

-- ------------------------------------------------------------
-- 6. RPC REVIEW ADMIN
--    Approve = terapkan snapshot ke tabel materi utama.
--    Revision = hanya mengubah status pengajuan, tidak menyentuh materi utama.
-- ------------------------------------------------------------

create or replace function public.review_mentor_publication_request(
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
  v_request public.mentor_publication_requests%rowtype;
  v_current_snapshot jsonb;
  v_section_id uuid;
  v_lesson_id uuid;
  v_content_type text;
  v_position integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Hanya Admin yang dapat memeriksa pengajuan materi.';
  end if;

  if p_decision is null or p_decision not in ('approved', 'revision_requested') then
    raise exception 'Keputusan review tidak valid.';
  end if;

  if p_decision = 'revision_requested' and coalesce(trim(p_note), '') = '' then
    raise exception 'Catatan revisi wajib diisi.';
  end if;

  select *
  into v_request
  from public.mentor_publication_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Pengajuan tidak ditemukan atau sudah diproses.';
  end if;

  if p_decision = 'revision_requested' then
    update public.mentor_publication_requests
    set status = 'revision_requested',
        admin_note = nullif(trim(p_note), ''),
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_request_id;
    return;
  end if;

  if v_request.payload is null or v_request.action not in ('create', 'update', 'delete') then
    raise exception 'Pengajuan ini belum memiliki snapshot versi materi yang dapat diterapkan. Minta Mentor mengajukan ulang.';
  end if;

  v_position := coalesce(nullif(v_request.payload ->> 'position', '')::integer, 0);
  if v_position < 0 then
    raise exception 'Urutan materi tidak boleh kurang dari nol.';
  end if;
  if v_request.entity_type = 'lesson'
     and coalesce(nullif(v_request.payload ->> 'duration_minutes', '')::integer, 0) < 0 then
    raise exception 'Durasi materi tidak boleh kurang dari nol.';
  end if;

  if v_request.entity_type = 'section' then
    if v_request.action = 'create' then
      if exists (select 1 from public.course_sections where id = v_request.entity_id) then
        raise exception 'Bab dengan ID ini sudah ada. Periksa kembali materi sebelum menyetujui.';
      end if;

      insert into public.course_sections (id, course_id, title, description, position)
      values (
        v_request.entity_id,
        v_request.course_id,
        nullif(trim(v_request.payload ->> 'title'), ''),
        nullif(trim(v_request.payload ->> 'description'), ''),
        v_position
      );

    elsif v_request.action = 'update' then
      select to_jsonb(s) into v_current_snapshot
      from public.course_sections s
      where s.id = v_request.entity_id
        and s.course_id = v_request.course_id
      for update;

      if v_current_snapshot is null or v_current_snapshot is distinct from v_request.base_snapshot then
        raise exception 'Bab telah berubah sejak diajukan. Periksa versi terbaru sebelum menyetujui.';
      end if;

      update public.course_sections
      set title = nullif(trim(v_request.payload ->> 'title'), ''),
          description = nullif(trim(v_request.payload ->> 'description'), ''),
          position = v_position
      where id = v_request.entity_id
        and course_id = v_request.course_id;

    else
      select to_jsonb(s) into v_current_snapshot
      from public.course_sections s
      where s.id = v_request.entity_id
        and s.course_id = v_request.course_id
      for update;

      if v_current_snapshot is null or v_current_snapshot is distinct from v_request.base_snapshot then
        raise exception 'Bab telah berubah sejak diajukan. Periksa versi terbaru sebelum menyetujui penghapusan.';
      end if;

      if exists (
        select 1
        from public.mentor_publication_requests r
        where r.status = 'pending'
          and r.id <> p_request_id
          and r.course_id = v_request.course_id
          and (
            (r.entity_type = 'lesson' and exists (
              select 1 from public.lessons l
              where l.id = r.entity_id and l.section_id = v_request.entity_id
            ))
            or
            (r.entity_type = 'lesson_content' and exists (
              select 1
              from public.lesson_contents lc
              join public.lessons l on l.id = lc.lesson_id
              where lc.id = r.entity_id and l.section_id = v_request.entity_id
            ))
          )
      ) then
        raise exception 'Bab memiliki pengajuan materi turunan yang masih menunggu review. Proses pengajuan tersebut terlebih dahulu.';
      end if;

      delete from public.course_sections
      where id = v_request.entity_id
        and course_id = v_request.course_id;
    end if;

  elsif v_request.entity_type = 'lesson' then
    if v_request.action = 'create' then
      v_section_id := nullif(v_request.payload ->> 'section_id', '')::uuid;
      if v_section_id is null or not exists (
        select 1 from public.course_sections s
        where s.id = v_section_id and s.course_id = v_request.course_id
      ) then
        raise exception 'Bab tujuan tidak tersedia. Pengajuan Materi Inti belum dapat diterapkan.';
      end if;
      if exists (select 1 from public.lessons where id = v_request.entity_id) then
        raise exception 'Materi Inti dengan ID ini sudah ada. Periksa kembali sebelum menyetujui.';
      end if;

      insert into public.lessons (
        id, section_id, title, content, video_provider, video_url,
        resource_path, duration_minutes, is_preview, status, position,
        created_at, updated_at
      ) values (
        v_request.entity_id,
        v_section_id,
        nullif(trim(v_request.payload ->> 'title'), ''),
        nullif(trim(v_request.payload ->> 'content'), ''),
        coalesce(nullif(trim(v_request.payload ->> 'video_provider'), ''), 'youtube'),
        nullif(trim(v_request.payload ->> 'video_url'), ''),
        nullif(trim(v_request.payload ->> 'resource_path'), ''),
        coalesce(nullif(v_request.payload ->> 'duration_minutes', '')::integer, 0),
        coalesce((v_request.payload ->> 'is_preview')::boolean, false),
        'published',
        v_position,
        now(), now()
      );

    elsif v_request.action = 'update' then
      select to_jsonb(l) into v_current_snapshot
      from public.lessons l
      join public.course_sections s on s.id = l.section_id
      where l.id = v_request.entity_id
        and s.course_id = v_request.course_id
      for update of l;

      if v_current_snapshot is null or v_current_snapshot is distinct from v_request.base_snapshot then
        raise exception 'Materi Inti telah berubah sejak diajukan. Periksa versi terbaru sebelum menyetujui.';
      end if;

      v_section_id := nullif(v_request.payload ->> 'section_id', '')::uuid;
      if v_section_id is null or not exists (
        select 1 from public.course_sections s
        where s.id = v_section_id and s.course_id = v_request.course_id
      ) then
        raise exception 'Bab tujuan tidak tersedia.';
      end if;

      update public.lessons
      set section_id = v_section_id,
          title = nullif(trim(v_request.payload ->> 'title'), ''),
          content = nullif(trim(v_request.payload ->> 'content'), ''),
          video_provider = coalesce(nullif(trim(v_request.payload ->> 'video_provider'), ''), 'youtube'),
          video_url = nullif(trim(v_request.payload ->> 'video_url'), ''),
          resource_path = nullif(trim(v_request.payload ->> 'resource_path'), ''),
          duration_minutes = coalesce(nullif(v_request.payload ->> 'duration_minutes', '')::integer, 0),
          is_preview = coalesce((v_request.payload ->> 'is_preview')::boolean, false),
          status = 'published',
          position = v_position,
          updated_at = now()
      where id = v_request.entity_id;

    else
      select to_jsonb(l) into v_current_snapshot
      from public.lessons l
      join public.course_sections s on s.id = l.section_id
      where l.id = v_request.entity_id
        and s.course_id = v_request.course_id
      for update of l;

      if v_current_snapshot is null or v_current_snapshot is distinct from v_request.base_snapshot then
        raise exception 'Materi Inti telah berubah sejak diajukan. Periksa versi terbaru sebelum menyetujui penghapusan.';
      end if;

      if exists (
        select 1
        from public.mentor_publication_requests r
        where r.status = 'pending'
          and r.id <> p_request_id
          and r.course_id = v_request.course_id
          and r.entity_type = 'lesson_content'
          and exists (
            select 1 from public.lesson_contents lc
            where lc.id = r.entity_id and lc.lesson_id = v_request.entity_id
          )
      ) then
        raise exception 'Materi Inti memiliki pengajuan Mini Materi yang masih menunggu review. Proses pengajuan tersebut terlebih dahulu.';
      end if;

      delete from public.lessons where id = v_request.entity_id;
    end if;

  elsif v_request.entity_type = 'lesson_content' then
    if v_request.action = 'create' then
      v_lesson_id := nullif(v_request.payload ->> 'lesson_id', '')::uuid;
      if v_lesson_id is null or not exists (
        select 1
        from public.lessons l
        join public.course_sections s on s.id = l.section_id
        where l.id = v_lesson_id and s.course_id = v_request.course_id
      ) then
        raise exception 'Materi Inti tujuan tidak tersedia. Pengajuan Mini Materi belum dapat diterapkan.';
      end if;
      if exists (select 1 from public.lesson_contents where id = v_request.entity_id) then
        raise exception 'Mini Materi dengan ID ini sudah ada. Periksa kembali sebelum menyetujui.';
      end if;

      v_content_type := coalesce(v_request.payload ->> 'content_type', '');
      if v_content_type not in ('text', 'tiktok', 'youtube', 'image', 'pdf', 'audio', 'link', 'callout') then
        raise exception 'Jenis Mini Materi tidak valid.';
      end if;
      if coalesce(trim(v_request.payload ->> 'resource_path'), '') <> '' then
        if v_request.payload ->> 'resource_path' not like
           'courses/' || v_request.course_id::text || '/lessons/' || v_lesson_id::text || '/%' then
          raise exception 'Lokasi file Mini Materi tidak sesuai dengan kelas dan materi tujuan.';
        end if;
        if not exists (
          select 1 from storage.objects so
          where so.bucket_id = 'learning-resources'
            and so.name = v_request.payload ->> 'resource_path'
        ) then
          raise exception 'File Mini Materi tidak lagi tersedia pada penyimpanan.';
        end if;
      end if;

      insert into public.lesson_contents (
        id, lesson_id, title, content_type, body, media_url, resource_path,
        link_url, link_label, settings, position, status, created_at, updated_at
      ) values (
        v_request.entity_id,
        v_lesson_id,
        nullif(trim(v_request.payload ->> 'title'), ''),
        v_content_type,
        nullif(trim(v_request.payload ->> 'body'), ''),
        nullif(trim(v_request.payload ->> 'media_url'), ''),
        nullif(trim(v_request.payload ->> 'resource_path'), ''),
        nullif(trim(v_request.payload ->> 'link_url'), ''),
        nullif(trim(v_request.payload ->> 'link_label'), ''),
        coalesce(v_request.payload -> 'settings', '{}'::jsonb),
        v_position,
        'published',
        now(), now()
      );

    elsif v_request.action = 'update' then
      select to_jsonb(lc) into v_current_snapshot
      from public.lesson_contents lc
      join public.lessons l on l.id = lc.lesson_id
      join public.course_sections s on s.id = l.section_id
      where lc.id = v_request.entity_id
        and s.course_id = v_request.course_id
      for update of lc;

      if v_current_snapshot is null or v_current_snapshot is distinct from v_request.base_snapshot then
        raise exception 'Mini Materi telah berubah sejak diajukan. Periksa versi terbaru sebelum menyetujui.';
      end if;

      v_lesson_id := nullif(v_request.payload ->> 'lesson_id', '')::uuid;
      if v_lesson_id is null or not exists (
        select 1
        from public.lessons l
        join public.course_sections s on s.id = l.section_id
        where l.id = v_lesson_id and s.course_id = v_request.course_id
      ) then
        raise exception 'Materi Inti tujuan tidak tersedia.';
      end if;

      v_content_type := coalesce(v_request.payload ->> 'content_type', '');
      if v_content_type not in ('text', 'tiktok', 'youtube', 'image', 'pdf', 'audio', 'link', 'callout') then
        raise exception 'Jenis Mini Materi tidak valid.';
      end if;
      if coalesce(trim(v_request.payload ->> 'resource_path'), '') <> '' then
        if v_request.payload ->> 'resource_path' not like
           'courses/' || v_request.course_id::text || '/lessons/' || v_lesson_id::text || '/%' then
          raise exception 'Lokasi file Mini Materi tidak sesuai dengan kelas dan materi tujuan.';
        end if;
        if not exists (
          select 1 from storage.objects so
          where so.bucket_id = 'learning-resources'
            and so.name = v_request.payload ->> 'resource_path'
        ) then
          raise exception 'File Mini Materi tidak lagi tersedia pada penyimpanan.';
        end if;
      end if;

      update public.lesson_contents
      set lesson_id = v_lesson_id,
          title = nullif(trim(v_request.payload ->> 'title'), ''),
          content_type = v_content_type,
          body = nullif(trim(v_request.payload ->> 'body'), ''),
          media_url = nullif(trim(v_request.payload ->> 'media_url'), ''),
          resource_path = nullif(trim(v_request.payload ->> 'resource_path'), ''),
          link_url = nullif(trim(v_request.payload ->> 'link_url'), ''),
          link_label = nullif(trim(v_request.payload ->> 'link_label'), ''),
          settings = coalesce(v_request.payload -> 'settings', '{}'::jsonb),
          position = v_position,
          status = 'published',
          updated_at = now()
      where id = v_request.entity_id;

    else
      select to_jsonb(lc) into v_current_snapshot
      from public.lesson_contents lc
      join public.lessons l on l.id = lc.lesson_id
      join public.course_sections s on s.id = l.section_id
      where lc.id = v_request.entity_id
        and s.course_id = v_request.course_id
      for update of lc;

      if v_current_snapshot is null or v_current_snapshot is distinct from v_request.base_snapshot then
        raise exception 'Mini Materi telah berubah sejak diajukan. Periksa versi terbaru sebelum menyetujui penghapusan.';
      end if;

      delete from public.lesson_contents where id = v_request.entity_id;
    end if;

  else
    raise exception 'Jenis materi pengajuan tidak dikenali.';
  end if;

  update public.mentor_publication_requests
  set status = 'approved',
      admin_note = nullif(trim(p_note), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.review_mentor_publication_request(uuid, text, text) from public;
grant execute on function public.review_mentor_publication_request(uuid, text, text) to authenticated;

commit;

-- Catatan:
-- - Admin tetap dapat membuat, mengedit, mengurutkan, memublikasikan, dan
--   menghapus materi melalui kebijakan Admin yang sudah ada.
-- - Persetujuan Mentor hanya menerapkan snapshot pengajuan yang diperiksa.
-- - Jika Admin mengubah materi setelah pengajuan dibuat, persetujuan ditolak
--   dengan pesan konflik agar versi Admin tidak tertimpa.
