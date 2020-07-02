const axios = require('axios').default
const querystring = require('querystring')
const http = require('http')
const url = require('url')
const express = require('express')
const assert = require('assert')
const cors = require('cors')
const polyline = require('google-polyline')
const fs = require('fs')
const path = require('path')
const constants = require('./constants.js').constants
console.log(constants)

const monk = require('monk')

const db = monk(`mongodb://${constants.DATABASE_ADDRESS}/${constants.DATABASE_NAME}`)

function replyError(errorMessage, statusCode, res) {
  console.error(errorMessage)
  res.writeHead(statusCode, {"Content-Type": "text/plain"})
  res.write(errorMessage)
  res.write("\n")
  res.end()
  return false
}

function storeAthlete(data, res) {

  const athletes = db.get('athletes')

  athletes.update(
    {'athlete.id': data.athlete.id}, {'$set': data}, {upsert: true, w: 1}, function(err, result) {
      if (err) {
        return replyError(`Failed to save token athlete information: ${err}`, 500, res)
      } else {
        res.writeHead(301, {
          'Location': `${constants.DOMAIN_SERVER}/#/map/${data.athlete.id}`,
          'Set-Cookie': `athlete=${data.athlete.id}; Max-Age=604800`
        })
        res.end()
        return true
      }
    })
}

function validateAuthorizationCode(requestUrl, res) {
  if (!requestUrl.search) {
    return replyError('Missing query string', 400, res)
  }
  
  queryParameters = querystring.parse(requestUrl.search.slice(1))
  if (!queryParameters.code) {
    return replyError('Failed to obtain authorization code', 400, res)
  }

  if (!queryParameters.scope) {
    return replyError('Failed to obtain authorization scope', 400, res)
  }

  if (!queryParameters.scope.split(',').includes('activity:read')) {
    return replyError(`Failed to obtain valid authorization scope: requires activity:read`, 400, res)
  }

  return queryParameters.code
}

function issueAuthorizationRequest(code, refresh, res) {
  fs.readFile(path.join(process.env.HOME, '.strava', 'secret'), 'utf8', function(err, data) {
    if (err) {
      return replyError('Authorization failed, please contact the server administrator if the issue persists contact', 500, res)
    }
    var body = querystring.stringify({
      'client_id': constants.CLIENT_ID,
      'client_secret': data.trim(),
      'code': code,
      'grant_type': 'authorization_code',
    })

    axios.post(`${constants.AUTH_SERVER}/oauth/token`, body, { 'headers': {'Content-Type': 'application/x-www-form-urlencoded'} })
      .then(function (response) {
        console.log(response.data);
        storeAthlete(response.data, res)
        return true
      })
      .catch(function (error) {
        return replyError(`Request to ${constants.AUTH_SERVER}/oauth/token failed: ${error}`, 400, res)
      })
  })
}

function sendData(qp, res) {

  var and = []

  if (qp.athletes)
    and.push({'athlete.id': {'$in': qp.athletes.split(',').map(a => {return parseInt(a)})}})
  if (qp.before)
    and.push({'startDate': {'$lt': new Date(qp.before * 1000)}})
  else if (qp.after)
    and.push({'startDate': {'$gt': new Date(qp.after * 1000)}})
  if (qp.types)
    and.push({'type': {
      '$in': qp.types.split(',').map(t => {
        return {
          'run': 'Run',
          'ride': 'Ride',
          'swim': 'Swim',
          'virtualride': 'VirtualRide',
          'virtualrun': 'VirtualRun',
        }[t]
      })
    }})
  if (qp.latmin)
    and.push({'bounds.latMax': {'$gt': parseFloat(qp.latmin)}})
  if (qp.latmax)
    and.push({'bounds.latMin': {'$lt': parseFloat(qp.latmax)}})
  if (qp.lngmin)
    and.push({'bounds.lngMax': {'$gt': parseFloat(qp.lngmin)}})
  if (qp.lngmax)
    and.push({'bounds.lngMin': {'$lt': parseFloat(qp.lngmax)}})

  var query = { }
  if (and.length) {
    query = {'$and': and}
  }

  console.debug(`Querying activities with filter ${JSON.stringify(query, undefined, 2)}`)

  db.get('activities').aggregate([
    {
      '$match': query,
    },
    {
      '$lookup': {
        'from': 'streams',
        'localField': 'id',
        'foreignField': 'id',
        'as': 'streams'
      }
    },
    {
      '$sort': {'startDate': 1}
    }
  ]).then(function(data) {

    console.log(`Found ${data.length} results`)
    res.write('<?xml version="1.0" encoding="UTF-8"?>\n')
    res.write('<gpx version="1.0" creator="custom" xmlns="http://www.topografix.com/GPX/1/0">\n')

    for (var activity of data) {
      // assert(activity.streams.length === 1)
      if (activity.streams.length) {
        for (stream of activity.streams) {
          for (var point of stream.trace) {
            res.write(`<wpt lat="${point.latlng[0]}" lon="${point.latlng[1]}"/>\n`)
          }
        }
      } else if (activity.map.summary_polyline) {

        for (var point of polyline.decode(activity.map.summary_polyline)) {
          res.write(`
<wpt lat="${point[0]}" lon="${point[1]}">
  <name>${activity.id}/${point[0]}/${point[1]}</name>
  <time>${activity.start_date}</time>
</wpt>`)
        }
      }
    }

    res.write('</gpx>')
    res.end()
  }).catch(function(err) {
    if (err) {
      return replyError(`Failed to load data: ${err}`, 500, res)
    }
  })
}

function erase(athleteId, res) {
  const streams = db.get('streams')
  console.log(`Erasing streams of athlete ${athleteId}`)
  streams.remove({'athleteId': athleteId})
    .then(function(result) {
      console.log(`Erasing activities of athlete ${athleteId}`)
      const activities = db.get('activities')
      activities.remove({'athlete.id': athleteId})
        .then(function(result) {
          logout(athleteId, res)
        })
        .catch(function(err) {
          replyError(`Failed to remove activities of athlete ${athleteId}: ${err}`, 500, res)
        })
    })
    .catch(function(err) {
      replyError(`Failed to remove streams of athlete ${athleteId}: ${err}`, 500, res)
    })
}

function logout(athleteId, res) {
  const athletes = db.get('athletes')

  console.log(`Erasing athlete ${athleteId}`)
  athletes.findOneAndDelete({'athlete.id': athleteId})
    .then(athlete => {
      if (!athlete) {
        console.warn(`Could not find athlete ${athleteId}`)
        res.writeHead(200)
        res.end()
      } else {
        console.log(`Unauthorizing access to Strava for athlete ${athleteId}`)
        axios.post(`${constants.AUTH_SERVER}/oauth/deauthorize?access_token=${athlete.access_token}`)
          .then(function (response) {
            console.log(`Successfully deleted athlete ${athleteId}`)
          })
          .catch(function (error) {
            console.error(`Failed to deauthorize from server ${constants.AUTH_SERVER}: ${error}`)
          })
          .then(function() {
            res.writeHead(200)
            res.end()
          })
      }
    }).catch(function(err) {
      console.error(`Could not find athlete ${athleteId}: ${err}`)
    })
}

var app = express()
app.use(cors())

app
  .get('/token_exchange', function(req, res, next) {
    var requestUrl = url.parse(req.url)
    code = validateAuthorizationCode(requestUrl, res)
    if (code)
      issueAuthorizationRequest(code, false, res)
  })
  .get('/data', function(req, res, next) {
    var requestUrl = url.parse(req.url)
    if (requestUrl.search) {
      queryParameters = querystring.parse(requestUrl.search.slice(1))
    }
    sendData(queryParameters, res)
  })
  .post('/athletes/:id/logout', function(req, res, next) {
    logout(parseInt(req.params['id']), res)
  })
  .delete('/athletes/:id', function(req, res, next) {
    erase(parseInt(req.params['id']), res)
  })
console.log("Listening on 8080")
app.listen(8080)
