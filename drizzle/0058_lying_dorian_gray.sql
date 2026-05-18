CREATE TABLE `book_snippets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`userId` int NOT NULL,
	`passageText` text NOT NULL,
	`pageNumber` int,
	`chapter` varchar(255),
	`theme` varchar(128),
	`snippetPlatform` enum('instagram','linkedin','twitter','facebook','all') DEFAULT 'instagram',
	`titleCardUrl` text,
	`titleCardStatus` enum('pending','generating','ready','failed') DEFAULT 'pending',
	`savedToKanban` boolean DEFAULT false,
	`contentItemId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `book_snippets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ebook_chapters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ebookId` int NOT NULL,
	`chapterNumber` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text,
	`content` longtext,
	`wordCount` int,
	`ebookChapterStatus` enum('pending','generating','complete','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ebook_chapters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ebooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`topic` text NOT NULL,
	`targetPersona` text,
	`chapterCount` int DEFAULT 8,
	`wordCountTarget` int DEFAULT 5000,
	`ebookStatus` enum('outline','drafting','complete','failed') NOT NULL DEFAULT 'outline',
	`outlineJson` longtext,
	`fullContent` longtext,
	`pdfS3Key` text,
	`pdfS3Url` text,
	`ctaBlockId` int,
	`landingPageId` int,
	`webinarSessionId` int,
	`ebookFunnelStage` enum('awareness','consideration','conversion') DEFAULT 'awareness',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ebooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `uploaded_books` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`author` varchar(255) DEFAULT 'Dr. Pedram Shojai',
	`s3Key` text,
	`s3Url` text,
	`extractedText` longtext,
	`voiceProfileJson` longtext,
	`pageCount` int,
	`wordCount` int,
	`uploadedBookStatus` enum('uploading','processing','ready','failed') NOT NULL DEFAULT 'uploading',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `uploaded_books_id` PRIMARY KEY(`id`)
);
