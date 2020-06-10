const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 6969;

http.listen(port, () => {
	console.log(`Draftster API running on ${port}`);
});

io.on('connection', (socket) => {
	// A user connected
	io.emit('userConnected');

	// The user disconnected
	socket.on('disconnect', () => {
		//Notify users of disconnect
		io.emit('userDisconnected');
	});

	// The user creates a room
	socket.on('createRoom', (roomId) => {
		socket.join(roomId);
	});

	// The user joins a room
	socket.on('joinRoom', (roomId) => {
		socket.join(roomId);
	});

	// Message from client
	socket.on('message', (data) => {
		const message = data.message;
		const roomId = data.roomId;
		// Send to all clients
		socket.to(roomId).emit('message', message);
	});
});
