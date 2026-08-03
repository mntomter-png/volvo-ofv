export const MIN_PASSWORD_LENGTH = 12;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passordet må være minst ${MIN_PASSWORD_LENGTH} tegn.`;
  }
  if (!/[a-zæøå]/.test(password) || !/[A-ZÆØÅ]/.test(password)) {
    return "Passordet må inneholde både store og små bokstaver.";
  }
  if (!/\d/.test(password)) {
    return "Passordet må inneholde minst ett tall.";
  }
  if (!/[^A-Za-zÆØÅæøå0-9]/.test(password)) {
    return "Passordet må inneholde minst ett spesialtegn.";
  }
  return null;
}

export const PASSWORD_REQUIREMENTS_HINT =
  `Minst ${MIN_PASSWORD_LENGTH} tegn, stor/liten bokstav, tall og spesialtegn`;
