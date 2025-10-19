// server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
console.log('Signaling server running on ws://localhost:8080');

let hostSocket = null;

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        let msg;
        try { msg = JSON.parse(message); } catch(e) { console.error(e); return; }

        if (msg.type === 'host') {
            hostSocket = ws;
            ws.role = 'host';
            console.log('Host connected');
        } else if (msg.type === 'viewer') {
            ws.role = 'viewer';
            console.log('Viewer connected');
            // notify host
            if (hostSocket && hostSocket.readyState === WebSocket.OPEN) {
                hostSocket.send(JSON.stringify({ type: 'newViewer' }));
            }
        } else if (msg.type === 'offer') {
            // host sends offer to viewer
            if (msg.target === 'viewer') {
                ws.sendTo = 'viewer';
                wss.clients.forEach(client => {
                    if(client !== ws && client.role === 'viewer') {
                        client.send(JSON.stringify({ type: 'offer', data: msg.data }));
                    }
                });
            }
        } else if (msg.type === 'answer') {
            // viewer sends answer to host
            if (hostSocket && hostSocket.readyState === WebSocket.OPEN) {
                hostSocket.send(JSON.stringify({ type: 'answer', data: msg.data }));
            }
        } else if (msg.type === 'ice') {
            // ICE candidates
            const target = msg.target;
            wss.clients.forEach(client => {
                if(target === 'viewer' && client.role === 'viewer') {
                    client.send(JSON.stringify({ type: 'ice', data: msg.data }));
                } else if(target === 'host' && client.role === 'host') {
                    client.send(JSON.stringify({ type: 'ice', data: msg.data }));
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (ws.role === 'host') hostSocket = null;
    });
});
