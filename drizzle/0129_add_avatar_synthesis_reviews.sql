CREATE TABLE `avatar_synthesis_reviews` (
  `id` int AUTO_INCREMENT NOT NULL,
  `webinarIntelligenceId` int NOT NULL,
  `sourceLabel` varchar(255) NOT NULL,
  `synthesis` mediumtext NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `avatar_synthesis_reviews_id` PRIMARY KEY(`id`),
  CONSTRAINT `avatar_synthesis_reviews_webinarIntelligenceId_unique` UNIQUE(`webinarIntelligenceId`)
);
