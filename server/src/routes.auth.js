const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('./db')

const router = express.Router()

const normalizeCredential = (value = '') => value.trim().toLowerCase()

router.post('/signup', async (req, res) => {
  const { fullName, age, address, email, phoneNumber, password } = req.body || {}

  if (!fullName || !age || !address || !email || !phoneNumber || !password) {
    return res.status(400).json({ message: 'All fields are required.' })
  }

  if (Number.isNaN(Number(age)) || Number(age) < 16) {
    return res.status(400).json({ message: 'Age must be 16 or above.' })
  }

  try {
    const [existing] = await db.execute(
      'SELECT id FROM users WHERE email = ? OR phone_number = ? LIMIT 1',
      [normalizeCredential(email), phoneNumber.trim()]
    )

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email or phone already registered.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await db.execute(
      `INSERT INTO users (full_name, age, address_line, email, phone_number, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName.trim(), Number(age), address.trim(), normalizeCredential(email), phoneNumber.trim(), passwordHash]
    )

    return res.status(201).json({ message: 'Signup successful.' })
  } catch (error) {
    console.error('Signup error', error)
    return res.status(500).json({ message: 'Failed to signup right now.' })
  }
})

router.post('/login', async (req, res) => {
  const { credential, password } = req.body || {}

  if (!credential || !password) {
    return res.status(400).json({ message: 'Credential and password required.' })
  }

  try {
    const normalized = normalizeCredential(credential)
    const [rows] = await db.execute(
      'SELECT id, full_name, email, phone_number, password_hash FROM users WHERE email = ? OR phone_number = ? LIMIT 1',
      [normalized, credential.trim()]
    )

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const user = rows[0]
    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const [userVerification] = await db.execute(
      'SELECT COALESCE(is_verified, 0) as is_verified FROM users WHERE id = ?',
      [user.id]
    )

    return res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number,
        isVerified: Boolean(userVerification[0]?.is_verified || 0),
      },
    })
  } catch (error) {
    console.error('Login error', error)
    return res.status(500).json({ message: 'Failed to login right now.' })
  }
})

module.exports = router
