'use strict'

const { findPackageJSON } = require('node:module')
const { writeFile, readFile } = require('node:fs/promises')
const { promisify } = require('node:util')
const exec = promisify(require('node:child_process').exec)
const fp = require('fastify-plugin')
const healthSchema = require('./schemas/health.json')
const infoSchema = require('./schemas/info.json')
const metricsSchema = require('./schemas/metrics.json')
const packageInfo = require('./package.json')

// Gitlab CI env vars
// see: https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
const GL_BRANCH = process.env.CI_COMMIT_BRANCH ?? false
const GL_MR_BRANCH = process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME ?? false
const GL_REF_NAME = process.env.CI_COMMIT_REF_NAME ?? false

// Github Actions env vars
const GH_BRANCH = process.env.GITHUB_HEAD_REF?.replace('refs/heads/', '')

async function getCommitID() {
  const { stdout: id } = await exec('git rev-parse HEAD')
  return id.trim()
}

async function getCommitTime() {
  const { stdout: time } = await exec('git log -n 1 --pretty="format:%cI"')
  return new Date(time.trim()).toISOString()
}

async function getBranch() {
  try {
    const { stdout: refs } = await exec('git symbolic-ref HEAD')
    return refs.trim().match(/refs\/heads\/(.*)/)?.[1]
  } catch {
    // No symbolic ref found, probably in detached state
    return 'detached HEAD'
  }
}

async function getTag() {
  try {
    const { stdout: tag } = await exec('git describe --tags')
    return tag.trim()
  } catch {
    // No tags found
    return undefined
  }
}

async function getCommitDetails() {
  try {
    const [tag, id, time, branch] = await Promise.all([
      getTag(),
      getCommitID(),
      getCommitTime(),
      // The current branch name is not available to git in Github Actions or
      // Gitlab CI, we check env vars before trying to call git cli.
      // If there is no GL_BRANCH or GL_MR_BRANCH but there is a GL_REF_NAME we
      // are probably on a tagged commit on main, so use main
      GH_BRANCH ||
        GL_BRANCH ||
        GL_MR_BRANCH ||
        (GL_REF_NAME ? 'main' : getBranch())
    ])

    const details = {
      branch,
      commit: { id, time }
    }

    if (tag) {
      details.tag = tag
    }

    return details
  } catch (error) {
    throw new Error('could not load commit details from git', { cause: error })
  }
}

async function getCommitDetailsFromFile(path) {
  try {
    const details = await readFile(path, 'utf8')
    return JSON.parse(details)
  } catch (error) {
    throw new Error(`could not load commit details from: ${path}`, {
      cause: error
    })
  }
}

async function writeCommitDetailsJSON(path = './.commit-details.json') {
  if (!path.endsWith('.json')) {
    throw new Error('file name must have a .json extension')
  }
  try {
    const commitDetails = await getCommitDetails()
    commitDetails.created = new Date().toISOString()
    const commitJSON = JSON.stringify(commitDetails, null, '  ')
    await writeFile(path, `${commitJSON}\n`, 'utf8')
    return path
  } catch (error) {
    throw new Error(`failed to write commit details to ${path}`, {
      cause: error
    })
  }
}

async function routes(app, opts) {
  const {
    disableHealth = false,
    disableInfo = false,
    disableMetrics = false
  } = opts

  // JSON data to serve from /info endpoint
  const info = {
    node: {
      version: process.versions.node
    }
  }

  // Load package.json information from parent application
  const packageDetails = findPackageJSON('..', __filename)

  if (packageDetails) {
    info.application = {
      name: packageDetails.name,
      description: packageDetails.description,
      version: packageDetails.version
    }
  } else {
    app.log.warn(
      'fastify-health-info: could not find package.json file, cannot add app data to /info'
    )
  }

  // Add git information to /info data, if available
  if (app.hasDecorator('commitDetails')) {
    info.application ??= {}
    info.application.version = app.commitDetails.tag ?? info.application.version
    info.git = {
      branch: app.commitDetails.branch,
      commit: app.commitDetails.commit
    }

    if (app.commitDetails.created) {
      info.build = { time: app.commitDetails.created }
    }
  }

  if (!disableInfo) {
    app.get('/info', { schema: infoSchema }, (_request, reply) => {
      reply.send(info)
    })
  }

  if (!disableHealth) {
    app.get('/health', { schema: healthSchema }, (_request, reply) => {
      reply.send({ status: 'UP' })
    })
  }

  if (!disableMetrics) {
    app.get('/metrics', { schema: metricsSchema }, (_request, reply) => {
      reply.send({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      })
    })
  }
}

/**
 * Serve health, info and metics endpoints on your fastify app
 * @param {import('fastify').FastifyInstance} app
 * @param {object} opts plugin options
 * @param {string} [opts.commitDetailsFrom=undefined] 'git' to load fresh commit info on start up, or path to pre-built git details JSON file
 * @param {boolean} [opts.disableHealth=false] disable the /health endpoint
 * @param {boolean} [opts.disableInfo=false] disable the /info endpoint
 * @param {boolean} [opts.disableMetrics=false] disable the /metrics endpoint
 * @param {string} [opts.prefix=false] path prefix for endpoints
 */
async function plugin(app, opts) {
  const { commitDetailsFrom } = opts

  if (commitDetailsFrom && typeof commitDetailsFrom !== 'string') {
    throw new TypeError(
      `opts.commitDetailsFrom must be "git" or the path to the commit details JSON file, got: ${commitDetailsFrom}`
    )
  }

  // Load some git commit details from git or a provided JSON path
  if (commitDetailsFrom) {
    const commitDetails =
      commitDetailsFrom === 'git'
        ? await getCommitDetails()
        : await getCommitDetailsFromFile(commitDetailsFrom)

    app.decorate('commitDetails', commitDetails)
  }

  // Mount routes
  app.register(routes, opts)
}

module.exports = fp(plugin, {
  name: packageInfo.name,
  fastify: '5.x'
})

module.exports.plugin = plugin
module.exports.writeCommitDetailsJSON = writeCommitDetailsJSON
