const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}))

const db = require('../src/db')
const bcrypt = require('bcryptjs')
const authRouter = require('../src/routes.auth')

describe('Auth Profile Update Controller (TC17-TC20)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(authRouter)
    jest.clearAllMocks()
  })

  test('TC17: Successful profile update without password change', async () => {
    db.execute.mockResolvedValueOnce([{ affectedRows: 1 }])

    const response = await request(app)
      .put('/profile')
      .send({
        id: 1,
        fullName: 'Sahil Sedhai',
        email: 'sahil@example.com',
        phoneNumber: '9800000000'
      })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Profile updated successfully.')
  })

  test('TC18: Profile update with new password', async () => {
    db.execute.mockResolvedValueOnce([{ affectedRows: 1 }])
    bcrypt.hash.mockResolvedValue('hashed-password')

    const response = await request(app)
      .put('/profile')
      .send({
        id: 1,
        fullName: 'Sahil Sedhai',
        email: 'sahil@example.com',
        phoneNumber: '9800000000',
        password: 'NewPassword123!'
      })

    expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 10)
    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Profile updated successfully.')
  })

  test('TC19: Profile update with missing fields (no email)', async () => {
    const response = await request(app)
      .put('/profile')
      .send({
        id: 1,
        fullName: 'Sahil Sedhai',
        phoneNumber: '9800000000'
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('ID, name, email, and phone are required.')
  })

  test('TC20: Profile update for non-existent user', async () => {
    db.execute.mockResolvedValueOnce([{ affectedRows: 0 }])

    const response = await request(app)
      .put('/profile')
      .send({
        id: 99,
        fullName: 'Sahil Sedhai',
        email: 'sahil@example.com',
        phoneNumber: '9800000000'
      })

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('User not found.')
  })
})