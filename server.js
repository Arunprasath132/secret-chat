const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Volatile Storage
let roomMessages = {}; 
let roomPasswords = {}; 

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.on('join-room', (data) => {
        const { key, password } = data;
        if (!roomPasswords[key]) {
            roomPasswords[key] = password;
            roomMessages[key] = [];
        }

        if (roomPasswords[key] === password) {
            socket.join(key);
            socket.currentRoom = key;
            
            // Sync history for the user joining
            socket.emit('load-history', roomMessages[key]);

            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            io.to(key).emit('receive-message', { 
                text: "SYSTEM: Secure connection established.", 
                time: time, type: 'system' 
            });

            const roomSize = io.sockets.adapter.rooms.get(key)?.size || 0;
            io.to(key).emit('user-update', { count: roomSize });
            socket.emit('login-success');
        } else {
            socket.emit('login-error', "Invalid Credentials.");
        }
    });

    socket.on('send-message', (data) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMessage = { text: data.message, time: time, senderId: socket.id };
        if (roomMessages[data.room]) {
            roomMessages[data.room].push(newMessage);
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

server.listen(3000, () => console.log('Bridge Active on Port 3000'));
