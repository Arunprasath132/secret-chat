const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Temporary server-side storage (clears if server restarts)
let roomMessages = {}; 

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.on('join-room', (key) => {
        socket.join(key);
        socket.currentRoom = key;

        // 1. Send chat history to the person who just joined
        if (roomMessages[key]) {
            socket.emit('load-history', roomMessages[key]);
        }

        const roomSize = io.sockets.adapter.rooms.get(key)?.size || 0;
        io.to(key).emit('user-update', { count: roomSize, event: 'joined' });
    });

    socket.on('send-message', (data) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMessage = { text: data.message, time: time, senderId: socket.id };

        // 2. Store message in server memory
        if (!roomMessages[data.room]) roomMessages[data.room] = [];
        roomMessages[data.room].push(newMessage);
        
        // Keep only last 50 messages to save memory
        if (roomMessages[data.room].length > 50) roomMessages[data.room].shift();

        // 3. Broadcast to everyone in the room
        io.to(data.room).emit('receive-message', newMessage);
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('display-typing', data.isTyping);
    });

    socket.on('end-session', (room) => {
        delete roomMessages[room]; // Wipe server memory for this room
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
server.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
