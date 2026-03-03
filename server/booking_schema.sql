-- ==========================================================
-- SHELTER: Room Booking System Production Schema (MySQL)
-- Description: Core tables, constraints, and audit logs
-- Database: shelter_auth
-- ==========================================================

USE shelter_auth;

-- 1. Create bookings Table
-- Tracks who reserved which room and for what duration.
CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    room_id BIGINT UNSIGNED NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    guests_count INT UNSIGNED NOT NULL DEFAULT 1,
    total_price DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    special_requests TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    
    -- Business Logic Rule: Check-out must be after Check-in
    -- Note: This syntax works on MySQL 8.0.16+
    CONSTRAINT check_booking_dates CHECK (check_out_date > check_in_date)
);

-- 2. CREATE TABLE booking_payments (Optional Enhancements)
-- Future-proofing for payment integration.
CREATE TABLE IF NOT EXISTS booking_payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNSIGNED NOT NULL,
    payment_status ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50), -- e.g., 'esewa', 'khalti', 'card'
    amount DECIMAL(10, 2) NOT NULL,
    transaction_ref VARCHAR(100) UNIQUE, -- ID from payment gateway
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- 3. CREATE TABLE booking_logs (Optional Enhancements)
-- Maintains an audit trail for all booking status changes.
CREATE TABLE IF NOT EXISTS booking_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(50) NOT NULL, -- e.g., 'created', 'approved', 'cancelled'
    performed_by BIGINT UNSIGNED NOT NULL, -- user_id or admin_id
    notes TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_log_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- ==========================================================
-- INDEX CREATION (For Performance Optimization)
-- ==========================================================

-- Standard queries search by room, user, or date range
CREATE INDEX idx_booking_room_id ON bookings(room_id);
CREATE INDEX idx_booking_user_id ON bookings(user_id);
CREATE INDEX idx_booking_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX idx_booking_status ON bookings(status);

-- ==========================================================
-- 3. DATE OVERLAP PREVENTION QUERY
-- ==========================================================
-- Use this query to check if a room IS AVAILABLE before inserting a new booking.
-- An overlap exists if: (ExistingStart < NewEnd) AND (ExistingEnd > NewStart)

/*
-- EXAMPLE QUERY: Replace '?' with values from your code
SELECT COUNT(*) AS total_overlaps
FROM bookings
WHERE room_id = ? 
  AND status NOT IN ('rejected', 'cancelled')
  AND check_in_date < '2026-03-05' -- Input New Check-out Date
  AND check_out_date > '2026-03-01'; -- Input New Check-in Date
*/

-- ==========================================================
-- 4. EXAMPLE INSERT BOOKING QUERY
-- ==========================================================
/*
INSERT INTO bookings (
    user_id, 
    room_id, 
    check_in_date, 
    check_out_date, 
    guests_count, 
    total_price, 
    status
) VALUES (
    1,          -- Replace with current logged-in user ID
    5,          -- Replace with target room ID
    '2026-03-01', 
    '2026-03-05', 
    2, 
    4500.00, 
    'pending'
);
*/

-- ==========================================================
-- SCALABILITY NOTE: 
-- We used BIGINT UNSIGNED for IDs to match your existing users/rooms tables.
-- DECIMAL(10,2) ensures high precision for financial data.
-- ENUMs restrict statuses to valid workflow stages.
-- ==========================================================
