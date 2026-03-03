const express = require('express')
const db = require('./db')

const router = express.Router()

// Get all users (admin only)
router.get('/users', async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, full_name, email, phone_number, age, address_line, 
       COALESCE(is_verified, 0) as is_verified, created_at
       FROM users
       ORDER BY created_at DESC`
    )

    const users = rows.map(user => ({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phoneNumber: user.phone_number,
      age: user.age,
      address: user.address_line,
      isVerified: Boolean(user.is_verified),
      createdAt: user.created_at,
    }))

    return res.json({ users })
  } catch (error) {
    console.error('Get admin users error', error)
    return res.status(500).json({ message: 'Failed to fetch users.' })
  }
})

// Get all rooms (admin only)
router.get('/rooms', async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.*, u.full_name as owner_full_name, u.email as owner_email, u.phone_number as owner_phone,
       COALESCE(u.is_verified, 0) as owner_is_verified
       FROM rooms r
       JOIN users u ON r.owner_id = u.id
       ORDER BY r.created_at DESC`
    )
    return res.json({ rooms: rows })
  } catch (error) {
    console.error('Get admin rooms error', error)
    return res.status(500).json({ message: 'Failed to fetch rooms.' })
  }
})

// Delete a user (admin only)
router.delete('/users/:userId', async (req, res) => {
  const { userId } = req.params

  try {
    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [userId])

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' })
    }

    return res.json({ message: 'User deleted successfully.' })
  } catch (error) {
    console.error('Delete user error', error)
    return res.status(500).json({ message: 'Failed to delete user.' })
  }
})

// Verify a user (admin only)
router.patch('/users/:userId/verify', async (req, res) => {
  const { userId } = req.params

  try {
    const [result] = await db.execute(
      'UPDATE users SET is_verified = 1 WHERE id = ?',
      [userId]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' })
    }

    return res.json({ message: 'User verified successfully.' })
  } catch (error) {
    console.error('Verify user error', error)
    return res.status(500).json({ message: 'Failed to verify user.' })
  }
})

// Unverify a user (admin only)
router.patch('/users/:userId/unverify', async (req, res) => {
  const { userId } = req.params

  try {
    const [result] = await db.execute(
      'UPDATE users SET is_verified = 0 WHERE id = ?',
      [userId]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' })
    }

    return res.json({ message: 'User unverified successfully.' })
  } catch (error) {
    console.error('Unverify user error', error)
    return res.status(500).json({ message: 'Failed to unverify user.' })
  }
})

// Get all bookings (admin only)
router.get('/bookings', async (_req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT b.*, r.title as room_title, r.address as room_address, u.full_name as user_name
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
    `)
    return res.json({ bookings: rows })
  } catch (error) {
    console.error('Get admin bookings error', error)
    return res.status(500).json({ message: 'Failed to fetch bookings.' })
  }
})

// Update booking status from admin
router.patch('/bookings/:bookingId/status', async (req, res) => {
  const { status } = req.body
  const { bookingId } = req.params

  if (!['approved', 'rejected', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' })
  }

  try {
    const [result] = await db.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, bookingId])

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Booking not found.' })
    }

    return res.json({ message: `Booking ${status} successfully.` })
  } catch (error) {
    console.error('Update admin booking status error', error)
    return res.status(500).json({ message: 'Failed to update booking status.' })
  }
})

module.exports = router

