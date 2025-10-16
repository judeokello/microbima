import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Custom decorator for date string validation with friendly error messages
 * Validates that the string is a valid ISO 8601 date string
 */
export function IsDateStringFriendly(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isDateStringFriendly',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (value === null || value === undefined || value === '') {
            return true; // Allow empty values (handled by @IsOptional)
          }

          if (typeof value !== 'string') {
            return false;
          }

          // Check if it's a valid ISO 8601 date string
          const date = new Date(value);
          return !isNaN(date.getTime()) && value === date.toISOString().split('T')[0];
        },
        defaultMessage(args: ValidationArguments) {
          return 'Date of Birth is invalid';
        },
      },
    });
  };
}
