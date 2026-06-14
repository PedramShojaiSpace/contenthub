-- Add uploaded_unlisted to video_job_status enum
ALTER TABLE `video_jobs` MODIFY COLUMN `vj_status` ENUM('pending','importing','editing','rendering','ready_for_review','approved','uploading','uploaded_unlisted','published','failed','rejected') NOT NULL DEFAULT 'pending';
