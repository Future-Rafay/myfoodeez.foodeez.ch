-- Apply manually to the shared Foodeez MySQL/MariaDB database.
-- Inventory release is claimed once per order; rate-limit keys are SHA-256 hashes.

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_order'
     AND COLUMN_NAME = 'INVENTORY_RELEASED_DATETIME') = 0,
  'ALTER TABLE business_order ADD COLUMN INVENTORY_RELEASED_DATETIME DATETIME NULL',
  'SELECT ''business_order.INVENTORY_RELEASED_DATETIME already exists'' AS message'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

CREATE TABLE IF NOT EXISTS checkout_rate_limit (
  RATE_LIMIT_KEY CHAR(64) NOT NULL,
  WINDOW_STARTED_AT DATETIME NOT NULL,
  REQUEST_COUNT INT NOT NULL DEFAULT 1,
  LAST_REQUEST_DATETIME DATETIME NOT NULL,
  PRIMARY KEY (RATE_LIMIT_KEY),
  INDEX idx_checkout_rate_limit_last_request (LAST_REQUEST_DATETIME)
);
