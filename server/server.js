const axios = require('axios').default
const querystring = require('querystring')
const http = require('http')
const url = require('url')
const express = require('express')
const assert = require('assert')
const db = require('monk')('mongodb://localhost:27017/heatme')
const cors = require('cors')
const polyline = require('google-polyline')

// const thisServer = 'http://35.210.237.237'
const thisServer = 'http://localhost:8081'

const stravaServer = 'https://www.strava.com'
//const stravaServer = 'http://localhost:8091'

const authServer = 'https://www.strava.com'
//const authServer = 'http://localhost:8090'

const clientId = 49670
const clientSecret = '13d5f9f7bc4e2295089f46f81e05fce8b8b9f6b2'

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
        res.writeHead(301, {'Location': `${thisServer}/#/map/${data.athlete.id}`})
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
  var body = querystring.stringify({
    'client_id': clientId.toString(),
    'client_secret': clientSecret,
    'code': code,
    'grant_type': 'authorization_code',
  })

  axios.post(authServer + '/oauth/token', body, { 'headers': {'Content-Type': 'application/x-www-form-urlencoded'} })
    .then(function (response) {
      console.log(response.data);
      storeAthlete(response.data, res)
      return true
    })
    .catch(function (error) {
      return replyError(`Request to ${authServer}/oauth/token failed: ` + error, 400, res)
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
    queryParameters = {}
    if (requestUrl.search) {
      queryParameters = querystring.parse(requestUrl.search.slice(1))
    }
    sendData(queryParameters, res)
  })

console.log("Listening on 8080")
app.listen(8080)
