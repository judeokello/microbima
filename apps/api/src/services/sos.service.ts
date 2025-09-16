import { Injectable, Logger } from '@nestjs/common';
import { SosResponseDto, SosResponseDataDto, SosContactDto } from '../dto/sos/sos-response.dto';

/**
 * SOS Service
 * 
 * Provides emergency contact information for insurance customers.
 * Uses in-memory caching for static emergency contact data.
 * 
 * Features:
 * - Static emergency contact data
 * - In-memory caching for performance
 * - Standardized response format
 */
@Injectable()
export class SosService {
  private readonly logger = new Logger(SosService.name);
  
  // In-memory cache for emergency contacts
  private emergencyContactsCache: SosResponseDto | null = null;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private cacheTimestamp: number = 0;

  /**
   * Get emergency contacts with caching
   * @param correlationId - Correlation ID for tracing
   * @returns Emergency contacts response
   */
  async getEmergencyContacts(correlationId: string): Promise<SosResponseDto> {
    this.logger.log(`[${correlationId}] Getting emergency contacts`);

    try {
      // Check if cache is valid
      if (this.isCacheValid()) {
        this.logger.log(`[${correlationId}] Returning cached emergency contacts`);
        return this.emergencyContactsCache!;
      }

      // Generate fresh data
      this.logger.log(`[${correlationId}] Generating fresh emergency contacts data`);
      const emergencyContacts = this.generateEmergencyContacts();
      
      // Cache the data
      this.emergencyContactsCache = emergencyContacts;
      this.cacheTimestamp = Date.now();

      this.logger.log(`[${correlationId}] Emergency contacts retrieved successfully`);
      return emergencyContacts;
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting emergency contacts: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Generate static emergency contacts data
   * @returns Emergency contacts response
   */
  private generateEmergencyContacts(): SosResponseDto {
    const sosContacts: SosContactDto[] = [
      {
        name: 'Ambulance Rescue Service 1',
        number: '254711911911',
        serviceType: 'AmbulanceRescue',
      },
      {
        name: 'Ambulance Rescue Service 2',
        number: '254714911911',
        serviceType: 'AmbulanceRescue',
      },
    ];

    const data: SosResponseDataDto = {
      sosContacts,
    };

    return {
      status: 200,
      success: true,
      message: 'SOS contacts retrieved successfully',
      data,
    };
  }

  /**
   * Check if cache is still valid
   * @returns boolean indicating cache validity
   */
  private isCacheValid(): boolean {
    if (!this.emergencyContactsCache) {
      return false;
    }

    const now = Date.now();
    const cacheAge = now - this.cacheTimestamp;
    
    return cacheAge < this.CACHE_TTL;
  }

  /**
   * Clear cache (useful for testing or manual cache invalidation)
   */
  clearCache(): void {
    this.logger.log('Clearing emergency contacts cache');
    this.emergencyContactsCache = null;
    this.cacheTimestamp = 0;
  }
}
