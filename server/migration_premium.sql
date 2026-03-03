USE shelter_auth;

-- Update users table with premium fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_premium TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS premium_until DATETIME DEFAULT NULL;

-- Update rooms table with geolocation fields
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) DEFAULT NULL;

-- Index for premium status
CREATE INDEX IF NOT EXISTS idx_is_premium ON users(is_premium);
