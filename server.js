const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Volatile Storage - Data is lost if server restarts
let roomMessages = {}; 
let roomPasswords = {}; 

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    
    socket.on('join-room', (data) => {
        const { key, password } = data;
        
        // Initialize room memory if it doesn't exist
        if (!roomPasswords[key]) {
            roomPasswords[key] = password;
            roomMessages[key] = [];
        }

        // Security Check
        if (roomPasswords[key] === password) {
            socket.join(key);
            socket.currentRoom = key;

            // SYNC HISTORY: Send existing messages to the user joining
            socket.emit('load-history', roomMessages[key]);

            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            io.to(key).emit('receive-message', { 
                text: "SYSTEM: Secure node synchronized.", 
                time: time, 
                type: 'system' 
            });

            // Update node count
            const roomSize = io.sockets.adapter.rooms.get(key)?.size || 0;
            io.to(key).emit('user-update', { count: roomSize });
            socket.emit('login-success');
        } else {
            socket.emit('login-error', "Access Denied: Invalid Password.");
        }
    });

    socket.on('send-message', (data) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMessage = { 
            text: data.message, 
            time: time, 
            senderId: socket.id,
            type: 'user' 
        };
        
        // Save to volatile RAM
        if (roomMessages[data.room]) {
            roomMessages[data.room].push(newMessage);
            if (roomMessages[data.room].length > 100) roomMessages[data.room].shift();
        }
        
        io.to(data.room).emit('receive-message', newMessage);
    });

    socket.on('end-session', (room) => {
        delete roomMessages[room];
        delete roomPasswords[room];
        io.to(room).emit('force-logout');
    });

    socket.on('disconnect', () => {
        if (socket.currentRoom) {
            const roomSize = io.sockets.adapter.rooms.get(socket.currentRoom)?.size || 0;
            io.to(socket.currentRoom).emit('user-update', { count: roomSize });
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Bridge established on port ${PORT}`);
});
