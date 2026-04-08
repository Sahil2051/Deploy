require('dotenv').config()
const express = require('express')
const cors = require('cors')
const authRoutes = require('./routes.auth')
const roomsRoutes = require('./routes.rooms')
const adminRoutes = require('./routes.admin')
const bookingsRoutes = require('./routes.bookings')
const premiumRoutes = require('./routes.premium')
const messagesRoutes = require('./routes.messages')
const paymentsRoutes = require('./routes.payments')

const path = require('path')

const app = express()

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

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

const port = Number(process.env.APP_PORT ?? 5000)
const host = process.env.APP_HOST ?? '0.0.0.0'

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`)
})

