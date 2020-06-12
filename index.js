const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cors = require('cors');

const port = process.env.PORT || 6969;

const rooms = {};

app.use(cors());

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
        // Remove user stock picks
        delete rooms[roomId].playerPicks[name];
        const updatedPlayerPicks = rooms[roomId].playerPicks;

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
            updatedPlayerPicks: updatedPlayerPicks
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
            currentRound: 1,
            inProgress: false,
            availablePicks: ['MSFT', 'AAPL', 'TSLA', 'NFLX'],
            playerPicks: {}
          };
          rooms[roomId].playerPicks[hostName] = [];

          // Success
          return fn({
            room: rooms[roomId]
          });
        } else {
          // The room exists but the player name is invalid
          return fn({
            error: `That name is not valid. Make sure it's not empty and doesn't include dashes.`
          });
        }
      } else {
        // The room already exists
        return fn({
          error: `That room id already exists, please choose another.`
        });
      }
    } else {
      // The room name is invalid
      return fn({
        error: `That room id is not valid. Make sure it's not empty and doesn't include dashes.`
      });
    }
  });

  // The user joins a room
  socket.on('joinRoom', (data, fn) => {
    const roomId = data.roomId;
    const playerName = data.name;

    // Check if room has been created
    if (rooms.hasOwnProperty(roomId)) {
      // Check if room's draft is already in progress
      if (!rooms[roomId].inProgress) {
        // Check if player name is available
        if (!rooms[roomId].players.includes(playerName)) {
          if (playerName !== '' && !playerName.includes('-')) {
            // Create and join the room
            socket.join(roomId);
            socket.id = playerName + '-' + roomId;

            // Add player to room and send new data to players
            rooms[roomId].players.push(playerName);
            rooms[roomId].playerPicks[playerName] = [];
            const players = rooms[roomId].players;
            const playerPicks = rooms[roomId].playerPicks;

            // Notify players a new user has joined
            io.emit('userConnected', {
              name: playerName,
              players: players,
              playerPicks: playerPicks
            });

            // Both fields are good!
            // Send message history as well
            return fn({
              room: rooms[roomId]
            });
          } else {
            // The room exists but the name is in use
            return fn({
              error: `That name is not valid. Make sure it's not empty and doesn't include dashes.`
            });
          }
        } else {
          // The room exists but the name is in use
          return fn({
            error: `That name is already in use in room: ${roomId}`
          });
        }
      } else {
        // The room is in progress so you can't join
        return fn({
          error: `That room is currently locked and in progress.`
        });
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

  // Lock the room to start the draft
  // and set to in progress
  socket.on('lockRoom', () => {
    const roomId = socket.id.split('-')[1];
    rooms[roomId].inProgress = true;
    socket.to(roomId).emit('lockRoom');
  });

  socket.on('selectPick', (pick, fn) => {
    const data = socket.id.split('-');
    const name = data[0];
    const roomId = data[1];

    // Only process if draft is in progress
    if (rooms[roomId].inProgress) {
      const currentTurn = rooms[roomId].currentTurn;
      // Only pick if it's the players current turn
      if (name === rooms[roomId].players[currentTurn]) {
        // Add the pick to the player's team
        rooms[roomId].playerPicks[name].push(pick);

        // Remove the pick from available picks
        rooms[roomId].availablePicks = rooms[roomId].availablePicks.filter(
          (value) => value != pick
        );
        const updatedAvailablePicks = rooms[roomId].availablePicks;
        const updatedPlayerPicks = rooms[roomId].playerPicks;
        // Increment turn
        let updatedTurnNum = rooms[roomId].currentTurn + 1;
        let updatedRoundNum = rooms[roomId].currentRound;
        // Increment round if all players took their turn
        if (updatedTurnNum > rooms[roomId].players.length - 1) {
          updatedTurnNum = 0;
          updatedRoundNum += 1;
        }
        rooms[roomId].currentTurn = updatedTurnNum;
        rooms[roomId].currentRound = updatedRoundNum;
        const response = {
          updatedAvailablePicks: updatedAvailablePicks,
          updatedPlayerPicks: updatedPlayerPicks,
          updatedTurnNum: updatedTurnNum,
          updatedRoundNum: updatedRoundNum
        };

        socket.to(roomId).emit('selectPick', response);
      } else {
        console.log(currentTurn);
        console.log(rooms[roomId].players[currentTurn]);
        // It's not the players turn
        return fn({
          error: `It's not the your turn!`
        });
      }
    } else {
      // The draft is not in progress
      return fn({
        error: `The draft is not in progress.`
      });
    }
  });
});
