-- Custom SQL migration file, put your code below! --

-- Add Content Brief fields to video_production_sessions
ALTER TABLE `video_production_sessions`
  ADD COLUMN `vps_content_pillar` ENUM('gut_health_metabolism','nervous_system_stress','consciousness_longevity','web_of_life','the_practice') NULL,
  ADD COLUMN `vps_funnel_destination` ENUM('lights_on','upstream','web_of_life_lander','elephant_lander','gateway_test') NULL,
  ADD COLUMN `vps_pain_cluster` VARCHAR(128) NULL,
  ADD COLUMN `vps_villain` VARCHAR(255) NULL,
  ADD COLUMN `vps_brief_hook_phrase` TEXT NULL;

-- Expand yt_pillar enum to include web_of_life and the_practice
ALTER TABLE `youtube_pipeline_videos`
  MODIFY COLUMN `yt_pillar` ENUM('gut_health_metabolism','nervous_system_stress','consciousness_longevity','web_of_life','the_practice') NOT NULL;