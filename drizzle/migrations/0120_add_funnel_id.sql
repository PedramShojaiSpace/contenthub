-- Migration: 0120_add_funnel_id
-- Adds funnel_id enum column to content_items, keyword_campaigns, landing_pages, email_sequences
-- funnel_id values: lights_on | oral_biome | gut | none

ALTER TABLE `content_items`
  ADD COLUMN `funnel_id` ENUM('lights_on','oral_biome','gut','none') DEFAULT 'none';

ALTER TABLE `keyword_campaigns`
  ADD COLUMN `funnel_id` ENUM('lights_on','oral_biome','gut','none') DEFAULT 'none';

ALTER TABLE `landing_pages`
  ADD COLUMN `funnel_id` ENUM('lights_on','oral_biome','gut','none') DEFAULT 'none';

ALTER TABLE `email_sequences`
  ADD COLUMN `funnel_id` ENUM('lights_on','oral_biome','gut','none') DEFAULT 'none';
