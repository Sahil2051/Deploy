const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

const db = require('../src/db')
const bookingsRouter = require('../src/routes.bookings')

describe('Bookings Controller - Create (TC13-TC16)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(bookingsRouter)
    jest.clearAllMocks()
  })

  test('TC13: Successful booking creation', async () => {
    db.execute
      .mockResolvedValueOnce([[{
        owner_id: 2,
        is_available: 1,
      }]])
      .mockResolvedValueOnce([[{ total_overlaps: 0 }]])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([{}])

    const response = await request(app)
      .post('/')
      .send({
        userId: 1,
        roomId: 1,
        checkInDate: '2025-08-01',
        checkOutDate: '2025-08-05',
        guestsCount: 2,
        totalPrice: 5000,
      })

    expect(response.status).toBe(201)
    expect(response.body.message).toContain('success')
    expect(response.body.message).toContain('Waiting for approval')
    expect(response.body.bookingId).toBe(1)
  })

  test('TC14: Missing required booking fields', async () => {
    const response = await request(app)
      .post('/')
      .send({
        userId: 1,
        roomId: 1,
        checkInDate: '2025-08-01',
        checkOutDate: '2025-08-05',
        guestsCount: 2,
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Missing required booking fields.')
  })

  test('TC15: Check-out date before check-in date', async () => {
    const response = await request(app)
      .post('/')
      .send({
        userId: 1,
        roomId: 1,
        checkInDate: '2025-08-05',
        checkOutDate: '2025-08-01',
        guestsCount: 2,
        totalPrice: 5000,
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Check-out date must be after check-in date.')
  })

  test('TC16: Owner trying to book their own room', async () => {
    db.execute.mockResolvedValueOnce([[{
      owner_id: 1,
      is_available: 1,
    }]])

    const response = await request(app)
      .post('/')
      .send({
        userId: 1,
        roomId: 1,
        checkInDate: '2025-08-01',
        checkOutDate: '2025-08-05',
        guestsCount: 2,
        totalPrice: 5000,
      })

    expect(response.status).toBe(403)
    expect(response.body.message).toBe('You cannot book your own room.')
  })
})