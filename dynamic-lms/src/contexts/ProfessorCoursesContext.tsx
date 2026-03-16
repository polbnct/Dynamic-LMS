"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getProfessorCourses, getCurrentProfessorId, type CourseWithStudents } from "@/lib/supabase/queries/courses.client";

export interface HandledCourse {
  id: string;
  name: string;
  code: string;
  studentsCount?: number;
}

interface ProfessorCoursesContextValue {
  courses: CourseWithStudents[];
  handledCourses: HandledCourse[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCourse: (courseName: string) => Promise<void>;
}

const ProfessorCoursesContext = createContext<ProfessorCoursesContextValue | null>(null);

export function ProfessorCoursesProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<CourseWithStudents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    try {
      setError(null);
      const professorId = await getCurrentProfessorId(true);
      if (!professorId) {
        setCourses([]);
        return;
      }
      const data = await getProfessorCourses(professorId);
      setCourses(data);
    } catch (err) {
      console.error("Error fetching professor courses:", err);
      setError("Failed to load courses.");
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handledCourses: HandledCourse[] = courses.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    studentsCount: c.studentsCount,
  }));

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleCreateCourse = useCallback(async () => {
    // Course creation is now admin-only.
    throw new Error("Course creation is admin-only. Please contact your admin to create a course.");
  }, []);

  const value: ProfessorCoursesContextValue = {
    courses,
    handledCourses,
    loading,
    error,
    refetch: fetchCourses,
    createCourse: handleCreateCourse,
  };

  return (
    <ProfessorCoursesContext.Provider value={value}>
      {children}
    </ProfessorCoursesContext.Provider>
  );
}

export function useProfessorCourses(): ProfessorCoursesContextValue {
  const ctx = useContext(ProfessorCoursesContext);
  if (!ctx) {
    return {
      courses: [],
      handledCourses: [],
      loading: false,
      error: null,
      refetch: async () => {},
      createCourse: async () => {},
    };
  }
  return ctx;
}
