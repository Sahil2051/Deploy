const express = require('express')
const db = require('./db')

const router = express.Router()

let ensureSurveyTablePromise = null

const ensureSurveyTable = async () => {
  if (!ensureSurveyTablePromise) {
    ensureSurveyTablePromise = db.execute(`
      CREATE TABLE IF NOT EXISTS post_survey_responses (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        q1 TEXT NOT NULL,
        q2 TEXT NOT NULL,
        q3 TEXT NOT NULL,
        q4 TEXT NOT NULL,
        q5 TEXT NOT NULL,
        q6 TEXT NOT NULL,
        q7 TEXT NOT NULL,
        q8 TEXT NOT NULL,
        q9 TEXT NOT NULL,
        q10 TEXT NOT NULL,
        q11 TEXT NOT NULL,
        q12 TEXT NOT NULL,
        q13 TEXT NOT NULL,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }

  await ensureSurveyTablePromise
}

const normalizeAnswer = (value) => String(value || '').trim()

router.post('/submit', async (req, res) => {
  const { userId = null, answers } = req.body || {}

  const payload = answers && typeof answers === 'object' ? answers : req.body || {}

  const normalized = {
    q1: normalizeAnswer(payload.q1),
    q2: normalizeAnswer(payload.q2),
    q3: normalizeAnswer(payload.q3),
    q4: normalizeAnswer(payload.q4),
    q5: normalizeAnswer(payload.q5),
    q6: normalizeAnswer(payload.q6),
    q7: normalizeAnswer(payload.q7),
    q8: normalizeAnswer(payload.q8),
    q9: normalizeAnswer(payload.q9),
    q10: normalizeAnswer(payload.q10),
    q11: normalizeAnswer(payload.q11),
    q12: normalizeAnswer(payload.q12),
    q13: normalizeAnswer(payload.q13),
  }

  const missing = Object.entries(normalized)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    return res.status(400).json({
      message: `Please answer all survey questions. Missing: ${missing.join(', ')}`,
    })
  }

  try {
    await ensureSurveyTable()

    await db.execute(
      `INSERT INTO post_survey_responses
       (user_id, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId ? Number(userId) : null,
        normalized.q1,
        normalized.q2,
        normalized.q3,
        normalized.q4,
        normalized.q5,
        normalized.q6,
        normalized.q7,
        normalized.q8,
        normalized.q9,
        normalized.q10,
        normalized.q11,
        normalized.q12,
        normalized.q13,
      ]
    )

    return res.status(201).json({ message: 'Survey submitted successfully. Thank you for your feedback.' })
  } catch (error) {
    console.error('Survey submit error', error)
    return res.status(500).json({ message: 'Failed to submit survey.' })
  }
})

module.exports = router
