-- Adds the official Foodeez display order number without changing the internal numeric ID.
-- I will delete old orders manually if needed.
-- If old orders are deleted, delete business_order_detail rows first, then business_order rows.
-- After old orders are deleted, AUTO_INCREMENT can be reset if business_order uses auto increment.

ALTER TABLE business_order
  ADD COLUMN ORDER_NUMBER VARCHAR(20) NULL;

ALTER TABLE business_order
  ADD UNIQUE KEY business_order_ORDER_NUMBER_unique (ORDER_NUMBER);
