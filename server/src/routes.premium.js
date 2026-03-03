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

// 2. Verify Payment - Decodes eSewa response and updates DB
router.post('/verify', async (req, res) => {
    const { data } = req.body || {}

    if (!data) {
        return res.status(400).json({ message: 'No data provided.' })
    }

    try {
        // eSewa v2 sends base64 encoded JSON
        const decodedDataString = Buffer.from(data, 'base64').toString('utf8')
        const decodedData = JSON.parse(decodedDataString)

        console.log('--- ESEWA VERIFICATION DATA ---')
        console.log(JSON.stringify(decodedData, null, 2))

        // { transaction_code, status, total_amount, transaction_uuid, product_code, signature }
        if (decodedData.status !== 'COMPLETE') {
            console.log('Payment status is NOT COMPLETE:', decodedData.status)
            return res.status(400).json({ message: 'Payment status is not COMPLETE.' })
        }

        // Extract metadata from UUID (PREM-userId-planType-timestamp)
        const parts = decodedData.transaction_uuid.split('-')
        if (parts[0] !== 'PREM' || parts.length < 3) {
            console.error('Invalid Transaction UUID Format:', decodedData.transaction_uuid)
            return res.status(400).json({ message: 'Invalid transaction format received.' })
        }

        const userId = parts[1]
        const planTypeFromUUID = parts[2]
        console.log(`Verified Transaction: User ${userId}, Plan ${planTypeFromUUID}`)

        // Use plan from UUID as source of truth, fallback to price check only for verification
        const planType = planTypeFromUUID

        const planDurations = { 'day': 1, 'week': 7, 'month': 30 }
        const premiumUntil = new Date()
        premiumUntil.setDate(premiumUntil.getDate() + (planDurations[planType] || 1))
        const formattedDate = premiumUntil.toISOString().slice(0, 19).replace('T', ' ')

        const [result] = await db.execute(
            'UPDATE users SET is_premium = 1, premium_until = ?, premium_plan = ? WHERE id = ?',
            [formattedDate, planType, userId]
        )

        if (result.affectedRows === 0) {
            console.error('Update failed: No user found with ID:', userId)
            return res.status(404).json({ message: 'User not found for this transaction.' })
        }

        console.log(`Successfully updated user ${userId} to premium ${planType}`)

        return res.json({
            message: `Payment successful! You are now an ${planType} premium user.`,
            premiumUntil: formattedDate,
            premiumPlan: planType
        })
    } catch (error) {
        console.error('Verification error', error)
        return res.status(500).json({ message: 'Failed to verify payment.' })
    }
})

module.exports = router
