ALTER TABLE `interconnected_leads`
  ADD COLUMN `meta_campaign_id` varchar(64),
  ADD COLUMN `meta_adset_id` varchar(64),
  ADD COLUMN `meta_ad_id` varchar(64),
  ADD COLUMN `meta_campaign_key` varchar(128);
