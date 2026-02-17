-- Add description to messaging_templates
ALTER TABLE "messaging_templates" ADD COLUMN IF NOT EXISTS "description" VARCHAR(500);

-- Create enum for attachment template type
CREATE TYPE "public"."MessagingAttachmentTemplateType" AS ENUM ('GENERIC_HTML', 'MEMBER_CARD');

-- Create messaging_attachment_templates table
CREATE TABLE "public"."messaging_attachment_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "templateKey" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "templatePath" VARCHAR(500) NOT NULL,
    "attachmentType" "public"."MessagingAttachmentTemplateType" NOT NULL,
    "parameterSpec" JSONB NOT NULL,
    "description" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "messaging_attachment_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_messaging_attachment_template_key" ON "messaging_attachment_templates"("templateKey");

-- Add dynamicAttachmentSpecs to messaging_deliveries
ALTER TABLE "messaging_deliveries" ADD COLUMN IF NOT EXISTS "dynamicAttachmentSpecs" JSONB;
