const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

let db
let premiumRouter

describe('Premium Membership Controller (TC29-TC32)', () => {
  let app

  beforeEach(() => {
    jest.resetModules()
    jest.doMock('../src/db', () => ({
      execute: jest.fn(),
    }))

    db = require('../src/db')
    premiumRouter = require('../src/routes.premium')

    app = express()
    app.use(express.json())
    app.use(premiumRouter)

    jest.spyOn(Date, 'now').mockReturnValue(1710000000000)
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('TC29: Bill generation on click succeeds', async () => {
    db.execute.mockResolvedValueOnce([{}])

    const response = await request(app)
      .post('/create-bill-on-click')
      .send({
        userId: 1,
        planType: 'month',
        amount: 1499
      })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Bill generated successfully!')
    expect(response.body.transactionUuid).toContain('PREM-1-month-1710000000000')
  })

  test('TC30: Initiate premium payment with invalid plan type', async () => {
    const response = await request(app)
      .post('/initiate')
      .send({
        userId: 1,
        planType: 'year'
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Invalid User ID or Plan Type.')
  })

  test('TC31: Purchase premium plan successfully', async () => {
    db.execute
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ premium_until: '2026-04-12 00:00:00' }]])
      .mockResolvedValueOnce([{}])

    const response = await request(app)
      .post('/purchase')
      .send({
        userId: 1,
        planType: 'month',
        paidAmount: 1499,
        transactionCode: 'TXN-001'
      })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Successfully activated month plan!')
    expect(response.body.premiumPlan).toBe('month')
    expect(response.body.premiumUntil).toBe('2026-04-12 00:00:00')
  })

  test('TC32: Activate premium bill that does not exist', async () => {
    db.execute.mockResolvedValueOnce([[]])

    const response = await request(app)
      .post('/activate')
      .send({
        userId: 1,
        billId: 99
      })

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Bill not found or already activated.')
  })
})