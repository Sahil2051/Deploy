-- SQL Schema Update for Admin Features
-- Run this in your MySQL/MariaDB to add the is_verified field to users table

USE shelter_auth;

-- Add is_verified column to users table
-- Note: If the column already exists, this will give an error - you can ignore it
ALTER TABLE users 
ADD COLUMN is_verified TINYINT(1) DEFAULT 0 AFTER password_hash;

-- Update existing users to be unverified by default
UPDATE users SET is_verified = 0 WHERE is_verified IS NULL;

-- Create an index for faster queries on verified status (if it doesn't exist, you may get an error)
CREATE INDEX idx_is_verified ON users(is_verified);

