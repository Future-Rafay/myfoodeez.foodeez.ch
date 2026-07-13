-- Apply manually to the shared Foodeez production database.
-- Safe to rerun. Do not run prisma migrate for this file.

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_order'
     AND INDEX_NAME = 'idx_business_order_visitor_created') = 0,
  'CREATE INDEX idx_business_order_visitor_created ON business_order (VISITOR_ID, CREATION_DATETIME)',
  'SELECT ''idx_business_order_visitor_created already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_order'
     AND INDEX_NAME = 'idx_business_order_email_created') = 0,
  'CREATE INDEX idx_business_order_email_created ON business_order (EMAIL_ADDRESS, CREATION_DATETIME)',
  'SELECT ''idx_business_order_email_created already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_order'
     AND INDEX_NAME = 'idx_business_order_business_status_created') = 0,
  'CREATE INDEX idx_business_order_business_status_created ON business_order (BUSINESS_ID, ORDER_STATUS, CREATION_DATETIME)',
  'SELECT ''idx_business_order_business_status_created already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_order_detail'
     AND INDEX_NAME = 'idx_business_order_detail_order') = 0,
  'CREATE INDEX idx_business_order_detail_order ON business_order_detail (BUSINESS_ORDER_ID)',
  'SELECT ''idx_business_order_detail_order already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_notification'
     AND INDEX_NAME = 'idx_business_notification_business_read_created') = 0,
  'CREATE INDEX idx_business_notification_business_read_created ON business_notification (BUSINESS_ID, IS_READ, CREATION_DATETIME)',
  'SELECT ''idx_business_notification_business_read_created already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
