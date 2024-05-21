'use strict'

const { test, beforeEach } = require('node:test')
const { join } = require('node:path')
const { equal, rejects } = require('node:assert/strict')
const { promisify } = require('node:util')
const exec = promisify(require('node:child_process').exec)
const fastify = require('fastify')
const plugin = require('../index.js')

beforeEach(() => {
  // biome-ignore lint/performance/noDelete: setting to undefined will convert to string value
  delete process.env.PORT
  // biome-ignore lint/performance/noDelete: setting to undefined will convert to string value
  delete process.env.HEALTH_PATH
  // biome-ignore lint/performance/noDelete: setting to undefined will convert to string value
  delete process.env.HEALTH_BASE_PATH
})

test('GET http://localhost:8080/health (default, no args)', async (t) => {
  const app = fastify()
  app.register(plugin)

  await app.listen({ port: 8080 })
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  const { stdout } = await exec(`node ${path}`)

  equal(stdout, 'healthy\n')
})

test('GET http://localhost:${PORT}/health', async (t) => {
  const app = fastify()
  app.register(plugin)

  const url = await app.listen()
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  process.env.PORT = new URL(url).port
  const { stdout } = await exec(`node ${path}`)

  equal(stdout, 'healthy\n')
})

test('GET http://localhost:${APP_PORT}/health (--port-var=APP_PORT)', async (t) => {
  const app = fastify()
  app.register(plugin)

  const url = await app.listen()
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  process.env.APP_PORT = new URL(url).port
  const { stdout } = await exec(`node ${path} --port-var=APP_PORT`)

  equal(stdout, 'healthy\n')
})

test('GET http://localhost:${PORT}/${HEALTH_PATH}', async (t) => {
  const app = fastify()
  app.register(plugin, { prefix: '/checks' })

  const url = await app.listen()
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  process.env.PORT = new URL(url).port
  process.env.HEALTH_PATH = '/checks/health'
  const { stdout } = await exec(`node ${path}`)

  equal(stdout, 'healthy\n')
})

test('GET http://localhost:${PORT}/${CUSTOM_PATH} (--path-var=CUSTOM_PATH)', async (t) => {
  const app = fastify()
  app.register(plugin, { prefix: '/checks' })

  const url = await app.listen()
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  process.env.PORT = new URL(url).port
  process.env.CUSTOM_PATH = '/checks/health'
  const { stdout } = await exec(`node ${path} --path-var=CUSTOM_PATH`)

  equal(stdout, 'healthy\n')
})

test('GET http://localhost:${PORT}/${HEALTH_BASE_PATH}/${HEALTH_PATH}', async (t) => {
  const app = fastify()
  app.register(
    async () => {
      app.register(plugin, { prefix: '/checks' })
    },
    { prefix: '/context-path' }
  )

  const url = await app.listen()
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  process.env.PORT = new URL(url).port
  process.env.HEALTH_PATH = '/checks/health'
  process.env.HEALTH_BASE_PATH = '/context-path'
  const { stdout } = await exec(`node ${path}`)

  equal(stdout, 'healthy\n')
})

test('GET http://localhost:${PORT}/${CONTEXT_PATH}/${HEALTH_PATH} (--base-var=CONTEXT_PATH)', async (t) => {
  const app = fastify()
  app.register(
    async () => {
      app.register(plugin, { prefix: '/checks' })
    },
    { prefix: '/context-path' }
  )

  const url = await app.listen()
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  process.env.PORT = new URL(url).port
  process.env.HEALTH_PATH = '/checks/health'
  process.env.CONTEXT_PATH = '/context-path'
  const { stdout } = await exec(`node ${path} --base-var=CONTEXT_PATH`)

  equal(stdout, 'healthy\n')
})

test('Logs error - 500', async (t) => {
  const app = fastify()
  app.get('/health', (_, reply) => {
    reply.status(500).send('error')
  })

  const url = await app.listen()
  t.after(() => app.close())

  process.env.PORT = new URL(url).port
  const path = join(__dirname, '../healthcheck.js')
  await rejects(async () => exec(`node ${path}`), {
    name: 'Error',
    stderr: 'Response not OK, status: 500\n'
  })
})

test('Logs error - no response', async () => {
  const path = join(__dirname, '../healthcheck.js')
  await rejects(async () => exec(`node ${path}`), {
    name: 'Error',
    stderr: 'fetch failed\n'
  })
})
