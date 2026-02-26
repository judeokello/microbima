-- Add audit fields from CSV to postpaid_scheme_payment_items (nullable for existing rows)
ALTER TABLE "postpaid_scheme_payment_items" ADD COLUMN "name" VARCHAR(255);
ALTER TABLE "postpaid_scheme_payment_items" ADD COLUMN "phoneNumber" VARCHAR(20);
ALTER TABLE "postpaid_scheme_payment_items" ADD COLUMN "amount" DECIMAL(10,2);
ALTER TABLE "postpaid_scheme_payment_items" ADD COLUMN "idNumber" VARCHAR(20);
ALTER TABLE "postpaid_scheme_payment_items" ADD COLUMN "paidDate" TIMESTAMPTZ(3);
