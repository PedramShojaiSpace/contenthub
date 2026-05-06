CREATE TABLE `framework_performance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fp_platform` varchar(32) NOT NULL,
	`fp_framework` varchar(64) NOT NULL,
	`winCount` int NOT NULL DEFAULT 0,
	`totalTests` int NOT NULL DEFAULT 0,
	`lastWonAt` timestamp,
	`fp_createdAt` timestamp NOT NULL DEFAULT (now()),
	`fp_updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `framework_performance_id` PRIMARY KEY(`id`)
);
