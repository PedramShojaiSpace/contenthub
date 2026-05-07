CREATE TABLE `viral_user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lastPersona` varchar(512),
	`vup_updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `viral_user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `viral_user_preferences_userId_unique` UNIQUE(`userId`)
);
