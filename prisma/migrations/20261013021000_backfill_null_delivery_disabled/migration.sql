-- Apply manually after 20261013020000_default_delivery_disabled.
-- Null previously appeared enabled through application fallbacks; make those rows explicitly off.
-- Existing 1 values may represent deliberate restaurant settings and are preserved.
UPDATE business_settings SET DELIVERY_ENABLED = 0 WHERE DELIVERY_ENABLED IS NULL;
