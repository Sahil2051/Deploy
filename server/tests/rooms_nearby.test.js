const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

jest.mock('multer', () => {
  const multer = jest.fn(() => ({
    array: () => (req, _res, next) => next(),
  }))

  multer.diskStorage = jest.fn(() => ({}))
  return multer
})

const db = require('../src/db')
const roomsRouter = require('../src/routes.rooms')

describe('Rooms Geolocation Controller (TC33-TC36)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(roomsRouter)
    jest.clearAllMocks()
  })

  test('TC33: Nearby rooms without lat/lng returns 400', async () => {
    const response = await request(app).get('/nearby')
    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Latitude and Longitude are required.')
  })

  test('TC34: Nearby rooms without userId returns 401', async () => {
    const response = await request(app).get('/nearby?lat=27.7&lng=85.3')
    expect(response.status).toBe(401)
    expect(response.body.message).toBe('User ID required to verify premium status.')
  })

  test('TC35: Non-premium user cannot access nearby rooms', async () => {
    db.execute.mockResolvedValueOnce([[{ is_premium: 0, premium_until: null }]])

    const response = await request(app).get('/nearby?lat=27.7&lng=85.3&userId=1')

    expect(response.status).toBe(403)
    expect(response.body.message).toBe('Premium subscription required for this feature.')
  })

  test('TC36: Premium user gets nearby rooms', async () => {
    db.execute
      .mockResolvedValueOnce([[{ is_premium: 1, premium_until: null }]])
      .mockResolvedValueOnce([[{ id: 1, title: 'Near Room', photos: '["/uploads/near.jpg"]', distance: 0.4 }]])

    const response = await request(app).get('/nearby?lat=27.7&lng=85.3&userId=1')

    expect(response.status).toBe(200)
    expect(response.body.rooms).toHaveLength(1)
    expect(response.body.rooms[0].photos).toEqual(['/uploads/near.jpg'])
  })
})