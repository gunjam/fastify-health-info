# fastify-health-info

Health check and info endpoints for fastify, with support for build and git
details.

## Install

```
npm install fastify-health-info
```

## Usage

Register the plugin and your application will server `/info`, `/health`, and
`/metrics` endpoints.

```javascript
const fastify = require('fastify')()

fastify.register(require('fastify-health-info'))
```

They will give the following responses:

`GET /health`
```javascript
{
  "status": "UP"
}
```

`GET /info`
```javascript
{
  "node": {
    // the version of node your application is running
    "version": "20.0.0"
  },
  "application": {
    // the name of your app from package.json
    "name": "movies",
    // the description of your app from package.json
    "description": "movies database API",
    // the version of your app from package.json
    "version": "1.5.0"
  }
}
```

`GET /metrics`
```javascript
{
  "uptime": 200,
  "cpu": {
    "user": 45,
    "system": 55
  },
  "memory": {
    "rss": 1000,
    "heapTotal": 3000,
    "heapUsed": 2000,
    "external": 4000,
    "arrayBuffers": 5000
  }
}
```

### Disabling endpoints

You can turn off any of the endpoints you don't want with the following options:

```javascript
fastify.register(require('fastify-health-info'), {
  // Disable /health endpoint
  disableHealth: true,
  // Disable /info endpoint
  disableInfo: true,
  // Disable /metrics endpoint
  disableMetrics: true
})
```

### Context path

You can add a context path to the `fastify-health-info` endpoints by using the prefix option:

```javascript
// Will now serve on /checks/health, for example
fastify.register(require('fastify-health-info'), {
  prefix: '/checks'
})
```

### Git details

#### Commit details included in `/info`

You can able to reporting of some git commit information in the `/info` endpoint
by setting the `commitDetailsFrom` option:

```javascript
fastify.register(require('fastify-health-info'), {
  commitDetailsFrom: 'git'
})
```

A value of `git` will load commit information live from git on application startup. Alternatively you can load pre-built commit details from a file path, after first generating them using the `gitdetails` command line tool that comes with this pacakge. This is more useful where git will not be available and want details from build time.

```
npx gitdetails .git-details.json
```

```javascript
fastify.register(require('fastify-health-info'), {
  commitDetailsFrom: './.git-details.json'
})
```

The JSON response from `/info` will now contain some commit information:

```javascript
{
  "node": {
    "version": "20.0.0"
  },
  "application": {
    "name": "movies",
    "description": "movies database API",
    "version": "1.5.0"
  },
  "git": {
    "branch": "main",
    "commit": {
      "id":"12969afe5ff6b56ee47a4dd823a0c275dbe5fe66",
      "time":"2024-05-01T12:13:22.000Z"
    }
  },
  "build":{
    // Build time is only included when loading commit details from a built
    // git-details JSON file.
    "time":"2024-05-02T22:08:49.586Z"
  }
}
```

If HEAD is a tag commit, the application version will be the tagged version,
otherwise it will be the last tag with a commit shorthash:

```javascript
{
  ...
  "application": {
    // Tag commit at head
    "version": "1.5.0"
    // Commit not tagged
    "version": "1.5.0-g12969af"
  },
  ...
}
```

The git details are made available via the decorator `app.commitDetails` for use
in your application:

#### Accessing git details from decorated app

```javascript
const fastify = require('fastify')()

fastify.register(require('fastify-health-info'), {
  commitDetailsFrom: './.git-details.json'
})

fastify.get('/', function (request, reply) {
  reply.send(`We're on branch ${fastify.commitDetails.branch}!`)
})
```

### Health check

This package comes with a health check script which you can use in docker images
to call `/health`, which could be useful if curl or wget is not available inside
your container.

The script will log `healthy` and exit on code 0 on receipt of a 200 sucess
response, otherwise will log an error and exit with code 1.

By default the script will call `http://localhost/health` on port `8080` or the value of the `PORT` environment variable:

```dockerfile
ENV PORT=3000

# GET http://localhost:3000/health
HEALTHCHECK CMD ./node_modules/.bin/healthcheck
````

If you have set a custom prefix you can set it using the path argument or the
`HEALTH_PATH` environment variable:

```dockerfile
ENV HEALTH_PATH=/checks/health

# GET http://localhost:8080/checks/health
HEALTHCHECK CMD ./node_modules/.bin/healthcheck
````

You can also set a separate `HEALTH_BASE_PATH` var:

```dockerfile
ENV HEALTH_PATH=/checks/health
ENV HEALTH_BASE_PATH=/context-path

# GET http://localhost:8080/context-path/checks/health
HEALTHCHECK CMD ./node_modules/.bin/healthcheck
````

You can change the names of the variables the script will look for with the
`--port-var`, `--path-var` and `--base-var` arguments - if you want to load a
value from a pre-existing env var:

```dockerfile
# GET http://localhost:${APP_PORT}/health
HEALTHCHECK CMD ./node_modules/.bin/healthcheck --port-var=APP_PORT
````
