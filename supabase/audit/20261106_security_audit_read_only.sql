-- ============================================================
-- READ-ONLY SECURITY AUDIT FOR KIKI CREATOR CLASS
-- Run in Supabase SQL Editor. This file does not modify data.
-- ============================================================

-- 1. RLS status for application tables used by the codebase.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'courses', 'course_sections', 'lessons', 'lesson_contents',
    'course_tasks', 'course_task_mentors', 'course_task_submissions',
    'enrollments', 'orders', 'order_items', 'payments', 'payment_methods',
    'profiles', 'user_roles', 'mentor_profiles',
    'mentor_publication_requests', 'mentor_workspace_entries',
    'course_certificate_settings', 'course_completion_approvals',
    'course_feedback_reviews', 'course_certificates',
    'course_lesson_progress', 'platform_activity_logs',
    'course_lesson_content_progress', 'kcc_platform_settings',
    'course_mentor_revenue_agreements', 'mentor_course_earnings',
    'mentor_withdrawal_requests'
  )
order by c.relname;

-- 2. Existing policies. Review especially INSERT/UPDATE/DELETE policies.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 3. Security-definer functions in public schema.
-- Every result should be checked for auth.uid(), ownership checks,
-- role checks, fixed search_path, and validation of related rows.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;

-- 4. Definitions for sensitive RPCs used by the application.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_course_order',
    'submit_course_payment',
    'admin_review_course_payment',
    'accept_mentor_invitation',
    'create_mentor_invitation',
    'review_course_task_submission',
    'request_course_completion_approval',
    'mentor_review_course_completion',
    'submit_course_feedback_and_issue_certificate',
    'get_member_course_certificate_status',
    'get_mentor_certificate_candidates',
    'get_mentor_task_student_profiles',
    'save_member_registration_details',
    'apply_course_promo',
    'remove_course_promo',
    'mark_course_lesson_complete',
    'mark_course_lesson_content_complete',
    'admin_save_mentor_course_setup',
    'get_mentor_course_participants',
    'sync_mentor_earnings_for_order',
    'request_mentor_withdrawal',
    'admin_review_mentor_withdrawal'
  )
order by p.proname;

-- 5. Table grants for authenticated and anonymous users.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and grantee in ('anon', 'authenticated')
order by table_schema, table_name, grantee, privilege_type;

-- 6. Storage buckets and whether they are public.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;

-- 7. Storage object policies. Verify private buckets do not allow public reads.
select
  policyname,
  tablename,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
order by tablename, policyname;


-- 8. Mentor finance triggers. Verify only the expected event hooks exist.
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'trg_sync_mentor_earnings_on_order_change',
    'trg_sync_mentor_earnings_on_enrollment_change',
    'trg_sync_mentor_earnings_on_order_item_change'
  )
order by event_object_table, trigger_name;

-- 9. Mentor finance table privileges. Earnings and withdrawal requests
-- should be SELECT-only for authenticated; writes must go through RPCs.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'course_mentor_revenue_agreements',
    'mentor_course_earnings',
    'mentor_withdrawal_requests'
  )
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- 10. Ledger arithmetic check. Every available row should satisfy
-- basis_amount = mentor_amount + platform_amount (within 0.01).
select id, order_id, order_item_id, mentor_user_id, member_user_id,
       basis_amount, mentor_amount, platform_amount, status
from public.mentor_course_earnings
where abs(basis_amount - mentor_amount - platform_amount) > 0.01
order by created_at desc;

-- 11. Withdrawal status totals for reconciliation with Admin UI.
select status, count(*) as request_count, coalesce(sum(amount), 0) as total_amount
from public.mentor_withdrawal_requests
group by status
order by status;
