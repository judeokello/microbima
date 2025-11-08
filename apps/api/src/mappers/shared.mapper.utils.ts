import { Gender, IdType } from '@prisma/client';

/**
 * Shared mapper utilities to eliminate code duplication
 * Contains common mapping functions used across multiple mappers
 */
export class SharedMapperUtils {
  /**
   * Map gender from DTO string to Prisma enum
   * @param gender - Gender string from DTO
   * @returns Prisma Gender enum value
   */
  static mapGenderFromDto(gender: string): Gender {
    switch (gender.toLowerCase()) {
      case 'male':
        return Gender.MALE;
      case 'female':
        return Gender.FEMALE;
      default:
        return Gender.PREFER_NOT_TO_SAY;
    }
  }

  /**
   * Map gender from Prisma enum to DTO string
   * @param gender - Prisma Gender enum value
   * @returns Gender string for DTO
   */
  static mapGenderToDto(gender: Gender | null | undefined): string {
    if (!gender) return 'male'; // Default value

    switch (gender) {
      case Gender.MALE:
        return 'male';
      case Gender.FEMALE:
        return 'female';
      default:
        return 'male'; // Default fallback
    }
  }

  /**
   * Map ID type from DTO string to Prisma enum
   * @param idType - ID type string from DTO
   * @returns Prisma IdType enum value
   */
  static mapIdTypeFromDto(idType?: string | null): IdType | null {
    if (!idType) {
      return null;
    }

    switch (idType.toLowerCase()) {
      case 'national':
        return IdType.NATIONAL_ID;
      case 'alien':
        return IdType.ALIEN;
      case 'passport':
        return IdType.PASSPORT;
      case 'birth_certificate':
        return IdType.BIRTH_CERTIFICATE;
      case 'military':
        return IdType.MILITARY;
      default:
        return IdType.NATIONAL_ID; // Default fallback when provided but unrecognized
    }
  }

  /**
   * Map ID type from Prisma enum to DTO string
   * @param idType - Prisma IdType enum value
   * @returns ID type string for DTO
   */
  static mapIdTypeToDto(idType?: IdType | null): string | undefined {
    if (!idType) {
      return undefined;
    }

    switch (idType) {
      case IdType.NATIONAL_ID:
        return 'national';
      case IdType.ALIEN:
        return 'alien';
      case IdType.PASSPORT:
        return 'passport';
      case IdType.BIRTH_CERTIFICATE:
        return 'birth_certificate';
      case IdType.MILITARY:
        return 'military';
      default:
        return 'national'; // Default fallback
    }
  }
}
