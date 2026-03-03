const express = require('express');
const db = require('./db');

const router = express.Router();

// 1. Create a Booking
router.post('/', async (req, res) => {
    const { userId, roomId, checkInDate, checkOutDate, guestsCount, totalPrice, specialRequests } = req.body;

    if (!userId || !roomId || !checkInDate || !checkOutDate || !guestsCount || !totalPrice) {
        return res.status(400).json({ message: 'Missing required booking fields.' });
    }

    // Basic date validation
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
        return res.status(400).json({ message: 'Check-out date must be after check-in date.' });
    }

    try {
        // A. Check if room exists and get owner info
        const [roomRows] = await db.execute('SELECT owner_id, is_available FROM rooms WHERE id = ?', [roomId]);
        if (roomRows.length === 0) {
            return res.status(404).json({ message: 'Room not found.' });
        }

        const room = roomRows[0];
        if (!room.is_available) {
            return res.status(400).json({ message: 'This room is currently not available for booking.' });
        }

        // B. Prevention: Owner cannot book their own room
        if (room.owner_id == userId) {
            return res.status(403).json({ message: 'You cannot book your own room.' });
        }

        // C. Date Overlap Prevention Query
        const [overlapRows] = await db.execute(`
            SELECT COUNT(*) AS total_overlaps
            FROM bookings
            WHERE room_id = ? 
              AND status NOT IN ('rejected', 'cancelled')
              AND check_in_date < ? -- New Check-out Date
              AND check_out_date > ? -- New Check-in Date
        `, [roomId, checkOutDate, checkInDate]);

        if (overlapRows[0].total_overlaps > 0) {
            return res.status(409).json({ message: 'Room is already booked for the selected dates.' });
        }

        // D. Insert Booking
        const [result] = await db.execute(`
            INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, guests_count, total_price, status, special_requests)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        `, [userId, roomId, checkInDate, checkOutDate, guestsCount, totalPrice, specialRequests || '']);

        const bookingId = result.insertId;

        // E. Log the action
        await db.execute(`
            INSERT INTO booking_logs (booking_id, action, performed_by, notes)
            VALUES (?, 'created', ?, 'User initiated a booking')
        `, [bookingId, userId]);

        return res.status(201).json({
            message: 'Booking request sent successfully! Waiting for approval.',
            bookingId: bookingId
        });

    } catch (error) {
        console.error('Booking creation error:', error);
        return res.status(500).json({ message: 'Failed to process booking.' });
    }
});

// 2. Get My Bookings (User View - where I am the booker)
router.get('/user/:userId', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT b.*, r.title as room_title, r.address as room_address, r.city as room_city
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        `, [req.params.userId]);

        return res.json({ bookings: rows });
    } catch (error) {
        console.error('Fetch user bookings error:', error);
        return res.status(500).json({ message: 'Failed to fetch bookings.' });
    }
});

// 2.5 Get Incoming Bookings (Owner View - where I am the owner)
router.get('/owner/:ownerId', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT b.*, r.title as room_title, r.address as room_address, r.city as room_city,
                   u.full_name as user_name, u.email as user_email, u.phone_number as user_phone
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN users u ON b.user_id = u.id
            WHERE r.owner_id = ?
            ORDER BY b.created_at DESC
        `, [req.params.ownerId]);

        return res.json({ bookings: rows });
    } catch (error) {
        console.error('Fetch owner incoming bookings error:', error);
        return res.status(500).json({ message: 'Failed to fetch incoming bookings.' });
    }
});

// 3. Get Room Bookings (For owners or public visibility)
router.get('/room/:roomId', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT check_in_date, check_out_date, status
            FROM bookings
            WHERE room_id = ? AND status NOT IN ('rejected', 'cancelled')
        `, [req.params.roomId]);

        return res.json({ bookings: rows });
    } catch (error) {
        console.error('Fetch room bookings error:', error);
        return res.status(500).json({ message: 'Failed to fetch room availability.' });
    }
});

// 4. Update Booking Status (Cancel/Approve/Reject)
router.patch('/:bookingId/status', async (req, res) => {
    const { status, userId } = req.body; // userId of the person performing the action
    const { bookingId } = req.params;

    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status.' });
    }

    try {
        const [result] = await db.execute(`
            UPDATE bookings SET status = ? WHERE id = ?
        `, [status, bookingId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // Log action
        await db.execute(`
            INSERT INTO booking_logs (booking_id, action, performed_by, notes)
            VALUES (?, ?, ?, ?)
        `, [bookingId, status, userId, `Booking status updated to ${status}`]);

        return res.json({ message: `Booking ${status} successfully.` });
    } catch (error) {
        console.error('Update booking status error:', error);
        return res.status(500).json({ message: 'Failed to update booking status.' });
    }
});

module.exports = router;
