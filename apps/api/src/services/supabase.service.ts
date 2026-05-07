import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigurationService } from '../config/configuration.service';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigurationService) {
    // Get Supabase configuration from environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    this.logger.log('✅ Supabase client initialized successfully');
  }

  /**
   * Get the Supabase client instance
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('partners')
        .select('count')
        .limit(1);

      if (error) {
        this.logger.error('Supabase connection test failed', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }

      this.logger.log('✅ Supabase connection test successful');
      return { success: true };
    } catch (error: unknown) {
      this.logger.error('Supabase connection test error', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get display name for a user by ID (from Supabase auth metadata or Brand Ambassador)
   * @param userId - Supabase user ID (UUID)
   * @returns Display name or 'Unknown User' if not found
   */
  async getUserDisplayName(userId: string): Promise<string> {
    try {
      const { data: { user }, error } = await this.supabase.auth.admin.getUserById(userId);
      if (error || !user) {
        return 'Unknown User';
      }
      const userMetadata = (user.user_metadata ?? {}) as { displayName?: string };
      return userMetadata.displayName ?? user.email ?? 'Unknown User';
    } catch {
      return 'Unknown User';
    }
  }

  /**
   * Create a user using Supabase admin client
   */
  /**
   * Provision Supabase Auth for a registered customer: id equals Customer.id, password = registration OTP.
   * Idempotent if the user already exists with the same id.
   */
  async ensureCustomerPortalUser(params: {
    customerId: string;
    syntheticEmail: string;
    otpPassword: string;
    correlationId: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    const { customerId, syntheticEmail, otpPassword, correlationId } = params;

    const { data: existing, error: getErr } = await this.supabase.auth.admin.getUserById(customerId);
    if (!getErr && existing.user) {
      this.logger.log(`[${correlationId}] Customer portal user already exists: ${customerId}`);
      return { ok: true };
    }

    const { error: createErr } = await this.supabase.auth.admin.createUser({
      id: customerId,
      email: syntheticEmail,
      password: otpPassword,
      email_confirm: true,
      user_metadata: { roles: ['customer'] },
    });

    if (!createErr) {
      this.logger.log(`[${correlationId}] Customer portal user created: ${customerId}`);
      return { ok: true };
    }

    const msg = createErr.message ?? String(createErr);

    // A previous customer with this phone was deleted from Postgres but their Supabase auth
    // user was never cleaned up (orphaned). The new customer has the same synthetic email but
    // a different UUID, so createUser fails with "email already registered". Detect this case,
    // delete the orphaned stale Supabase user, and retry creation with the current UUID.
    const isEmailTaken = msg.toLowerCase().includes('already been registered') || msg.toLowerCase().includes('already registered');
    if (isEmailTaken) {
      const deleted = await this.deleteOrphanedSupabaseUserByEmail(syntheticEmail, correlationId);
      if (deleted) {
        const { error: retryErr } = await this.supabase.auth.admin.createUser({
          id: customerId,
          email: syntheticEmail,
          password: otpPassword,
          email_confirm: true,
          user_metadata: { roles: ['customer'] },
        });
        if (!retryErr) {
          this.logger.log(`[${correlationId}] Customer portal user created after orphan cleanup: ${customerId}`);
          return { ok: true };
        }
        const retryMsg = retryErr.message ?? String(retryErr);
        this.logger.error(`[${correlationId}] ensureCustomerPortalUser failed after orphan cleanup: ${retryMsg}`);
        return { ok: false, error: retryMsg };
      }
    }

    const { data: again } = await this.supabase.auth.admin.getUserById(customerId);
    if (again.user) {
      this.logger.log(`[${correlationId}] Customer portal user exists after create race: ${customerId}`);
      return { ok: true };
    }

    this.logger.error(`[${correlationId}] ensureCustomerPortalUser failed: ${msg}`);
    return { ok: false, error: msg };
  }

  async updateCustomerPortalPassword(
    customerId: string,
    newPassword: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const { error } = await this.supabase.auth.admin.updateUserById(customerId, { password: newPassword });
    if (error) {
      return { ok: false, error: error.message ?? String(error) };
    }
    return { ok: true };
  }

  /**
   * Find a Supabase auth user by synthetic email and delete them.
   * Used to clean up orphaned Supabase users whose Postgres customer record was deleted
   * but whose auth entry was never removed, causing email conflicts on re-registration.
   */
  private async deleteOrphanedSupabaseUserByEmail(email: string, correlationId: string): Promise<boolean> {
    try {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      // The Supabase admin REST API supports email filtering directly.
      const resp = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
      );
      if (!resp.ok) {
        this.logger.warn(`[${correlationId}] Failed to query Supabase users by email (${resp.status})`);
        return false;
      }
      const body = await resp.json() as { users?: Array<{ id: string }> };
      const orphan = body?.users?.[0];
      if (!orphan?.id) {
        this.logger.warn(`[${correlationId}] No orphaned Supabase user found for email: ${email}`);
        return false;
      }
      const { error: delErr } = await this.supabase.auth.admin.deleteUser(orphan.id);
      if (delErr) {
        this.logger.error(`[${correlationId}] Failed to delete orphaned Supabase user ${orphan.id}: ${delErr.message}`);
        return false;
      }
      this.logger.warn(`[${correlationId}] Deleted orphaned Supabase user ${orphan.id} (email: ${email})`);
      return true;
    } catch (err) {
      this.logger.error(`[${correlationId}] deleteOrphanedSupabaseUserByEmail threw: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async createUser(userData: {
    email: string;
    password: string;
    userMetadata?: {
      roles?: string[];
      partnerId?: number;
      displayName?: string;
      phone?: string;
      perRegistrationRateCents?: number;
    };
  }): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      this.logger.log(`Creating user: ${userData.email}`);

      const { data: user, error } = await this.supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Verify email automatically
        user_metadata: userData.userMetadata
      });

      if (error) {
        this.logger.error('Error creating user', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }

      this.logger.log(`✅ User created successfully: ${user.user.id}`);
      return { success: true, data: user.user };
    } catch (error: unknown) {
      this.logger.error('Unexpected error creating user', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Create a partner using Supabase client
   */
  async createPartner(partnerData: {
    partnerName: string;
    website?: string;
    officeLocation?: string;
  }): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      this.logger.log(`Creating partner: ${partnerData.partnerName}`);

      // Check if partner already exists
      const { data: existingPartner, error: checkError } = await this.supabase
        .from('partners')
        .select('id')
        .eq('partner_name', partnerData.partnerName)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        this.logger.error('Error checking existing partner', checkError);
        return { success: false, error: checkError.message };
      }

      if (existingPartner) {
        this.logger.log(`Partner ${partnerData.partnerName} already exists`);
        return { success: true, data: existingPartner };
      }

      // Create new partner
      const { data: newPartner, error: createError } = await this.supabase
        .from('partners')
        .insert({
          partner_name: partnerData.partnerName,
          website: partnerData.website,
          office_location: partnerData.officeLocation,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        this.logger.error('Error creating partner', createError);
        return { success: false, error: createError.message };
      }

      this.logger.log(`✅ Partner created successfully: ${newPartner.id}`);
      return { success: true, data: newPartner };
    } catch (error: unknown) {
      this.logger.error('Unexpected error creating partner', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

