/* eslint no-console: 0 */
const isEqual = require('lodash.isequal');

//
// This a plugin to mock WebSocket exchange between the client and API.
//
// It will setup a message workflow on the  websocket server that will
// respond to the client using messages defined in a fixtures file.
//
// The following command will load file fixtures/websocket-workflow/retrain.json:
//
//   cy.setWebsocketWorkflow('retrain');
//
// Please note the fixture file has to be defined manually in 'workflows' objects bellow.
//
// After setting up the workflow, the server will:
//
// - Respond to ping/pong messages
// - Validate if client message follow expect order in fixture file and
// log errors to console
// - Send expected messages in sequence
//

// Load workflow fixtures
const workflows = {
  retrain: require('../fixtures/websocket-workflow/retrain.json'),
};

// Init websocket messages queue
let step = 0;
let queue = [];

// Start websocket server
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 1999 });
console.log('\n\nWebsocket plugin server started.\n');

function sendServerMessages(ws) {
  while (queue[step] && queue[step].type === 'server') {
    ws.send(JSON.stringify(queue[step].payload));
    console.log(`\nWorkflow step ${step + 1}/${queue.length} (server message)`);
    step += 1;
  }
}

// Setup listeners
wss.on('connection', function connection(ws, req) {
  // Configure message handling for the Cypress client and return
  if (req.url === '/?token=cypress') {
    ws.on('message', function incoming(messageString) {
      const message = JSON.parse(messageString);
      if (message.type === 'cy:setup_workflow') {
        // Internal cypress message to set the workflow
        queue = workflows[message.data];
        step = 0;
        console.log('\nA new websocket workflow was set.\n');
      } else {
        console.log('\nUnexpected Cypress message!!\n');
      }
    });
    return;
  }

  // Configure message handling for the app client
  ws.on('message', function incoming(messageString) {
    // Keep ping/pong flow
    if (messageString.indexOf('ping#') === 0) {
      ws.send(`pong#${parseInt(messageString.split('#')[1])}`);
      return;
    }

    // Print message
    console.log(`\nWorkflow step ${step + 1}/${queue.length} (client message)`);

    // Parse message payload
    const message = JSON.parse(messageString);

    // Check if workflow ended
    if (!queue[step]) {
      console.log(
        '\n  Message sent by client after workflow ended: ',
        messageString,
        '\n'
      );
      return;
    }

    // Check if payload is expected
    if (!isEqual(queue[step].payload, message)) {
      console.log('\nUnexpected websocket message data:');
      console.log('  Expected: ', JSON.stringify(queue[step].payload));
      console.log('  Received: ', JSON.stringify(message), '\n');
    }

    // Move queue pointer to next message
    step += 1;

    // Send server messages, if any
    sendServerMessages(ws);
  });

  // On connection, check if there are message to be sent by the server
  sendServerMessages(ws);
});
