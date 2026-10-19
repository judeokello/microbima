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

/** When a deferrable ID number is being saved, ID type must be present too. */
export const getIdTypeRequiredWithIdNumberError = (
  idNumber: string | undefined,
  idType: string | undefined
): string | null => {
  const hasNumber = (idNumber ?? '').trim().length > 0;
  if (!hasNumber) return null;
  if (!(idType ?? '').trim()) {
    return 'ID type is required when ID number is provided';
  }
  return null;
};
