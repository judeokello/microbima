import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as Sentry from '@sentry/nestjs';

export interface BAUser {
  id: string;
  roles: string[];
  baId?: string;
  partnerId?: number;
}

/**
 * Data Masking Interceptor
 *
 * Masks sensitive customer data when accessed by Brand Ambassadors
 * to comply with privacy requirements.
 */
@Injectable()
export class DataMaskingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as BAUser;

    return next.handle().pipe(
      map(data => {
        try {
          // Only mask data for Brand Ambassadors (not admins)
          if (user && user.roles.includes('brand_ambassador') && !user.roles.includes('registration_admin')) {
            return this.maskSensitiveData(data);
          }

          return data;
        } catch (error) {
          Sentry.captureException(error, {
            tags: {
              operation: 'DataMaskingInterceptor.intercept',
            },
          });

          // Return original data if masking fails
          return data;
        }
      }),
    );
  }

  /**
   * Recursively mask sensitive data in the response
   */
  private maskSensitiveData(data: unknown): unknown {
    if (!data) return data;

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }

    // Handle objects
    if (typeof data === 'object') {
      const masked = { ...data } as Record<string, unknown>;

      // Mask customer data
      if (masked.customer) {
        masked.customer = this.maskCustomerData(masked.customer);
      }

      // Mask customers array
      if ('customers' in masked && Array.isArray(masked.customers)) {
        masked.customers = masked.customers.map((customer: unknown) => this.maskCustomerData(customer));
      }

      // Mask registrations array
      if ('registrations' in masked && Array.isArray(masked.registrations)) {
        masked.registrations = masked.registrations.map((registration: unknown) => {
          if (registration && typeof registration === 'object' && 'customer' in registration) {
            (registration as Record<string, unknown>).customer = this.maskCustomerData((registration as Record<string, unknown>).customer);
          }
          return registration;
        });
      }

      // Recursively mask nested objects
      const maskedObj = masked;
      Object.keys(maskedObj).forEach(key => {
        if (typeof maskedObj[key] === 'object' && maskedObj[key] !== null) {
          maskedObj[key] = this.maskSensitiveData(maskedObj[key]);
        }
      });

      return masked;
    }

    return data;
  }

  /**
   * Mask customer-specific sensitive data
   */
  private maskCustomerData(customer: unknown): unknown {
    if (!customer || typeof customer !== 'object') return customer;

    const customerObj = customer as Record<string, unknown>;

    return {
      ...customerObj,
      // Mask phone number (show last 4 digits)
      phoneNumber: customerObj.phoneNumber && typeof customerObj.phoneNumber === 'string'
        ? this.maskPhoneNumber(customerObj.phoneNumber)
        : customerObj.phoneNumber,

      // Mask email (show first 2 characters and domain)
      email: customerObj.email && typeof customerObj.email === 'string'
        ? this.maskEmail(customerObj.email)
        : customerObj.email,

      // Mask ID number (show last 4 digits)
      idNumber: customerObj.idNumber && typeof customerObj.idNumber === 'string'
        ? this.maskIdNumber(customerObj.idNumber)
        : customerObj.idNumber,

      // Keep other fields as-is (firstName, lastName, etc. are needed for BA operations)
    };
  }

  /**
   * Mask phone number - show last 4 digits
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length <= 4) {
      return phoneNumber;
    }

    const masked = '*'.repeat(phoneNumber.length - 4);
    return masked + phoneNumber.slice(-4);
  }

  /**
   * Mask email - show first 2 characters and domain
   */
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return email;
    }

    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return email;
    }

    const maskedLocal = localPart.substring(0, 2) + '*'.repeat(localPart.length - 2);
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mask ID number - show last 4 digits
   */
  private maskIdNumber(idNumber: string): string {
    if (!idNumber || idNumber.length <= 4) {
      return idNumber;
    }

    const masked = '*'.repeat(idNumber.length - 4);
    return masked + idNumber.slice(-4);
  }
}
