CREATE TABLE `urban_monk_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`umcm_session_id` int NOT NULL,
	`umcm_role` enum('user','assistant') NOT NULL,
	`umcm_content` longtext NOT NULL,
	`umcm_created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `urban_monk_chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `urban_monk_chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`umcs_user_id` int NOT NULL,
	`umcs_title` varchar(255) NOT NULL DEFAULT 'New Conversation',
	`umcs_created_at` timestamp NOT NULL DEFAULT (now()),
	`umcs_updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `urban_monk_chat_sessions_id` PRIMARY KEY(`id`)
);
