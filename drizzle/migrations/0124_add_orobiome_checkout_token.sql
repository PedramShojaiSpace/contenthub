-- Migration 0124: Deduplicate verified Shopify checkout-start events by checkout token.
ALTER TABLE `orobiome_funnel_events` ADD COLUMN `shopify_checkout_token` VARCHAR(128);
