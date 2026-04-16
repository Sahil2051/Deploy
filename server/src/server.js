const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env'), silent: true })
const express = require('express')
const cors = require('cors')
const authRoutes = require('./routes.auth')
const roomsRoutes = require('./routes.rooms')
const adminRoutes = require('./routes.admin')
const bookingsRoutes = require('./routes.bookings')
const premiumRoutes = require('./routes.premium')
const messagesRoutes = require('./routes.messages')
const paymentsRoutes = require('./routes.payments')

const app = express()

// CORS: allow configured frontend origin(s) plus localhost during development.
// FRONTEND_URL can be a single URL or a comma-separated list of URLs.
const allowedOrigins = String(process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173')
}

const corsOptions = {
  origin: (origin, callback) => {
    // For non-browser requests (no Origin header), allow.
    if (!origin) return callback(null, true)
    if (allowedOrigins.length === 0) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error(`CORS blocked origin: ${origin}`))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.get('/', (_req, res) => {
  res.json({
    message: 'Shelter API is running.',
    status: 'ok',
    health: '/health',
    routes: [
      '/api/auth',
      '/api/rooms',
      '/api/admin',
      '/api/bookings',
      '/api/premium',
      '/api/messages',
      '/api/payments',
    ],
  })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/rooms', roomsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/bookings', bookingsRoutes)
app.use('/api/premium', premiumRoutes)
app.use('/api/messages', messagesRoutes)
app.use('/api/payments', paymentsRoutes)

// 404 + error handler (production-friendly JSON)
app.use((_req, res) => {
  res.status(404).json({
    message: 'Not Found',
    hint: 'Try /health or one of the /api/* routes.',
  })
})

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled server error:', err)
  res.status(500).json({ message: err?.message || 'Internal Server Error' })
})

const port = Number(process.env.PORT ?? process.env.APP_PORT ?? 5000)
const host = process.env.APP_HOST ?? '0.0.0.0'

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`)
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('WARNING: SMTP is not configured. Email OTP and reset features will not work.')
  }
})

