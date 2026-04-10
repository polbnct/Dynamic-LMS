export const SIGNUP_PASSWORD_MIN_LENGTH = 8;

/** Human-readable rule text for signup forms. */
export const SIGNUP_PASSWORD_RULES_SUMMARY =
  `At least ${SIGNUP_PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, a number, and a symbol.`;

export function isStrongSignupPassword(password: string): boolean {
  return validateSignupPassword(password) === null;
}

/** Returns an error message if invalid, or null if the password meets policy. */
export function validateSignupPassword(password: string): string | null {
  if (password.length < SIGNUP_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${SIGNUP_PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include a number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include a symbol.";
  }
  return null;
}
