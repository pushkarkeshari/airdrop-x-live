const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' folder
app.use(express.static('public'));

// Handle new client connections
io.on('connection', (socket) => {
    console.log('A new user connected! ID:', socket.id);

    // Forward WebRTC signaling messages to other peers
    socket.on('signaling-message', (message) => {
        socket.broadcast.emit('signaling-message', message);
    });

    // Handle user disconnects
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start the server on port 3000
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running! Open in browser: http://localhost:${PORT}`);
});