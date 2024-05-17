'use strict'

const { test } = require('node:test')
const { join } = require('node:path')
const { readFile, rm, mkdtemp } = require('node:fs/promises')
const { ok, equal, match, rejects } = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { promisify } = require('node:util')
const exec = promisify(require('node:child_process').exec)

test('cli writes file', async (t) => {
  // Create temp dir to store produced commit details json file
  const tmp = await mkdtemp(join(tmpdir(), 'health'))
  t.after(async () => rm(tmp, { recursive: true }))

  const path = join(__dirname, '../cli.js')
  const outputFile = join(tmp, `${Date.now()}.json`)
  const { stdout } = await exec(`node ${path} ${outputFile}`)
  const json = await readFile(outputFile, 'utf-8').then((f) => JSON.parse(f))

  ok(Object.hasOwn(json, 'branch'))
  ok(Object.hasOwn(json, 'commit'))
  ok(Object.hasOwn(json.commit, 'id'))
  ok(Object.hasOwn(json.commit, 'time'))
  match(json.created, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/)
  equal(stdout, `written to file ${outputFile}\n`)
})

test('cli logs error - bad path', async () => {
  const path = join(__dirname, '../cli.js')
  await rejects(() => exec(`node ${path} fail`), {
    stderr: 'file name must have a .json extension\n',
    code: 1
  })
})

test('cli logs error - write fail', async () => {
  const path = join(__dirname, '../cli.js')

  // Can't write to root
  await rejects(() => exec(`node ${path} /egg.json`), {
    stderr: 'failed to write commit details to /egg.json\n',
    code: 1
  })
})
