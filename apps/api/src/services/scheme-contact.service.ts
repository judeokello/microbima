import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as Sentry from '@sentry/nestjs';

/**
 * Scheme Contact Service
 *
 * Manages contacts associated with schemes.
 * Enforces a maximum of 5 contacts per scheme.
 *
 * Features:
 * - Create contacts with validation
 * - Update contacts
 * - Delete contacts (hard delete)
 * - List contacts by scheme
 * - Maximum 5 contacts per scheme validation
 */
@Injectable()
export class SchemeContactService {
  private readonly logger = new Logger(SchemeContactService.name);
  private readonly MAX_CONTACTS_PER_SCHEME = 5;

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Create a new scheme contact
   * Validates that scheme doesn't already have 5 contacts
   *
   * @param data - Contact data
   * @param userId - User ID who is creating the contact
   * @param correlationId - Correlation ID for tracing
   * @returns Created contact
   */
  async createContact(
    data: {
      schemeId: number;
      firstName: string;
      otherName?: string;
      phoneNumber?: string;
      phoneNumber2?: string;
      email?: string;
      designation?: string;
      notes?: string;
    },
    userId: string,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Creating contact for scheme ${data.schemeId}`);

    try {
      // Verify scheme exists
      const scheme = await this.prismaService.scheme.findUnique({
        where: { id: data.schemeId },
        select: { id: true },
      });

      if (!scheme) {
        throw new NotFoundException(`Scheme with ID ${data.schemeId} not found`);
      }

      // Check current number of contacts for this scheme
      const contactCount = await this.prismaService.schemeContact.count({
        where: { schemeId: data.schemeId },
      });

      if (contactCount >= this.MAX_CONTACTS_PER_SCHEME) {
        throw new BadRequestException(
          `Cannot add more than ${this.MAX_CONTACTS_PER_SCHEME} contacts to a scheme`
        );
      }

      // Create the contact
      const contact = await this.prismaService.schemeContact.create({
        data: {
          schemeId: data.schemeId,
          firstName: data.firstName,
          otherName: data.otherName ?? null,
          phoneNumber: data.phoneNumber ?? null,
          phoneNumber2: data.phoneNumber2 ?? null,
          email: data.email ?? null,
          designation: data.designation ?? null,
          notes: data.notes ?? null,
          createdBy: userId,
        },
      });

      this.logger.log(
        `[${correlationId}] Created contact ${contact.id} for scheme ${data.schemeId}`
      );

      return contact;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error creating contact for scheme ${data.schemeId}`,
        error instanceof Error ? error.stack : String(error)
      );
      Sentry.captureException(error, {
        tags: {
          service: 'SchemeContactService',
          operation: 'createContact',
          correlationId,
        },
        extra: { schemeId: data.schemeId, userId },
      });
      throw error;
    }
  }

  /**
   * Update an existing scheme contact
   *
   * @param contactId - Contact ID to update
   * @param data - Updated contact data
   * @param userId - User ID who is updating the contact
   * @param correlationId - Correlation ID for tracing
   * @returns Updated contact
   */
  async updateContact(
    contactId: number,
    data: {
      firstName?: string;
      otherName?: string;
      phoneNumber?: string;
      phoneNumber2?: string;
      email?: string;
      designation?: string;
      notes?: string;
    },
    userId: string,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Updating contact ${contactId}`);

    try {
      // Verify contact exists
      const existingContact = await this.prismaService.schemeContact.findUnique({
        where: { id: contactId },
        select: { id: true, schemeId: true },
      });

      if (!existingContact) {
        throw new NotFoundException(`Contact with ID ${contactId} not found`);
      }

      // Update the contact
      const updatedContact = await this.prismaService.schemeContact.update({
        where: { id: contactId },
        data: {
          ...(data.firstName !== undefined && { firstName: data.firstName }),
          ...(data.otherName !== undefined && { otherName: data.otherName || null }),
          ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber || null }),
          ...(data.phoneNumber2 !== undefined && { phoneNumber2: data.phoneNumber2 || null }),
          ...(data.email !== undefined && { email: data.email || null }),
          ...(data.designation !== undefined && { designation: data.designation || null }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          updatedAt: new Date(),
        },
      });

      this.logger.log(`[${correlationId}] Updated contact ${contactId}`);

      return updatedContact;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error updating contact ${contactId}`,
        error instanceof Error ? error.stack : String(error)
      );
      Sentry.captureException(error, {
        tags: {
          service: 'SchemeContactService',
          operation: 'updateContact',
          correlationId,
        },
        extra: { contactId, userId },
      });
      throw error;
    }
  }

  /**
   * Delete a scheme contact (hard delete)
   *
   * @param contactId - Contact ID to delete
   * @param correlationId - Correlation ID for tracing
   * @returns Deleted contact
   */
  async deleteContact(contactId: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Deleting contact ${contactId}`);

    try {
      // Verify contact exists
      const existingContact = await this.prismaService.schemeContact.findUnique({
        where: { id: contactId },
        select: { id: true, schemeId: true },
      });

      if (!existingContact) {
        throw new NotFoundException(`Contact with ID ${contactId} not found`);
      }

      // Delete the contact
      const deletedContact = await this.prismaService.schemeContact.delete({
        where: { id: contactId },
      });

      this.logger.log(`[${correlationId}] Deleted contact ${contactId}`);

      return deletedContact;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error deleting contact ${contactId}`,
        error instanceof Error ? error.stack : String(error)
      );
      Sentry.captureException(error, {
        tags: {
          service: 'SchemeContactService',
          operation: 'deleteContact',
          correlationId,
        },
        extra: { contactId },
      });
      throw error;
    }
  }

  /**
   * Get all contacts for a scheme
   *
   * @param schemeId - Scheme ID
   * @param correlationId - Correlation ID for tracing
   * @returns List of contacts
   */
  async getContactsByScheme(schemeId: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting contacts for scheme ${schemeId}`);

    try {
      // Verify scheme exists
      const scheme = await this.prismaService.scheme.findUnique({
        where: { id: schemeId },
        select: { id: true },
      });

      if (!scheme) {
        throw new NotFoundException(`Scheme with ID ${schemeId} not found`);
      }

      // Get all contacts for the scheme
      const contacts = await this.prismaService.schemeContact.findMany({
        where: { schemeId },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.log(
        `[${correlationId}] Found ${contacts.length} contacts for scheme ${schemeId}`
      );

      return contacts;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting contacts for scheme ${schemeId}`,
        error instanceof Error ? error.stack : String(error)
      );
      Sentry.captureException(error, {
        tags: {
          service: 'SchemeContactService',
          operation: 'getContactsByScheme',
          correlationId,
        },
        extra: { schemeId },
      });
      throw error;
    }
  }

  /**
   * Get a single contact by ID
   *
   * @param contactId - Contact ID
   * @param correlationId - Correlation ID for tracing
   * @returns Contact
   */
  async getContactById(contactId: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting contact ${contactId}`);

    try {
      const contact = await this.prismaService.schemeContact.findUnique({
        where: { id: contactId },
      });

      if (!contact) {
        throw new NotFoundException(`Contact with ID ${contactId} not found`);
      }

      this.logger.log(`[${correlationId}] Found contact ${contactId}`);

      return contact;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting contact ${contactId}`,
        error instanceof Error ? error.stack : String(error)
      );
      Sentry.captureException(error, {
        tags: {
          service: 'SchemeContactService',
          operation: 'getContactById',
          correlationId,
        },
        extra: { contactId },
      });
      throw error;
    }
  }
}

