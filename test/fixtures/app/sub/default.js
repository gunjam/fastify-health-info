'use strict'

const plugin = require('../../../../index.js')
const fastify = require('fastify')

async function run() {
  try {
    const app = fastify({ logger: false })
    app.register(plugin)
    const res = await app.inject('/info')
    process.stdout.write(res.payload)
  } catch (error) {
    process.stdout.write(error.message)
  }
}

run()
