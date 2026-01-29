-- SQL Schema for rooms table
-- Run this in your MySQL/MariaDB to create the rooms table

USE shelter_auth;

CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id BIGINT UNSIGNED NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  owner_id_number VARCHAR(50),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  price_per_month DECIMAL(10, 2) NOT NULL,
  room_type VARCHAR(50),
  bedrooms TINYINT UNSIGNED DEFAULT 1,
  bathrooms TINYINT UNSIGNED DEFAULT 1,
  area_sqft INT UNSIGNED,
  available_from DATE,
  amenities TEXT,
  contact_email VARCHAR(160),
  contact_phone VARCHAR(30),
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY fk_rooms_owner (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_owner_id (owner_id),
  INDEX idx_is_available (is_available)
);

