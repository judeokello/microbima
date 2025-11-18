// Partner API Key Mapper - no entity imports needed as we work with data objects

/**
 * Mapper for converting between PartnerApiKey entities and DTOs
 * Handles the transformation between internal domain objects and external API contracts
 */
export class PartnerApiKeyMapper {
  /**
   * Convert PartnerApiKey entity to API key response DTO
   * @param apiKeyData - API key data from service
   * @param correlationId - Correlation ID from request
   * @returns API key response DTO
   */
  static toApiKeyResponseDto(
    apiKeyData: {
      apiKey: string;
      partnerId: number;
      createdAt: Date;
    },
    correlationId: string
  ): {
    status: number;
    correlationId?: string;
    message: string;
    data: {
      apiKey: string;
      partnerId: number;
      createdAt: string;
      expiresAt?: string;
    };
  } {
    return {
      status: 201,
      correlationId: correlationId,
      message: 'API key generated successfully',
      data: {
        apiKey: apiKeyData.apiKey,
        partnerId: apiKeyData.partnerId,
        createdAt: apiKeyData.createdAt.toISOString(),
        // Note: API keys don't expire in our current implementation
        // expiresAt: undefined,
      },
    };
  }

  /**
   * Convert PartnerApiKey entity to API key validation response DTO
   * @param validationResult - Validation result from service
   * @param correlationId - Correlation ID from request
   * @returns API key validation response DTO
   */
  static toApiKeyValidationResponseDto(
    validationResult: {
      valid: boolean;
      partnerId?: number;
      message: string;
    },
    correlationId: string
  ): {
    status: number;
    correlationId?: string;
    message: string;
    data: {
      valid: boolean;
      partnerId?: number;
    };
  } {
    return {
      status: validationResult.valid ? 200 : 401,
      correlationId: correlationId,
      message: validationResult.message,
      data: {
        valid: validationResult.valid,
        partnerId: validationResult.partnerId,
      },
    };
  }
}
