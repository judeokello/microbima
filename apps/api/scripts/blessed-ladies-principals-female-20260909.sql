-- Set Blessed Ladies (scheme 13) principal customers marked male to female.
-- Preview first:
--   SELECT c.id, c.gender, c."firstName", c."lastName"
--   FROM package_scheme_customers psc
--   JOIN package_schemes ps ON ps.id = psc."packageSchemeId"
--   JOIN customers c ON c.id = psc."customerId"
--   WHERE ps."schemeId" = 13 AND c.gender = 'MALE';

UPDATE customers c
SET gender = 'FEMALE',
    "updatedAt" = NOW()
FROM package_scheme_customers psc
JOIN package_schemes ps ON ps.id = psc."packageSchemeId"
WHERE psc."customerId" = c.id
  AND ps."schemeId" = 13
  AND c.gender = 'MALE';
