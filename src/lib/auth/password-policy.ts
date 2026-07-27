export const MIN_PASSWORD_LENGTH = 12;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passordet må være minst ${MIN_PASSWORD_LENGTH} tegn.`;
  }
  return null;
}
