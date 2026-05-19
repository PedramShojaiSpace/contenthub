CREATE TABLE `ebook_chapter_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chapterId` int NOT NULL,
	`ebookId` int NOT NULL,
	`chapterNumber` int NOT NULL,
	`versionNumber` int NOT NULL DEFAULT 1,
	`title` varchar(255) NOT NULL,
	`content` longtext NOT NULL,
	`wordCount` int,
	`trigger` varchar(64) DEFAULT 'regenerate',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ebook_chapter_versions_id` PRIMARY KEY(`id`)
);
