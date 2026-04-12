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

describe('Rooms Inquiry Controller (TC45-TC48)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(roomsRouter)
    jest.clearAllMocks()
  })

  test('TC45: Send inquiry with missing fields returns 400', async () => {
    const response = await request(app)
      .post('/1/inquire')
      .send({ senderName: 'Sahil', senderEmail: '' })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Name, email, and message are required.')
  })

  test('TC46: Send inquiry success returns 201', async () => {
    db.execute.mockResolvedValueOnce([{}])

    const response = await request(app)
      .post('/1/inquire')
      .send({
        senderName: 'Sahil',
        senderEmail: 'sahil@example.com',
        senderPhone: '9800000000',
        message: 'Is this room available?'
      })

    expect(response.status).toBe(201)
    expect(response.body.message).toBe('Inquiry sent successfully.')
  })

  test('TC47: Sent inquiries with unknown user returns 404', async () => {
    db.execute.mockResolvedValueOnce([[]])

    const response = await request(app).get('/sent-inquiries/99')

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('User not found.')
  })

  test('TC48: My inquiries returns inquiries list', async () => {
    db.execute.mockResolvedValueOnce([[{ id: 1, room_title: 'Room A' }]])

    const response = await request(app).get('/my-inquiries/2')

    expect(response.status).toBe(200)
    expect(response.body.inquiries).toHaveLength(1)
  })
})