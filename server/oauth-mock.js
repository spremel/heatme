const http = require('http')
const url = require('url')
const fs = require('fs')
const querystring = require('querystring')
const formidable = require('formidable')

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
    validUrls = ['/oauth/token']
    
    requestUrl = url.parse(request.url)
    path = requestUrl.pathname

    if (!validUrls.includes(path)) {
        response.writeHead(404)
        response.write(`Valid URLs are ${validUrls.join(', ')}\n`)
        response.end()
        return
    }

    var form = new formidable.IncomingForm()
    
    form.parse(request, function(err, data, files) {
        if (err) {
            response.writeHead(400)
            response(`Failed to parse form data\n`)
            response.end()
            return
        }

        for (prop of ['client_id', 'client_secret', 'grant_type']) {
            if (!data[prop]) {
                response.writeHead(400)
                response.write(`Missing prop ${prop}\n`)
                response.end()
                return
            }
        }

        if (!data.refresh_token && !data.code) {
            response.writeHead(400)
            response.write(`Missing code/refresh_token\n`)
            response.end()
            return
        }
        
        if (!['authorization_code', 'refresh_token'].includes(data.grant_type)) {
            response.writeHead(400)
            response.write(`Invalid grant_type ${data.grant_type}\n`)
            response.end()
            return
        }

        filename = './strava-api/get-token-valid.json'
        if (requestUrl.search) {
            queryParameters = querystring.parse(requestUrl.search.slice(1))
            if (queryParameters.expired) {
                filename = './strava-api/get-token-expired.json'
            }
        }

        if (path == '/oauth/token') {
            sendFile(filename, response)
        } else {
            response.writeHead(404)
            response.end()
        }
    })
})

console.log('Listening on port 8090')
server.listen(8090)
