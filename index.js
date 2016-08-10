const express = require('express');
const bodyParser = require('body-parser');
const mdns = require('mdns');
const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const request = require('request');

const PORT = process.env.PORT || 3000;
const app = express();
const devices = new Map();

const browser = mdns.createBrowser(mdns.tcp('googlecast'));

function deviceRegister(name, address, port) {
  let id = devices.size;
  let client = new Client();

  return new Promise((resolve, reject) => {
    client.connect(address, () => {
      client.launch(DefaultMediaReceiver, (err, player) => {
        if (err) {
          reject(err);
          return;
        }

        devices.set(id, { name, address, port, client, player });
      });
    });
  });
}

browser.on('serviceUp', (service) => {
  console.log('found device "%s" at %s:%d', service.name, service.addresses[0], service.port);
  // ondeviceup(service.addresses[0]);
  deviceRegister(service.name, service.addresses[0], service.port).then(() => {
    console.log('Player registered');
  }).catch((err) => {
    console.error(err.message);
  });
  browser.stop();
});

browser.start();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/api', (req, res, next) => {
  let stack = app._router.stack;
  let methodList = [];
  Object.keys(stack).forEach(key => {
    let route = stack[key].route;
    if (route) {
      methodList.push(`${route.stack[0].method.toUpperCase()} ${route.path}`);
    }
  });
  res.type('text/plain').send(`Available routes:

${methodList.join('\n')}
`);
});

app.get('/api/devices', (req, res, next) => {
  let result = [];

  for (let [id, { name, address }] of devices) {
    result.push({id, name, address});
  }

  res.send({result});
});

app.get('/api/devices/:id', (req, res, next) => {
  let device = devices.get(parseInt(req.params.id, 10));
  let result = {}
  if (device) {
    result.name = device.name;
    result.address = device.address;
    result.port = device.port;
  }

  res.send(result);
});

app.post('/api/devices/:id/songs', (req, res, next) => {
  let song = req.body.song;

  request.get(`https://api.spotify.com/v1/search?q=${song}&type=track&market=DE`, (err, data, body) => {
    if (err || data.statusCode !== 200) {
      console.error(err, data);
      res.send(500, 'FAIL');
      return;
    }

    body = JSON.parse(body);
    let track = body.tracks.items[0];
    if (track) {
      let id = track.id;

      request.get(`https://api.spotify.com/v1/tracks/${id}`, (err, data, body) => {
        if (err || data.statusCode !== 200) {
          console.error(err, data);
          res.send(500, 'FAIL');
          return;
        }
        body = JSON.parse(body);
        console.dir(body, { depth: 1});

        if (body) {
          let albumImage = body.album.images[0].url;
          let title = body.name;
          let artist = body.artists[0].name;
          let url = body.preview_url;

          res.send({albumImage, artist, title, url});
        }
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});