#!/usr/bin/env node

'use strict'

const { writeCommitDetailsJSON } = require('./index.js')

const filePath = process.argv.at(2)
writeCommitDetailsJSON(filePath)
  .then((path) => {
    console.log(`written to file ${path}`)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
