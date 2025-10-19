// server.js
const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();

// serve your static files (host.html, viewer.html, etc.) from /public
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// create HTTP server (so WS can piggyback on same port)
const server = http.createServer(app);

// attach WebSocket server to the HTTP server (path /ws)
const wss = new WebSocket.Server({ server, path: '/ws' });

let hostSocket = null;

wss.on('connection', (ws, req) => {
  console.log('New ws client connected, url:', req.url);

  ws.on('message', (message) => {
    let msg;
    try { msg = JSON.parse(message); } catch (e) { console.error('Invalid JSON', e); return; }

    // role registration
    if (msg.type === 'host') {
      hostSocket = ws;
      ws.role = 'host';
      console.log('Host connected');
      return;
    } else if (msg.type === 'viewer') {
      ws.role = 'viewer';
      console.log('Viewer connected');
      // notify host (if present)
      if (hostSocket && hostSocket.readyState === WebSocket.OPEN) {
        hostSocket.send(JSON.stringify({ type: 'newViewer' }));
      }
      return;
    }

    // signaling messages
    if (msg.type === 'offer') {
      // forward offer to all viewers
      wss.clients.forEach(client => {
        if (client !== ws && client.role === 'viewer' && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'offer', data: msg.data }));
        }
      });
    } else if (msg.type === 'answer') {
      // forward answer to host
      if (hostSocket && hostSocket.readyState === WebSocket.OPEN) {
        hostSocket.send(JSON.stringify({ type: 'answer', data: msg.data }));
      }
    } else if (msg.type === 'ice') {
      const target = msg.target;
      wss.clients.forEach(client => {
        if (client.readyState !== WebSocket.OPEN) return;
        if (target === 'viewer' && client.role === 'viewer') client.send(JSON.stringify({ type: 'ice', data: msg.data }));
        if (target === 'host' && client.role === 'host') client.send(JSON.stringify({ type: 'ice', data: msg.data }));
      });
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected (role =', ws.role, ')');
    if (ws.role === 'host') hostSocket = null;
  });

  ws.on('error', (err) => console.error('ws error', err));
});

// PORT from env (Render sets PORT automatically)
const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
