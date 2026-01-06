const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve the HTML file when someone visits the URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('User connected to cloud');

    // Join a room based on the Secret Key
    socket.on('join-room', (key) => {
        socket.join(key);
    });

    // Send message only to the specific room
    socket.on('send-message', (data) => {
        socket.to(data.room).emit('receive-message', data.message);
    });

    // Trigger Wipe for both users
    socket.on('end-session', (room) => {
        io.to(room).emit('force-logout');
    });
});

// IMPORTANT: process.env.PORT is required for Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
