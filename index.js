const express = require('express');
const bodyParser = require('body-parser');
const mdns = require('mdns');
const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const request = require('request');
const os = require('os');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const PORT = process.env.PORT || 3000;
const app = express();
const devices = new Map();
let playlist = [];

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
        resolve(player);
      });
    });
  });
}

function createEventListeners(player) {
  player.on('status', function(status) {
    console.log('status broadcast playerState=%s', status.playerState);
    if (status.playerState === 'IDLE') {
      playlist.splice(0, 1);
      writePlaylist();
      if (playlist.length > 0) {
        player.load(playlist[0], { autoplay: true}, (err, status) => {
          console.log('Play!');
        });
      }
    }
  });
}

function writePlaylist() {
  let songs = playlist.map(p => p.metadata.title).join('\n');
  let content = `http://dk.ngrok.io/api
${songs}`
  fs.writeFileSync(path.join(os.homedir(), 'playlist.txt'), content, 'utf8');
}

function getMediaObject(name, artist, songUrl, picture) {
  return {
    contentId: songUrl,
    contentType: 'audio/mpeg3',
    streamType: 'LIVE', // or LIVE

    // Title and cover displayed while buffering
    metadata: {
      type: 0,
      metadataType: 0,
      title: `${name} - ${artist}`, 
      images: [
        { url: picture }
      ]
    }
  };
}

let idx = 0;
browser.on('serviceUp', (service) => {
  if (idx !== 0) {
    return;
  }
  idx = 1;
  console.log('found device "%s" at %s:%d', service.name, service.addresses[0], service.port);
  // ondeviceup(service.addresses[0]);
  deviceRegister(service.name, service.addresses[0], service.port).then(player => {
    console.log('Player registered');
    return player;
  }).then(createEventListeners).catch((err) => {
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

app.patch('/api/devices/:id', (req, res, next) => {
  let state = req.body.state.toLowerCase();
  let device = devices.get(parseInt(req.params.id, 10));

  if (!device) {
    res.send(500, 'FAIL');
    return;
  }

  if (state === 'pause') {
    playlist = [playlist[0], ...playlist];
    device.player.pause((err, state) => {
      console.log('Pause');
    });
    return res.send('PAUSED');
  } else if (state === 'play') {
    device.player.play((err, state) => {
      console.log('Play');
    });
    return res.send('PLAY');
  } else if (state === 'skip') {
    playlist.splice(0, 1);
    if (playlist.length > 0) {
      device.player.load(playlist[0], { autoplay: true }, (err, state) => {        
      });
    }
    res.send('SKIP');
    writePlaylist();
  }
});

app.post('/api/devices/:id/songs', (req, res, next) => {
  let song = req.body.song;
  let { player } = devices.get(parseInt(req.params.id, 10));

  if (!song) {
    res.send(400, 'Please submit a "song" post paramater');
    return;
  }

  request.get(`https://api.spotify.com/v1/search?q=${querystring.escape(song)}&type=track&market=DE`, (err, data, body) => {
    if (err || data.statusCode !== 200) {
      // console.error(err, data);
      res.send(500, 'FAIL');
      return;
    }

    body = JSON.parse(body);
    let track = body.tracks.items[0];
    if (track) {
      let id = track.id;

      request.get(`https://api.spotify.com/v1/tracks/${id}`, (err, data, body) => {
        if (err || data.statusCode !== 200) {
          // console.error(err, data);
          res.send(500, 'FAIL');
          return;
        }
        body = JSON.parse(body);

        if (body) {
          let albumImage = body.album.images[0].url;
          let title = body.name;
          let artist = body.artists[0].name;
          let url = body.preview_url;

          let media = getMediaObject(title, artist, url, albumImage);

          playlist.push(media);
          console.log(playlist);
          writePlaylist();

          if (playlist.length === 1) {
            player.load(media, { autoplay: true }, (err, status) => {
              console.log('PLAY');
            });
          }

          res.send({albumImage, artist, title, url});
        }
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});