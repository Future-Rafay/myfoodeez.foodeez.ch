-- Apply manually to the shared Foodeez MySQL/MariaDB database.
-- Existing callers that still provide explicit IDs remain compatible, while
-- updated order creators can rely on atomic database-generated IDs.

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_order'
     AND COLUMN_NAME = 'BUSINESS_ORDER_ID'
     AND EXTRA LIKE '%auto_increment%') = 0,
  'ALTER TABLE business_order MODIFY COLUMN BUSINESS_ORDER_ID INT NOT NULL AUTO_INCREMENT',
  'SELECT ''business_order.BUSINESS_ORDER_ID already auto-increments'' AS message'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_order_detail'
     AND COLUMN_NAME = 'BUSINESS_ORDER_DETAIL_ID'
     AND EXTRA LIKE '%auto_increment%') = 0,
  'ALTER TABLE business_order_detail MODIFY COLUMN BUSINESS_ORDER_DETAIL_ID INT NOT NULL AUTO_INCREMENT',
  'SELECT ''business_order_detail.BUSINESS_ORDER_DETAIL_ID already auto-increments'' AS message'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;
