CREATE TABLE `sku_cpa_targets` (
  `id` int AUTO_INCREMENT NOT NULL,
  `sku_id` varchar(64) NOT NULL,
  `label` varchar(128) NOT NULL,
  `target_cpa` decimal(10,2) NOT NULL,
  `min_daily_budget` decimal(10,2) NOT NULL,
  `max_daily_budget` decimal(10,2) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `sku_cpa_targets_id` PRIMARY KEY(`id`),
  CONSTRAINT `sku_cpa_targets_sku_id_unique` UNIQUE(`sku_id`)
);
--> statement-breakpoint
INSERT INTO `sku_cpa_targets` (`sku_id`, `label`, `target_cpa`, `min_daily_budget`, `max_daily_budget`) VALUES
  ('kbmoTesting',    'KBMO Food Sensitivity Test',   200.00, 20.00, 300.00),
  ('lightsOnCourse', 'Lights On Course',             200.00, 20.00, 300.00),
  ('sleepTestKit',   'Sleep Test Kit',               200.00, 20.00, 300.00),
  ('orobiomeTestKit','Orobiome Test Kit',            200.00, 20.00, 300.00),
  ('academy',        'Urban Monk Academy ($297/yr)', 150.00, 20.00, 500.00),
  ('upstream',       'Upstream Course',              100.00, 15.00, 200.00),
  ('lightsOn',       'Lights On (Lead Gen)',          25.00, 15.00, 200.00),
  ('general',        'General / Awareness',           50.00, 10.00, 100.00)
ON DUPLICATE KEY UPDATE `sku_id` = `sku_id`;
