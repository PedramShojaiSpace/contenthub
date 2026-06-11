CREATE TABLE `presence_assessment_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`par_user_id` int,
	`par_scores` text NOT NULL,
	`par_suppressed_channels` varchar(512),
	`par_primary_result` varchar(64) NOT NULL,
	`par_overall_score` int NOT NULL DEFAULT 0,
	`par_email` varchar(320),
	`par_created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `presence_assessment_results_id` PRIMARY KEY(`id`)
);
