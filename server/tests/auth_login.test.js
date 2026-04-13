const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}))

const db = require('../src/db')
const bcrypt = require('bcryptjs')
const authRouter = require('../src/routes.auth')

describe('Auth Login Controller (TC01-TC04)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(authRouter)
    jest.clearAllMocks()
  })

  test('TC01: Valid login with correct email and password', async () => {
    db.execute
      .mockResolvedValueOnce([[{
        id: 1,
        full_name: 'Sahil Sedhai',
        email: 'sahil@example.com',
        phone_number: '9800000000',
        password_hash: 'hashed-password',
        is_verified: 1,
        is_premium: 0,
        premium_until: null,
        premium_plan: null,
      }]])

    bcrypt.compare.mockResolvedValue(true)

    const response = await request(app)
      .post('/login')
      .send({ credential: 'sahil@example.com', password: 'Password123!' })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Login successful.')
    expect(response.body.user).toMatchObject({
      id: 1,
      fullName: 'Sahil Sedhai',
      email: 'sahil@example.com',
      phoneNumber: '9800000000',
      isVerified: true,
      isPremium: false,
      premiumUntil: null,
      premiumPlan: null,
    })
  })

  test('TC02: Login with wrong password', async () => {
    db.execute.mockResolvedValueOnce([[{
      id: 1,
      full_name: 'Sahil Sedhai',
      email: 'sahil@example.com',
      phone_number: '9800000000',
      password_hash: 'hashed-password',
      is_premium: 0,
      premium_until: null,
      premium_plan: null,
    }]])

    bcrypt.compare.mockResolvedValue(false)

    const response = await request(app)
      .post('/login')
      .send({ credential: 'sahil@example.com', password: 'WrongPassword' })

    expect(response.status).toBe(401)
    expect(response.body.message).toBe('Invalid credentials.')
  })

  test('TC03: Login with unregistered email', async () => {
    db.execute.mockResolvedValueOnce([[]])

    const response = await request(app)
      .post('/login')
      .send({ credential: 'missing@example.com', password: 'Password123!' })

    expect(response.status).toBe(401)
    expect(response.body.message).toBe('Invalid credentials.')
  })

  test('TC04: Login with empty fields', async () => {
    const response = await request(app)
      .post('/login')
      .send({})

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Credential and password required.')
  })
})