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
            // Send history so late-comers see previous messages
            socket.emit('load-history', roomMessages[key]);

            const time = new Date().toLocaleTimeString();
            io.to(key).emit('receive-message', { 
                text: `*** NODE_${socket.id.substring(0,4)} CONNECTED ***`, 
                time: time, type: 'system' 
            });

            socket.emit('login-success');
        }
    });

    socket.on('send-message', (data) => {
        const time = new Date().toLocaleTimeString();
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
});

server.listen(3000, () => console.log('Terminal Bridge Active'));
