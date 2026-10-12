-- Apply manually to the shared Foodeez MySQL/MariaDB database after the fulfillment settings migration.
-- New business_settings rows default to delivery off. Existing values, including explicit 1, are preserved.
ALTER TABLE business_settings ALTER COLUMN DELIVERY_ENABLED SET DEFAULT 0;
