-- Apply manually to the shared Foodeez MySQL database BEFORE deploying the email verification code.
-- Adds visitors_account.EMAIL_VERIFIED_DATETIME. Every account that exists when this runs counts as verified, so nobody is
-- locked out; only password sign-ups created afterwards must confirm their email. Safe to run twice.
-- Afterwards run `npx prisma db pull` and `npx prisma generate` in both repositories.
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visitors_account' AND COLUMN_NAME = 'EMAIL_VERIFIED_DATETIME') = 0,
  'ALTER TABLE visitors_account ADD COLUMN EMAIL_VERIFIED_DATETIME DATETIME NULL', 'SELECT 1');
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

-- Only on the first run: existing accounts are treated as verified from their creation date.
UPDATE visitors_account SET EMAIL_VERIFIED_DATETIME = COALESCE(CREATION_DATETIME, NOW())
WHERE EMAIL_VERIFIED_DATETIME IS NULL
  AND NOT EXISTS (SELECT 1 FROM (SELECT 1 FROM visitors_account WHERE EMAIL_VERIFIED_DATETIME IS NOT NULL LIMIT 1) AS already_backfilled);
