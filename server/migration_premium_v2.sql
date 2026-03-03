USE shelter_auth;

-- Add premium_plan tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS premium_plan VARCHAR(20) DEFAULT NULL AFTER premium_until;
