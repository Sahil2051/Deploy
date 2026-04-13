describe('Database Verification - Pool Configuration (TC54)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.DATABASE_URL
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test('TC54: db.js creates PostgreSQL pool using PG_* / MYSQL_* fallback env and safe defaults', () => {
    process.env.PG_HOST = 'localhost'
    process.env.PG_USER = 'postgres'
    process.env.PG_DATABASE = 'shelter_auth_test'
    process.env.PG_PORT = '5433'
    process.env.PG_PASSWORD = 'secret'

    const PoolMock = jest.fn(() => ({}))

    jest.doMock('pg', () => ({
      Pool: PoolMock,
    }))

    jest.isolateModules(() => {
      require('../src/db')
    })

    expect(PoolMock).toHaveBeenCalledTimes(1)
    expect(PoolMock).toHaveBeenCalledWith({
      host: 'localhost',
      port: 5433,
      user: 'postgres',
      password: 'secret',
      database: 'shelter_auth_test',
      max: 10,
    })
  })
})
