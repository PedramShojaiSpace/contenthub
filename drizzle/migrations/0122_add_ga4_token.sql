-- Migration 0122: Add GA4 refresh token to user_credentials
ALTER TABLE `user_credentials` ADD COLUMN `ga4RefreshToken` TEXT;
