const http = require('http')
const url = require('url')
const fs = require('fs')
const querystring = require('querystring')

function sendFile(filename, response) {
    fs.readFile(filename, 'utf8', function(err, data) {
        if (err) {
            response.writeHead(500)
            response.write(`Failed to read file ${filename}\n`)
            response.end()
        } else { 
            response.writeHead(200, {"Content-Type": "application/json"})
            response.write(data)
            response.end()
        }
    })
}

server = http.createServer(function(request, response) {
    validUrls = [
        '/api/v3/athlete',
        '/api/v3/athlete/activities',
        '/api/v3/activities/3607848392/streams',
        '/api/v3/activities/3602203847/streams'
    ]

    urlRequest = url.parse(request.url)

    path = urlRequest.pathname
    console.log(path)

    if (!validUrls.includes(path)) {
        response.writeHead(404)
        response.write(`Valid URLs are ${validUrls.join(', ')}\n`)
        response.end()
        return
    }

    if (!request.headers.authorization) {
        response.writeHead(401)
        response.end()
        return
    }

    authToken = request.headers.authorization.split(' ')
    if (authToken.length != 2 || authToken[0] !== 'Bearer') {
        response.writeHead(401)
        response.end()
        return
    }

    if (path == '/api/v3/athlete') {
        sendFile('./strava-api/get-athlete.json', response)
    }
    else if (path == '/api/v3/athlete/activities') {
        queryParameters = {}
        if (urlRequest.search) {
            queryParameters = querystring.parse(urlRequest.search.slice(1))
        }

        fs.readFile('./strava-api/get-activities.json', 'utf8', function(err, data) {
            if (err) {
                response.writeHead(500)
                response.write(`Failed to read file ${filename}\n`)
                response.end()
                return
            }

            if (queryParameters.after) {
                activities = JSON.parse(data)
                activities = activities.filter(a => {return new Date(a.start_date) > queryParameters.after})
                data = JSON.stringify(activities, undefined, 2)
            }
            if (queryParameters.before) {
                activities = JSON.parse(data)
                activities = activities.filter(a => {return new Date(a.start_date) < queryParameters.before})
                data = JSON.stringify(activities, undefined, 2)
            }

            response.writeHead(200, {"Content-Type": "application/json"})
            response.write(data)
            response.end()
        })
    }
    else if (path == '/api/v3/activities/3607848392/streams' || path == '/api/v3/activities/3602203847/streams') {
        sendFile('./strava-api/get-streams.json', response)
    } else {
        response.writeHead(404)
        response.end()
    }
})

console.log('Listening on port 8091')
server.listen(8091)
