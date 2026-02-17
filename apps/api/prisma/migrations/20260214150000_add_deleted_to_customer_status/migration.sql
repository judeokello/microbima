-- Add DELETED to CustomerStatus enum (for soft-deleted customers)
ALTER TYPE "public"."CustomerStatus" ADD VALUE IF NOT EXISTS 'DELETED';
