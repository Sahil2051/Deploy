const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

const db = require('../src/db')
const bookingsRouter = require('../src/routes.bookings')

describe('Bookings Management Controller (TC49-TC52)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(bookingsRouter)
    jest.clearAllMocks()
  })

  test('TC49: Update booking status with invalid status returns 400', async () => {
    const response = await request(app)
      .patch('/1/status')
      .send({ status: 'pending', userId: 1 })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Invalid status.')
  })

  test('TC50: Update booking status not found returns 404', async () => {
    db.execute.mockResolvedValueOnce([{ affectedRows: 0 }])

    const response = await request(app)
      .patch('/999/status')
      .send({ status: 'approved', userId: 2 })

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Booking not found.')
  })

  test('TC51: Update booking status success returns 200', async () => {
    db.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{}])

    const response = await request(app)
      .patch('/1/status')
      .send({ status: 'approved', userId: 2 })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Booking approved successfully.')
  })

  test('TC52: Get user bookings returns list', async () => {
    db.execute.mockResolvedValueOnce([[{ id: 1, room_title: 'Room A' }]])

    const response = await request(app).get('/user/1')

    expect(response.status).toBe(200)
    expect(response.body.bookings).toHaveLength(1)
  })
})