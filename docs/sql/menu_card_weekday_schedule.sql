-- Menu card weekday scheduling columns.
-- Run manually in MySQL Workbench against the Foodeez database.
-- This script only adds nullable/defaulted columns and does not delete or rewrite existing data.
--
-- Check existing columns first, then run only the missing ADD COLUMN clauses.
-- MySQL/MariaDB versions used by this project may not support ADD COLUMN IF NOT EXISTS.
--
-- SELECT COLUMN_NAME
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME = 'business_food_menu_card'
--   AND COLUMN_NAME IN ('REPEAT_WEEKLY', 'ACTIVE_DAYS_JSON', 'IS_UNLIMITED', 'VALID_TO');

ALTER TABLE `business_food_menu_card`
  ADD COLUMN `REPEAT_WEEKLY` TINYINT NOT NULL DEFAULT 0 COMMENT '1 when the card repeats on selected weekdays',
  ADD COLUMN `ACTIVE_DAYS_JSON` LONGTEXT NULL COMMENT 'JSON text array of weekday keys, e.g. ["monday","tuesday","friday"]',
  ADD COLUMN `IS_UNLIMITED` TINYINT NOT NULL DEFAULT 0 COMMENT '1 when the card has no end date and stays active until STATUS is inactive';

-- Prisma currently shows VALID_TO as nullable:
--   VALID_TO DateTime? @db.DateTime(0)
-- If the live database column is NOT nullable, run this before saving unlimited schedules:
--
-- ALTER TABLE `business_food_menu_card`
--   MODIFY COLUMN `VALID_TO` DATETIME NULL;
--
-- Daily unlimited menu cards should be stored as:
--   IS_UNLIMITED = 1
--   VALID_TO = NULL
--   ACTIVE_DAYS_JSON = '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]'
-- They remain active forever until the restaurant sets STATUS inactive.
--
-- Do not add unique constraints for active menus. Multiple active menu cards
-- may exist for the same business and overlapping date ranges.
