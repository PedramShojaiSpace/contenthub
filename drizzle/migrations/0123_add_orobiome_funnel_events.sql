-- Migration 0123: Anonymous first-party Orobiome page-funnel visibility.
-- No customer identity, raw IP address, offer, price, or product data is stored here.
CREATE TABLE IF NOT EXISTS `orobiome_funnel_events` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `visitor_id` VARCHAR(64) NOT NULL,
  `variant` VARCHAR(32) NOT NULL,
  `event_type` ENUM('page_view','scroll_25','scroll_50','scroll_75','cta_click','cart_intent','checkout_start','purchase') NOT NULL,
  `page_path` VARCHAR(128) NOT NULL,
  `cta_position` VARCHAR(32),
  `utm_source` VARCHAR(128),
  `utm_medium` VARCHAR(128),
  `utm_campaign` VARCHAR(256),
  `utm_content` VARCHAR(256),
  `fbclid` VARCHAR(256),
  `shopify_order_id` VARCHAR(64),
  `order_total_cents` BIGINT,
  `currency` VARCHAR(3),
  `event_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`)
);
