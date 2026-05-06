import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string; quizId: string }>;
};

/**
 * There is no dedicated quiz "detail" page; editing questions lives under
 * /manage-questions. Sending users here avoids a bare 404 on /quizzes/[quizId].
 */
export default async function QuizIdPlaceholderPage({ params }: PageProps) {
  const { id, quizId } = await params;
  redirect(`/prof/courses/${id}/quizzes/${quizId}/manage-questions`);
}
