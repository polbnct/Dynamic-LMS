"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getCurrentStudentId,
  getStudentCourses,
  type CourseWithStudents,
} from "@/lib/supabase/queries/courses.client";

interface StudentCoursesContextValue {
  courses: CourseWithStudents[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const StudentCoursesContext = createContext<StudentCoursesContextValue | null>(null);

export function StudentCoursesProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<CourseWithStudents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    try {
      setError(null);
      const studentId = await getCurrentStudentId();
      if (!studentId) {
        setCourses([]);
        return;
      }

      const data = await getStudentCourses(studentId);
      setCourses(data);
    } catch (err) {
      console.error("Error fetching student courses:", err);
      setError("Failed to load courses.");
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const value: StudentCoursesContextValue = {
    courses,
    loading,
    error,
    refetch: fetchCourses,
  };

  return (
    <StudentCoursesContext.Provider value={value}>
      {children}
    </StudentCoursesContext.Provider>
  );
}

export function useStudentCourses(): StudentCoursesContextValue {
  const ctx = useContext(StudentCoursesContext);
  if (!ctx) {
    return {
      courses: [],
      loading: false,
      error: null,
      refetch: async () => {},
    };
  }
  return ctx;
}
