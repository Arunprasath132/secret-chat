const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    socket.on('join-room', (key) => {
        socket.join(key);
        socket.currentRoom = key;

        // Count people in room and notify
        const roomSize = io.sockets.adapter.rooms.get(key)?.size || 0;
        io.to(key).emit('user-update', { count: roomSize, event: 'joined' });
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('display-typing', data.isTyping);
    });

    socket.on('send-message', (data) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        socket.to(data.room).emit('receive-message', { 
            text: data.message, 
            time: time 
        });
    });

    socket.on('end-session', (room) => {
        io.to(room).emit('force-logout');
    });

    socket.on('disconnect', () => {
        const room = socket.currentRoom;
        if (room) {
            const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
            io.to(room).emit('user-update', { count: roomSize, event: 'left' });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
