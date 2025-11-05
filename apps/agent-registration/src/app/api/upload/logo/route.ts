import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// Determine storage method based on environment
// Use NODE_ENV: 'development' = filesystem, 'staging' or 'production' = Supabase Storage
// Note: NODE_ENV can be 'staging' in our deployment (set in fly.toml), even though TypeScript types don't include it
const shouldUseSupabaseStorage = () => {
  const nodeEnv = process.env.NODE_ENV as string | undefined;
  return nodeEnv === 'staging' || nodeEnv === 'production';
};

export async function POST(request: NextRequest) {
  try {
    // Check authentication - get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Create Supabase client for server-side operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const entityType = formData.get('entityType') as string; // 'underwriter' or 'package'
    const entityId = formData.get('entityId') as string; // ID of the entity

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!entityType || !['underwriter', 'package'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entity type. Must be "underwriter" or "package"' },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: 'Entity ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed (JPEG, PNG, GIF, WebP)' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum allowed size (5MB)' },
        { status: 400 }
      );
    }

    // Get file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase() ?? 'png';

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let publicPath: string;

    if (shouldUseSupabaseStorage()) {
      // Use Supabase Storage for staging/production
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseServiceKey) {
        return NextResponse.json(
          { error: 'Server configuration error - Supabase service key not found' },
          { status: 500 }
        );
      }

      // Create Supabase client with service role key for storage operations
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Determine storage path based on entity type
      let storagePath: string;
      if (entityType === 'underwriter') {
        storagePath = `underwriters/${entityId}/logo.${fileExtension}`;
      } else {
        const underwriterId = formData.get('underwriterId') as string;
        if (!underwriterId) {
          return NextResponse.json(
            { error: 'Underwriter ID is required for package logos' },
            { status: 400 }
          );
        }
        storagePath = `underwriters/${underwriterId}/packages/${entityId}.${fileExtension}`;
      }

      // Upload to Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('logos')
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true, // Replace if exists
        });

      if (uploadError) {
        console.error('Supabase Storage upload error:', uploadError);
        return NextResponse.json(
          { error: `Failed to upload to storage: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('logos')
        .getPublicUrl(storagePath);

      publicPath = publicUrl;
    } else {
      // Use filesystem storage for development
      // Determine file path based on entity type
      let fileName: string;
      let directoryPath: string;

      if (entityType === 'underwriter') {
        // Underwriter logo: public/logos/underwriters/{underwriterId}/logo.{ext}
        directoryPath = join(process.cwd(), 'public', 'logos', 'underwriters', entityId);
        fileName = `logo.${fileExtension}`;
      } else {
        // Package logo: public/logos/underwriters/{underwriterId}/packages/{packageId}.{ext}
        const underwriterId = formData.get('underwriterId') as string;
        if (!underwriterId) {
          return NextResponse.json(
            { error: 'Underwriter ID is required for package logos' },
            { status: 400 }
          );
        }
        directoryPath = join(process.cwd(), 'public', 'logos', 'underwriters', underwriterId, 'packages');
        fileName = `${entityId}.${fileExtension}`;
      }

      // Create directory if it doesn't exist
      if (!existsSync(directoryPath)) {
        await mkdir(directoryPath, { recursive: true });
      }

      // Write file to disk
      const filePath = join(directoryPath, fileName);
      await writeFile(filePath, buffer);

      // Generate public URL path (relative to public folder)
      if (entityType === 'underwriter') {
        publicPath = `/logos/underwriters/${entityId}/${fileName}`;
      } else {
        const underwriterId = formData.get('underwriterId') as string;
        publicPath = `/logos/underwriters/${underwriterId}/packages/${fileName}`;
      }
    }

    return NextResponse.json({
      success: true,
      path: publicPath,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading file:', error);

    // Report error to Sentry with context
    // Note: We can't read formData again in catch block, so we'll capture what we can
    try {
      const formData = await request.formData();
      if (error instanceof Error) {
        Sentry.captureException(error, {
          tags: {
            endpoint: '/api/upload/logo',
            method: 'POST',
          },
          extra: {
            entityType: formData.get('entityType'),
            entityId: formData.get('entityId'),
          },
        });
      } else {
        Sentry.captureException(new Error('Unknown error in logo upload'), {
          tags: {
            endpoint: '/api/upload/logo',
            method: 'POST',
          },
          extra: {
            error: String(error),
          },
        });
      }
    } catch {
      // If we can't read formData, just capture the error without extra context
      if (error instanceof Error) {
        Sentry.captureException(error, {
          tags: {
            endpoint: '/api/upload/logo',
            method: 'POST',
          },
        });
      }
    }

    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication - get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Create Supabase client for server-side operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Get path from request body
    const body = await request.json();
    const storagePath = body.path as string;
    const oldLogoPath = body.oldLogoPath as string | undefined; // For filesystem deletion

    if (!storagePath && !oldLogoPath) {
      return NextResponse.json(
        { error: 'Storage path or old logo path is required' },
        { status: 400 }
      );
    }

    if (shouldUseSupabaseStorage()) {
      // Delete from Supabase Storage
      if (!storagePath) {
        return NextResponse.json(
          { error: 'Storage path is required for Supabase Storage deletion' },
          { status: 400 }
        );
      }
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseServiceKey) {
        return NextResponse.json(
          { error: 'Server configuration error - Supabase service key not found' },
          { status: 500 }
        );
      }

      // Create Supabase client with service role key for storage operations
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Delete file from Supabase Storage
      const { error: deleteError } = await supabaseAdmin.storage
        .from('logos')
        .remove([storagePath]);

      if (deleteError) {
        console.error('Supabase Storage delete error:', deleteError);
        return NextResponse.json(
          { error: `Failed to delete file: ${deleteError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'File deleted successfully',
      });
    } else {
      // Delete from filesystem storage in development
      if (!oldLogoPath) {
        return NextResponse.json(
          { error: 'Old logo path is required for filesystem deletion' },
          { status: 400 }
        );
      }

      // Extract relative path from public URL (e.g., /logos/underwriters/1/logo.png)
      // or use the path directly if it's already a relative path
      let filePath: string;
      if (oldLogoPath.startsWith('/')) {
        // Relative path from public folder
        filePath = join(process.cwd(), 'public', oldLogoPath);
      } else if (oldLogoPath.startsWith('http')) {
        // Full URL - extract path
        const urlObj = new URL(oldLogoPath);
        filePath = join(process.cwd(), 'public', urlObj.pathname);
      } else {
        // Assume it's already a relative path
        filePath = join(process.cwd(), 'public', oldLogoPath);
      }

      // Check if file exists before deleting
      if (existsSync(filePath)) {
        await unlink(filePath);
        return NextResponse.json({
          success: true,
          message: 'File deleted successfully from filesystem',
        });
      } else {
        // File doesn't exist - still return success (idempotent)
        return NextResponse.json({
          success: true,
          message: 'File not found (may have been already deleted)',
        });
      }
    }
  } catch (error) {
    console.error('Error deleting file:', error);

    if (error instanceof Error) {
      Sentry.captureException(error, {
        tags: {
          endpoint: '/api/upload/logo',
          method: 'DELETE',
        },
      });
    }

    return NextResponse.json(
      { error: 'Failed to delete file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

