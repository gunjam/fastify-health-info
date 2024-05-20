'use strict'

const { test } = require('node:test')
const { join } = require('node:path')
const { equal, rejects } = require('node:assert/strict')
const { promisify } = require('node:util')
const exec = promisify(require('node:child_process').exec)
const fastify = require('fastify')
const plugin = require('../index.js')

test('GETs http://localhost:8080', async (t) => {
  const app = fastify()
  app.register(plugin)

  await app.listen({ port: 8080 })
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  const { stdout } = await exec(`node ${path}`)

  equal(stdout, 'healthy\n')
})

test('GETs http://localhost:${PORT}', async (t) => {
  const app = fastify()
  app.register(plugin)

  const url = await app.listen()
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  process.env.PORT = new URL(url).port
  const { stdout } = await exec(`node ${path}`)

  equal(stdout, 'healthy\n')
})

test('GETs ${url}', async (t) => {
  const app = fastify()
  app.register(plugin)

  const url = await app.listen()
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  const { stdout } = await exec(`node ${path} ${url}/health`)

  equal(stdout, 'healthy\n')
})

test('GETs ${url}', async (t) => {
  const app = fastify()
  app.register(plugin)

  const url = await app.listen()
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  const { stdout } = await exec(`node ${path} ${url}/health`)

  equal(stdout, 'healthy\n')
})

test('Logs error - 500', async (t) => {
  const app = fastify()
  app.get('/health', (_, reply) => {
    reply.status(500).send('error')
  })

  const url = await app.listen()
  t.after(() => app.close())

  const path = join(__dirname, '../healthcheck.js')
  await rejects(async () => exec(`node ${path} ${url}/health`), {
    name: 'Error',
    stderr: 'Response not OK, status: 500\n'
  })
})

test('Logs error - no response', async () => {
  const path = join(__dirname, '../healthcheck.js')
  await rejects(async () => exec(`node ${path} http://test/test`), {
    name: 'Error',
    stderr: 'fetch failed\n'
  })
})
