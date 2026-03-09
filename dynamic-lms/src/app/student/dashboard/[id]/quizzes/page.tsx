import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentDashboardQuizzesRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/student/courses/${id}/quizzes`);
}

