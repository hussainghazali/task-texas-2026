const { v4: uuidv4 } = require('uuid');

const rooms = {};

const roomStore = {
  create({ name, maxPlayers = 9 }) {
    const id = uuidv4();
    const room = { id, name: name || `Room ${id.slice(0, 6)}`, players: [], status: 'waiting', maxPlayers };
    rooms[id] = room;
    return room;
  },

  findById(id) {
    return rooms[id] || null;
  },

  addPlayer(roomId, player) {
    const room = rooms[roomId];
    if (!room) return null;
    if (!room.players.find((p) => p.id === player.id)) {
      room.players.push(player);
    }
    if (room.players.length >= room.maxPlayers) {
      room.status = 'full';
    }
    return room;
  },

  getAll() {
    return Object.values(rooms);
  },
};

module.exports = roomStore;
