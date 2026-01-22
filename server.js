const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Volatile Memory - Cleared on server restart or manual 'Wipe'
let roomMessages = {}; 
let roomPasswords = {}; 

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    
    socket.on('join-room', (data) => {
        const { key, password } = data;
        
        // Initialize room if it doesn't exist
        if (!roomPasswords[key]) {
            roomPasswords[key] = password;
            roomMessages[key] = [];
        }

        // Security Check
        if (roomPasswords[key] === password) {
            socket.join(key);
            socket.currentRoom = key;

            // PUSH HISTORY: This allows offline users to catch up
            socket.emit('load-history', roomMessages[key]);

            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const systemMsg = { 
                text: "🔒 Node linked. Tunnel history synchronized.", 
                time: time, 
                type: 'system' 
            };
            
            // Broadcast join message to others
            socket.to(key).emit('receive-message', systemMsg);
            // Send specifically to the joiner
            socket.emit('receive-message', { ...systemMsg, text: "🔒 Bridge established. Connection synchronized." });

            const roomSize = io.sockets.adapter.rooms.get(key)?.size || 0;
            io.to(key).emit('user-update', { count: roomSize });
            socket.emit('login-success');
        } else {
            socket.emit('login-error', "Access Denied: Invalid Credentials.");
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
        
        // Save to RAM
        if (roomMessages[data.room]) {
            roomMessages[data.room].push(newMessage);
            // Cap history at 100 messages to prevent memory leaks
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
server.listen(PORT, '0.0.0.0', () => console.log(`Secure Bridge live on port ${PORT}`));
