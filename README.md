# Chromecast REST API playing Spotify

This is a small "hack" that I built on a [Twitch stream](https://twitch.tv/twilio) that uses [thibauts/node-castv2-client](github.com/thibauts/node-castv2-client) to communicate with the Chromecast and the [Spotify Web API](https://developer.spotify.com/web-api/) to search for songs and extract the Preview Snippets to play them with the `DefaultMediaReceiver` on the Chromecast.

## Setup Instructions

```sh
git clone https://github.com/dkundel/spotify-chromecast-api.git
cd spotify-chromecast-api
npm install
node .
```

This will install all dependencies and start the server listening by default on Port 3000.

## API

**Right now due to a bug it will only connect to one Chromecast since there was a bug during my stream that would double connect.**

### `GET /api`

List all endpoints

### `GET /api/devices`

List all devices available

### `GET /api/devices/0`

Gets the first Chromecast

### `PATCH /api/devices/0`

Reads a `status` body parameter that is `x-www-form-urlencoded` and can be `Play`, `Pause` or `Skip` and controls the music flow.

### `POST /api/devices/0/songs`

Gets a `song` body parameter that is `x-www-form-urlencoded` and it will look up the first song that is returned from Spotify and add the preview mp3 file to the playlist or plays it if the playlist is empty.

# Contributors

Dominik Kundel
