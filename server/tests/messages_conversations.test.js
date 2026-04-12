const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

const db = require('../src/db')
const messagesRouter = require('../src/routes.messages')

describe('Messages Conversations Controller (TC37-TC40)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(messagesRouter)
    jest.clearAllMocks()
  })

  test('TC37: Conversations without auth returns 401', async () => {
    const response = await request(app).get('/conversations')

    expect(response.status).toBe(401)
    expect(response.body.message).toBe('Authentication required')
  })

  test('TC38: Conversations with userId returns list', async () => {
    db.execute.mockResolvedValueOnce([[{ other_user_id: 2, other_user_name: 'Anju' }]])

    const response = await request(app).get('/conversations?userId=1')

    expect(response.status).toBe(200)
    expect(response.body.conversations).toHaveLength(1)
  })

  test('TC39: Unread count returns value', async () => {
    db.execute.mockResolvedValueOnce([[{ unread_count: 3 }]])

    const response = await request(app).get('/unread-count?userId=1')

    expect(response.status).toBe(200)
    expect(response.body.unreadCount).toBe(3)
  })

  test('TC40: Favorite toggle with invalid value returns 400', async () => {
    const response = await request(app)
      .patch('/conversation/2/favorite?userId=1')
      .send({ favorite: 'yes' })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('favorite must be boolean')
  })
})