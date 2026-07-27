const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A new user connected! ID:', socket.id);

    socket.on('signaling-message', (message) => {
        socket.broadcast.emit('signaling-message', message);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// YAHAN CHANGE KIYA HAI - Cloud Port ya Local Port
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(Server is running! Port: ${PORT});
});