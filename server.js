const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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
            socket.emit('load-history', roomMessages[key]);

            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            io.to(key).emit('receive-message', { text: "SYSTEM: Bridge synchronized.", time, type: 'system' });
            
            const count = io.sockets.adapter.rooms.get(key)?.size || 0;
            io.to(key).emit('user-update', { count });
            socket.emit('login-success');
        }
    });

    socket.on('send-message', (data) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msg = { text: data.message, time, senderId: socket.id, type: 'user' };
        if (roomMessages[data.room]) roomMessages[data.room].push(msg);
        io.to(data.room).emit('receive-message', msg);
    });

    socket.on('end-session', (room) => {
        delete roomMessages[room];
        delete roomPasswords[room];
        io.to(room).emit('force-logout');
    });
});

server.listen(3000, '0.0.0.0', () => console.log('Bridge Live'));
