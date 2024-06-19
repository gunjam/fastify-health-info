'use strict'

const { ok, equal, deepEqual, rejects } = require('node:assert/strict')
const { test, beforeEach } = require('node:test')
const { promisify } = require('node:util')
const { join } = require('node:path')
const exec = promisify(require('node:child_process').exec)
const proxyquire = require('proxyquire')
const fastify = require('fastify')
const testDetails = require('./fixtures/test-git-details.json')

function mockExec(command, cb) {
  switch (command) {
    case 'git rev-parse HEAD':
      cb(null, { stdout: '8896a0c4cb68614d499c0093c742d2e0c0074bf7' })
      break
    case 'git log -n 1 --pretty="format:%cI"':
      cb(null, { stdout: '2023-08-24T11:28:44+01:00' })
      break
    case 'git symbolic-ref HEAD':
      cb(null, { stdout: 'refs/heads/afpc3687' })
      break
    case 'git describe --tags':
      cb(null, { stdout: '1.10.1' })
      break
    default:
      cb(null, { stdout: '' })
  }
}

beforeEach(() => {
  // biome-ignore lint/performance/noDelete: setting to undefined will convert to string value
  delete process.env.CI_COMMIT_BRANCH
  // biome-ignore lint/performance/noDelete: setting to undefined will convert to string value
  delete process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME
  // biome-ignore lint/performance/noDelete: setting to undefined will convert to string value
  delete process.env.CI_COMMIT_REF_NAME
  // biome-ignore lint/performance/noDelete: setting to undefined will convert to string value
  delete process.env.GITHUB_HEAD_REF
})

test('does not decorate fastify with commitDetails if `commitDetailsFrom` not set', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin)

  equal(Object.hasOwn(app, 'commitDetails'), false)
})

test('decorates fastify instance with commitDetails from git', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { commitDetailsFrom: 'git' })

  ok(Object.hasOwn(app, 'commitDetails'))
  deepEqual(app.commitDetails, {
    tag: '1.10.1',
    branch: 'afpc3687',
    commit: {
      id: '8896a0c4cb68614d499c0093c742d2e0c0074bf7',
      time: '2023-08-24T10:28:44.000Z'
    }
  })
})

test('commitDetails takes branch name from GITHUB_HEAD_REF env var if available', async (t) => {
  process.env.GITHUB_HEAD_REF = 'refs/heads/branch-1'

  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { commitDetailsFrom: 'git' })

  ok(Object.hasOwn(app, 'commitDetails'))
  deepEqual(app.commitDetails, {
    tag: '1.10.1',
    branch: 'branch-1',
    commit: {
      id: '8896a0c4cb68614d499c0093c742d2e0c0074bf7',
      time: '2023-08-24T10:28:44.000Z'
    }
  })
})

test('commitDetails takes branch name from CI_COMMIT_BRANCH env var if available', async (t) => {
  process.env.CI_COMMIT_BRANCH = 'branch-1'
  process.env.CI_COMMIT_REF_NAME = 'branch-2'

  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { commitDetailsFrom: 'git' })

  ok(Object.hasOwn(app, 'commitDetails'))
  deepEqual(app.commitDetails, {
    tag: '1.10.1',
    branch: 'branch-1',
    commit: {
      id: '8896a0c4cb68614d499c0093c742d2e0c0074bf7',
      time: '2023-08-24T10:28:44.000Z'
    }
  })
})

test('commitDetails takes branch name from CI_MERGE_REQUEST_SOURCE_BRANCH_NAME env var if available and CI_COMMIT_BRANCH is not', async (t) => {
  process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME = 'branch-2'

  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { commitDetailsFrom: 'git' })

  ok(Object.hasOwn(app, 'commitDetails'))
  deepEqual(app.commitDetails, {
    tag: '1.10.1',
    branch: 'branch-2',
    commit: {
      id: '8896a0c4cb68614d499c0093c742d2e0c0074bf7',
      time: '2023-08-24T10:28:44.000Z'
    }
  })
})

test('commitDetails set branch name to main if on GitLab but no branch name is found', async (t) => {
  process.env.CI_COMMIT_REF_NAME = '1.10.1'

  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { commitDetailsFrom: 'git' })

  ok(Object.hasOwn(app, 'commitDetails'))
  deepEqual(app.commitDetails, {
    tag: '1.10.1',
    branch: 'main',
    commit: {
      id: '8896a0c4cb68614d499c0093c742d2e0c0074bf7',
      time: '2023-08-24T10:28:44.000Z'
    }
  })
})

test('commitDetails set branch name to main if on GitLab but no branch name is found', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': {
      exec: (command, cb) => {
        if (command === 'git symbolic-ref HEAD') {
          cb(new Error(), { stderr: '8896a0c4cb68614d499c0093c742d2e0c0074bf7' })
        } else {
          mockExec(command, cb)
        }
      }
    }
  })

  const app = fastify()
  await app.register(plugin, { commitDetailsFrom: 'git' })

  ok(Object.hasOwn(app, 'commitDetails'))
  deepEqual(app.commitDetails, {
    tag: '1.10.1',
    branch: 'detached HEAD',
    commit: {
      id: '8896a0c4cb68614d499c0093c742d2e0c0074bf7',
      time: '2023-08-24T10:28:44.000Z'
    }
  })
})

test('commitDetails has no tag if no tag is found', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': {
      exec(command, cb) {
        if (command !== 'git describe --tags') {
          mockExec(command, cb)
          return
        }
        cb(new Error('bang'), { stderr: 'error' })
      }
    }
  })

  const app = fastify()
  await app.register(plugin, { commitDetailsFrom: 'git' })

  ok(Object.hasOwn(app, 'commitDetails'))
  deepEqual(app.commitDetails, {
    branch: 'afpc3687',
    commit: {
      id: '8896a0c4cb68614d499c0093c742d2e0c0074bf7',
      time: '2023-08-24T10:28:44.000Z'
    }
  })
})

test('decorates fastify instance with commitDetails from file', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, {
    commitDetailsFrom: join(__dirname, './fixtures/test-git-details.json')
  })

  ok(Object.hasOwn(app, 'commitDetails'))
  deepEqual(app.commitDetails, testDetails)
})

test('throw error if commitDetailsFrom is not a string', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await rejects(async () => app.register(plugin, { commitDetailsFrom: 10 }), {
    name: 'TypeError',
    message:
      'opts.commitDetailsFrom must be "git" or the path to the commit details JSON file, got: 10'
  })
})

test('throw error if commit details file load fails', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await rejects(
    async () =>
      app.register(plugin, {
        commitDetailsFrom: 'bad-path.json'
      }),
    {
      name: 'Error',
      message: 'could not load commit details from: bad-path.json'
    }
  )
})

test('throw error if loading commit details from git fails', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': {
      exec(_command, cb) {
        cb(new Error('bang!'))
      }
    }
  })

  const app = fastify()
  await rejects(
    async () =>
      app.register(plugin, {
        commitDetailsFrom: 'git'
      }),
    {
      name: 'Error',
      message: 'could not load commit details from git'
    }
  )
})

test('/health is loaded', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin)
  t.after(async () => app.close())

  const res = await app.inject('/health')
  equal(res.statusCode, 200)
  deepEqual(res.json(), {
    status: 'UP'
  })
})

test('/health is loaded on prefix', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { prefix: '/prefix' })
  t.after(async () => app.close())

  const res = await app.inject('/prefix/health')
  equal(res.statusCode, 200)
  deepEqual(res.json(), {
    status: 'UP'
  })
})

test('/health is disabled', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { disableHealth: true })
  t.after(async () => app.close())

  const res = await app.inject('/health')
  equal(res.statusCode, 404)
})

test('/metrics is loaded', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const cpuMock = {
    system: 55,
    user: 45
  }

  const memoryMock = {
    arrayBuffers: 5_000,
    external: 4_000,
    heapTotal: 3_000,
    heapUsed: 2_000,
    rss: 1_000
  }

  const uptimeMock = 200

  t.mock.method(process, 'cpuUsage', () => cpuMock)
  t.mock.method(process, 'memoryUsage', () => memoryMock)
  t.mock.method(process, 'uptime', () => uptimeMock)

  const app = fastify()
  t.after(async () => app.close())

  app.register(plugin)
  const res = await app.inject('/metrics')

  equal(res.statusCode, 200)
  deepEqual(res.json(), {
    cpu: cpuMock,
    memory: memoryMock,
    uptime: uptimeMock
  })
})

test('/metrics is loaded on prefix', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { prefix: '/prefix' })
  t.after(async () => app.close())

  const res = await app.inject('/prefix/metrics')
  equal(res.statusCode, 200)
})

test('/metrics is disabled', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { disableMetrics: true })
  t.after(async () => app.close())

  const res = await app.inject('/metrics')
  equal(res.statusCode, 404)
})

test('/info is loaded', async () => {
  // Run in separate process so it detects the test package.json of its
  // parent app
  const path = join(__dirname, './fixtures/app/sub/default.js')
  const { stdout } = await exec(`node ${path}`)

  deepEqual(JSON.parse(stdout), {
    application: {
      name: 'test-app',
      description: 'My test app',
      version: '0.1.0'
    },
    node: {
      version: process.versions.node
    }
  })
})

test('/info is loaded with git details from JSON', async () => {
  // Run in separate process so it detects the test package.json of its
  // parent app
  const path = join(__dirname, './fixtures/app/sub/git-from-path.js')
  const { stdout } = await exec(`node ${path}`)

  deepEqual(JSON.parse(stdout), {
    application: {
      name: 'test-app',
      description: 'My test app',
      version: '1.0.0'
    },
    node: {
      version: process.versions.node
    },
    git: {
      branch: 'branch',
      commit: {
        id: '9ce898e',
        time: '2023-08-09T15:50:53+01:00'
      }
    },
    build: {
      time: '2024-04-29T15:28:22.930Z'
    }
  })
})

test('/info is loaded on prefix', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { prefix: '/prefix' })
  t.after(async () => app.close())

  const res = await app.inject('/prefix/info')
  equal(res.statusCode, 200)
})

test('/info is disabled', async (t) => {
  const plugin = proxyquire('../index.js', {
    'node:child_process': { exec: mockExec }
  })

  const app = fastify()
  await app.register(plugin, { disableInfo: true })
  t.after(async () => app.close())

  const res = await app.inject('/info')
  equal(res.statusCode, 404)
})
