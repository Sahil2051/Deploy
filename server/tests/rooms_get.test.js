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

describe('Rooms Controller - GET (TC09-TC12)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(roomsRouter)
    jest.clearAllMocks()
  })

  test('TC09: Get all available rooms', async () => {
    db.execute.mockResolvedValueOnce([[{
      id: 1,
      title: 'Room A',
      photos: '["/uploads/a.jpg"]',
    }, {
      id: 2,
      title: 'Room B',
      photos: '["/uploads/b.jpg","/uploads/c.jpg"]',
    }]])

    const response = await request(app).get('/')

    expect(response.status).toBe(200)
    expect(response.body.rooms).toHaveLength(2)
    expect(response.body.rooms[0].photos).toEqual(['/uploads/a.jpg'])
    expect(response.body.rooms[1].photos).toEqual(['/uploads/b.jpg', '/uploads/c.jpg'])
  })

  test('TC10: Get my rooms with valid ownerId query param', async () => {
    db.execute.mockResolvedValueOnce([[{
      id: 1,
      owner_id: 7,
      title: 'Room A',
      photos: '["/uploads/a.jpg"]',
    }]])

    const response = await request(app).get('/my-rooms?ownerId=7')

    expect(response.status).toBe(200)
    expect(response.body.rooms).toHaveLength(1)
  })

  test('TC11: Get my rooms without ownerId', async () => {
    const response = await request(app).get('/my-rooms')

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Owner ID required.')
  })

  test('TC12: Get nearby rooms without lat/lng params', async () => {
    const response = await request(app).get('/nearby')

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Latitude and Longitude are required.')
  })
})