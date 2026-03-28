const express = require('express')
const db = require('./db')
const crypto = require('crypto')

const router = express.Router()

// eSewa UAT Config
const ESEWA_SECRET_KEY = '8gBm/:&EnhH.1/q'
const ESEWA_PRODUCT_CODE = 'EPAYTEST'

const planPrices = {
    'day': 99,
    'week': 499,
    'month': 1499
}

// 0. Create Bill Immediately on Click (Simulated Purchase)
router.post('/create-bill-on-click', async (req, res) => {
    const { userId, planType, amount } = req.body || {}

    if (!userId || !planType || !amount) {
        return res.status(400).json({ message: 'Missing required fields.' })
    }

    const transaction_uuid = `PREM-${userId}-${planType}-${Date.now()}`

    try {
        await db.execute(
            'INSERT INTO premium_bills (user_id, plan_type, amount, transaction_uuid, is_activated) VALUES (?, ?, ?, ?, 0)',
            [userId, planType, amount, transaction_uuid]
        )

        res.json({
            message: 'Bill generated successfully!',
            transactionUuid: transaction_uuid
        })
    } catch (error) {
        console.error('Create bill error', error)
        res.status(500).json({ message: 'Failed to create bill.' })
    }
})

// 1. Initiate Payment - Returns signature and UUID
router.post('/initiate', async (req, res) => {
    const { userId, planType, successUrl, failureUrl } = req.body || {}

    if (!userId || !planType || !planPrices[planType]) {
        return res.status(400).json({ message: 'Invalid User ID or Plan Type.' })
    }

    const amount = planPrices[planType]
    // NEW: Secret UID strategy - encode everything we need in cross-platform UUID
    const transaction_uuid = `PREM-${userId}-${planType}-${Date.now()}`

    // Generate Signature for eSewa v2
    // total_amount,transaction_uuid,product_code
    const signatureString = `total_amount=${amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_PRODUCT_CODE}`

    const signature = crypto
        .createHmac('sha256', ESEWA_SECRET_KEY)
        .update(signatureString)
        .digest('base64')

    // derive base URL for redirection. try body override first, then env var, then request origin, then hardcoded fallback
    const baseUrl =
        successUrl?.replace(/\/?$/, '') ||
        process.env.FRONTEND_URL ||
        req.headers.origin ||
        'http://localhost:5173'

    const generatedSuccess = `${baseUrl}/?payment=success`
    const generatedFailure = `${baseUrl}/?payment=failure`

    console.log('🧾 Initiating payment', { userId, planType, amount, redirectBase: baseUrl })

    // create a provisional history record so we can look up later even if callback fails
    try {
        await db.execute(
            `INSERT INTO payment_history 
             (user_id, transaction_uuid, plan_type, amount, payment_status, is_verified) 
             VALUES (?, ?, ?, ?, 'INITIATED', FALSE)`,
            [userId, transaction_uuid, planType, amount]
        )
    } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') console.error('Init record error', err)
    }

    res.json({
        signature,
        transaction_uuid,
        amount,
        product_code: ESEWA_PRODUCT_CODE,
        tax_amount: 0,
        psc: 0,
        pdc: 0,
        total_amount: amount,
        success_url: generatedSuccess,
        failure_url: generatedFailure
    })
})

// Mock Purchase Premium Plan (Legacy/Direct) – “cheat” endpoint that bypasses the
// eSewa verification flow.  Call this from the frontend when the user presses the
// **Start** button on the receipt.  It updates the user immediately, computes the
// expiry in the database, and records a payment_history row so admins still see the transaction.
router.post('/purchase', async (req, res) => {
    // paidAmount and transactionCode are optional, you can supply them from the
    // payment provider or leave them null when doing a manual trigger.
    const { userId, planType, paidAmount = null, transactionCode = null } = req.body || {}

    if (!userId || !planType) {
        return res.status(400).json({ message: 'User ID and Plan Type are required.' })
    }

    const planDurations = {
        'day': 1,
        'week': 7,
        'month': 30
    }

    const durationDays = planDurations[planType]
    if (!durationDays) {
        return res.status(400).json({ message: 'Invalid plan type.' })
    }

    try {
        // mark user premium and compute expiration using UTC_TIMESTAMP()
        await db.execute(
            `UPDATE users 
             SET is_premium = 1,
                 premium_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY),
                 premium_plan = ?
             WHERE id = ?`,
            [durationDays, planType, userId]
        )

        const [[userRow]] = await db.execute(
            'SELECT premium_until FROM users WHERE id = ?',
            [userId]
        )
        const formattedDate = userRow.premium_until

        // insert log entry in payment_history for auditing
        const transaction_uuid = `MANUAL-${userId}-${Date.now()}`
        const receiptNumber = `RCP-${userId}-${Date.now()}`
        await db.execute(
            `INSERT INTO payment_history 
             (user_id, transaction_uuid, plan_type, amount, payment_status,
              is_verified, receipt_number, premium_expires_at, paid_amount, verification_date)
             VALUES (?, ?, ?, ?, 'COMPLETE', TRUE, ?, ?, ?, UTC_TIMESTAMP())`,
            [
                userId,
                transaction_uuid,
                planType,
                paidAmount,
                receiptNumber,
                formattedDate,
                paidAmount
            ]
        )

        return res.json({
            message: `Successfully activated ${planType} plan!`,
            premiumUntil: formattedDate,
            premiumPlan: planType,
            receiptNumber
        })
    } catch (error) {
        console.error('Purchase error', error)
        return res.status(500).json({ message: 'Failed to process purchase.' })
    }
})

// helper that contains most of the verify logic. returns result object or throws
async function processVerification(decodedData) {
    console.log('--- ESEWA VERIFICATION DATA ---')
    console.log(JSON.stringify(decodedData, null, 2))

    // { transaction_code, status, total_amount, transaction_uuid, product_code, signature }
    if (decodedData.status !== 'COMPLETE') {
        console.log('Payment status is NOT COMPLETE:', decodedData.status)
        throw new Error('Payment status is not COMPLETE.')
    }

    // Extract metadata from UUID (PREM-userId-planType-timestamp)
    const parts = decodedData.transaction_uuid.split('-')
    if (parts[0] !== 'PREM' || parts.length < 3) {
        console.error('Invalid Transaction UUID Format:', decodedData.transaction_uuid)
        throw new Error('Invalid transaction format received.')
    }

    const userId = parts[1]
    const planTypeFromUUID = parts[2]
    console.log(`Verified Transaction: User ${userId}, Plan ${planTypeFromUUID}`)

    const planType = planTypeFromUUID
    const planDurations = { 'day': 1, 'week': 7, 'month': 30 }
    const durationDays = planDurations[planType] || 1

    // Calculate expiry date (but DON'T activate yet - user must click START)
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + durationDays)
    const formattedDate = expiryDate.toISOString().slice(0, 19).replace('T', ' ')
    const receiptNumber = `RCP-${userId}-${Date.now()}`

    // Check if payment already exists
    const [existingPayment] = await db.execute(
        'SELECT * FROM payment_history WHERE transaction_uuid = ?',
        [decodedData.transaction_uuid]
    )

    if (existingPayment.length > 0) {
        // Update existing payment record - set to PENDING_ACTIVATION
        const verificationDate = new Date().toISOString().slice(0, 19).replace('T', ' ')

        // Check if already activated
        if (existingPayment[0].activation_status === 'ACTIVE') {
            return {
                alreadyActivated: true,
                userId,
                premiumUntil: existingPayment[0].premium_expires_at,
                premiumPlan: existingPayment[0].plan_type,
                receiptNumber: existingPayment[0].receipt_number,
                activationStatus: 'ACTIVE'
            }
        }

        // Set to PENDING_ACTIVATION - user needs to click START
        await db.execute(
            `UPDATE payment_history SET 
              user_id=?, transaction_code=?, plan_type=?, amount=?, payment_status='COMPLETE',
              is_verified=1, receipt_number=?, premium_expires_at=?, paid_amount=?, 
              verification_date=?, activation_status='PENDING_ACTIVATION'
             WHERE transaction_uuid=?`,
            [
                userId,
                decodedData.transaction_code || null,
                planType,
                decodedData.total_amount,
                receiptNumber,
                formattedDate,
                decodedData.total_amount,
                verificationDate,
                decodedData.transaction_uuid
            ]
        )
    } else {
        // Insert new payment record with PENDING_ACTIVATION status
        const verificationDate = new Date().toISOString().slice(0, 19).replace('T', ' ')

        await db.execute(
            `INSERT INTO payment_history 
            (user_id, transaction_code, transaction_uuid, plan_type, amount, payment_status, 
             is_verified, receipt_number, premium_expires_at, paid_amount, verification_date, activation_status) 
            VALUES (?, ?, ?, ?, ?, 'COMPLETE', ?, ?, ?, ?, ?, 'PENDING_ACTIVATION')`,
            [
                userId,
                decodedData.transaction_code || null,
                decodedData.transaction_uuid,
                planType,
                decodedData.total_amount,
                true,
                receiptNumber,
                formattedDate,
                decodedData.total_amount,
                verificationDate
            ]
        )
    }

    console.log(`Payment verified for user ${userId}. Status: PENDING_ACTIVATION. User must click START to activate.`)

    return {
        alreadyActivated: false,
        userId,
        premiumUntil: formattedDate,
        premiumPlan: planType,
        receiptNumber,
        transactionCode: decodedData.transaction_code,
        amount: decodedData.total_amount,
        activationStatus: 'PENDING_ACTIVATION',
        message: 'Payment successful! Please click START to activate your subscription.'
    }
}

// 2. Verify Payment - Decodes eSewa response and updates DB
router.post('/verify', async (req, res) => {
    const { data } = req.body || {}

    if (!data) {
        return res.status(400).json({ message: 'No data provided.' })
    }

    try {
        const decodedDataString = Buffer.from(data, 'base64').toString('utf8')
        const decodedData = JSON.parse(decodedDataString)

        const result = await processVerification(decodedData)

        return res.json({
            message: result.message || 'Payment verified successfully!',
            premiumUntil: result.premiumUntil,
            premiumPlan: result.premiumPlan,
            receiptNumber: result.receiptNumber,
            transactionCode: result.transactionCode,
            amount: result.amount,
            activationStatus: result.activationStatus,
            status: result.alreadyActivated ? 'ALREADY_ACTIVE' : 'PENDING_ACTIVATION'
        })
    } catch (error) {
        console.error('Verification error', error)
        const msg = error.message || 'Failed to verify payment.'
        return res.status(500).json({ message: msg })
    }
})

// 3. Webhook endpoint – designed for direct eSewa notifications.
//    eSewa can be configured to POST the same base64 payload it returns to the
//    browser. The logic is identical to `/verify` but responds with plain text
//    and always returns 200 so that the payment provider knows the call succeeded.
router.post('/webhook', async (req, res) => {
    const { data } = req.body || {}

    if (!data) {
        console.warn('Webhook hit with no data')
        return res.status(400).send('no data')
    }

    try {
        const decodedDataString = Buffer.from(data, 'base64').toString('utf8')
        const decodedData = JSON.parse(decodedDataString)

        console.log('🟢 webhook received payment data')
        await processVerification(decodedData)
        // reply simply; provider only cares about status code
        res.send('ok')
    } catch (error) {
        console.error('Webhook processing error', error)
        // still 200 to avoid retries from provider – we log the issue and can
        // inspect later. You could also send 500 if you prefer failure signals.
        res.send('error')
    }
})

// 4. Check a transaction by UUID (useful for polling when callback/data missing)
router.get('/check/:transaction_uuid', async (req, res) => {
    const { transaction_uuid } = req.params
    try {
        const [rows] = await db.execute(
            'SELECT * FROM payment_history WHERE transaction_uuid = ?',
            [transaction_uuid]
        )
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Not found' })
        }
        return res.json({ payment: rows[0] })
    } catch (err) {
        console.error('Check transaction error', err)
        return res.status(500).json({ message: 'Internal error' })
    }
})

// 5. Get payment history for a user
router.get('/history/:userId', async (req, res) => {
    const { userId } = req.params

    try {
        const [payments] = await db.execute(
            `SELECT * FROM payment_history 
             WHERE user_id = ? 
             ORDER BY purchased_at DESC`,
            [userId]
        )

        return res.json({ payments })
    } catch (error) {
        console.error('Get payment history error', error)
        return res.status(500).json({ message: 'Failed to fetch payment history.' })
    }
})

// 3. Fetch Bills for a User (from premium_bills table)
router.get('/bills/:userId', async (req, res) => {
    const { userId } = req.params

    try {
        const [bills] = await db.execute(
            'SELECT * FROM premium_bills WHERE user_id = ? ORDER BY paid_at DESC',
            [userId]
        )
        res.json(bills)
    } catch (error) {
        console.error('Fetch bills error', error)
        res.status(500).json({ message: 'Failed to fetch bills.' })
    }
})

// 5. Activate subscription - Called when user clicks Activate on the bill
router.post('/activate', async (req, res) => {
    const { userId, billId } = req.body || {}

    if (!userId || !billId) {
        return res.status(400).json({ message: 'User ID and Bill ID are required.' })
    }

    try {
        // Find the bill
        const [bills] = await db.execute(
            'SELECT * FROM premium_bills WHERE id = ? AND user_id = ? AND is_activated = 0',
            [billId, userId]
        )

        if (bills.length === 0) {
            return res.status(404).json({ message: 'Bill not found or already activated.' })
        }

        const bill = bills[0]
        const planType = bill.plan_type
        const planDurations = { 'day': 1, 'week': 7, 'month': 30 }
        const durationDays = planDurations[planType] || 1

        const now = new Date()
        const expiryDate = new Date()
        expiryDate.setDate(now.getDate() + durationDays)

        const formattedNow = now.toISOString().slice(0, 19).replace('T', ' ')
        const formattedExpiry = expiryDate.toISOString().slice(0, 19).replace('T', ' ')

        // 1. Update bill
        await db.execute(
            'UPDATE premium_bills SET is_activated = 1, activated_at = ?, expires_at = ? WHERE id = ?',
            [formattedNow, formattedExpiry, billId]
        )

        // 2. Update user
        await db.execute(
            'UPDATE users SET is_premium = 1, premium_until = ?, premium_plan = ? WHERE id = ?',
            [formattedExpiry, planType, userId]
        )

        res.json({
            message: `Successfully activated ${planType} plan!`,
            expiresAt: formattedExpiry,
            planType
        })
    } catch (error) {
        console.error('Activation error', error)
        res.status(500).json({ message: 'Failed to activate plan.' })
    }
})

// 6. Get pending activation for user (for bill view)
router.get('/pending/:userId', async (req, res) => {
    const { userId } = req.params

    try {
        const [payments] = await db.execute(
            `SELECT * FROM payment_history 
             WHERE user_id = ? AND activation_status = 'PENDING_ACTIVATION' 
             ORDER BY purchased_at DESC LIMIT 1`,
            [userId]
        )

        if (payments.length === 0) {
            return res.json({ pending: null })
        }

        return res.json({ pending: payments[0] })
    } catch (error) {
        console.error('Get pending error:', error)
        return res.status(500).json({ message: 'Failed to fetch pending activation.' })
    }
})

// 7. Cancel subscription (Admin only or user emergency)
router.post('/cancel', async (req, res) => {
    const { userId, reason } = req.body || {}

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' })
    }

    try {
        // Find active subscription
        const [payments] = await db.execute(
            `SELECT * FROM payment_history 
             WHERE user_id = ? AND activation_status = 'ACTIVE' 
             ORDER BY subscription_start_time DESC LIMIT 1`,
            [userId]
        )

        if (payments.length === 0) {
            return res.status(404).json({ message: 'No active subscription found.' })
        }

        const payment = payments[0]

        // Update payment to cancelled
        await db.execute(
            `UPDATE payment_history SET 
              activation_status = 'CANCELLED',
              cancelled_by = 'USER',
              cancelled_at = UTC_TIMESTAMP(),
              cancellation_reason = ?
             WHERE id = ?`,
            [reason || 'User requested cancellation', payment.id]
        )

        // Remove premium from user
        await db.execute(
            `UPDATE users SET is_premium = 0, premium_until = NULL, premium_plan = NULL WHERE id = ?`,
            [userId]
        )

        console.log(`❌ Subscription cancelled for user ${userId}. Reason: ${reason || 'User requested'}`)

        return res.json({
            message: 'Subscription cancelled successfully.',
            status: 'CANCELLED'
        })
    } catch (error) {
        console.error('Cancellation error:', error)
        return res.status(500).json({ message: 'Failed to cancel subscription.' })
    }
})

module.exports = router
