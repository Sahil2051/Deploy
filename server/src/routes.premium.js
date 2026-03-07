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

// 1. Initiate Payment - Returns signature and UUID
router.post('/initiate', async (req, res) => {
    const { userId, planType } = req.body || {}

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

    res.json({
        signature,
        transaction_uuid,
        amount,
        product_code: ESEWA_PRODUCT_CODE,
        tax_amount: 0,
        psc: 0,
        pdc: 0,
        total_amount: amount,
        success_url: 'http://localhost:5173/?payment=success',
        failure_url: 'http://localhost:5173/?payment=failure'
    })
})

// Mock Purchase Premium Plan (Legacy/Direct)
router.post('/purchase', async (req, res) => {
    const { userId, planType } = req.body || {}

    if (!userId || !planType) {
        return res.status(400).json({ message: 'User ID and Plan Type are required.' })
    }

    // Define durations in days
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
        const premiumUntil = new Date()
        premiumUntil.setDate(premiumUntil.getDate() + durationDays)

        // Format for MySQL
        const formattedDate = premiumUntil.toISOString().slice(0, 19).replace('T', ' ')

        await db.execute(
            'UPDATE users SET is_premium = 1, premium_until = ?, premium_plan = ? WHERE id = ?',
            [formattedDate, planType, userId]
        )

        return res.json({
            message: `Successfully purchased ${planType} plan!`,
            premiumUntil: formattedDate,
            premiumPlan: planType
        })
    } catch (error) {
        console.error('Purchase error', error)
        return res.status(500).json({ message: 'Failed to process purchase.' })
    }
})

// 2. Verify Payment - Decodes eSewa response and CREATES A BILL
router.post('/verify', async (req, res) => {
    const { data } = req.body || {}

    if (!data) {
        return res.status(400).json({ message: 'No data provided.' })
    }

    try {
        const decodedDataString = Buffer.from(data, 'base64').toString('utf8')
        const decodedData = JSON.parse(decodedDataString)

        if (decodedData.status !== 'COMPLETE') {
            return res.status(400).json({ message: 'Payment status is not COMPLETE.' })
        }

        const parts = decodedData.transaction_uuid.split('-')
        if (parts[0] !== 'PREM' || parts.length < 3) {
            return res.status(400).json({ message: 'Invalid transaction format received.' })
        }

        const userId = parts[1]
        const planType = parts[2]
        const amount = decodedData.total_amount

        // Create a bill instead of activating immediately
        await db.execute(
            'INSERT INTO premium_bills (user_id, plan_type, amount, transaction_uuid) VALUES (?, ?, ?, ?)',
            [userId, planType, amount, decodedData.transaction_uuid]
        )

        return res.json({
            message: `Payment successful! A bill for ${planType} has been generated in your account.`,
            planType: planType
        })
    } catch (error) {
        console.error('Verification error', error)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'This transaction has already been processed.' })
        }
        return res.status(500).json({ message: 'Failed to verify payment.' })
    }
})

// 2.5 Create Bill Immediately on Click (Simulated Purchase)
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
            message: 'Bill generated successfully! You can activate it in your account.',
            transactionUuid: transaction_uuid
        })
    } catch (error) {
        console.error('Create bill error', error)
        res.status(500).json({ message: 'Failed to create bill.' })
    }
})

// 3. Fetch Bills for a User
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

// 4. Activate a Bill
router.post('/activate', async (req, res) => {
    const { billId, userId } = req.body

    try {
        // Find the bill
        const [bills] = await db.execute(
            'SELECT * FROM premium_bills WHERE id = ? AND user_id = ? AND is_activated = 0',
            [billId, userId]
        )

        if (bills.length === 0) {
            return res.status(400).json({ message: 'Bill not found or already activated.' })
        }

        const bill = bills[0]
        const planDurations = { 'day': 1, 'week': 7, 'month': 30 }
        const durationDays = planDurations[bill.plan_type] || 1

        const activatedAt = new Date()
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + durationDays)

        const formattedActivatedAt = activatedAt.toISOString().slice(0, 19).replace('T', ' ')
        const formattedExpiresAt = expiresAt.toISOString().slice(0, 19).replace('T', ' ')

        // Begin transaction
        const connection = await db.getConnection()
        await connection.beginTransaction()

        try {
            // Update the bill
            await connection.execute(
                'UPDATE premium_bills SET is_activated = 1, activated_at = ?, expires_at = ? WHERE id = ?',
                [formattedActivatedAt, formattedExpiresAt, billId]
            )

            // Update the user
            await connection.execute(
                'UPDATE users SET is_premium = 1, premium_until = ?, premium_plan = ? WHERE id = ?',
                [formattedExpiresAt, bill.plan_type, userId]
            )

            await connection.commit()
            connection.release()

            res.json({
                message: `Premium ${bill.plan_type} plan activated!`,
                expiresAt: formattedExpiresAt,
                planType: bill.plan_type
            })
        } catch (err) {
            await connection.rollback()
            connection.release()
            throw err
        }
    } catch (error) {
        console.error('Activation error', error)
        res.status(500).json({ message: 'Failed to activate premium.' })
    }
})

module.exports = router
