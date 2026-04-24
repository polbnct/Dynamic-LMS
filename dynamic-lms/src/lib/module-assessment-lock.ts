export const MODULE_ASSESSMENT_LOCK_KEY = "moduleAssessmentLock";
export const MODULE_ASSESSMENT_LOCK_STALE_MS = 45_000;

export interface ModuleAssessmentLock {
  ownerTabId: string;
  courseId: string;
  lessonId: string;
  heartbeatAt: number;
}

function isValidLock(value: unknown): value is ModuleAssessmentLock {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ownerTabId === "string" &&
    typeof v.courseId === "string" &&
    typeof v.lessonId === "string" &&
    typeof v.heartbeatAt === "number"
  );
}

export function readModuleAssessmentLock(): ModuleAssessmentLock | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MODULE_ASSESSMENT_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidLock(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeModuleAssessmentLock(lock: ModuleAssessmentLock): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODULE_ASSESSMENT_LOCK_KEY, JSON.stringify(lock));
}

export function clearModuleAssessmentLock(ownerTabId?: string): void {
  if (typeof window === "undefined") return;
  const current = readModuleAssessmentLock();
  if (!current) return;
  if (ownerTabId && current.ownerTabId !== ownerTabId) return;
  window.localStorage.removeItem(MODULE_ASSESSMENT_LOCK_KEY);
}

export function isModuleAssessmentLockActive(lock: ModuleAssessmentLock | null): boolean {
  if (!lock) return false;
  return Date.now() - lock.heartbeatAt <= MODULE_ASSESSMENT_LOCK_STALE_MS;
}

