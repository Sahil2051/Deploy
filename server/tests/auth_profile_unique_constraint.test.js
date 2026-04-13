const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

const db = require('../src/db')
const authRouter = require('../src/routes.auth')

describe('Database Verification - Unique Constraint (TC53)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(authRouter)
    jest.clearAllMocks()
  })

  test('TC53: Profile update returns 409 when DB unique constraint is violated', async () => {
    const duplicateError = new Error('Duplicate entry')
    duplicateError.code = '23505'

    db.execute.mockRejectedValueOnce(duplicateError)

    const response = await request(app)
      .put('/profile')
      .send({
        id: 1,
        fullName: 'Sahil Sedhai',
        email: 'duplicate@example.com',
        phoneNumber: '9800000000'
      })

    expect(response.status).toBe(409)
    expect(response.body.message).toBe('Email or phone already in use.')
  })
})