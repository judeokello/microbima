-- AddEmailPhoneToDependants
-- Add email and phoneNumber columns to dependants table

ALTER TABLE "dependants" ADD COLUMN "email" VARCHAR(100);
ALTER TABLE "dependants" ADD COLUMN "phoneNumber" VARCHAR(20);
