-- Add PENDING_ACTIVATION to PolicyStatus enum
-- This must be done BEFORE migration 20251030180217_add_package_plans_and_policy_payments
-- which uses this enum value as a default

ALTER TYPE "public"."PolicyStatus" ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';

