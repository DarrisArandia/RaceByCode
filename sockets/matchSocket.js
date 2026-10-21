// sockets/matchSocket.js — PLACEHOLDER
//
// Real version later: on a player joining a match, on submitting an answer,
// broadcast leaderboard/car-progress updates to everyone in that match room.
//
// For now this just confirms a socket connection happened, so we can verify
// Socket.IO itself is wired up correctly before building real match logic.

function registerMatchSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = registerMatchSocket;