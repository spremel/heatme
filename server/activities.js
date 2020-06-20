const MongoClient = require('mongodb').MongoClient;
const axios = require('axios').default;
const polyline = require('google-polyline')
const constants = require('./constants.js').constants

const dbConnectionString = `mongodb://${constants.DATABASE_ADDRESS}/`

var context = {initDb: false, athletes: {}}

function initializeDatabase() {
  MongoClient.connect(dbConnectionString, function(err, client) {
    const db = client.db(constants.DATABASE_NAME)

    const athletes = db.collection('athletes')
    athletes.createIndex( {'athlete.id': 1}, {unique: true} )
    athletes.createIndex( {'lastActivityAt': 1} )
    athletes.createIndex( {'updatedAt': 1} )
    athletes.createIndex( {'startDate': -1} )
    athletes.createIndex( {'type': 1} )
    athletes.createIndex( {'bounds.latMin': 1} )
    athletes.createIndex( {'bounds.latMax': 1} )
    athletes.createIndex( {'bounds.lngMin': 1} )
    athletes.createIndex( {'bounds.lngMax': 1} )

    const activities = db.collection('activities')
    activities.createIndex( {'id': 1}, {unique: true} )
    activities.createIndex( {'athlete.id': 1})
    activities.createIndex( {'hasStream': 1} )

    const streams = db.collection('streams')
    streams.createIndex( {'id': 1}, {unique: true} )
    streams.createIndex( {'athleteId': 1} )
    client.close()
  })
}

function getAthleteActivityContext(athlete, activity) {
  c = getAthleteContext(athlete)
  if (!c.activities[activity.id]) {
    c.activities[activity.id] = {
      fetchingStreams: false,
    }
  }

  return c.activities[activity.id]
}

function getAthleteContext(athlete) {
  if (!context.athletes[athlete.athlete.id]) {
    context.athletes[athlete.athlete.id] = {
      activities: { },
      fetchingActivities: false,
      fetchingAuthorization: false,
    }
  }

  return context.athletes[athlete.athlete.id]
}

function storeAthlete(data, res) {
  MongoClient.connect(dbConnectionString, function(err, client) {
    if (err) {
      return replyError(`Failed to connect to the database: ${err}`, 500, res)
    }

    const athletes = client.db(dbName).collection('athletes')
    athletes.replaceOne({'athlete.id': data.athlete.id}, data, {upsert: true, w: 1}, function(err, result) {
      var c = getAthleteContext(data)
      c.fetchingAuthorization = false

      client.close()
      if (err) {
        return replyError(`Failed to save token athlete information: ${err}`, 500, res)
      } else {
        res.writeHead(301, {'Location': constants.DOMAIN_SERVER})
        return true
      }
    })
  })
}

function refreshAuthorization(athlete) {
  var c = getAthleteContext(athlete)

  if (c.fetchingAuthorization) {
    console.debug(`Skipping activities fetch for athlete ${athlete.athlete.id}`)
    return
  }

  remaining = athlete.expires_at - now()
  if (remaining > 0) {
    console.warn(`API replied with 401 but the access token for athlete is still valid for ${remaining} seconds`)
  }
  
  axios.post(`${constants.AUTH_SERVER}/oauth/token`, querystring.stringify({
    'client_id': constants.CLIENT_ID,
    'client_secret': constants.CLIENT_SECRET,
    'refresh_token': athlete.refresh_token,
    'grant_type': 'refresh_token',
  }), { 'headers': {'Content-Type': 'application/x-www-form-urlencoded'} })
    .then(function (response) {
      console.log(response.data);
      return storeAthlete(response.data, res)
    })
    .catch(function (error) {
      return replyError(`Failed to refresh authorization for athlete ${athlete.athlete.id}: request to ${constants.AUTH_SERVER} failed: ` + error, 400, res)
    })
}

function authorizationHeader(athlete) {
  return {'Authorization': `${athlete.token_type} ${athlete.access_token}`}
}

function mergeTimeSeries(d) {
  var trace = []
  for (var i = 0; i < d[0].data.length; i++) {
    var point = {}
    for (var j = 0; j < d.length; j++) {
      point[d[j].type] = d[j].data[i]
    }
    trace.push(point)
  }
  return trace
}

function now() {
  return parseInt(Date.now() / 1000)
}

function updateAthleteTime(athlete, lastActivityAt, upToDate, athletesDb, athleteContext) {
  update = { }

  if (lastActivityAt) {
    update['lastActivityAt'] = lastActivityAt
  }

  if (upToDate) {
    update['updatedAt'] = now()
  }

  athletesDb.updateOne({'athlete.id': athlete.athlete.id}, {'$set': update})
    .then((client) => { console.debug(`Updated time fields for athlete ${athlete.athlete.id}`) })
    .catch((err) => { console.error(`Failed to update time fields for athlete ${athlete.athlete.id}: ${err}`)})
    .then(() => { athleteContext.fetchingActivities = false })
}

function updateAthletes() {
  MongoClient.connect(dbConnectionString, function(err, client) {
    if (err) {
      console.error(`Failed to connect to ${dbConnectionString}: ${err}`)
      return
    }

    const db = client.db(constants.DATABASE_NAME)
    const athletes = db.collection('athletes')
    const activities = db.collection('activities')

    // find all athletes which have not been updated since 15min and fetches new activities
    athletes.find({'$or': [
      {'updatedAt': {'$lt': now() - 15 * 60} },
      {'updatedAt': {'$exists': false} }
    ]}).forEach(
      function(athlete) {
        var c = getAthleteContext(athlete)
        if (c.fetchingActivities) {
          console.debug(`Skipping activities fetch for athlete ${athlete.athlete.id}`)
          return
        }

        c.fetchingActivities = true
        var lastActivityAt = athlete.lastActivityAt || 0
        var sentinel = 20

        console.log(`Fetching activities after ${new Date(1000 * lastActivityAt)} for athlete ${athlete.athlete.id}`)

          axios.get(`${constants.STRAVA_SERVER}/api/v3/athlete/activities?after=${lastActivityAt}&per_page=100`, {'headers': authorizationHeader(athlete)})
            .then(function(response) {
              console.log(`Found ${response.data.length} new activities for athlete ${athlete.athlete.id}`)
              
              lastActivityAt = response.data.length ? Math.ceil(
                new Date(response.data[response.data.length - 1].start_date).getTime() / 1000
              ) : 0

              if (!response.data.length) {
                updateAthleteTime(athlete, lastActivityAt, true, athletes, c)
                return
              }
              activities.insertMany(response.data.map(a => {
                var minLat = Infinity, maxLat = 0, minLng = Infinity, maxLng = 0
                if (a.map.summary_polyline) {
                  var points = polyline.decode(a.map.summary_polyline)
                  for (var p of points) {
                    minLat = Math.min(p[0], minLat)
                    maxLat = Math.max(p[0], maxLat)
                    minLng = Math.min(p[1], minLng)
                    maxLng = Math.max(p[1], maxLng)
                  }
                  a['bounds'] = {
                    'latMin': minLat,
                    'latMax': maxLat,
                    'lngMin': minLng,
                    'lngMax': maxLng
                  }
                } else {
                  console.debug(`Missing polyline for activities ${a.id} of athlete ${athlete.athlete.id} (${a.type})`)
                }

                a['startDate'] = new Date(a.start_date);

                return a;
              }))
                .then((client) => { updateAthleteTime(athlete, lastActivityAt, false, athletes, c) })
                .catch((err) => {
                  console.error(`Failed to insert activities of athlete ${athlete.athlete.id}: ${err}`)
                  c.fetchingActivities = false
                  return
                })
            })
            .catch(function(error) {
              c.fetchingActivities = false
              console.error(`Failed to GET activities of athlete ${athlete.athlete.id}: ${error}`)
            })
      })

    // fetch streams for all activities without
    if (false) {
      activities.find({'hasStream': {'$in': [false, null]}}).limit(2).forEach(
        function(activity) {
          athletes.find({'athlete.id': activity.athlete.id}).forEach(
            function(athlete) {
              var c = getAthleteActivityContext(athlete, activity)

              if (c.fetchingStreams) {
                console.debug(`Skipping streams fetch for activity ${activity.id} of athlete ${athlete.athlete.id}`)
                return                
              }
              c.fetchingStreams = true

              console.log(`Fetching stream for activity ${activity.id} for athlete ${athlete.athlete.id}`)
              timeSeries = [
                'time', 'distance', 'latlng', 'altitude', 'velocity_smooth',
                'heartrate', 'cadence', 'watts', 'temp', 'moving', 'grade_smooth'
              ]

              axios.get(`${constants.STRAVA_SERVER}/api/v3/activities/${activity.id}/streams?keys=${timeSeries.join(',')}`, {'headers': authorizationHeader(athlete)})
                .then(function(response) {
                  const streams = db.collection('streams')
                  stream = {'id': activity.id, 'athleteId': athlete.athlete.id, 'trace': mergeTimeSeries(response.data)}
                  streams.insertOne(stream)
                    .then(function(err, client) {
                      activities.updateOne({'id': activity.id}, {'$set': {'hasStream': true}})
                        .then((client) => { })
                        .catch((err) => { console.error(`Failed to update hasStream field of activity ${activity.id} of athlete ${athlete.id}: ${err}`) })
                        .then(() => { c.fetchingStreams = false })
                    })
                    .catch((err) => {
                      c.fetchingStreams = false
                      console.error(`Failed to insert stream of activity ${activity.id} of athlete ${athlete.id}: ${err}`)
                    })
                }).catch(function(error) {
                  c.fetchingStreams = false

                  console.error(`Failed to GET stream of activity ${activity.id} of athlete ${activity.athlete.id}: ${error}`)

                  if (error.response.status === 401) {
                    refreshAuthorization(athlete)
                  }
                })
            })
        })
    }
  })
}

if (require.main === module) {    
  initializeDatabase()
  setInterval(updateAthletes, 5000)
}
