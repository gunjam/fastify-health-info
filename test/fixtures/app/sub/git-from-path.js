'use strict'

const { join } = require('node:path')
const fastify = require('fastify')
const plugin = require('../../../../index.js')

async function run() {
  try {
    const app = fastify({ logger: false })
    app.register(plugin, {
      commitDetailsFrom: join(__dirname, '../../test-git-details.json')
    })

    const res = await app.inject('/info')
    process.stdout.write(res.payload)
  } catch (error) {
    process.stdout.write(error.message)
  }
}

run()
