#!/usr/bin/env node

'use strict'

const { PORT = 8080 } = process.env

async function healthCheck() {
  try {
    const url = process.argv[2] ?? `http://localhost:${PORT}/health`
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
