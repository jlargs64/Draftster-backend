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
		if (socket.id.includes('-')) {
			const data = socket.id.split('-');
			const name = data[0];
			const roomId = data[1];
			// If the room exists and this player belongs to it
			if (
				rooms.hasOwnProperty(roomId) &&
				rooms[roomId].players.includes(name)
			) {
				// Remove user from room
				const updatedPlayers = rooms[roomId].players.filter(
					(value) => value != name
				);

				// If all the players left, delete the room
				if (updatedPlayers.length === 0) {
					delete rooms[roomId];
				} else {
					rooms[roomId].players = updatedPlayers;

					// send new players array too
					//Notify users of disconnect
					socket.to(roomId).emit('userDisconnected', {
						name: name,
						updatedPlayers: updatedPlayers,
					});
				}
			}
		}
	});

	// The user creates a room
	socket.on('createRoom', (data, fn) => {
		const roomId = data.roomId;
		const hostName = data.name;
		// Check if room id is valid
		if (roomId !== '') {
			// Check if room has been created
			if (rooms[roomId] === undefined) {
				if (hostName !== '' && !hostName.includes('-')) {
					// Create and join the room
					socket.join(roomId);
					socket.id = hostName + '-' + roomId;
					rooms[roomId] = {
						id: roomId,
						players: [hostName],
						messages: [],
						currentTurn: 0,
						inProgress: false,
						availablePicks: ['MSFT', 'AAPL', 'TSLA', 'NFLX'],
					};
					// Success
					return fn({
						room: rooms[roomId],
					});
				} else {
					// The room exists but the player name is invalid
					return fn({
						error: `That name is not valid. Make sure it's not empty and doesn't include dashes.`,
					});
				}
			} else {
				// The room already exists
				return fn({
					error: `That room id already exists, please choose another.`,
				});
			}
		} else {
			// The room name is invalid
			return fn({
				error: `That room id is not valid. Make sure it's not empty and doesn't include dashes.`,
			});
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

					// Add player to room and send new data to players
					rooms[roomId].players.push(playerName);
					const players = rooms[roomId].players;

					// Notify players a new user has joined
					io.emit('userConnected', { name: playerName, players: players });

					// Both fields are good!
					// Send message history as well
					return fn({
						room: rooms[roomId],
					});
				} else {
					// The room exists but the name is in use
					return fn({
						error: `That name is not valid. Make sure it's not empty and doesn't include dashes.`,
					});
				}
			} else {
				// The room exists but the name is in use
				return fn({ error: `That name is already in use in room: ${roomId}` });
			}
		} else {
			// The room does not exist
			return fn({ error: `That room does not exist.` });
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
