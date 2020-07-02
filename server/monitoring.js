const MongoClient = require('mongodb').MongoClient;
const axios = require('axios').default;
const polyline = require('google-polyline')
const fs = require('fs')
const path = require('path')
const querystring = require('querystring')
const constants = require('./constants.js').constants
const Event = require('events')

const dbConnectionString = `mongodb://${constants.DATABASE_ADDRESS}/`

var context = {athletes: {}}

class OnFetchingAthleteActivities extends Event {}
class OnFetchingAthleteAuthorization extends Event {}
class OnFetchingActivityStreams extends Event {}

const onFetchingAthleteActivities = new OnFetchingAthleteActivities()
const onFetchingAthleteAuthorization = new OnFetchingAthleteAuthorization()
const onFetchingActivityStreams = new OnFetchingActivityStreams()

onFetchingAthleteActivities.on('event', (athlete, state) => {
  console.debug(`OnFetchingAthleteActivities emitted with ${athlete.athlete.id}, ${state}`)
  getAthleteContext(athlete).fetchingActivities = state
})
onFetchingAthleteActivities.on('error', (err) => { console.error(`OnFetchingActivities error: ${err}`) } )

onFetchingAthleteAuthorization.on('event', (athlete, state) => {
  console.debug(`OnFetchingAthleteAuthorization emmited with ${athlete.athlete.id}, ${state}`)
  getAthleteContext(athlete).fetchingAuthorization = state
})
onFetchingAthleteAuthorization.on('error', (err) => { console.error(`OnFetchingAthleteAuthorization error: ${err}`) } )

onFetchingActivityStreams.on('event', (athlete, activity, state) => {
  console.debug(`OnFetchingActivityStreams emmited with ${athlete.athlete.id}, ${activity.id}, ${state}`)
  getActivityContext(athlete, activity).fetchingStreams = state
})
onFetchingActivityStreams.on('error', (err) => { console.error(`OnFetchingActivityStreams error: ${err}`) } )

function getAthleteContext(athlete) {
  if (!context.athletes[athlete.athlete.id]) {
    context.athletes[athlete.athlete.id] = {
      activities: { },
      fetchingActivities: false,
      fetchingAuthorization: false
    }
  }

  return context.athletes[athlete.athlete.id]
}

function getActivityContext(athlete, activity) {
  var c = getAthleteContext(athlete)
  if (!c.activities[activity.id]) {
    c.activities[activity.id] = {
      fetchingStreams: false
    }
  }

  return c.activities[activity.id]
}

function isFetchingAthleteActivities(athlete) { return getAthleteContext(athlete).fetchingActivities }
function isFetchingAthleteAuthorization(athlete) { return getAthleteContext(athlete).fetchingAuthorization }
function isFetchingActivityStreams(athlete) { return getActivityContext(athlete, activity).fetchingStreams }

function initializeDatabase() {
  MongoClient.connect(dbConnectionString)
    .then(function(client) {
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
    .catch(function(err) {
      console.error(`Failed to initialize database: ${err}`)
      process.exit()
    })
}

function updateAuthorization(athlete, token) {
  MongoClient.connect(dbConnectionString)
    .then(function(client) {

      const athletes = client.db(constants.DATABASE_NAME).collection('athletes')
      athletes.updateOne(
        {'athlete.id': athlete.athlete.id}, {'$set': token}, {upsert: true, w: 1})
        .then(function(result) {
          console.log(`Refreshed token for athlete ${athlete.athlete.id}`)
        })
        .catch(function (err) {
          console.error(`Failed to save token athlete information: ${err}`)
        })
        .then(function() {
          onFetchingAthleteAuthorization.emit('event', athlete, false)
        })
    })
    .catch(function(err) {
      onFetchingAthleteAuthorization.emit('event', athlete, false)
      console.error(`Failed to connect to the database: ${err}`)
    })
}

function refreshAuthorization(athlete) {

  if (isFetchingAthleteAuthorization(athlete)) {
    console.debug(`Skipping authorization refresh for athlete ${athlete.athlete.id}`)
    return
  }

  remaining = athlete.expires_at - now()
  if (remaining > 0) {
    console.warn(`API replied negatively but the access token for athlete is still valid for ${remaining} seconds`)
  }
  
  fs.readFile(path.join(process.env.HOME, '.strava', 'secret'), 'utf8', function(err, data) {
    if (err) {
      console.log(`Failed to load client secret: ${err}`)
    }

    body = {
      'client_id': constants.CLIENT_ID,
      'client_secret': data.trim(),
      'refresh_token': athlete.refresh_token,
      'grant_type': 'refresh_token',
    }

    onFetchingAthleteAuthorization.emit('event', athlete, true)
    axios.post(`${constants.AUTH_SERVER}/oauth/token`, querystring.stringify(body), { 'headers': {'Content-Type': 'application/x-www-form-urlencoded'} })
      .then(function (response) {
        console.log(response.data);
        updateAuthorization(athlete, response.data)
      })
      .catch(function (error) {
        onFetchingAthleteAuthorization.emit('event', athlete, false)
        console.error(`Failed to refresh authorization for athlete ${athlete.athlete.id}: request to ${constants.AUTH_SERVER} failed: ${error}`)
      })
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

function updateAthleteTime(athlete, lastActivityAt, upToDate, athletesDb) {
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
    .then(() => { onFetchingAthleteActivities.emit('event', athlete, false) })
}

function updateAthletes() {
  MongoClient.connect(dbConnectionString)
    .then(function(client) {

      const db = client.db(constants.DATABASE_NAME)
      const athletes = db.collection('athletes')
      const activities = db.collection('activities')

      // find all athletes which have not been updated since 15min and fetches new activities
      athletes.find({'$or': [
        {'updatedAt': {'$lt': now() - 15 * 60} },
        {'updatedAt': {'$exists': false} }
      ]}).forEach(
        function(athlete) {
          if (isFetchingAthleteActivities(athlete)) {
            console.debug(`Skipping activities fetch for athlete ${athlete.athlete.id}`)
            return
          }

          onFetchingAthleteActivities.emit('event', athlete, true)
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
                updateAthleteTime(athlete, lastActivityAt, true, athletes)
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
                .then((client) => { updateAthleteTime(athlete, lastActivityAt, false, athletes) })
                .catch((err) => {
                  console.error(`Failed to insert activities of athlete ${athlete.athlete.id}: ${err}`)
                  updateAthleteTime(athlete, lastActivityAt, false, athletes)
                  onFetchingAthleteActivities.emit('event', athlete, false)
                })
            })
            .catch(function(error) {
              onFetchingAthleteActivities.emit('event', athlete, false)
              console.error(`Failed to GET activities of athlete ${athlete.athlete.id}: ${error}`)
              if (error.response && error.response.status === 401) {
                refreshAuthorization(athlete)
              }
            })
        })
        .catch(function(err) {
          console.error(`Failed to connect to ${dbConnectionString}: ${err}`)
          return
        })

    // fetch streams for all activities without
    if (false) {
      activities.find({'hasStream': {'$in': [false, null]}}).limit(2).forEach(
        function(activity) {
          athletes.find({'athlete.id': activity.athlete.id}).forEach(
            function(athlete) {
              if (isFetchingActivityStreams(athlete, activity)) {
                console.debug(`Skipping streams fetch for activity ${activity.id} of athlete ${athlete.athlete.id}`)
                return                
              }
              onFetchingActivityStreams.emit('event', athlete, activity, true)

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
                        .then(() => { onFetchingActivityStreams.emit('event', athlete, activity, false) })
                    })
                    .catch((err) => {
                      onFetchingActivityStreams.emit('event', athlete, activity, false)
                      console.error(`Failed to insert stream of activity ${activity.id} of athlete ${athlete.id}: ${err}`)
                    })
                }).catch(function(error) {
                  onFetchingActivityStreams.emit('event', athlete, activity, false)
                  console.error(`Failed to GET stream of activity ${activity.id} of athlete ${activity.athlete.id}: ${error}`)

                  if (error.response && error.response.status === 401) {
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
