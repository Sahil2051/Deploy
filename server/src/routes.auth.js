const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const { OAuth2Client } = require('google-auth-library')
const db = require('./db')

const router = express.Router()

const normalizeCredential = (value = '') => value.trim().toLowerCase()
const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const DEFAULT_COUNTRY_CODE = '+977'

const googleAuthStateStore = new Map()
const passwordResetStore = new Map()

const smtpHost = process.env.SMTP_HOST
const smtpPort = Number(process.env.SMTP_PORT ?? 587)
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const smtpFrom = process.env.SMTP_FROM || smtpUser || 'no-reply@shelter.local'
const exposeSignupOtp = String(process.env.SIGNUP_OTP_DEBUG || '').toLowerCase() === 'true'

const mailTransport = smtpHost && smtpUser && smtpPass
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null

const getGoogleOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return null
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri)
}

const isValidEmail = (email = '') => EMAIL_REGEX.test(normalizeCredential(email))
const SIGNUP_OTP_EXPIRY_MS = 10 * 60 * 1000

const signupOtpStore = new Map()

const normalizeNepalPhone = (phone = '', countryCode = DEFAULT_COUNTRY_CODE) => {
  const digitsOnly = String(phone).replace(/\D/g, '')
  const countryDigits = String(countryCode).replace(/\D/g, '') || '977'

  let normalized = digitsOnly

  if (normalized.startsWith(countryDigits) && normalized.length === countryDigits.length + 10) {
    normalized = normalized.slice(countryDigits.length)
  }

  if (normalized.startsWith('0') && normalized.length === 11) {
    normalized = normalized.slice(1)
  }

  if (!/^\d{10}$/.test(normalized)) {
    return null
  }

  return normalized
}

const generateRandomToken = (size = 32) => crypto.randomBytes(size).toString('hex')
const hashToken = (token = '') => crypto.createHash('sha256').update(token).digest('hex')

const buildUserPayload = (userRow) => ({
  id: userRow.id,
  fullName: userRow.full_name,
  email: userRow.email,
  phoneNumber: userRow.phone_number,
  isVerified: Boolean(userRow.is_verified || 0),
  isPremium: Boolean(userRow.is_premium || 0),
  premiumUntil: userRow.premium_until,
  premiumPlan: userRow.premium_plan,
})

const ensureStrongPassword = (password = '') => STRONG_PASSWORD_REGEX.test(password)

const buildPopupHtml = ({ success, message, user, origin }) => {
  const payload = JSON.stringify({ type: 'shelter-google-auth', success, message, user })
  const escapedPayload = payload.replace(/</g, '\\u003c')
  const safeOrigin = origin || '*'

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Google Login</title>
  </head>
  <body>
    <script>
      (function () {
        var payload = ${escapedPayload};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, ${JSON.stringify(safeOrigin)});
        }
        window.close();
        document.body.innerText = payload.success ? 'Google login successful. You can close this tab.' : (payload.message || 'Google login failed. You can close this tab.');
      })();
    </script>
  </body>
</html>`
}

const sendPasswordResetEmail = async ({ email, fullName, token }) => {
  if (!mailTransport) {
    return false
  }

  const resetBaseUrl = process.env.PASSWORD_RESET_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5173'
  const resetUrl = `${resetBaseUrl}?resetEmail=${encodeURIComponent(email)}&resetToken=${encodeURIComponent(token)}`

  await mailTransport.sendMail({
    from: smtpFrom,
    to: email,
    subject: 'SHELTER password reset verification',
    text: `Hello ${fullName || 'User'},\n\nWe received a request to reset your password.\nUse this link to verify and reset: ${resetUrl}\n\nIf this was not you, ignore this email.\nThis link expires in 15 minutes.`,
    html: `<p>Hello ${fullName || 'User'},</p><p>We received a request to reset your password.</p><p><a href="${resetUrl}">Verify and reset password</a></p><p>If this was not you, ignore this email.</p><p>This link expires in 15 minutes.</p>`,
  })

  return true
}

const sendSignupOtpEmail = async ({ email, fullName, otp }) => {
  if (!mailTransport) {
    return false
  }

  await mailTransport.sendMail({
    from: smtpFrom,
    to: email,
    subject: 'SHELTER signup verification code',
    text: `Hello ${fullName || 'User'},\n\nYour signup verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
    html: `<p>Hello ${fullName || 'User'},</p><p>Your signup verification code is:</p><p><strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
  })

  return true
}

const findUniquePhoneSeed = async (seedValue) => {
  let attempts = 0
  while (attempts < 10) {
    const hash = crypto.createHash('sha256').update(`${seedValue}-${attempts}`).digest('hex')
    const numeric = BigInt(`0x${hash.slice(0, 12)}`).toString().slice(0, 10).padStart(10, '9')
    const candidate = numeric.slice(0, 10)
    const [rows] = await db.execute('SELECT id FROM users WHERE phone_number = ? LIMIT 1', [candidate])
    if (rows.length === 0) {
      return candidate
    }
    attempts += 1
  }
  throw new Error('Could not generate a unique phone number.')
}

const insertSignupUser = async ({ fullName, age, address, email, phoneNumber, passwordHash }) => {
  const normalizedEmail = normalizeCredential(email)
  const normalizedPhone = phoneNumber || await findUniquePhoneSeed(normalizedEmail)

  await db.execute(
    `INSERT INTO users (full_name, age, address_line, email, phone_number, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [fullName.trim(), age, address.trim(), normalizedEmail, normalizedPhone, passwordHash]
  )
}

router.post('/signup/request-otp', async (req, res) => {
  const { fullName, age, address, email, password } = req.body || {}

  if (!mailTransport) {
    return res.status(503).json({ message: 'Email service is not configured. Contact support.' })
  }

  if (!fullName || !age || !address || !email || !password) {
    return res.status(400).json({ message: 'Name, age, address, email, and password are required.' })
  }

  const ageNumber = Number(age)
  if (Number.isNaN(ageNumber) || ageNumber < 16) {
    return res.status(400).json({ message: 'Age must be 16 or above.' })
  }

  if (!ensureStrongPassword(password)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters and include letters and numbers.' })
  }

  const normalizedEmail = normalizeCredential(email)
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' })
  }

  try {
    const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail])
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Email already registered.' })
    }

    const otp = String(crypto.randomInt(100000, 1000000))
    const otpHash = hashToken(otp)
    const passwordHash = await bcrypt.hash(password, 10)

    signupOtpStore.set(normalizedEmail, {
      fullName: fullName.trim(),
      age: ageNumber,
      address: address.trim(),
      passwordHash,
      otpHash,
      expiresAt: Date.now() + SIGNUP_OTP_EXPIRY_MS,
    })

    const emailSent = await sendSignupOtpEmail({ email: normalizedEmail, fullName: fullName.trim(), otp })

    if (!emailSent) {
      return res.status(503).json({ message: 'Failed to send verification code email.' })
    }

    return res.json({
      message: 'Verification code sent to your email.',
      ...(exposeSignupOtp ? { verificationCode: otp } : {}),
    })
  } catch (error) {
    console.error('Signup OTP request error', error)
    return res.status(500).json({ message: 'Failed to send verification code.' })
  }
})

router.post('/signup/verify-otp', async (req, res) => {
  const { email, otp } = req.body || {}
  const normalizedEmail = normalizeCredential(email || '')

  if (!normalizedEmail || !otp) {
    return res.status(400).json({ message: 'Email and verification code are required.' })
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' })
  }

  const signupRecord = signupOtpStore.get(normalizedEmail)
  if (!signupRecord) {
    return res.status(400).json({ message: 'Verification request not found. Request a new code.' })
  }

  if (Date.now() > signupRecord.expiresAt) {
    signupOtpStore.delete(normalizedEmail)
    return res.status(400).json({ message: 'Verification code expired. Request a new one.' })
  }

  if (hashToken(String(otp)) !== signupRecord.otpHash) {
    return res.status(401).json({ message: 'Invalid verification code.' })
  }

  try {
    const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail])
    if (existingUsers.length > 0) {
      signupOtpStore.delete(normalizedEmail)
      return res.status(409).json({ message: 'Email already registered.' })
    }

    await insertSignupUser({
      fullName: signupRecord.fullName,
      age: signupRecord.age,
      address: signupRecord.address,
      email: normalizedEmail,
      passwordHash: signupRecord.passwordHash,
    })

    signupOtpStore.delete(normalizedEmail)
    return res.json({ message: 'Signup successful.' })
  } catch (error) {
    console.error('Signup OTP verify error', error)
    return res.status(500).json({ message: 'Failed to complete signup.' })
  }
})

router.post('/signup', async (req, res) => {
  const { fullName, age, address, email, phoneNumber, countryCode, password } = req.body || {}

  if (!fullName || !age || !address || !password) {
    return res.status(400).json({ message: 'Name, age, address, and password are required.' })
  }

  const ageNumber = Number(age)
  if (Number.isNaN(ageNumber) || ageNumber < 16) {
    return res.status(400).json({ message: 'Age must be 16 or above.' })
  }

  if (!ensureStrongPassword(password)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters and include letters and numbers.' })
  }

  const hasEmail = Boolean(String(email || '').trim())
  const hasPhone = Boolean(String(phoneNumber || '').trim())

  if (hasEmail) {
    return res.status(400).json({ message: 'Email signups must use verification code first.' })
  }

  if (!hasEmail && !hasPhone) {
    return res.status(400).json({ message: 'Provide either a valid email address or a 10-digit Nepal phone number.' })
  }

  let normalizedEmail = ''
  let normalizedPhone = ''

  if (hasEmail) {
    normalizedEmail = normalizeCredential(email)
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' })
    }
  }

  if (hasPhone) {
    normalizedPhone = normalizeNepalPhone(phoneNumber, countryCode)
    if (!normalizedPhone) {
      return res.status(400).json({ message: 'Nepal phone number must contain exactly 10 digits.' })
    }
  }

  try {
    if (normalizedPhone) {
      const [byPhone] = await db.execute('SELECT id FROM users WHERE phone_number = ? LIMIT 1', [normalizedPhone])
      if (byPhone.length > 0) {
        return res.status(409).json({ message: 'Phone already registered.' })
      }
    }

    if (!normalizedEmail && normalizedPhone) {
      normalizedEmail = `np${normalizedPhone}@phone.local`
    }

    if (!normalizedPhone && normalizedEmail) {
      normalizedPhone = await findUniquePhoneSeed(normalizedEmail)
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await insertSignupUser({
      fullName,
      age: ageNumber,
      address,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      passwordHash,
    })

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
    const normalizedPhone = normalizeNepalPhone(credential)

    const [rows] = await db.execute(
      `SELECT id, full_name, email, phone_number, password_hash, is_verified, is_premium, premium_until, premium_plan
       FROM users
       WHERE email = ? OR phone_number = ? OR phone_number = ?
       LIMIT 1`,
      [normalized, String(credential).trim(), normalizedPhone || '__no_phone_match__']
    )

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const user = rows[0]
    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    let isPremium = Boolean(user.is_premium || 0)
    let premiumUntil = user.premium_until

    if (isPremium && premiumUntil) {
      const expiryDate = new Date(premiumUntil)
      if (expiryDate < new Date()) {
        isPremium = false
        await db.execute('UPDATE users SET is_premium = FALSE WHERE id = ?', [user.id])
      }
    }

    return res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number,
        isVerified: Boolean(user.is_verified || 0),
        isPremium,
        premiumUntil,
        premiumPlan: user.premium_plan,
      },
    })
  } catch (error) {
    console.error('Login error', error)
    return res.status(500).json({ message: 'Failed to login right now.' })
  }
})

router.get('/google/start', (req, res) => {
  const oauthClient = getGoogleOAuthClient()

  if (!oauthClient) {
    const html = buildPopupHtml({
      success: false,
      message: 'Google login is not configured on server. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.',
      origin: req.query.origin || process.env.FRONTEND_URL || '*',
    })
    return res.status(500).send(html)
  }

  const origin = req.query.origin || process.env.FRONTEND_URL || '*'
  const state = generateRandomToken(16)

  googleAuthStateStore.set(state, {
    origin,
    createdAt: Date.now(),
  })

  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
  })

  return res.redirect(authUrl)
})

router.get('/google/callback', async (req, res) => {
  const oauthClient = getGoogleOAuthClient()
  if (!oauthClient) {
    return res.status(500).send('Google login is not configured on server.')
  }

  const { code, state } = req.query
  if (!code || !state) {
    return res.status(400).send('Google callback is missing required parameters.')
  }

  const stateData = googleAuthStateStore.get(String(state))
  googleAuthStateStore.delete(String(state))

  const origin = stateData?.origin || '*'

  if (!stateData || Date.now() - stateData.createdAt > 10 * 60 * 1000) {
    const html = buildPopupHtml({
      success: false,
      message: 'Google login session expired. Please try again.',
      origin,
    })
    return res.status(400).send(html)
  }

  try {
    const { tokens } = await oauthClient.getToken(String(code))
    if (!tokens.id_token) {
      throw new Error('No id_token returned by Google.')
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    const email = normalizeCredential(payload?.email || '')
    const fullName = payload?.name || 'Google User'

    if (!payload?.email_verified || !isValidEmail(email)) {
      const html = buildPopupHtml({
        success: false,
        message: 'Only verified email accounts can use Google login.',
        origin,
      })
      return res.status(400).send(html)
    }

    let userRow = null
    const [existing] = await db.execute(
      `SELECT id, full_name, email, phone_number, password_hash, is_verified, is_premium, premium_until, premium_plan
       FROM users WHERE email = ? LIMIT 1`,
      [email]
    )

    if (existing.length > 0) {
      userRow = existing[0]
    } else {
      const generatedPhone = await findUniquePhoneSeed(`${email}-${payload?.sub || 'google'}`)
      const generatedPassword = generateRandomToken(20)
      const generatedPasswordHash = await bcrypt.hash(generatedPassword, 10)

      const [insertResult] = await db.execute(
        `INSERT INTO users (full_name, age, address_line, email, phone_number, password_hash, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [fullName, 18, 'Added via Google login', email, generatedPhone, generatedPasswordHash]
      )

      const [insertedRows] = await db.execute(
        `SELECT id, full_name, email, phone_number, password_hash, is_verified, is_premium, premium_until, premium_plan
         FROM users WHERE id = ? LIMIT 1`,
        [insertResult.insertId]
      )

      userRow = insertedRows[0]
    }

    const userPayload = buildUserPayload(userRow)
    const html = buildPopupHtml({
      success: true,
      message: 'Google login successful.',
      user: userPayload,
      origin,
    })
    return res.send(html)
  } catch (error) {
    console.error('Google auth callback error', error)
    const html = buildPopupHtml({
      success: false,
      message: 'Google login failed. Please try again.',
      origin,
    })
    return res.status(500).send(html)
  }
})

router.post('/password/change', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body || {}

  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ message: 'User ID, current password, and new password are required.' })
  }

  if (!ensureStrongPassword(newPassword)) {
    return res.status(400).json({ message: 'New password must be at least 8 characters and include letters and numbers.' })
  }

  try {
    const [rows] = await db.execute('SELECT id, password_hash FROM users WHERE id = ? LIMIT 1', [userId])
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const user = rows[0]
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash)

    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' })
    }

    const newHash = await bcrypt.hash(newPassword, 10)
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId])

    return res.json({ message: 'Password changed successfully.' })
  } catch (error) {
    console.error('Password change error', error)
    return res.status(500).json({ message: 'Failed to change password.' })
  }
})

router.post('/password/reset/request', async (req, res) => {
  const { email } = req.body || {}
  const normalizedEmail = normalizeCredential(email || '')

  if (!mailTransport) {
    return res.status(503).json({ message: 'Email service is not configured. Contact support.' })
  }

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' })
  }

  try {
    const [rows] = await db.execute('SELECT id, full_name, email FROM users WHERE email = ? LIMIT 1', [normalizedEmail])
    const genericMessage = 'If this email exists, a verification email has been sent.'

    if (rows.length === 0) {
      return res.json({ message: genericMessage })
    }

    const user = rows[0]
    const token = generateRandomToken(24)
    const tokenHash = hashToken(token)
    const expiresAt = Date.now() + 15 * 60 * 1000

    passwordResetStore.set(normalizedEmail, {
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    const emailSent = await sendPasswordResetEmail({
      email: normalizedEmail,
      fullName: user.full_name,
      token,
    })

    if (!emailSent) {
      return res.status(503).json({ message: 'Failed to send verification email.' })
    }

    return res.json({ message: genericMessage })
  } catch (error) {
    console.error('Password reset request error', error)
    return res.status(500).json({ message: 'Failed to process password reset request.' })
  }
})

router.post('/password/reset/verify', async (req, res) => {
  const { email, token, newPassword } = req.body || {}
  const normalizedEmail = normalizeCredential(email || '')

  if (!normalizedEmail || !token || !newPassword) {
    return res.status(400).json({ message: 'Email, verification token, and new password are required.' })
  }

  if (!ensureStrongPassword(newPassword)) {
    return res.status(400).json({ message: 'New password must be at least 8 characters and include letters and numbers.' })
  }

  const resetRecord = passwordResetStore.get(normalizedEmail)
  if (!resetRecord) {
    return res.status(400).json({ message: 'Reset request not found. Request a new verification email.' })
  }

  if (Date.now() > resetRecord.expiresAt) {
    passwordResetStore.delete(normalizedEmail)
    return res.status(400).json({ message: 'Verification token expired. Request a new one.' })
  }

  const incomingHash = hashToken(String(token))
  if (incomingHash !== resetRecord.tokenHash) {
    return res.status(401).json({ message: 'Invalid verification token.' })
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, resetRecord.userId])
    passwordResetStore.delete(normalizedEmail)

    return res.json({ message: 'Password reset successful.' })
  } catch (error) {
    console.error('Password reset verify error', error)
    return res.status(500).json({ message: 'Failed to reset password.' })
  }
})

router.put('/profile', async (req, res) => {
  const { id, fullName, email, phoneNumber, password } = req.body || {}

  if (!id || !fullName || !email || !phoneNumber) {
    return res.status(400).json({ message: 'ID, name, email, and phone are required.' })
  }

  const normalizedEmail = normalizeCredential(email)
  const normalizedPhone = normalizeNepalPhone(phoneNumber) || String(phoneNumber).trim()

  try {
    let query = 'UPDATE users SET full_name = ?, email = ?, phone_number = ?'
    const params = [String(fullName).trim(), normalizedEmail, normalizedPhone]

    if (password) {
      if (!ensureStrongPassword(password)) {
        return res.status(400).json({ message: 'Password must be at least 8 characters and include letters and numbers.' })
      }
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
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
      },
    })
  } catch (error) {
    console.error('Update profile error', error)
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email or phone already in use.' })
    }
    return res.status(500).json({ message: 'Failed to update profile.' })
  }
})

router.get('/profile/:id', async (req, res) => {
  const { id } = req.params
  try {
    const [rows] = await db.execute(
      'SELECT id, full_name, email, phone_number, is_verified, is_premium, premium_until, premium_plan FROM users WHERE id = ?',
      [id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' })
    }

    return res.json({
      user: buildUserPayload(rows[0]),
    })
  } catch (error) {
    console.error('Fetch profile error', error)
    return res.status(500).json({ message: 'Failed to fetch user data.' })
  }
})

module.exports = router