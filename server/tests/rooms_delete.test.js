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

describe('Rooms Controller - Delete (TC21-TC24)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(roomsRouter)
    jest.clearAllMocks()
  })

  test('TC21: Successful room deletion', async () => {
    db.execute.mockResolvedValueOnce([{ affectedRows: 1 }])

    const response = await request(app).delete('/1?ownerId=2')

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Room deleted successfully.')
  })

  test('TC22: Delete room that does not exist', async () => {
    db.execute.mockResolvedValueOnce([{ affectedRows: 0 }])

    const response = await request(app).delete('/1?ownerId=2')

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Room not found or you do not have permission to delete it.')
  })

  test('TC23: Delete room without roomId param', async () => {
    const response = await request(app).delete('/')

    expect(response.status).toBe(404)
  })

  test('TC24: DB error during deletion', async () => {
    db.execute.mockRejectedValueOnce(new Error('Database error'))

    const response = await request(app).delete('/1?ownerId=2')

    expect(response.status).toBe(500)
    expect(response.body.message).toBe('Failed to delete room.')
  })
})