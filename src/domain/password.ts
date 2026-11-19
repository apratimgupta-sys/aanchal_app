export const MIN_PASSWORD_LENGTH = 10;

export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!currentPassword) errors.currentPassword = "Enter your current password";

  if (newPassword.length < MIN_PASSWORD_LENGTH)
    errors.newPassword = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  else if (newPassword === currentPassword)
    errors.newPassword = "Choose a password you have not used here before";

  if (confirmPassword !== newPassword)
    errors.confirmPassword = "Both passwords must match";

  return errors;
}
