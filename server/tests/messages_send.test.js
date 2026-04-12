const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

const db = require('../src/db')
const messagesRouter = require('../src/routes.messages')

describe('Messages Send Controller (TC41-TC44)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(messagesRouter)
    jest.clearAllMocks()
  })

  test('TC41: Send message missing required fields returns 400', async () => {
    const response = await request(app)
      .post('/send')
      .send({ userId: 1, content: 'Hi' })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Receiver and content are required')
  })

  test('TC42: Send message to non-existent receiver returns 404', async () => {
    db.execute.mockResolvedValueOnce([[]])

    const response = await request(app)
      .post('/send')
      .send({ userId: 1, receiverId: 99, content: 'Hello' })

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Receiver not found')
  })

  test('TC43: Send message successfully returns 201', async () => {
    db.execute
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([{ insertId: 10 }])
      .mockResolvedValueOnce([{}])

    const response = await request(app)
      .post('/send')
      .send({ userId: 1, receiverId: 2, content: 'Hello there' })

    expect(response.status).toBe(201)
    expect(response.body.message).toBe('Message sent successfully')
    expect(response.body.messageId).toBe(10)
  })

  test('TC44: Send message DB error returns 500', async () => {
    db.execute.mockRejectedValueOnce(new Error('DB failure'))

    const response = await request(app)
      .post('/send')
      .send({ userId: 1, receiverId: 2, content: 'Hello there' })

    expect(response.status).toBe(500)
    expect(response.body.message).toBe('Failed to send message')
  })
})