-- Care-ops missing requirements for parents (customer_parents)
ALTER TYPE "public"."RegistrationEntityKind" ADD VALUE IF NOT EXISTS 'PARENT';
