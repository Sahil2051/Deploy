const express = require('express')
const db = require('./db')

const router = express.Router()

// Mock Purchase Premium Plan
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
            'UPDATE users SET is_premium = 1, premium_until = ? WHERE id = ?',
            [formattedDate, userId]
        )

        return res.json({
            message: `Successfully purchased ${planType} plan!`,
            premiumUntil: formattedDate
        })
    } catch (error) {
        console.error('Purchase error', error)
        return res.status(500).json({ message: 'Failed to process purchase.' })
    }
})

module.exports = router
