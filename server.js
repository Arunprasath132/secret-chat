const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });


let roomMessages = {}; 

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('New connection established');

    
    socket.on('get-preview', (key) => {
        if (roomMessages[key] && roomMessages[key].length > 0) {
            const lastMsg = roomMessages[key][roomMessages[key].length - 1];
            socket.emit('preview-response', { text: lastMsg.text, time: lastMsg.time });
        } else {
            socket.emit('preview-response', { text: "No active messages", time: "" });
        }
    });

    
    socket.on('join-room', (key) => {
        socket.join(key);
        socket.currentRoom = key;

        
        if (roomMessages[key]) {
            socket.emit('load-history', roomMessages[key]);
        }

        const roomSize = io.sockets.adapter.rooms.get(key)?.size || 0;
        io.to(key).emit('user-update', { count: roomSize, event: 'joined' });
    });

    
    socket.on('send-message', (data) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMessage = { 
            text: data.message, 
            time: time, 
            senderId: socket.id 
        };

        if (!roomMessages[data.room]) roomMessages[data.room] = [];
        roomMessages[data.room].push(newMessage);
        
        // Limit to 50 messages per room to save memory
        if (roomMessages[data.room].length > 50) roomMessages[data.room].shift();

        io.to(data.room).emit('receive-message', newMessage);
    });

    
    socket.on('typing', (data) => {
        socket.to(data.room).emit('display-typing', data.isTyping);
    });

    
    socket.on('end-session', (room) => {
        delete roomMessages[room];
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
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
