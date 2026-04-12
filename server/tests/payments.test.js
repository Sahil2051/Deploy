const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

let db
let paymentsRouter

describe('Payments Controller (TC25-TC28)', () => {
  let app

  beforeEach(() => {
    jest.resetModules()
    jest.doMock('../src/db', () => ({
      execute: jest.fn(),
    }))

    db = require('../src/db')
    paymentsRouter = require('../src/routes.payments')

    app = express()
    app.use(express.json())
    app.use(paymentsRouter)

    jest.spyOn(Date, 'now').mockReturnValue(1710000000000)
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('TC25: Successful booking payment initiation', async () => {
    db.execute
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])

    const response = await request(app)
      .post('/booking/initiate')
      .send({
        userId: 1,
        roomId: 2,
        totalAmount: 5000,
        successUrl: 'http://localhost:5173',
        failureUrl: 'http://localhost:5173'
      })

    expect(response.status).toBe(200)
    expect(response.body.product_code).toBe('EPAYTEST')
    expect(response.body.amount).toBe(5000)
    expect(response.body.transaction_uuid).toContain('BOOK-1-2-1710000000000')
    expect(response.body.signature).toBeDefined()
  })

  test('TC26: Booking payment initiation with missing fields', async () => {
    const response = await request(app)
      .post('/booking/initiate')
      .send({
        userId: 1,
        roomId: 2
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Missing booking payment fields.')
  })

  test('TC27: Verify payment with no data provided', async () => {
    const response = await request(app)
      .post('/verify')
      .send({})

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('No payment data provided.')
  })

  test('TC28: Verify completed payment but transaction not found', async () => {
    db.execute.mockResolvedValueOnce([{}])
    db.execute.mockResolvedValueOnce([[]])

    const payload = {
      status: 'COMPLETE',
      transaction_uuid: 'BOOK-1-2-1710000000000',
      total_amount: 5000
    }

    const response = await request(app)
      .post('/verify')
      .send({
        data: Buffer.from(JSON.stringify(payload)).toString('base64'),
        context: 'booking'
      })

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Payment transaction not found.')
  })
})