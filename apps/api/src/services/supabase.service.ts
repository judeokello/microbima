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
   * Create a user using Supabase admin client
   */
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

