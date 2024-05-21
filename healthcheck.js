#!/usr/bin/env node

'use strict'

const { join } = require('node:path')
const { parseArgs } = require('node:util')

async function healthCheck() {
  try {
    const { values: vars } = parseArgs({
      options: {
        'port-var': {
          type: 'string',
          default: 'PORT'
        },
        'path-var': {
          type: 'string',
          default: 'HEALTH_PATH'
        },
        'base-var': {
          type: 'string',
          default: 'HEALTH_BASE_PATH'
        }
      }
    })

    const port = process.env[vars['port-var']] ?? 8080
    const base = process.env[vars['base-var']] ?? '/'
    const path = process.env[vars['path-var']] ?? '/health'

    const url = new URL('http://localhost')
    url.port = port
    url.pathname = join(base, path)

    const res = await fetch(url)

    if (!res.ok) {
      throw new Error(`Response not OK, status: ${res.status}`)
    }

    process.stdout.write('healthy\n')
    process.exit(0)
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  }
}

healthCheck()
