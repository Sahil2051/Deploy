const express = require('express')
const request = require('supertest')

jest.mock('../src/db', () => ({
  execute: jest.fn(),
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}))

const mockSendMail = jest.fn().mockResolvedValue({})

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}))

process.env.SMTP_HOST = 'smtp.test.local'
process.env.SMTP_USER = 'tester@test.local'
process.env.SMTP_PASS = 'app-password'

const db = require('../src/db')
const bcrypt = require('bcryptjs')
const authRouter = require('../src/routes.auth')

describe('Auth Signup Controller (TC05-TC10)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(authRouter)
    jest.clearAllMocks()
  })

  test('TC05: Email signup sends verification code', async () => {
    db.execute.mockResolvedValueOnce([[]])
    bcrypt.hash.mockResolvedValue('hashed-password')

    const response = await request(app)
      .post('/signup/request-otp')
      .send({
        fullName: 'Sahil Sedhai',
        age: 20,
        address: 'Kathmandu',
        email: 'sahil@example.com',
        password: 'Password123!'
      })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Verification code sent to your email.')
    expect(mockSendMail).toHaveBeenCalled()
  })

  test('TC06: Email signup verifies code and creates account', async () => {
    db.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }])

    bcrypt.hash.mockResolvedValue('hashed-password')

    await request(app)
      .post('/signup/request-otp')
      .send({
        fullName: 'Sahil Sedhai',
        age: 20,
        address: 'Kathmandu',
        email: 'sahil@example.com',
        password: 'Password123!'
      })

    const sentMailArgs = mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1][0]
    const otpFromMail = String(sentMailArgs.text || '').match(/verification code is: (\d{6})/i)?.[1]

    const verifyResponse = await request(app)
      .post('/signup/verify-otp')
      .send({
        email: 'sahil@example.com',
        otp: otpFromMail,
      })

    expect(verifyResponse.status).toBe(200)
    expect(verifyResponse.body.message).toBe('Signup successful.')
  })

  test('TC07: Phone signup still works without email OTP', async () => {
    db.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }])

    bcrypt.hash.mockResolvedValue('hashed-password')

    const response = await request(app)
      .post('/signup')
      .send({
        fullName: 'Sahil Sedhai',
        age: 20,
        address: 'Kathmandu',
        phoneNumber: '9800000000',
        password: 'Password123!'
      })

    expect(response.status).toBe(201)
    expect(response.body.message).toBe('Signup successful.')
  })

  test('TC08: Signup with missing contact fields', async () => {
    const response = await request(app)
      .post('/signup')
      .send({
        fullName: 'Sahil Sedhai',
        age: 20,
        address: 'Kathmandu',
        password: 'Password123!'
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Provide either a valid email address or a 10-digit Nepal phone number.')
  })

  test('TC09: Signup with age below 16', async () => {
    const response = await request(app)
      .post('/signup/request-otp')
      .send({
        fullName: 'Sahil Sedhai',
        age: 14,
        address: 'Kathmandu',
        email: 'sahil@example.com',
        password: 'Password123!'
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Age must be 16 or above.')
  })

  test('TC10: Direct email signup is rejected until OTP is verified', async () => {
    const response = await request(app)
      .post('/signup')
      .send({
        fullName: 'Sahil Sedhai',
        age: 20,
        address: 'Kathmandu',
        email: 'sahil@example.com',
        password: 'Password123!'
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Email signups must use verification code first.')
  })

})