/** Student signups must use the institutional domain. */
export const STUDENT_SIGNUP_EMAIL_DOMAIN = "eac.edu.ph";

export function isAllowedStudentSignupEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.includes(" ")) return false;
  return domain === STUDENT_SIGNUP_EMAIL_DOMAIN;
}
