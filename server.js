const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('New connection established');

    // Join a room based on the Secret Key
    socket.on('join-room', (key) => {
        socket.join(key);
        console.log(`User joined private bridge: ${key}`);
    });

    // Send message only to the specific room
    socket.on('send-message', (data) => {
        // This broadcasts the message to everyone in the room EXCEPT the sender
        socket.to(data.room).emit('receive-message', data.message);
    });

    // Trigger Wipe for both users
    socket.on('end-session', (room) => {
        io.to(room).emit('force-logout');
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Listen on your specific IP address
const PORT = 3000;
const IP_ADDR = '0.0.0.0'; // '0.0.0.0' allows connections from your mobile
server.listen(PORT, IP_ADDR, () => {
    console.log(`SERVER IS LIVE!`);
    console.log(`On your computer: http://localhost:${PORT}`);
    console.log(`On your mobile: http://10.29.200.41:${PORT}`);
});