const axios = require('axios').default
const querystring = require('querystring')
const http = require('http')
const url = require('url')
const express = require('express')
const assert = require('assert')
const db = require('monk')('mongodb://localhost:27017/heatme')
const cors = require('cors')

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
  athletes.update({'athlete.id': data.athlete.id}, data, {upsert: true, w: 1, replaceOne: true},
                  function(err, result) {
                    if (err) {
                      return replyError(`Failed to save token athlete information: ${err}`, 500, res)
                    } else {
                      res.writeHead(301, {'Location': 'http://localhost:1234/#/map/${data.athlete.id}'})
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

  query = {}

  if (qp.athletes)
    query = {'athlete.id': {'$in': qp.athletes.split(',').map(a => {return parseInt(a)})}}
  if (qp.before)
    query['startDate'] = {'$lt': new Date(qp.before * 1000)}
  if (qp.after)
    query['startDate'] = {'$gt': new Date(qp.after * 1000)}
  if (qp.types)
    query['type'] = {
      '$in': qp.types.split(',').map(t => {
        return {
          'run': 'Run',
          'ride': 'Ride',
          'virtualride': 'Virtual Ride',
          'virtualrun': 'Virtual Run',
        }[t]
      })
    }
  if (qp.latmin)
    query['bounds.latMin'] = {'$gt': parseFloat(qp.latmin)}
  if (qp.latmax)
    query['bounds.latMax'] = {'$lt': parseFloat(qp.latmax)}
  if (qp.lngmin)
    query['bounds.lngMin'] = {'$gt': parseFloat(qp.lngmin)}
  if (qp.lngmax)
    query['bounds.lngMax'] = {'$lt': parseFloat(qp.lngmax)}

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

    res.write('<?xml version="1.0" encoding="UTF-8"?>\n')
    res.write('<gpx version="1.0" creator="custom" xmlns="http://www.topografix.com/GPX/1/0">\n')

    for (var activity of data) {
      assert(activity.streams.length === 1)
      for (stream of activity.streams) {
        for (var point of stream.trace) {
          res.write(`<wpt lat="${point.latlng[0]}" lon="${point.latlng[1]}"/>\n`)
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

  // db.get('activities').find(query).each(function(activity) {
  //     db.get('streams').find({'id': activity.id}, {'trace.latlng': true})
  //         .each(function(doc){
  //             for (var point of doc.trace) {
  //                 res.write(`<wpt lat="${point.latlng[0]}" lon="${point.latlng[1]}"/>\n`)
  //             }
  //         })
  //         .then(function() {
  //             res.write('</gpx>')
  //             res.end()
  //         })
  // }).then(function() {
  // })
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
