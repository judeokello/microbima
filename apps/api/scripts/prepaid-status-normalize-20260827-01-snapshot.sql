-- =============================================================================
-- Prepaid status normalize — STEP 1: snapshot / CC report (2026-08-27)
-- =============================================================================
--
-- Context: Stage-2 prepaid arrears audit (money-target cap + payment by account
-- number / package lineage). 31 latest prepaid policies (ACTIVE/SUSPENDED/
-- INACTIVE) whose current status ≠ expected status under corrected math.
--
-- This script creates table prepaid_status_fix_20260827 and loads the BEFORE
-- state + intended AFTER targets so Customer Care can review, and so STEP 3
-- rollback can restore exact prior columns if needed.
--
-- Postpaid schemes are excluded. No LCT / SMS side effects (raw SQL only).
--
-- HOW TO RUN:
--   1. Run this file once (creates + truncates + inserts snapshot).
--   2. Export the final SELECT for Customer Care.
--   3. Then run: prepaid-status-normalize-20260827-02-apply.sql
--   4. Keep:     prepaid-status-normalize-20260827-03-rollback.sql for emergencies
--
--   psql $DATABASE_URL -f apps/api/scripts/prepaid-status-normalize-20260827-01-snapshot.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS prepaid_status_fix_20260827 (
  policy_id uuid PRIMARY KEY,
  customer_id uuid NOT NULL,
  policy_number text NOT NULL,
  first_name text,
  last_name text,
  phone_number text,
  mismatch_class text NOT NULL,
  -- BEFORE
  old_policy_status text NOT NULL,
  old_customer_status text NOT NULL,
  old_in_grace boolean NOT NULL,
  old_grace_entered_at timestamptz,
  old_overdue_anchor timestamptz,
  old_suspended_at timestamptz,
  old_inactivated_at timestamptz,
  old_customer_deactivated_at timestamptz,
  -- TARGET
  new_policy_status text NOT NULL,      -- ACTIVE | ACTIVE_GRACE | SUSPENDED | INACTIVE
  new_customer_status text NOT NULL,
  next_due_date date,
  paid numeric,
  money_target numeric,
  arrears numeric,
  overdue_days int,
  premium_complete boolean,
  applied_at timestamptz,
  rolled_back_at timestamptz
);

TRUNCATE prepaid_status_fix_20260827;

INSERT INTO prepaid_status_fix_20260827 (
  policy_id, customer_id, policy_number, first_name, last_name, phone_number,
  mismatch_class, old_policy_status, old_customer_status, old_in_grace,
  old_grace_entered_at, old_overdue_anchor, old_suspended_at, old_inactivated_at,
  old_customer_deactivated_at, new_policy_status, new_customer_status,
  next_due_date, paid, money_target, arrears, overdue_days, premium_complete
) VALUES
-- INACTIVE → SUSPENDED (8)
('4053a56c-571a-4729-9ae1-003343bc0ae4','c808e098-4478-414a-afac-3d5f363b29e4','MP/MFG/044','Andrew','Kaswii','0722169058','INACTIVE_TO_SUSPENDED','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-13 01:00:00.008+00','2026-08-13 01:00:14.509+00','SUSPENDED','SUSPENDED','2026-08-01',25840,41952,4104,26,false),
('515e822b-e8de-473e-b096-3958ccc04591','c3ac0241-b875-4ba7-bcda-df4911f8cddc','MP/MFG/112','Leonard','Mwololo','0723436849','INACTIVE_TO_SUSPENDED','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-13 01:00:00.008+00','2026-08-13 01:00:30.617+00','SUSPENDED','SUSPENDED','2026-08-11',18695,30636,1840,16,false),
('ddcc25f9-c106-4801-925f-102e0d8a2bd9','dba48aff-0f31-4d12-919f-30c5ccd0c9cb','MP/MFG/134','Elizabeth','Kariuki','0723996819','INACTIVE_TO_SUSPENDED','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-13 01:00:00.008+00','2026-08-13 01:00:30.883+00','SUSPENDED','SUSPENDED','2026-08-06',18870,30636,2442,21,false),
('9bde7249-038f-46dc-b0a0-da7b6a6017e3','72141fc5-3f08-4103-9bed-aad7302318eb','MP/MFG/174','Peter','Samoei','0722265855','INACTIVE_TO_SUSPENDED','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-13 01:00:00.008+00','2026-08-13 01:00:38.831+00','SUSPENDED','SUSPENDED','2026-08-01',20520,41952,4104,26,false),
('9d6042d8-ae96-4ed2-adc1-0e5148d38d87','00bb7c7d-9c2f-431a-b8e7-07d9f057fc57','MP/MFG/197','Rosemary','Macharia','0722499892','INACTIVE_TO_SUSPENDED','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-24 01:00:00.006+00','2026-08-24 01:00:16.014+00','SUSPENDED','SUSPENDED','2026-07-29',14456,41952,4544,29,false),
('504697aa-72b8-4691-a93e-2b2155655c2d','70257d42-a831-47b2-a0c9-d7c3152a2598','MP/MFG/199','Susan','Njeru','0721789642','INACTIVE_TO_SUSPENDED','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-24 01:00:00.006+00','2026-08-24 01:00:18.075+00','SUSPENDED','SUSPENDED','2026-08-09',10537,30636,2006,18,false),
('ff73235d-5045-4ba2-8904-9e280650ec13','f170a64a-5a21-4c45-98fd-69d64f2fe83f','MP/MFG/212','Diana','Kilonzi','0721878807','INACTIVE_TO_SUSPENDED','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-27 01:00:00.003+00','2026-08-27 01:00:12.612+00','SUSPENDED','SUSPENDED','2026-07-29',9728,41952,4560,29,false),
('e64645c5-c893-4ad1-80de-0d0b30a85c75','3ab3a5cc-92c1-4a29-a45c-05bd4d20b4c6','MP/MFG/246','Patrick','Kihuria','0705845222','INACTIVE_TO_SUSPENDED','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-24 01:00:00.006+00','2026-08-24 01:00:19.089+00','SUSPENDED','SUSPENDED','2026-07-30',2400,30636,3150,28,false),
-- SHOULD_BE_ACTIVE (13) — includes Nathaniel MP/MFG/017
('f0d38f8c-6a6d-46d1-9c11-0c1410ed97c5','8faaeb61-836a-4536-a40d-32a287c2662e','MP/MFB/001','Ronald','Situma','0711735551','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-26 01:00:00.007+00','2026-08-26 01:00:13.488+00','ACTIVE_GRACE','ACTIVE','2026-08-14',6200,38745,1672,13,false),
('5614bc1d-9e54-480b-8524-fe198153093c','79934683-3c2a-418d-a65e-f7ca2ec19514','MP/MFG/017','Nathaniel','Nyaga','0792706478','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-13 01:00:00.008+00','2026-08-13 01:00:28.888+00','ACTIVE','ACTIVE','2026-08-04',41952,41952,0,0,true),
('459962e2-e695-4436-a8b7-635b5d7a787c','1a55ff59-4340-4555-942a-3b207ed0c69d','MP/MFG/018','Stephen','Mutua','0724525571','SHOULD_BE_ACTIVE','SUSPENDED','SUSPENDED',false,NULL,NULL,'2026-08-27 01:00:00.003+00',NULL,NULL,'ACTIVE','ACTIVE','2026-09-18',7215,30636,0,0,false),
('ffe9ca2e-4454-4fbb-827c-4cc51d817c31','705741b7-3e91-44cb-8d35-ac430d206666','MP/MFG/065','Kennedy','Anyika','0723727771','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-13 01:00:00.008+00','2026-08-13 01:00:25.017+00','ACTIVE_GRACE','ACTIVE','2026-08-14',21199,30636,1445,13,false),
('250f9f50-2693-4055-9d3a-ff3bfe8331e5','80afb26d-532c-49de-9936-6b38856525ea','MP/MFG/093','Rose','Mulee','0745143221','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-24 01:00:00.006+00','2026-08-24 01:00:19.607+00','ACTIVE_GRACE','ACTIVE','2026-08-19',20172,30636,918,8,false),
('a96126d0-a612-4ed8-b13e-4e3929519bce','c95d84fa-297c-4bce-bd24-d33dbfe1d168','MP/MFG/094','Charles','Kamanza','0722455174','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-13 01:00:00.008+00','2026-08-13 01:00:42.637+00','ACTIVE_GRACE','ACTIVE','2026-08-20',11924,23184,592,7,false),
('1583b89b-c8a7-4245-b3f6-6db65441fc66','308b4731-f257-4380-ae6d-9e5a5c060f2c','MP/MFG/099','Malon','Wangubo','0728812423','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-13 01:00:00.008+00','2026-08-13 01:00:07.534+00','ACTIVE_GRACE','ACTIVE','2026-08-25',20626,30636,242,2,false),
('9efbed31-ca2d-4cac-947f-a80c4cc498e6','3493fd5b-9eb2-48bb-a69b-ddef96efa466','MP/MFG/180','Agnes','Mbinya','0723016191','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-13 01:00:00.008+00','2026-08-13 01:00:40.494+00','ACTIVE_GRACE','ACTIVE','2026-08-15',20320,41496,960,12,false),
('46f0554e-e0b0-4ba8-bd08-f7629b89bffb','21e789a9-a094-47f9-8e36-628f25158d47','MP/MFG/186','Wilson','Murenga','0712284107','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-24 01:00:00.006+00','2026-08-24 01:00:19.869+00','ACTIVE','ACTIVE','2026-08-02',16761,30969,0,0,false),
('19684372-f1a8-4236-9183-cbb4deb81d96','f45f40f2-dd08-45ca-acde-83549b4e7c74','MP/MFG/202','Pius','Mwiandi','0727131929','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-24 01:00:00.006+00','2026-08-24 01:00:14.962+00','ACTIVE_GRACE','ACTIVE','2026-08-24',16618,41952,558,3,false),
('9d5e3a5e-11b0-4fb5-9475-3f0e88db404f','7c9bf504-e4f6-4bb4-9d60-80e18c078e65','MP/MFG/211','David','Chege','0728039930','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-24 01:00:00.006+00','2026-08-24 01:00:17.307+00','ACTIVE_GRACE','ACTIVE','2026-08-16',9735,30636,1254,11,false),
('f56b6bd3-2ab2-434b-af3f-8402ca52e42b','44704dad-d41e-408e-b29f-0e1a141d668b','MP/MFG/228','Caroline','Waithaka','0702878304','SHOULD_BE_ACTIVE','INACTIVE','DEACTIVATED',false,NULL,NULL,NULL,'2026-08-24 01:00:00.006+00','2026-08-24 01:00:16.24+00','ACTIVE','ACTIVE','2026-08-01',2604,23436,0,0,false),
('4fa32df7-40de-4e6f-a469-1a3c20c64668','5eef18ab-7d54-4627-8e86-fc17ab4ef0b2','MP/MFG/257','Gillet','Ganira','0722924815','SHOULD_BE_ACTIVE','SUSPENDED','SUSPENDED',false,NULL,NULL,'2026-08-13 01:00:00.008+00',NULL,NULL,'ACTIVE_GRACE','ACTIVE','2026-08-19',4111,30264,545,8,false),
-- SHOULD_CLEAR_GRACE (8)
('db295d70-6156-48c6-821e-c30695b5d58a','0181933b-c8b1-4730-8351-862adf8ed924','MP/MFB/010','Hamisi','Mlaula','0795498959','SHOULD_CLEAR_GRACE','ACTIVE','ACTIVE',true,'2026-08-27 01:00:00.003+00','2026-08-26 00:00:00+00',NULL,NULL,NULL,'ACTIVE','ACTIVE','2026-08-27',1370,42840,126,0,false),
('cd49f484-0092-40c8-a46b-b61c414f38d5','3bf835b7-9598-47d2-84ea-4864502f8b8c','MP/MFB/018','Mdzomba','Munga','0713510430','SHOULD_CLEAR_GRACE','ACTIVE','ACTIVE',true,'2026-08-20 01:00:00.005+00','2026-08-19 00:00:00+00',NULL,NULL,NULL,'ACTIVE','ACTIVE','2026-08-27',1370,42840,126,0,false),
('01cf226e-16fa-493b-ab0c-2c68687708c8','824385ce-4f08-42fd-81af-f097d7022a83','MP/MFG/179','John','Gicheha','0725265795','SHOULD_CLEAR_GRACE','ACTIVE','ACTIVE',true,'2026-08-18 01:00:00.007+00','2026-08-17 00:00:00+00',NULL,NULL,NULL,'ACTIVE','ACTIVE','2026-11-24',11550,30636,0,0,false),
('37d42ab5-5295-4f73-b12b-13f8f46524b6','dd79940d-611b-4e22-87c6-824668a10278','MP/MFG/210','Wycliffe','Machoka','0720263620','SHOULD_CLEAR_GRACE','ACTIVE','ACTIVE',true,'2026-07-14 01:00:00.01+00','2026-07-12 00:00:00+00',NULL,NULL,NULL,'ACTIVE','ACTIVE','2026-09-16',10767,30636,0,0,false),
('fd4505d0-d414-4a98-86e6-4d8d186bad6d','e6cfc7b3-9d92-498e-a81c-78504b561b74','MP/MFG/247','Pauline','Ikua','0745681736','SHOULD_CLEAR_GRACE','ACTIVE','ACTIVE',true,'2026-08-12 01:00:00.012+00','2026-08-11 00:00:00+00',NULL,NULL,NULL,'ACTIVE','ACTIVE','2026-09-03',6629,23184,0,0,false),
('9d1715af-3f53-4dff-93fa-a475d4635ca0','ae9e1ffc-de0d-436c-9069-4eb0141f71fc','MP/MFG/255','Collins','Otieno','0717817049','SHOULD_CLEAR_GRACE','ACTIVE','ACTIVE',true,'2026-08-24 01:00:00.006+00','2026-08-23 00:00:00+00',NULL,NULL,NULL,'ACTIVE','ACTIVE','2026-08-27',4773,30636,111,0,false),
('23f8d0cf-8fde-499e-a31b-02b071020657','6819fa58-8bd4-4ebe-8b9d-381e8042c920','MP/MFG/288','Kevin','Odongo','0742095606','SHOULD_CLEAR_GRACE','ACTIVE','ACTIVE',true,'2026-07-30 01:00:00.005+00','2026-07-28 00:00:00+00',NULL,NULL,NULL,'ACTIVE','ACTIVE','2026-10-20',14159,41952,0,0,false),
('5b3fd2ce-dc20-413f-8a9e-1c975d729f3d','4d79f480-d967-4632-8e5a-a198b5f88532','MP/MFG/298','Fredrick','Bita','0722823709','SHOULD_CLEAR_GRACE','ACTIVE','ACTIVE',true,'2026-08-22 01:00:00.013+00','2026-08-21 00:00:00+00',NULL,NULL,NULL,'ACTIVE','ACTIVE','2026-08-27',3503,41952,145,0,false),
-- SUSPENDED → INACTIVE (2)
('82af83d3-41ed-4cc9-8301-20931e8b9e88','30da0a82-228c-417d-b9eb-ff3695ebd95a','MP/MFG/206','Isaac','Wanjeru','0720232665','SUSPENDED_TO_INACTIVE','SUSPENDED','SUSPENDED',false,NULL,NULL,'2026-08-26 01:00:00.007+00',NULL,NULL,'INACTIVE','DEACTIVATED','2026-07-25',2442,30636,3774,33,false),
('ad434363-89a0-4082-8d92-c5f6a5f54642','af98c657-3bea-4e4b-9687-26c528ef248d','MP/MFG/276','Paul','Karanja','0719779396','SUSPENDED_TO_INACTIVE','SUSPENDED','SUSPENDED',false,NULL,NULL,'2026-08-26 01:00:00.007+00',NULL,NULL,'INACTIVE','DEACTIVATED','2026-07-27',152,42408,4560,31,false);

-- Customer Care export
SELECT
  mismatch_class,
  policy_number,
  first_name,
  last_name,
  phone_number,
  old_policy_status,
  new_policy_status,
  old_customer_status,
  new_customer_status,
  paid,
  money_target,
  arrears,
  overdue_days,
  premium_complete
FROM prepaid_status_fix_20260827
ORDER BY mismatch_class, policy_number;

SELECT count(*) AS snapshot_rows FROM prepaid_status_fix_20260827;
-- expect 31
