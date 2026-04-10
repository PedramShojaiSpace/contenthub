CREATE TABLE `webinar_intelligence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarSessionId` int NOT NULL,
	`surveyType` enum('pre_registration','post_webinar') NOT NULL DEFAULT 'pre_registration',
	`rawResponses` text,
	`responseCount` int DEFAULT 0,
	`extractedThemes` text,
	`extractedPainPoints` text,
	`extractedMotivations` text,
	`extractedQuestions` text,
	`extractedLanguage` text,
	`aiSummary` text,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`extractedAt` timestamp,
	`notes` text,
	CONSTRAINT `webinar_intelligence_id` PRIMARY KEY(`id`)
);
