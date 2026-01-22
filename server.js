const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Server-side temporary storage
let roomMessages = {}; 
let roomPasswords = {}; 

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    // 1. Preview Logic for Login Screen
    socket.on('get-preview', (key) => {
        if (roomMessages[key] && roomMessages[key].length > 0) {
            const lastMsg = roomMessages[key][roomMessages[key].length - 1];
            socket.emit('preview-response', { text: lastMsg.text, time: lastMsg.time });
        } else {
            socket.emit('preview-response', { text: "No active messages", time: "" });
        }
    });

    // 2. Secured Room Entry
    socket.on('join-room', (data) => {
        const { key, password } = data;
        
        // Set password if room is being created for the first time
        if (!roomPasswords[key]) {
            roomPasswords[key] = password;
        }

        // Validate password match
        if (roomPasswords[key] === password) {
            socket.join(key);
            socket.currentRoom = key;

            // Send history to the joined user
            if (roomMessages[key]) {
                socket.emit('load-history', roomMessages[key]);
            }

            const roomSize = io.sockets.adapter.rooms.get(key)?.size || 0;
            io.to(key).emit('user-update', { count: roomSize, event: 'joined' });
            socket.emit('login-success');
        } else {
            socket.emit('login-error', "Access Denied: Invalid Password.");
        }
    });

    // 3. Message Handling
    socket.on('send-message', (data) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMessage = { text: data.message, time: time, senderId: socket.id };

        if (!roomMessages[data.room]) roomMessages[data.room] = [];
        roomMessages[data.room].push(newMessage);
        
        // Memory limit: 50 messages per bridge
        if (roomMessages[data.room].length > 50) roomMessages[data.room].shift();

        io.to(data.room).emit('receive-message', newMessage);
    });

    // 4. Typing Indicator
    socket.on('typing', (data) => {
        socket.to(data.room).emit('display-typing', data.isTyping);
    });

    // 5. Termination (Wipe)
    socket.on('end-session', (room) => {
        delete roomMessages[room];
        delete roomPasswords[room];
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
server.listen(PORT, '0.0.0.0', () => console.log(`Secure Bridge live on ${PORT}`));
