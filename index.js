const express = require('express');
const bodyParser = require('body-parser');
const mdns = require('mdns');
const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;

const PORT = process.env.PORT || 3000;
const app = express();

const browser = mdns.createBrowser(mdns.tcp('googlecast'));

browser.on('serviceUp', (service) => {
  console.log('found device "%s" at %s:%d', service.name, service.addresses[0], service.port);
  // ondeviceup(service.addresses[0]);
  browser.stop();
});

browser.start();

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

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});