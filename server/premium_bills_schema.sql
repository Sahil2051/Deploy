CREATE TABLE IF NOT EXISTS premium_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan_type ENUM('day', 'week', 'month') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    transaction_uuid VARCHAR(255) UNIQUE NOT NULL,
    is_activated BOOLEAN DEFAULT 0,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
