import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Custom decorator for Kenyan phone number validation
 * Validates that the phone number is 10 digits starting with 01 or 07
 *
 * This matches the validation used in the frontend (/register/customer page)
 */
export function IsKenyanPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isKenyanPhone',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          // Allow empty values (handled by @IsOptional)
          if (value === null || value === undefined || value === '') {
            return true;
          }

          if (typeof value !== 'string') {
            return false;
          }

          // Remove any non-digit characters
          const cleanPhone = value.replace(/\D/g, '');
          // Check if it starts with 01 or 07 and is exactly 10 digits
          return /^(01|07)\d{8}$/.test(cleanPhone);
        },
        defaultMessage(args: ValidationArguments) {
          return 'Phone number must be 10 digits starting with 01 or 07';
        },
      },
    });
  };
}

