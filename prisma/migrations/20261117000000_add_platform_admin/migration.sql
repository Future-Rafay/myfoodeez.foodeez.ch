-- Apply manually to the shared Foodeez MySQL database before deploying the Super Admin, onboarding and marketing code.
-- Additive only: one nullable column and new tables. Safe to run twice.
-- Afterwards run `npx prisma db pull` and `npx prisma generate` in both repositories.

-- Super Admins: set by hand, for example
--   UPDATE visitors_account SET PLATFORM_ROLE = 'super_admin' WHERE EMAIL_ADDRESS IN ('owner-one@…', 'owner-two@…');
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visitors_account' AND COLUMN_NAME = 'PLATFORM_ROLE') = 0,
  'ALTER TABLE visitors_account ADD COLUMN PLATFORM_ROLE VARCHAR(20) NULL', 'SELECT 1');
PREPARE statement FROM @sql; EXECUTE statement; DEALLOCATE PREPARE statement;

-- Every Super Admin change (approve, reject, switch off, moderate, send) is recorded here.
CREATE TABLE IF NOT EXISTS platform_audit_log (
  AUDIT_LOG_ID BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CREATION_DATETIME DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ACTOR_VISITORS_ACCOUNT_ID BIGINT NOT NULL,
  ACTION VARCHAR(64) NOT NULL,
  ENTITY_TYPE VARCHAR(40) NOT NULL,
  ENTITY_ID VARCHAR(64) NOT NULL,
  DETAILS_JSON TEXT NULL,
  KEY idx_platform_audit_log_entity (ENTITY_TYPE, ENTITY_ID),
  KEY idx_platform_audit_log_created (CREATION_DATETIME)
);

-- Restaurant registrations (a new pending business) and claims (an existing business), waiting for a Super Admin.
-- STATUS: email_pending (claim code sent), pending, approved, rejected.
CREATE TABLE IF NOT EXISTS business_onboarding_request (
  REQUEST_ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CREATION_DATETIME DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  REQUEST_TYPE VARCHAR(20) NOT NULL,
  STATUS VARCHAR(20) NOT NULL,
  BUSINESS_ID INT NOT NULL,
  VISITORS_ACCOUNT_ID BIGINT NOT NULL,
  CONTACT_NAME VARCHAR(100) NULL,
  CONTACT_PHONE VARCHAR(45) NULL,
  MESSAGE VARCHAR(1000) NULL,
  EMAIL_CODE_HASH CHAR(64) NULL,
  EMAIL_CODE_EXPIRES DATETIME NULL,
  EMAIL_CODE_ATTEMPTS TINYINT NOT NULL DEFAULT 0,
  EMAIL_VERIFIED_DATETIME DATETIME NULL,
  REVIEWED_BY BIGINT NULL,
  REVIEWED_DATETIME DATETIME NULL,
  REVIEW_NOTE VARCHAR(500) NULL,
  KEY idx_business_onboarding_request_status (STATUS, CREATION_DATETIME),
  KEY idx_business_onboarding_request_business (BUSINESS_ID),
  KEY idx_business_onboarding_request_account (VISITORS_ACCOUNT_ID)
);

-- Email marketing. AUDIENCE: business (restaurant outreach) or subscriber (newsletter).
-- STATUS: draft, sending, sent, scheduled, cancelled.
CREATE TABLE IF NOT EXISTS marketing_campaign (
  CAMPAIGN_ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CREATION_DATETIME DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_DATETIME DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  NAME VARCHAR(160) NOT NULL,
  SUBJECT VARCHAR(200) NOT NULL,
  HTML MEDIUMTEXT NOT NULL,
  AUDIENCE VARCHAR(20) NOT NULL,
  STATUS VARCHAR(20) NOT NULL DEFAULT 'draft',
  SCHEDULED_DATETIME DATETIME NULL,
  SENT_DATETIME DATETIME NULL,
  CREATED_BY BIGINT NOT NULL,
  KEY idx_marketing_campaign_status (STATUS, UPDATED_DATETIME)
);

-- STATUS: pending, sent, scheduled, failed, cancelled.
CREATE TABLE IF NOT EXISTS marketing_campaign_recipient (
  RECIPIENT_ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  CREATION_DATETIME DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CAMPAIGN_ID INT NOT NULL,
  BUSINESS_ID INT NULL,
  SUBSCRIPTION_ID BIGINT NULL,
  EMAIL VARCHAR(320) NOT NULL,
  NAME VARCHAR(255) NULL,
  STATUS VARCHAR(20) NOT NULL DEFAULT 'pending',
  PROVIDER_MESSAGE_ID VARCHAR(120) NULL,
  ERROR VARCHAR(500) NULL,
  SENT_DATETIME DATETIME NULL,
  UNIQUE KEY marketing_campaign_recipient_campaign_email_unique (CAMPAIGN_ID, EMAIL),
  KEY idx_marketing_campaign_recipient_status (CAMPAIGN_ID, STATUS),
  KEY idx_marketing_campaign_recipient_business (BUSINESS_ID),
  KEY idx_marketing_campaign_recipient_email (EMAIL)
);

-- Do-not-email list: unsubscribes and addresses a Super Admin excludes. Every campaign send checks it.
CREATE TABLE IF NOT EXISTS email_suppression (
  EMAIL VARCHAR(320) NOT NULL PRIMARY KEY,
  CREATION_DATETIME DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  REASON VARCHAR(40) NOT NULL
);
