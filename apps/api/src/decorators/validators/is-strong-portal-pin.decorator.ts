import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { WEAK_PORTAL_PIN_MESSAGE, isEasilyGuessablePortalPin } from '@microbima/portal-pin';

/**
 * Chosen customer-portal PIN must be four digits and not an easily guessable pattern (spec FR-019).
 * Non-matching length/format is left to @Matches on the same field so only one format error is shown.
 */
export function IsStrongPortalPin(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPortalPin',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }
          if (!/^[0-9]{6}$/.test(value)) {
            return true;
          }
          return !isEasilyGuessablePortalPin(value);
        },
        defaultMessage() {
          return WEAK_PORTAL_PIN_MESSAGE;
        },
      },
    });
  };
}
