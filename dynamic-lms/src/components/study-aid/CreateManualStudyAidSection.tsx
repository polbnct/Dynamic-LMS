"use client";

import React, { useMemo, useState } from "react";
import {
  addLessonStudyQuestions,
  getLessonStudyQuestions,
  type StudyAidQuestion,
} from "@/lib/supabase/queries/study-aid";
import {
  StudyAidQuestionForm,
  type StudyAidQuestionTypeOption,
  type StudyAidQuestionUpdates,
} from "@/components/study-aid/StudyAidQuestionForm";

export type ManualStudyAidUiType = "flashcard" | "multiple_choice" | "fill_blank";

const UI_TO_DB_TYPE: Record<ManualStudyAidUiType, StudyAidQuestionTypeOption> = {
  flashcard: "true_false",
  multiple_choice: "multiple_choice",
  fill_blank: "fill_blank",
};

function buildPayload(updates: StudyAidQuestionUpdates, manualType: ManualStudyAidUiType) {
  return {
    type: UI_TO_DB_TYPE[manualType],
    question: updates.question!,
    options: updates.options,
    fill_blank_answer_mode: updates.fill_blank_answer_mode ?? null,
    correct_answer: updates.correct_answer!,
  };
}

export function CreateManualStudyAidSection({
  lessonId,
  onQuestionsChange,
  onSuccess,
  onError,
}: {
  lessonId: string;
  onQuestionsChange: (questions: StudyAidQuestion[]) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [manualType, setManualType] = useState<ManualStudyAidUiType>("multiple_choice");
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const emptyQuestion = useMemo(
    (): StudyAidQuestion => ({
      id: `manual-${formKey}`,
      type: UI_TO_DB_TYPE[manualType],
      question: "",
      options: manualType === "multiple_choice" ? ["", "", "", ""] : undefined,
      correct_answer: manualType === "multiple_choice" ? 0 : "",
      fill_blank_answer_mode: manualType === "fill_blank" ? "term_only" : null,
    }),
    [manualType, formKey]
  );

  const persist = async (updates: StudyAidQuestionUpdates) => {
    setSaving(true);
    onError("");
    try {
      const payload = buildPayload(updates, manualType);
      const result = await addLessonStudyQuestions(lessonId, [payload]);
      const list = await getLessonStudyQuestions(lessonId);
      onQuestionsChange(list);
      const duplicateNote =
        result.skippedDuplicates > 0
          ? ` (${result.skippedDuplicates} duplicate${result.skippedDuplicates !== 1 ? "s" : ""} skipped)`
          : "";
      if (result.added === 0) {
        onError("This study aid was not added. It may be a duplicate of an existing question.");
        return;
      }
      onSuccess(`Study aid created${duplicateNote}.`);
      setFormKey((k) => k + 1);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/50">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full cursor-pointer items-center gap-3 bg-white px-4 py-4 text-left transition-colors hover:bg-gray-50 sm:px-5 ${
          open ? "border-b border-gray-200" : ""
        }`}
        aria-expanded={open}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            open ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"
          }`}
        >
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gray-800">Create manually</span>
          <span className="mt-0.5 block text-sm text-gray-500">
            Add flashcards, fill-in-the-blank, or multiple choice without AI generation.
          </span>
        </span>
      </button>

      {open && (
        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Question type</label>
            <select
              value={manualType}
              onChange={(e) => {
                setManualType(e.target.value as ManualStudyAidUiType);
                setFormKey((k) => k + 1);
              }}
              className="w-full cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900"
            >
              <option value="flashcard">Flashcard</option>
              <option value="multiple_choice">Multiple choice</option>
              <option value="fill_blank">Fill in the blank</option>
            </select>
          </div>

          <StudyAidQuestionForm
            key={`${manualType}-${formKey}`}
            mode="create"
            question={emptyQuestion}
            allowedTypes={[UI_TO_DB_TYPE[manualType]]}
            lockType
            saving={saving}
            submitLabel="Create"
            onCancel={() => setFormKey((k) => k + 1)}
            onSave={persist}
          />
        </div>
      )}
    </section>
  );
}
