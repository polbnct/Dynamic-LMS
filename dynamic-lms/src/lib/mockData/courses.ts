// Mock data for courses and enrollments
// This can be easily replaced with Supabase calls later

export interface Student {
  id: string;
  name: string;
  email: string;
  studentId?: string;
  enrolledAt: string;
}

export interface CourseWithStudents {
  id: string;
  name: string;
  code: string;
  classroomCode: string;
  professorId: string;
  professorName: string;
  createdAt: string;
  students: Student[];
  studentsCount: number;
}

// Mock courses data
const MOCK_COURSES: CourseWithStudents[] = [
  {
    id: "1",
    name: "Discrete Structures",
    code: "CS101",
    classroomCode: "DS2024",
    professorId: "prof-1",
    professorName: "Dr. Jane Smith",
    createdAt: "2024-01-15T10:00:00Z",
    studentsCount: 45,
    students: [
      {
        id: "student-1",
        name: "John Doe",
        email: "john.doe@student.edu",
        studentId: "STU2024001",
        enrolledAt: "2024-01-20T09:00:00Z",
      },
      {
        id: "student-2",
        name: "Alice Johnson",
        email: "alice.johnson@student.edu",
        studentId: "STU2024002",
        enrolledAt: "2024-01-20T09:30:00Z",
      },
      {
        id: "student-3",
        name: "Bob Williams",
        email: "bob.williams@student.edu",
        studentId: "STU2024003",
        enrolledAt: "2024-01-21T10:15:00Z",
      },
      {
        id: "student-4",
        name: "Charlie Brown",
        email: "charlie.brown@student.edu",
        studentId: "STU2024004",
        enrolledAt: "2024-01-21T11:00:00Z",
      },
      {
        id: "student-5",
        name: "Diana Prince",
        email: "diana.prince@student.edu",
        studentId: "STU2024005",
        enrolledAt: "2024-01-22T08:45:00Z",
      },
    ],
  },
  {
    id: "2",
    name: "Data Structures and Algorithms",
    code: "CS201",
    classroomCode: "DSA2024",
    professorId: "prof-1",
    professorName: "Dr. Jane Smith",
    createdAt: "2024-01-10T10:00:00Z",
    studentsCount: 32,
    students: [
      {
        id: "student-1",
        name: "John Doe",
        email: "john.doe@student.edu",
        studentId: "STU2024001",
        enrolledAt: "2024-01-15T09:00:00Z",
      },
      {
        id: "student-6",
        name: "Emma Watson",
        email: "emma.watson@student.edu",
        studentId: "STU2024006",
        enrolledAt: "2024-01-15T10:00:00Z",
      },
      {
        id: "student-7",
        name: "Frank Miller",
        email: "frank.miller@student.edu",
        studentId: "STU2024007",
        enrolledAt: "2024-01-16T09:30:00Z",
      },
      {
        id: "student-8",
        name: "Grace Lee",
        email: "grace.lee@student.edu",
        studentId: "STU2024008",
        enrolledAt: "2024-01-16T11:15:00Z",
      },
    ],
  },
  {
    id: "3",
    name: "Web Development",
    code: "CS301",
    classroomCode: "WEB2024",
    professorId: "prof-1",
    professorName: "Dr. Jane Smith",
    createdAt: "2024-01-05T10:00:00Z",
    studentsCount: 28,
    students: [
      {
        id: "student-2",
        name: "Alice Johnson",
        email: "alice.johnson@student.edu",
        studentId: "STU2024002",
        enrolledAt: "2024-01-08T09:00:00Z",
      },
      {
        id: "student-9",
        name: "Henry Ford",
        email: "henry.ford@student.edu",
        studentId: "STU2024009",
        enrolledAt: "2024-01-08T10:30:00Z",
      },
      {
        id: "student-10",
        name: "Ivy Chen",
        email: "ivy.chen@student.edu",
        studentId: "STU2024010",
        enrolledAt: "2024-01-09T08:45:00Z",
      },
      {
        id: "student-11",
        name: "Jack Taylor",
        email: "jack.taylor@student.edu",
        studentId: "STU2024011",
        enrolledAt: "2024-01-09T14:20:00Z",
      },
    ],
  },
];

// Mock utility functions - Replace with real Supabase calls later
export const getProfessorCourses = async (
  professorId: string
): Promise<CourseWithStudents[]> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Filter courses by professor ID
  return MOCK_COURSES.filter((course) => course.professorId === professorId);
};

export const getCourseById = async (
  courseId: string
): Promise<CourseWithStudents | null> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  const course = MOCK_COURSES.find((c) => c.id === courseId);
  return course || null;
};

export const getCourseStudents = async (
  courseId: string
): Promise<Student[]> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  const course = MOCK_COURSES.find((c) => c.id === courseId);
  return course?.students || [];
};

export const createCourse = async (
  courseName: string,
  professorId: string,
  professorName: string
): Promise<CourseWithStudents> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 400));

  const newCourse: CourseWithStudents = {
    id: String(MOCK_COURSES.length + 1),
    name: courseName,
    code: `CS${Math.floor(Math.random() * 900) + 100}`,
    classroomCode: courseName.substring(0, 3).toUpperCase() + String(Math.floor(Math.random() * 1000)),
    professorId,
    professorName,
    createdAt: new Date().toISOString(),
    students: [],
    studentsCount: 0,
  };

  MOCK_COURSES.push(newCourse);
  return newCourse;
};

// Get current professor ID (mock - replace with real auth)
export const getCurrentProfessorId = (): string => {
  // In real implementation, get from auth session
  return "prof-1";
};

// Get current student ID (mock - replace with real auth)
export const getCurrentStudentId = (): string => {
  // In real implementation, get from auth session
  return "student-1";
};

// Get student's enrolled courses
export const getStudentCourses = async (
  studentId: string
): Promise<CourseWithStudents[]> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Filter courses where student is enrolled
  return MOCK_COURSES.filter((course) =>
    course.students.some((student) => student.id === studentId)
  );
};

