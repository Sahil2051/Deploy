describe('Database Verification - Pool Configuration (TC54)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test('TC54: db.js creates MySQL pool using env values and safe defaults', () => {
    process.env.MYSQL_HOST = 'localhost'
    process.env.MYSQL_USER = 'root'
    process.env.MYSQL_DB = 'shelter_auth_test'
    process.env.MYSQL_PORT = '3307'
    process.env.MYSQL_PASSWORD = 'secret'

    const createPoolMock = jest.fn(() => ({ execute: jest.fn() }))

    jest.doMock('mysql2/promise', () => ({
      createPool: createPoolMock,
    }))

    jest.isolateModules(() => {
      require('../src/db')
    })

    expect(createPoolMock).toHaveBeenCalledTimes(1)
    expect(createPoolMock).toHaveBeenCalledWith({
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: 'secret',
      database: 'shelter_auth_test',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  })
})