-- SQL Schema for chat_messages table (separate from inquiry messages)
-- Run this in your MySQL/MariaDB to create the chat messaging tables

USE shelter_auth;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_id BIGINT UNSIGNED NOT NULL,
  receiver_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NULL, -- Optional: link to room for context
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY fk_chat_messages_sender (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY fk_chat_messages_receiver (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY fk_chat_messages_room (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  INDEX idx_sender_receiver (sender_id, receiver_id),
  INDEX idx_receiver_sender (receiver_id, sender_id),
  INDEX idx_created_at (created_at),
  INDEX idx_room_id (room_id)
);

-- Table for chat message threads/conversations (separate from inquiry system)
CREATE TABLE IF NOT EXISTS chat_threads (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  participant1_id BIGINT UNSIGNED NOT NULL,
  participant2_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NULL, -- If conversation started from a room
  last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY fk_chat_threads_p1 (participant1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY fk_chat_threads_p2 (participant2_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY fk_chat_threads_room (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  UNIQUE KEY unique_participants (participant1_id, participant2_id, room_id),
  INDEX idx_last_message (last_message_at DESC),
  INDEX idx_participants (participant1_id, participant2_id)
);