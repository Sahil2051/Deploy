const express = require('express')
const crypto = require('crypto')
const db = require('./db')

const router = express.Router()

const ESEWA_SECRET_KEY = '8gBm/:&EnhH.1/q'
const ESEWA_PRODUCT_CODE = 'EPAYTEST'

const DEFAULT_ROOM_REGISTRATION_FEE = 99

let tableReadyPromise = null

const ensureFeaturePaymentsTable = async () => {
  if (!tableReadyPromise) {
    tableReadyPromise = db.execute(`
      CREATE TABLE IF NOT EXISTS feature_payments (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        transaction_uuid VARCHAR(120) NOT NULL UNIQUE,
        payment_for VARCHAR(30) NOT NULL
          CHECK (payment_for IN ('booking', 'room_registration')),
        amount DECIMAL(10,2) NOT NULL,
        payment_status VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        metadata_json TEXT,
        is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        verified_at TIMESTAMPTZ,
        consumed_at TIMESTAMPTZ
      )
    `)
  }

  await tableReadyPromise
}

const buildSignature = ({ totalAmount, transactionUuid }) => {
  const signatureString = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${ESEWA_PRODUCT_CODE}`
  return crypto
    .createHmac('sha256', ESEWA_SECRET_KEY)
    .update(signatureString)
    .digest('base64')
}

const resolveBaseUrl = (req, explicitUrl) => {
  return (
    explicitUrl?.replace(/\/?$/, '') ||
    process.env.FRONTEND_URL ||
    req.headers.origin ||
    'http://localhost:5173'
  )
}

const parseGatewayData = (base64Data) => {
  const decodedDataString = Buffer.from(base64Data, 'base64').toString('utf8')
  return JSON.parse(decodedDataString)
}

const parseContextFromUuid = (transactionUuid) => {
  if (typeof transactionUuid !== 'string') return null
  if (transactionUuid.startsWith('BOOK-')) return 'booking'
  if (transactionUuid.startsWith('ROOM-')) return 'room_registration'
  return null
}

router.post('/booking/initiate', async (req, res) => {
  const { userId, roomId, totalAmount, successUrl, failureUrl } = req.body || {}

  if (!userId || !roomId || !totalAmount) {
    return res.status(400).json({ message: 'Missing booking payment fields.' })
  }

  const amount = Number(totalAmount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Invalid booking amount.' })
  }

  const transactionUuid = `BOOK-${userId}-${roomId}-${Date.now()}`
  const signature = buildSignature({ totalAmount: amount, transactionUuid })
  const baseUrl = resolveBaseUrl(req, successUrl)

  try {
    await ensureFeaturePaymentsTable()
    await db.execute(
      `INSERT INTO feature_payments
       (user_id, transaction_uuid, payment_for, amount, payment_status, metadata_json)
       VALUES (?, ?, 'booking', ?, 'INITIATED', ?)`,
      [userId, transactionUuid, amount, JSON.stringify({ roomId: Number(roomId) })]
    )

    return res.json({
      signature,
      transaction_uuid: transactionUuid,
      amount,
      product_code: ESEWA_PRODUCT_CODE,
      tax_amount: 0,
      psc: 0,
      pdc: 0,
      total_amount: amount,
      success_url: `${baseUrl}/?payment=success&context=booking`,
      failure_url: `${(failureUrl?.replace(/\/?$/, '') || baseUrl)}/?payment=failure&context=booking`
    })
  } catch (error) {
    console.error('Booking payment initiation error', error)
    return res.status(500).json({ message: 'Failed to initiate booking payment.' })
  }
})

router.post('/room/initiate', async (req, res) => {
  const { userId, amount = DEFAULT_ROOM_REGISTRATION_FEE, successUrl, failureUrl } = req.body || {}

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' })
  }

  const feeAmount = Number(amount)
  if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
    return res.status(400).json({ message: 'Invalid room registration fee.' })
  }

  const transactionUuid = `ROOM-${userId}-${Date.now()}`
  const signature = buildSignature({ totalAmount: feeAmount, transactionUuid })
  const baseUrl = resolveBaseUrl(req, successUrl)

  try {
    await ensureFeaturePaymentsTable()
    await db.execute(
      `INSERT INTO feature_payments
       (user_id, transaction_uuid, payment_for, amount, payment_status)
       VALUES (?, ?, 'room_registration', ?, 'INITIATED')`,
      [userId, transactionUuid, feeAmount]
    )

    return res.json({
      signature,
      transaction_uuid: transactionUuid,
      amount: feeAmount,
      product_code: ESEWA_PRODUCT_CODE,
      tax_amount: 0,
      psc: 0,
      pdc: 0,
      total_amount: feeAmount,
      success_url: `${baseUrl}/?payment=success&context=room-registration`,
      failure_url: `${(failureUrl?.replace(/\/?$/, '') || baseUrl)}/?payment=failure&context=room-registration`
    })
  } catch (error) {
    console.error('Room registration payment initiation error', error)
    return res.status(500).json({ message: 'Failed to initiate room registration payment.' })
  }
})

router.post('/verify', async (req, res) => {
  const { data, context } = req.body || {}

  if (!data) {
    return res.status(400).json({ message: 'No payment data provided.' })
  }

  try {
    await ensureFeaturePaymentsTable()

    const decoded = parseGatewayData(data)
    if (decoded.status !== 'COMPLETE') {
      return res.status(400).json({ message: 'Payment is not completed.' })
    }

    const parsedContext = parseContextFromUuid(decoded.transaction_uuid)
    const normalizedContext = context === 'room-registration' ? 'room_registration' : context

    if (!parsedContext || (normalizedContext && normalizedContext !== parsedContext)) {
      return res.status(400).json({ message: 'Invalid payment context.' })
    }

    const [rows] = await db.execute(
      `SELECT * FROM feature_payments WHERE transaction_uuid = ? LIMIT 1`,
      [decoded.transaction_uuid]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Payment transaction not found.' })
    }

    const payment = rows[0]

    await db.execute(
      `UPDATE feature_payments
       SET payment_status = 'COMPLETE',
           is_verified = TRUE,
           verified_at = NOW()
       WHERE id = ?`,
      [payment.id]
    )

    return res.json({
      message: 'Payment verified successfully.',
      context: parsedContext,
      transactionUuid: decoded.transaction_uuid,
      amount: Number(decoded.total_amount || payment.amount)
    })
  } catch (error) {
    console.error('Feature payment verification error', error)
    return res.status(500).json({ message: 'Failed to verify payment.' })
  }
})

module.exports = router
