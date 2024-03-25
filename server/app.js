const express = require('express');
const responseTime = require('response-time')
const axios = require('axios');
const Redis = require('ioredis');

const app = express();

// create and connect redis client to sentinel instances.
var client = new Redis({
    sentinels: [{host: 'redis-sentinel-north', port: 26379},{host: 'redis-sentinel-west', port: 26379},{host: 'redis-sentinel-east', port: 26379}],
    name: 'redis-skupper'
});

// Print redis errors to the console
client.on('error', (err) => {
  console.log("Error " + err);
});

// use response-time as a middleware
app.use(responseTime());

// create an api/search route
app.get('/api/search', (req, res) => {
  // Extract the query from url and trim trailing spaces
//  const query = (req.query.query).trim();
  const query = req.query.query;
  // Build the Wikipedia API url
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=parse&format=json&section=0&page=${query}`;

  // Try fetching the result from Redis first in case we have it cached
  return client.get(`wikipedia:${query}`, (err, result) => {
    // If that key exist in Redis store
    if (result) {
      const resultJSON = JSON.parse(result);
      return res.status(200).json(resultJSON);
    } else { // Key does not exist in Redis store
      // Fetch directly from Wikipedia API
      return axios.get(searchUrl)
        .then(response => {
          const responseJSON = response.data;
          // Save the Wikipedia API response in Redis store
          client.setex(`wikipedia:${query}`, 3600, JSON.stringify({ source: 'Redis Cache', ...responseJSON, }));
          // Send JSON response to client
          return res.status(200).json({ source: 'Wikipedia API', ...responseJSON, });
        })
        .catch(err => {
          return res.json(err);
        });
    }
  });
});

app.listen(8080, () => {
  console.log('Server listening on port: ', 8080);
});