-- ============================================================
-- KIKI CREATOR CLASS
-- PUBLIC COURSE LANDING DATA
--
-- Tujuan:
-- 1. Menampilkan struktur kurikulum resmi tanpa membuka isi materi terkunci.
-- 2. Menampilkan ringkasan rating dan ulasan peserta di halaman publik.
-- 3. Tidak membuat tabel rating baru; menggunakan course_feedback_reviews
--    yang sudah dipakai oleh alur penerbitan sertifikat.
--
-- Migration ini bersifat additive. Tidak mengubah data, tabel, atau RLS lama.
-- Jalankan satu kali setelah memastikan backup database tersedia.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. OUTLINE KURIKULUM PUBLIK
-- Hanya mengembalikan Bab dan Materi Inti yang sudah published.
-- Isi teks, URL video, file, dan isi Mini Materi tidak pernah dikirim.
-- ------------------------------------------------------------

create or replace function public.get_public_course_curriculum(
  p_course_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'description', s.description,
        'position', s.position,
        'lessons', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', l.id,
                'title', l.title,
                'duration_minutes', l.duration_minutes,
                'is_preview', coalesce(l.is_preview, false),
                'mini_material_count', (
                  select count(*)::integer
                  from public.lesson_contents lc
                  where lc.lesson_id = l.id
                    and lc.status = 'published'
                )
              )
              order by l.position asc, l.created_at asc
            ),
            '[]'::jsonb
          )
          from public.lessons l
          where l.section_id = s.id
            and l.status = 'published'
        )
      )
      order by s.position asc, s.created_at asc
    ),
    '[]'::jsonb
  )
  from public.course_sections s
  join public.courses c on c.id = s.course_id
  where s.course_id = p_course_id
    and c.status = 'published'
    and exists (
      select 1
      from public.lessons l
      where l.section_id = s.id
        and l.status = 'published'
    );
$$;

revoke all on function public.get_public_course_curriculum(uuid) from public;
grant execute on function public.get_public_course_curriculum(uuid)
  to anon, authenticated;

comment on function public.get_public_course_curriculum(uuid) is
  'Mengembalikan outline Bab dan Materi Inti yang telah dipublikasikan untuk landing page kelas. Tidak mengembalikan isi materi terkunci.';


-- ------------------------------------------------------------
-- 2. RINGKASAN RATING DAN ULASAN PUBLIK
-- Data berasal dari course_feedback_reviews, yang hanya dapat
-- diisi peserta melalui alur penyelesaian kelas/sertifikat.
--
-- Nama, user_id, dan data profil peserta tidak diekspos.
-- ------------------------------------------------------------

create or replace function public.get_public_course_review_summary(
  p_course_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with visible_reviews as (
    select
      r.id,
      r.rating,
      r.review_text,
      r.submitted_at
    from public.course_feedback_reviews r
    join public.courses c on c.id = r.course_id
    where r.course_id = p_course_id
      and c.status = 'published'
  ),
  summary as (
    select
      count(*)::integer as total_reviews,
      coalesce(round(avg(rating)::numeric, 1), 0) as average_rating,
      count(*) filter (where rating = 1)::integer as one_star,
      count(*) filter (where rating = 2)::integer as two_star,
      count(*) filter (where rating = 3)::integer as three_star,
      count(*) filter (where rating = 4)::integer as four_star,
      count(*) filter (where rating = 5)::integer as five_star
    from visible_reviews
  ),
  latest_reviews as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', latest.id,
          'rating', latest.rating,
          'review_text', latest.review_text,
          'submitted_at', latest.submitted_at,
          'display_name', 'Peserta Terverifikasi'
        )
        order by latest.submitted_at desc
      ),
      '[]'::jsonb
    ) as items
    from (
      select id, rating, review_text, submitted_at
      from visible_reviews
      order by submitted_at desc
      limit 10
    ) latest
  )
  select jsonb_build_object(
    'total_reviews', summary.total_reviews,
    'average_rating', summary.average_rating,
    'distribution', jsonb_build_object(
      '1', summary.one_star,
      '2', summary.two_star,
      '3', summary.three_star,
      '4', summary.four_star,
      '5', summary.five_star
    ),
    'reviews', latest_reviews.items
  )
  from summary
  cross join latest_reviews
  where exists (
    select 1
    from public.courses c
    where c.id = p_course_id
      and c.status = 'published'
  );
$$;

revoke all on function public.get_public_course_review_summary(uuid) from public;
grant execute on function public.get_public_course_review_summary(uuid)
  to anon, authenticated;

comment on function public.get_public_course_review_summary(uuid) is
  'Mengembalikan agregat rating dan maksimal 10 ulasan publik untuk kelas terbit tanpa mengekspos identitas peserta.';

commit;
