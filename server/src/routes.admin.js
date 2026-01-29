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

// Delete a room (admin only - no owner check)
router.delete('/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params

  try {
    const [result] = await db.execute('DELETE FROM rooms WHERE id = ?', [roomId])

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Room not found.' })
    }

    return res.json({ message: 'Room deleted successfully.' })
  } catch (error) {
    console.error('Delete room error', error)
    return res.status(500).json({ message: 'Failed to delete room.' })
  }
})

module.exports = router

