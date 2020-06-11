const { hostname } = require('os');
const { RSA_PKCS1_PADDING } = require('constants');

const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 6969;

const rooms = {};

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
	socket.on('createRoom', (data, fn) => {
		const roomId = data.roomId;
		const hostName = data.name;
		// Check if room has been created
		if (rooms[roomId] === undefined) {
			// Create and join the room
			socket.join(roomId);
			rooms[roomId] = {
				players: [hostName],
				messages: [],
			};
			return fn({ roomExists: false });
		} else {
			return fn({ roomExists: true });
		}
	});

	// The user joins a room
	socket.on('joinRoom', (data, fn) => {
		const roomId = data.roomId;
		const playerName = data.name;

		// Check if room has been created
		if (rooms.hasOwnProperty(roomId)) {
			// Check if player name is available

			if (!rooms[roomId].players.includes(playerName)) {
				// Create and join the room
				socket.join(roomId);
				rooms[roomId].players.push(playerName);
				const messageHistory = rooms[roomId].messages;
				// Both fields are good!
				// Send message history as well
				return fn({
					roomExists: true,
					nameInUse: false,
					messages: messageHistory,
				});
			} else {
				// The room exists but the name is in use
				return fn({ roomExists: true, nameInUse: true });
			}
		} else {
			// The room does not exist
			return fn({ roomExists: false, nameInUse: false });
		}
	});

	// Message from client
	socket.on('message', (data) => {
		const message = data.message;
		const roomId = data.roomId;
		// Save message to room messages history
		rooms[roomId].messages.push(message);
		// Send to all clients
		socket.to(roomId).emit('message', message);
	});
});
