import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ConfigurationService } from '../config/configuration.service';
import * as Sentry from '@sentry/nestjs';

/**
 * IP Whitelist Guard
 *
 * Validates that incoming requests are from allowed IP addresses.
 * Used for M-Pesa callback endpoints that cannot require API key authentication.
 *
 * For development/testing: Always allows localhost and common development IPs.
 * For production: Validates against Safaricom IP ranges from configuration.
 *
 * Security failure response: Returns success (ResultCode: 0) to M-Pesa, logs security violation,
 * does NOT process request, tracks as metric.
 */
@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(IpWhitelistGuard.name);

  constructor(private readonly configService: ConfigurationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);
    const correlationId = this.getCorrelationId(request);
    const isProduction = this.configService.environment === 'production';

    // In development mode: Allow all IPs (for ngrok and local testing)
    // IP whitelist is only enforced in production for security
    if (!isProduction) {
      this.logger.debug(
        JSON.stringify({
          event: 'IP_WHITELIST_ALLOWED_DEV',
          correlationId,
          ip: clientIp,
          path: request.path,
          message: 'Development mode - allowing all IPs',
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    }

    // For production: Validate against Safaricom IP ranges
    // First check if IP is a development IP (shouldn't happen in production, but safety check)
    if (this.isDevelopmentIp(clientIp)) {
      this.logger.debug(
        JSON.stringify({
          event: 'IP_WHITELIST_ALLOWED_DEV',
          correlationId,
          ip: clientIp,
          path: request.path,
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    }

    const allowedIpRanges = this.configService.mpesa.allowedIpRanges;

    if (!allowedIpRanges || allowedIpRanges.length === 0) {
      // No IP ranges configured
      if (isProduction) {
        // In production, reject if not configured (security risk)
        this.logger.warn(
          JSON.stringify({
            event: 'IP_WHITELIST_NOT_CONFIGURED',
            correlationId,
            ip: clientIp,
            path: request.path,
            message: 'IP whitelist not configured in production - this is a security risk',
            timestamp: new Date().toISOString(),
          })
        );
        this.logSecurityViolation(clientIp, correlationId, request, 'IP whitelist not configured');
        return false;
      } else {
        // In development, allow if not configured (for ngrok and local testing)
        this.logger.warn(
          JSON.stringify({
            event: 'IP_WHITELIST_NOT_CONFIGURED_DEV',
            correlationId,
            ip: clientIp,
            path: request.path,
            message: 'IP whitelist not configured - allowing in development (ngrok/local testing)',
            timestamp: new Date().toISOString(),
          })
        );
        return true;
      }
    }

    // Check if IP is in allowed ranges
    const isAllowed = this.isIpInRanges(clientIp, allowedIpRanges);

    if (!isAllowed) {
      this.logSecurityViolation(clientIp, correlationId, request, 'IP address not in whitelist');
      return false;
    }

    this.logger.debug(
      JSON.stringify({
        event: 'IP_WHITELIST_ALLOWED',
        correlationId,
        ip: clientIp,
        path: request.path,
        timestamp: new Date().toISOString(),
      })
    );

    return true;
  }

  /**
   * Check if IP is a development/testing IP (localhost, private networks)
   */
  private isDevelopmentIp(ip: string): boolean {
    // Localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return true;
    }

    // Private network ranges
    // 192.168.0.0/16
    if (ip.startsWith('192.168.')) {
      return true;
    }

    // 10.0.0.0/8
    if (ip.startsWith('10.')) {
      return true;
    }

    // 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
    const ipParts = ip.split('.');
    if (ipParts.length === 4) {
      const firstOctet = parseInt(ipParts[0], 10);
      const secondOctet = parseInt(ipParts[1], 10);
      if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if IP is in any of the allowed CIDR ranges
   */
  private isIpInRanges(ip: string, ranges: string[]): boolean {
    for (const range of ranges) {
      if (this.isIpInCidr(ip, range.trim())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if IP is in a CIDR range
   * Supports both IPv4 and basic IPv6 CIDR notation
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    try {
      const [network, prefixLengthStr] = cidr.split('/');
      const prefixLength = parseInt(prefixLengthStr, 10);

      if (isNaN(prefixLength)) {
        // If no prefix length, do exact match
        return ip === network;
      }

      // IPv4 CIDR
      if (this.isIPv4(ip) && this.isIPv4(network)) {
        return this.isIPv4InCidr(ip, network, prefixLength);
      }

      // IPv6 CIDR (basic support)
      if (this.isIPv6(ip) && this.isIPv6(network)) {
        // For now, do exact match for IPv6 (can be enhanced later)
        return ip === network;
      }

      return false;
    } catch (error) {
      this.logger.warn(
        `Error checking IP in CIDR: ${ip} in ${cidr} - ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }

  /**
   * Check if string is IPv4
   */
  private isIPv4(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipv4Regex.test(ip);
  }

  /**
   * Check if string is IPv6
   */
  private isIPv6(ip: string): boolean {
    return ip.includes(':');
  }

  /**
   * Check if IPv4 address is in CIDR range
   */
  private isIPv4InCidr(ip: string, network: string, prefixLength: number): boolean {
    const ipNum = this.ipv4ToNumber(ip);
    const networkNum = this.ipv4ToNumber(network);
    const mask = (0xffffffff << (32 - prefixLength)) >>> 0; // Unsigned right shift

    return (ipNum & mask) === (networkNum & mask);
  }

  /**
   * Convert IPv4 address to number
   */
  private ipv4ToNumber(ip: string): number {
    const parts = ip.split('.').map((part) => parseInt(part, 10));
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  }

  /**
   * Get client IP from request
   */
  private getClientIp(request: Request): string {
    // Check various headers that might contain the real IP
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fallback to connection remote address
    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }

  /**
   * Get correlation ID from request
   */
  private getCorrelationId(request: Request): string {
    const correlationIdHeader = request.headers['x-correlation-id'];
    if (correlationIdHeader) {
      return Array.isArray(correlationIdHeader) ? correlationIdHeader[0] : correlationIdHeader;
    }
    return `ip-check-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Log security violation
   * Returns success to M-Pesa, logs as ERROR, does NOT process request, tracks as metric
   */
  private logSecurityViolation(
    ip: string,
    correlationId: string,
    request: Request,
    reason: string
  ): void {
    // Log security violation as ERROR level
    this.logger.error(
      JSON.stringify({
        event: 'SECURITY_VIOLATION',
        correlationId,
        ip,
        path: request.path,
        method: request.method,
        reason,
        userAgent: request.headers['user-agent'],
        timestamp: new Date().toISOString(),
        // Sanitized payload (only key fields, not full payload for security)
        payload: {
          transactionId: (request.body as { TransID?: string })?.TransID,
          transactionType: (request.body as { TransactionType?: string })?.TransactionType,
        },
      })
    );

    // Metric: Security violations (counter)
    this.logger.log(
      JSON.stringify({
        event: 'METRIC_SECURITY_VIOLATION',
        metricType: 'counter',
        metricName: 'security_violations',
        value: 1,
        correlationId,
        ip,
        path: request.path,
        reason,
        timestamp: new Date().toISOString(),
      })
    );

    // Send to Sentry for alerting
    Sentry.captureMessage('IP Whitelist Security Violation', {
      level: 'error',
      tags: {
        service: 'IpWhitelistGuard',
        operation: 'canActivate',
        correlationId,
      },
      extra: {
        ip,
        path: request.path,
        reason,
        userAgent: request.headers['user-agent'],
      },
    });
  }
}

