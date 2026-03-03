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
      'SELECT id, full_name, email, phone_number, password_hash, is_premium, premium_until, premium_plan FROM users WHERE email = ? OR phone_number = ? LIMIT 1',
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

    // Check Premium Expiry
    let isPremium = Boolean(user.is_premium || 0)
    let premiumUntil = user.premium_until

    if (isPremium && premiumUntil) {
      const expiryDate = new Date(premiumUntil)
      if (expiryDate < new Date()) {
        isPremium = false
        // Update DB
        await db.execute('UPDATE users SET is_premium = 0 WHERE id = ?', [user.id])
      }
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
        isPremium: isPremium,
        premiumUntil: premiumUntil,
        premiumPlan: user.premium_plan,
      },
    })
  } catch (error) {
    console.error('Login error', error)
    return res.status(500).json({ message: 'Failed to login right now.' })
  }
})

router.put('/profile', async (req, res) => {
  const { id, fullName, email, phoneNumber, password } = req.body || {}

  if (!id || !fullName || !email || !phoneNumber) {
    return res.status(400).json({ message: 'ID, name, email, and phone are required.' })
  }

  try {
    let query = 'UPDATE users SET full_name = ?, email = ?, phone_number = ?'
    let params = [fullName.trim(), normalizeCredential(email), phoneNumber.trim()]

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10)
      query += ', password_hash = ?'
      params.push(passwordHash)
    }

    query += ' WHERE id = ?'
    params.push(id)

    const [result] = await db.execute(query, params)

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' })
    }

    return res.json({
      message: 'Profile updated successfully.',
      user: {
        id,
        fullName,
        email,
        phoneNumber,
        // Carry over these from session if needed, but usually frontend handles partial updates
      }
    })
  } catch (error) {
    console.error('Update profile error', error)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email or phone already in use.' })
    }
    return res.status(500).json({ message: 'Failed to update profile.' })
  }
})

module.exports = router
