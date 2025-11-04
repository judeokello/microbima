import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

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

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Write file to disk
    const filePath = join(directoryPath, fileName);
    await writeFile(filePath, buffer);

    // Generate public URL path (relative to public folder)
    let publicPath: string;
    if (entityType === 'underwriter') {
      publicPath = `/logos/underwriters/${entityId}/${fileName}`;
    } else {
      const underwriterId = formData.get('underwriterId') as string;
      publicPath = `/logos/underwriters/${underwriterId}/packages/${fileName}`;
    }

    return NextResponse.json({
      success: true,
      path: publicPath,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

