-- READ-ONLY PRE-FLIGHT CHECK FOR THE MENTOR REVENUE MIGRATION
-- Run this before 20261109_mentor_revenue_and_withdrawals.sql.
-- It only reads schema metadata and function signatures.

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'orders' and column_name in ('id', 'user_id', 'status', 'subtotal', 'total', 'currency', 'created_at', 'updated_at'))
    or (table_name = 'order_items' and column_name in ('id', 'order_id', 'course_id', 'line_total'))
    or (table_name = 'enrollments' and column_name in ('id', 'user_id', 'course_id', 'status', 'granted_at', 'created_at'))
    or (table_name = 'course_task_mentors' and column_name in ('course_id', 'mentor_user_id', 'assigned_by'))
    or (table_name = 'profiles' and column_name in ('id', 'full_name'))
    or (table_name = 'user_roles' and column_name in ('user_id', 'role'))
  )
order by table_name, ordinal_position;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_platform_admin', 'is_assigned_course_mentor', 'admin_review_course_payment')
order by p.proname;

-- If any required column or function is missing, DO NOT run the revenue migration.

-- Required unique key for the ON CONFLICT clause used by the Admin RPC.
select
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
 and kcu.table_name = tc.table_name
where tc.table_schema = 'public'
  and tc.table_name = 'course_task_mentors'
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
group by tc.table_name, tc.constraint_name
order by tc.constraint_name;

-- Verify the exact columns used by the migration, including its proportional
-- allocation basis and mentor assignment fields.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'orders' and column_name in ('id', 'user_id', 'status', 'subtotal', 'total', 'currency', 'created_at', 'updated_at'))
    or (table_name = 'order_items' and column_name in ('id', 'order_id', 'course_id', 'line_total'))
    or (table_name = 'courses' and column_name = 'id')
    or (table_name = 'course_task_mentors' and column_name in ('course_id', 'mentor_user_id', 'assigned_by'))
    or (table_name = 'enrollments' and column_name in ('user_id', 'course_id', 'status', 'granted_at', 'created_at'))
    or (table_name = 'profiles' and column_name in ('id', 'full_name'))
    or (table_name = 'user_roles' and column_name in ('user_id', 'role'))
  )
order by table_name, ordinal_position;
