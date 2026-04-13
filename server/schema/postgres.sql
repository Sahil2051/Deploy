-- SHELTER: PostgreSQL schema for production (e.g. Render Postgres)
-- Apply with: node scripts/apply-schema.js   (requires DATABASE_URL or PG_* env)

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  age SMALLINT NOT NULL,
  address_line VARCHAR(255) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone_number VARCHAR(30) NOT NULL,
  password_hash CHAR(60) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  premium_plan VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_phone UNIQUE (phone_number)
);

CREATE INDEX IF NOT EXISTS idx_is_verified ON users(is_verified);
CREATE INDEX IF NOT EXISTS idx_is_premium ON users(is_premium);

CREATE TABLE IF NOT EXISTS user_logins (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45)
);

CREATE TABLE IF NOT EXISTS rooms (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_name VARCHAR(120) NOT NULL,
  owner_id_number VARCHAR(50),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  price_per_month DECIMAL(10, 2) NOT NULL,
  room_type VARCHAR(50),
  bedrooms SMALLINT DEFAULT 1,
  bathrooms SMALLINT DEFAULT 1,
  area_sqft INTEGER,
  available_from DATE,
  amenities TEXT,
  contact_email VARCHAR(160),
  contact_phone VARCHAR(30),
  is_available BOOLEAN DEFAULT TRUE,
  photos JSONB,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owner_id ON rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_is_available ON rooms(is_available);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_name VARCHAR(120) NOT NULL,
  sender_email VARCHAR(160) NOT NULL,
  sender_phone VARCHAR(30),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  guests_count INTEGER NOT NULL DEFAULT 1,
  total_price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  special_requests TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_booking_dates CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_booking_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_booking_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_booking_status ON bookings(status);

CREATE TABLE IF NOT EXISTS booking_payments (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method VARCHAR(50),
  amount DECIMAL(10, 2) NOT NULL,
  transaction_ref VARCHAR(100) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_logs (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  performed_by BIGINT NOT NULL,
  notes TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id BIGINT REFERENCES rooms(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_receiver ON chat_messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_sender ON chat_messages(receiver_id, sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);

CREATE TABLE IF NOT EXISTS chat_threads (
  id BIGSERIAL PRIMARY KEY,
  participant1_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant2_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id BIGINT REFERENCES rooms(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_participants UNIQUE (participant1_id, participant2_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_last ON chat_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_threads_participants ON chat_threads(participant1_id, participant2_id);

CREATE TABLE IF NOT EXISTS premium_bills (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(10) NOT NULL
    CHECK (plan_type IN ('day', 'week', 'month')),
  amount DECIMAL(10, 2) NOT NULL,
  transaction_uuid VARCHAR(255) NOT NULL UNIQUE,
  is_activated BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payment_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_code VARCHAR(255),
  transaction_uuid VARCHAR(255) NOT NULL UNIQUE,
  plan_type VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
  is_verified BOOLEAN DEFAULT FALSE,
  receipt_number VARCHAR(255),
  premium_expires_at TIMESTAMPTZ,
  paid_amount DECIMAL(10, 2),
  verification_date TIMESTAMPTZ,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  activation_status VARCHAR(50),
  subscription_start_time TIMESTAMPTZ,
  cancelled_by VARCHAR(50),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_purchased ON payment_history(purchased_at DESC);

CREATE TABLE IF NOT EXISTS feature_payments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_uuid VARCHAR(120) NOT NULL UNIQUE,
  payment_for VARCHAR(30) NOT NULL
    CHECK (payment_for IN ('booking', 'room_registration')),
  amount DECIMAL(10, 2) NOT NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  metadata_json TEXT,
  is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_feature_payments_user_id ON feature_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_payments_purpose ON feature_payments(payment_for);
