CREATE TABLE `testimonials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testimonial_campaign` enum('lo','gut','sleep','webinar','general') NOT NULL DEFAULT 'lo',
	`category` varchar(128),
	`quote` text NOT NULL,
	`author_name` varchar(255) NOT NULL,
	`author_title` varchar(255),
	`date_label` varchar(128),
	`source` varchar(64) DEFAULT 'manual',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `testimonials_id` PRIMARY KEY(`id`)
);
