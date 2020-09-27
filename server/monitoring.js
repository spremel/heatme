const MongoClient = require('mongodb').MongoClient;
const axios = require('axios').default;
const polyline = require('google-polyline')
const fs = require('fs')
const path = require('path')
const querystring = require('querystring')
const constants = require('./constants.js').constants
const Event = require('events')

const dbConnectionString = `mongodb://${constants.DATABASE_ADDRESS}`

var context = {athletes: {}}

class OnFetchingAthleteActivities extends Event {}

const onFetchingAthleteActivities = new OnFetchingAthleteActivities()

function getAthleteContext(athlete) {
  if (!context.athletes[athlete.athlete.id]) {
    context.athletes[athlete.athlete.id] = {
      fetchingActivities: false
    }
  }

  return context.athletes[athlete.athlete.id]
}

onFetchingAthleteActivities.on('event', (athlete, state) => {
  console.debug(`OnFetchingAthleteActivities emitted with ${athlete.athlete.id}, ${state}`)
  getAthleteContext(athlete).fetchingActivities = state
})
onFetchingAthleteActivities.on('error', (err) => { console.error(`OnFetchingActivities error: ${err}`) } )


function isFetchingAthleteActivities(athlete) { return getAthleteContext(athlete).fetchingActivities }

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

function getDate(activity) {
  return new Date(activity.start_date).getTime() / 1000
}

async function storeAuthorization(athlete, token, db) {
  try {
    await db.collection('athletes').updateOne({'athlete.id': athlete.athlete.id}, {'$set': token}, {upsert: true, w: 1})
    console.log(`Refreshed token for athlete ${athlete.athlete.id}`)
  } catch (err) {
    console.error(`Failed to save token athlete information: ${err}`)
  }
}

async function refreshAuthorization(athlete, db) {
  remaining = athlete.expires_at - now()
  if (remaining > 0) {
    console.warn(`API replied negatively but the access token for athlete is still valid for ${remaining} seconds`)
  }

  var secret = ''
  try {
    secret = fs.readFileSync(path.join(process.env.HOME, '.strava', 'secret'), 'utf8')
  } catch (err) {
    console.log(`Failed to load client secret: ${err}`)
    return
  }

  body = {
    'client_id': constants.CLIENT_ID,
    'client_secret': secret.trim(),
    'refresh_token': athlete.refresh_token,
    'grapnt_type': 'refresh_token',
  }

  try {
    response = await axios.post(`${constants.AUTH_SERVER}/oauth/token`, querystring.stringify(body), { 'headers': {'Content-Type': 'application/x-www-form-urlencoded'} })
    await storeAuthorization(athlete, response.data, db)
  } catch (error) {
    console.error(`Failed to refresh authorization for athlete ${athlete.athlete.id}: request to ${constants.AUTH_SERVER} failed: ${error}`)
  }
}

async function storeAthleteActivities(athlete, activities, db) {
  try {
    await db.collection('activities').insertMany(activities.map(a => {
      var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
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
    }), {'ordered': false})
  } catch (err) {
    console.error(`Failed to insert activities of athlete ${athlete.athlete.id}: ${err}`)
  }
}

async function storeAthleteMetadata(athlete, newActivities, db) {
  set = { }
  if (newActivities.length) {
    set['lastActivityAt'] = Math.ceil(getDate(newActivities[newActivities.length - 1]))
  } else {
    set['updatedAt'] = now()
  }

  if (!athlete.firstActivityAt) {
    set['firstActivityAt'] = Math.floor(getDate(newActivities[0]))
  }

  try {
    await db.collection('athletes').updateOne(
      {'athlete.id': athlete.athlete.id}, {'$set': set, '$inc': {'loadedActivities': newActivities.length}}
    )
    console.debug(`Updated time fields for athlete ${athlete.athlete.id}`)
  } catch (err) {
    console.error(`Failed to update time fields for athlete ${athlete.athlete.id}: ${err}`)
  }
}

async function updateAthlete(athlete) {
  var client = null
  try {
    client = await MongoClient.connect(dbConnectionString)
    const db = client.db(constants.DATABASE_NAME)

    if (isFetchingAthleteActivities(athlete)) {
      console.debug(`Skipping activities fetch for athlete ${athlete.athlete.id}`)
      return
    }

    onFetchingAthleteActivities.emit('event', athlete, true)
    var lastActivityAt = athlete.lastActivityAt || 0
    console.log(`Fetching activities after ${new Date(1000 * lastActivityAt)} for athlete ${athlete.athlete.id}`)

    try {
      response = await axios.get(`${constants.STRAVA_SERVER}/api/v3/athlete/activities?after=${lastActivityAt}&per_page=100`, {'headers': authorizationHeader(athlete)})
    } catch (error) {
      console.error(`Failed to GET activities of athlete ${athlete.athlete.id}: ${error}`)
      if (error.response && error.response.status === 401) {
        await refreshAuthorization(athlete, db)
        return
      }
    }
    
    if (response.data.length) {
      console.log(`Found ${response.data.length} new activities for athlete ${athlete.athlete.id}`)
      await storeAthleteActivities(athlete, response.data, db)
    } else {
      console.log(`No new activities for athlete ${athlete.athlete.id}`)
    }

    await storeAthleteMetadata(athlete, response.data, db)
  }
  catch (err) {
    console.error(`Failed to update athlete ${athlete.athlete.id}: ${err}`)
  }
  finally {
    onFetchingAthleteActivities.emit('event', athlete, false)
    if (client) {
      client.close()
    }
  }
}

function updateAthletes() {
  MongoClient.connect(dbConnectionString)
    .then(function(client) {
      // find all athletes which have not been updated since 15min and fetches new activities
      client.db(constants.DATABASE_NAME).collection('athletes').find({'$or': [
        {'updatedAt': {'$lt': now() - 15 * 60} },
        {'updatedAt': {'$exists': false} }
      ]}).forEach(
        function(athlete) {
          updateAthlete(athlete)
        },
        function(err) {
          if (err) {
            console.error(`Error occured while fetching athlete ${athlete.athlete.id}: ${err}`)
          }
          client.close()
        })
    })
    .catch(function(err) {
      console.error(`Failed to connect to database ${dbConnectionString}: ${err}`)
    })
}

if (require.main === module) {    
  initializeDatabase()
  setInterval(updateAthletes, 5000)
}
