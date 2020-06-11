const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 6969;

const rooms = {};

http.listen(port, () => {
	console.log(`Draftster API running on ${port}`);
});

io.on('connection', (socket) => {
	// The user disconnected
	socket.on('disconnect', () => {
		const data = socket.id.split('-');
		const name = data[0];
		const roomId = data[1];
		// Remove user from room
		//rooms[roomId].players.filter((value, index, arr) => value != name);
		// send new players array too
		//Notify users of disconnect
		socket.to(roomId).emit('userDisconnected', name);
	});

	// The user creates a room
	socket.on('createRoom', (data, fn) => {
		const roomId = data.roomId;
		const hostName = data.name;

		// Check if room has been created
		if (rooms[roomId] === undefined) {
			if (hostName !== '' && !hostName.includes('-')) {
				// Create and join the room
				socket.join(roomId);
				socket.id = hostName + '-' + roomId;
				rooms[roomId] = {
					players: [hostName],
					messages: [],
				};
				return fn({
					roomExists: false,
					nameValid: true,
				});
			} else {
				return fn({
					roomExists: false,
					nameValid: false,
				});
			}
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
				if (playerName !== '' && !playerName.includes('-')) {
					// Create and join the room
					socket.join(roomId);
					socket.id = playerName + '-' + roomId;

					// Notify players a new user has joined

					io.emit('userConnected', playerName);

					// Add player to room and send new data to players
					rooms[roomId].players.push(playerName);
					const messageHistory = rooms[roomId].messages;
					const players = rooms[roomId].players;

					// Both fields are good!
					// Send message history as well
					return fn({
						roomExists: true,
						nameInUse: false,
						nameValid: true,
						players: players,
						messages: messageHistory,
					});
				} else {
					// The room exists but the name is in use
					return fn({ roomExists: true, nameInUse: false, nameValid: false });
				}
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
