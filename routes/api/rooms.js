const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { createRoom, joinRoom, listRooms, getRoom } = require('../../controllers/rooms');

router.get('/', listRooms);

router.post(
  '/',
  [
    check('name', 'Room name must be a string').optional().isString(),
    check('maxPlayers', 'maxPlayers must be a number between 2 and 9').optional().isInt({ min: 2, max: 9 }),
  ],
  createRoom,
);

router.get('/:id', getRoom);

router.post(
  '/:id/join',
  [
    check('playerName', 'playerName is required').notEmpty().isString(),
  ],
  joinRoom,
);

module.exports = router;
