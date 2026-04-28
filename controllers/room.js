const { validationResult } = require('express-validator');
const { asyncHandler, NotFoundError, ValidationError } = require('../utils/errors');
const { sendSuccess, sendValidationError } = require('../utils/response');
const roomStore = require('../utils/roomStore');
const logger = require('../utils/logger');

/**
 * @route   POST /api/rooms
 * @desc    Create a new room/session
 * @access  Public
 */
exports.createRoom = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { name, maxPlayers } = req.body;
  const room = roomStore.create({ name, maxPlayers });

  logger.info('Room created:', { roomId: room.id, name: room.name });

  return sendSuccess(res, { room }, 'Room created successfully', 201);
});

/**
 * @route   POST /api/rooms/:id/join
 * @desc    Join an existing room and broadcast join event via Socket.IO
 * @access  Public
 */
exports.joinRoom = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { id } = req.params;
  const { playerName, playerId } = req.body;

  const room = roomStore.findById(id);
  if (!room) {
    throw new NotFoundError('Room not found');
  }

  if (room.status === 'full') {
    throw new ValidationError('Room is full');
  }

  const player = { id: playerId || req.body.socketId || `player-${Date.now()}`, name: playerName };
  const updatedRoom = roomStore.addPlayer(id, player);

  logger.info('Player joined room:', { roomId: id, playerId: player.id, playerName: player.name });

  // Broadcast join event to all sockets in the room channel
  const io = req.app.get('io');
  if (io) {
    io.to(`room:${id}`).emit('SC_ROOM_PLAYER_JOINED', {
      roomId: id,
      player,
      room: updatedRoom,
    });
    logger.info(`[BROADCAST] SC_ROOM_PLAYER_JOINED -> room:${id}`, { player });
  }

  return sendSuccess(res, { room: updatedRoom, player }, 'Joined room successfully');
});

/**
 * @route   GET /api/rooms
 * @desc    List all rooms
 * @access  Public
 */
exports.listRooms = asyncHandler(async (req, res) => {
  const rooms = roomStore.getAll();
  return sendSuccess(res, { rooms });
});

/**
 * @route   GET /api/rooms/:id
 * @desc    Get a single room by ID
 * @access  Public
 */
exports.getRoom = asyncHandler(async (req, res) => {
  const room = roomStore.findById(req.params.id);
  if (!room) {
    throw new NotFoundError('Room not found');
  }
  return sendSuccess(res, { room });
});
