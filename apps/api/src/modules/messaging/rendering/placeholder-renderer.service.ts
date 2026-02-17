import { Injectable } from '@nestjs/common';
import { ValidationException } from '../../../exceptions/validation.exception';
import { ErrorCodes } from '../../../enums/error-codes.enum';

@Injectable()
export class PlaceholderRendererService {
  private readonly keyRegex = /^[a-z0-9_]+$/;

  scanRequiredPlaceholders(texts: Array<string | null | undefined>): string[] {
    const required = new Set<string>();
    for (const text of texts) {
      if (!text) continue;
      const matches = text.match(/\{([^}]+)\}/g) ?? [];
      for (const m of matches) {
        const key = m.slice(1, -1);
        if (!this.keyRegex.test(key)) {
          throw ValidationException.forField('placeholderKey', `Invalid placeholder key "${key}"`, ErrorCodes.INVALID_FORMAT);
        }
        required.add(key);
      }
    }
    return Array.from(required.values()).sort();
  }

  render(text: string, placeholderValues: Record<string, string | number | boolean | Date>) {
    const required = this.scanRequiredPlaceholders([text]);
    const missingKeys: string[] = [];

    for (const key of required) {
      const val = placeholderValues[key];
      if (val === null || val === undefined) {
        missingKeys.push(key);
        continue;
      }
      if (typeof val === 'string' && val.trim() === '') {
        missingKeys.push(key);
        continue;
      }
    }

    if (missingKeys.length > 0) {
      throw ValidationException.withMultipleErrors(
        Object.fromEntries(missingKeys.map((k) => [k, 'Missing placeholder value'])),
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const rendered = text.replace(/\{([^}]+)\}/g, (_match, key: string) => {
      const val = placeholderValues[key];
      if (val instanceof Date) return val.toISOString();
      return String(val);
    });

    return { rendered, requiredPlaceholders: required };
  }
}

