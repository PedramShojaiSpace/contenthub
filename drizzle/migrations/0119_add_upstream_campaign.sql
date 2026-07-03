-- Migration: Add 'upstream' to the hosted landing pages campaign enum
ALTER TABLE `hosted_landing_pages`
  MODIFY COLUMN `hlp_campaign` ENUM('lo','gut','sleep','webinar','upstream') NOT NULL DEFAULT 'lo';
