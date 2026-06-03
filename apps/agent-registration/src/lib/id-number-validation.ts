export const ID_NUMBER_MIN_LENGTH = 5;
export const ID_NUMBER_MAX_LENGTH = 9;

export const getIdNumberValidationError = (value: string | undefined, required: boolean = false): string | null => {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return required ? `ID number is required` : null;
  }

  if (trimmed.length < ID_NUMBER_MIN_LENGTH || trimmed.length > ID_NUMBER_MAX_LENGTH) {
    return `ID number must be between ${ID_NUMBER_MIN_LENGTH} and ${ID_NUMBER_MAX_LENGTH} characters`;
  }

  return null;
};
