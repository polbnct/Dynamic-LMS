-- Restrict course provisioning to admins only.
-- Allows:
-- - Admin: full access
-- - Professor: read courses they own
-- - Student: read courses they are enrolled in

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Ensure we don't accumulate duplicate policies if re-run
DROP POLICY IF EXISTS "courses_select_admin_prof_student" ON public.courses;
DROP POLICY IF EXISTS "courses_insert_admin_only" ON public.courses;
DROP POLICY IF EXISTS "courses_update_admin_only" ON public.courses;
DROP POLICY IF EXISTS "courses_delete_admin_only" ON public.courses;

-- SELECT: admins OR owning professor OR enrolled student
CREATE POLICY "courses_select_admin_prof_student"
ON public.courses
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.professors p
    WHERE p.user_id = auth.uid() AND p.id = public.courses.professor_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    WHERE e.course_id = public.courses.id
      AND s.user_id = auth.uid()
  )
);

-- INSERT/UPDATE/DELETE: admin only
CREATE POLICY "courses_insert_admin_only"
ON public.courses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

CREATE POLICY "courses_update_admin_only"
ON public.courses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

CREATE POLICY "courses_delete_admin_only"
ON public.courses
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

