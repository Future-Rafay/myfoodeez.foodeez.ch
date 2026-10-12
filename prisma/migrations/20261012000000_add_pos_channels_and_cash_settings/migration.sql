-- Apply manually to the shared Foodeez MySQL/MariaDB database.
-- Existing menus remain online-only and cash methods remain opt-in.

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_food_menu_card'
     AND COLUMN_NAME = 'SALES_CHANNEL') = 0,
  'ALTER TABLE business_food_menu_card ADD COLUMN SALES_CHANNEL VARCHAR(20) NOT NULL DEFAULT ''online''',
  'SELECT ''business_food_menu_card.SALES_CHANNEL already exists'' AS message'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_order'
     AND COLUMN_NAME = 'CHECKOUT_REQUEST_ID') = 0,
  'ALTER TABLE business_order ADD COLUMN CHECKOUT_REQUEST_ID VARCHAR(64) NULL',
  'SELECT ''business_order.CHECKOUT_REQUEST_ID already exists'' AS message'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_order'
     AND INDEX_NAME = 'business_order_CHECKOUT_REQUEST_ID_unique') = 0,
  'ALTER TABLE business_order ADD UNIQUE INDEX business_order_CHECKOUT_REQUEST_ID_unique (CHECKOUT_REQUEST_ID)',
  'SELECT ''business_order_CHECKOUT_REQUEST_ID_unique already exists'' AS message'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_settings'
     AND COLUMN_NAME = 'CASH_ON_DELIVERY_ENABLED') = 0,
  'ALTER TABLE business_settings ADD COLUMN CASH_ON_DELIVERY_ENABLED TINYINT NOT NULL DEFAULT 0',
  'SELECT ''business_settings.CASH_ON_DELIVERY_ENABLED already exists'' AS message'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_settings'
     AND COLUMN_NAME = 'CASH_ON_PICKUP_ENABLED') = 0,
  'ALTER TABLE business_settings ADD COLUMN CASH_ON_PICKUP_ENABLED TINYINT NOT NULL DEFAULT 0',
  'SELECT ''business_settings.CASH_ON_PICKUP_ENABLED already exists'' AS message'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_order'
     AND COLUMN_NAME = 'POS_REQUEST_ID') = 0,
  'ALTER TABLE business_order ADD COLUMN POS_REQUEST_ID VARCHAR(64) NULL',
  'SELECT ''business_order.POS_REQUEST_ID already exists'' AS message'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_order'
     AND INDEX_NAME = 'business_order_POS_REQUEST_ID_unique') = 0,
  'ALTER TABLE business_order ADD UNIQUE INDEX business_order_POS_REQUEST_ID_unique (POS_REQUEST_ID)',
  'SELECT ''business_order_POS_REQUEST_ID_unique already exists'' AS message'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;
