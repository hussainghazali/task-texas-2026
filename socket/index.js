const jwt = require('jsonwebtoken');
const Table = require('../core/Table');
const Player = require('../core/Player');
const logger = require('../utils/logger');
const {
  CS_FETCH_LOBBY_INFO,
  SC_RECEIVE_LOBBY_INFO,
  SC_PLAYERS_UPDATED,
  CS_JOIN_TABLE,
  SC_TABLE_JOINED,
  SC_TABLES_UPDATED,
  CS_LEAVE_TABLE,
  SC_TABLE_LEFT,
  CS_FOLD,
  CS_CHECK,
  CS_CALL,
  CS_RAISE,
  TABLE_MESSAGE,
  CS_SIT_DOWN,
  CS_REBUY,
  CS_STAND_UP,
  SITTING_OUT,
  SITTING_IN,
  CS_DISCONNECT,
  SC_TABLE_UPDATED,
  WINNER,
  CS_LOBBY_CONNECT,
  CS_LOBBY_DISCONNECT,
  SC_LOBBY_CONNECTED,
  SC_LOBBY_DISCONNECTED,
  SC_LOBBY_CHAT,
  CS_LOBBY_CHAT,
  CS_JOIN_ROOM,
  SC_ROOM_PLAYER_JOINED,
} = require('../core/actions');
const roomStore = require('../utils/roomStore');
const config = require('../config');

const tables = {
  1: new Table(1, 'Table 1', config.INITIAL_CHIPS_AMOUNT),
};
const players = {};
const BOT_SOCKET_ID = 'bot-demo-1';

function getCurrentPlayers() {
  return Object.values(players)
    .filter((p) => p.socketId !== BOT_SOCKET_ID)
    .map((player) => ({
      socketId: player.socketId,
      id: player.id,
      name: player.name,
    }));
}

function getCurrentTables() {
  return Object.values(tables).map((table) => ({
    id: table.id,
    name: table.name,
    limit: table.limit,
    maxPlayers: table.maxPlayers,
    currentNumberPlayers: table.players.length,
    smallBlind: table.minBet,
    bigBlind: table.minBet * 2,
  }));
}

/**
 * Initialize socket connection handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
const init = (socket, io) => {
  logger.info('New socket connection:', socket.id);

  // Lobby event handlers
  socket.on(CS_LOBBY_CONNECT, ({ gameId, address, userInfo }) => {
    try {
      socket.join(gameId);
      io.to(gameId).emit(SC_LOBBY_CONNECTED, { address, userInfo });
      logger.socket(SC_LOBBY_CONNECTED, { address, socketId: socket.id });
    } catch (error) {
      logger.error('Error in CS_LOBBY_CONNECT:', error);
    }
  });

  socket.on(CS_LOBBY_DISCONNECT, ({ gameId, address, userInfo }) => {
    try {
      io.to(gameId).emit(SC_LOBBY_DISCONNECTED, { address, userInfo });
      logger.socket(CS_LOBBY_DISCONNECT, { address, socketId: socket.id });
    } catch (error) {
      logger.error('Error in CS_LOBBY_DISCONNECT:', error);
    }
  });

  socket.on(CS_LOBBY_CHAT, ({ gameId, text, userInfo }) => {
    try {
      io.to(gameId).emit(SC_LOBBY_CHAT, { text, userInfo });
    } catch (error) {
      logger.error('Error in CS_LOBBY_CHAT:', error);
    }
  });

  socket.on(CS_FETCH_LOBBY_INFO, ({ walletAddress, socketId, gameId, username }) => {
    try {
      if (!walletAddress || !username) {
        logger.warn('Invalid lobby info request:', { walletAddress, username });
        return;
      }

      // Remove existing player if reconnecting
      const found = Object.values(players).find(
        (player) => player.id === walletAddress,
      );

      if (found) {
        delete players[found.socketId];
        Object.values(tables).forEach((table) => {
          table.removePlayer(found.socketId);
          broadcastToTable(table);
        });
      }

      // Create new player instance
      players[socketId] = new Player(
        socketId,
        walletAddress,
        username,
        config.INITIAL_CHIPS_AMOUNT,
      );

      // Send lobby info to requesting player
      socket.emit(SC_RECEIVE_LOBBY_INFO, {
        tables: getCurrentTables(),
        players: getCurrentPlayers(),
        socketId: socket.id,
        amount: config.INITIAL_CHIPS_AMOUNT,
      });

      // Notify other players
      socket.broadcast.emit(SC_PLAYERS_UPDATED, getCurrentPlayers());
    } catch (error) {
      logger.error('Error in CS_FETCH_LOBBY_INFO handler:', error);
    }
  });

  socket.on(CS_JOIN_TABLE, (tableId) => {
    try {
      const table = tables[tableId];
      const player = players[socket.id];

      if (!table) {
        logger.error(`Table ${tableId} not found`);
        socket.emit('error', { message: 'Table not found' });
        return;
      }

      if (!player) {
        logger.error(`Player not found for socket ${socket.id}. Player must register via CS_FETCH_LOBBY_INFO first.`);
        // Don't emit error event as it causes unhandled error - just log and return
        // The client should handle this by registering the player first
        return;
      }

      logger.info('Player joining table:', { tableId, playerName: player.name });

      // Add player to table
      table.addPlayer(player);
      
      // Notify player of successful join
      socket.emit(SC_TABLE_JOINED, { 
        tables: getCurrentTables(), 
        tableId 
      });
      
      // Update other players about table changes
      socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
      
      // Automatically sit player down
      sitDown(tableId, table.players.length, table.limit);

      // Add demo bot if only 1 player (so user can play immediately)
      if (table.activePlayers().length === 1) {
        const botPlayer = new Player(
          BOT_SOCKET_ID,
          'bot-demo',
          'Demo Bot',
          config.INITIAL_CHIPS_AMOUNT,
        );
        players[BOT_SOCKET_ID] = botPlayer;
        table.addPlayer(botPlayer);
        const botSeatId = 2;
        table.sitPlayer(botPlayer, botSeatId, table.limit);
        initNewHand(table);
      }

      // Immediately send current table state to the joining player
      const tableCopy = hideOpponentCards(table, socket.id);
      socket.emit(SC_TABLE_UPDATED, {
        table: tableCopy,
        message: null,
        from: null,
      });

      // Broadcast join message to other players
      if (table.players.length > 0) {
        const message = `${player.name} joined the table.`;
        broadcastToTable(table, message);
      }
    } catch (error) {
      logger.error('Error in CS_JOIN_TABLE handler:', error);
      socket.emit('error', { message: 'Failed to join table' });
    }
  });

  socket.on(CS_LEAVE_TABLE, (tableId) => {
    try {
      const table = tables[tableId];
      const player = players[socket.id];

      if (!table) {
        logger.error(`Table ${tableId} not found`);
        return;
      }

      // Find player's seat and update bankroll
      const seat = Object.values(table.seats).find(
        (seat) => seat && seat.player?.socketId === socket.id,
      );

      if (seat && player) {
        updatePlayerBankroll(player, seat.stack);
      }

      // Remove player from table
      table.removePlayer(socket.id);

      // Notify other players
      socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
      socket.emit(SC_TABLE_LEFT, { tables: getCurrentTables(), tableId });

      // Broadcast leave message
      if (table.players.length > 0 && player) {
        const message = `${player.name} left the table.`;
        broadcastToTable(table, message);
      }

      // Handle single player scenario
      if (table.activePlayers().length === 1) {
        clearForOnePlayer(table);
      }
    } catch (error) {
      logger.error('Error in CS_LEAVE_TABLE handler:', error);
    }
  });

  socket.on(CS_FOLD, (tableId) => {
    try {
      const table = tables[tableId];
      if (!table) {
        logger.error(`Table ${tableId} not found for fold action`);
        return;
      }

      const result = table.handleFold(socket.id);
      if (result) {
        broadcastToTable(table, result.message);
        changeTurnAndBroadcast(table, result.seatId);
      }
    } catch (error) {
      logger.error('Error in CS_FOLD handler:', error);
    }
  });

  socket.on(CS_CHECK, (tableId) => {
    try {
      const table = tables[tableId];
      if (!table) {
        logger.error(`Table ${tableId} not found for check action`);
        return;
      }

      const result = table.handleCheck(socket.id);
      if (result) {
        broadcastToTable(table, result.message);
        changeTurnAndBroadcast(table, result.seatId);
      }
    } catch (error) {
      logger.error('Error in CS_CHECK handler:', error);
    }
  });

  socket.on(CS_CALL, (tableId) => {
    try {
      const table = tables[tableId];
      if (!table) {
        logger.error(`Table ${tableId} not found for call action`);
        return;
      }

      const result = table.handleCall(socket.id);
      if (result) {
        broadcastToTable(table, result.message);
        changeTurnAndBroadcast(table, result.seatId);
      }
    } catch (error) {
      logger.error('Error in CS_CALL handler:', error);
    }
  });

  socket.on(CS_RAISE, ({ tableId, amount }) => {
    try {
      const table = tables[tableId];
      if (!table) {
        logger.error(`Table ${tableId} not found for raise action`);
        return;
      }

      if (!amount || amount <= 0) {
        logger.warn('Invalid raise amount:', amount);
        return;
      }

      const result = table.handleRaise(socket.id, Number(amount));
      if (result) {
        broadcastToTable(table, result.message);
        changeTurnAndBroadcast(table, result.seatId);
      }
    } catch (error) {
      logger.error('Error in CS_RAISE handler:', error);
    }
  });

  socket.on(TABLE_MESSAGE, ({ message, from, tableId }) => {
    let table = tables[tableId];
    broadcastToTable(table, message, from);
  });

  // socket.on(CS_SIT_DOWN, ({ tableId, seatId, amount }) => {
  //   const table = tables[tableId];
  //   const player = players[socket.id];

  //   if (player) {
  //     table.sitPlayer(player, seatId, amount);
  //     let message = `${player.name} sat down in Seat ${seatId}`;

  //     updatePlayerBankroll(player, -amount);

  //     broadcastToTable(table, message);
  //     if (table.activePlayers().length === 2) {
  //       initNewHand(table);
  //     }
  //   }
  // });
  /**
   * Handle player sitting down at a seat
   * @param {number} tableId - Table ID
   * @param {number} seatId - Seat number
   * @param {number} amount - Buy-in amount
   */
  const sitDown = (tableId, seatId, amount) => {
    try {
      const table = tables[tableId];
      const player = players[socket.id];

      if (!table) {
        logger.error(`Table ${tableId} not found`);
        return;
      }

      if (!player) {
        logger.error(`Player not found for socket ${socket.id}`);
        return;
      }

      table.sitPlayer(player, seatId, amount);
      const message = `${player.name} sat down in Seat ${seatId}`;

      updatePlayerBankroll(player, -amount);

      broadcastToTable(table, message);

      // Start new hand if 2+ players are active
      if (table.activePlayers().length === 2) {
        initNewHand(table);
      }
    } catch (error) {
      logger.error('Error in sitDown:', error);
    }
  };

  socket.on(CS_REBUY, ({ tableId, seatId, amount }) => {
    try {
      const table = tables[tableId];
      const player = players[socket.id];

      if (!table || !player) {
        logger.error('Invalid rebuy request:', { tableId, seatId, amount });
        return;
      }

      if (!amount || amount <= 0) {
        logger.warn('Invalid rebuy amount:', amount);
        return;
      }

      table.rebuyPlayer(seatId, amount);
      updatePlayerBankroll(player, -amount);

      broadcastToTable(table);
    } catch (error) {
      logger.error('Error in CS_REBUY handler:', error);
    }
  });

  socket.on(CS_STAND_UP, (tableId) => {
    try {
      const table = tables[tableId];
      const player = players[socket.id];

      if (!table) {
        logger.error(`Table ${tableId} not found`);
        return;
      }

      const seat = Object.values(table.seats).find(
        (seat) => seat && seat.player?.socketId === socket.id,
      );

      let message = '';
      if (seat && player) {
        updatePlayerBankroll(player, seat.stack);
        message = `${player.name} left the table`;
      }

      table.standPlayer(socket.id);

      broadcastToTable(table, message);

      if (table.activePlayers().length === 1) {
        clearForOnePlayer(table);
      }
    } catch (error) {
      logger.error('Error in CS_STAND_UP handler:', error);
    }
  });

  socket.on(SITTING_OUT, ({ tableId, seatId }) => {
    try {
      const table = tables[tableId];
      if (!table) {
        logger.error(`Table ${tableId} not found`);
        return;
      }

      const seat = table.seats[seatId];
      if (seat) {
        seat.sittingOut = true;
        broadcastToTable(table);
      }
    } catch (error) {
      logger.error('Error in SITTING_OUT handler:', error);
    }
  });

  socket.on(SITTING_IN, ({ tableId, seatId }) => {
    try {
      const table = tables[tableId];
      if (!table) {
        logger.error(`Table ${tableId} not found`);
        return;
      }

      const seat = table.seats[seatId];
      if (seat) {
        seat.sittingOut = false;
        broadcastToTable(table);

        // Start new hand if conditions are met
        if (table.handOver && table.activePlayers().length === 2) {
          initNewHand(table);
        }
      }
    } catch (error) {
      logger.error('Error in SITTING_IN handler:', error);
    }
  });

  // Room event: client subscribes to a room channel and optionally joins it
  socket.on(CS_JOIN_ROOM, ({ roomId, playerName, playerId }) => {
    try {
      console.log('🔥🔥🔥 CS_JOIN_ROOM RECEIVED 🔥🔥🔥');
      console.log('Room ID:', roomId);
      console.log('Player Name:', playerName);
      console.log('Player ID:', playerId);
      
      if (!roomId) {
        console.log('❌ Missing roomId');
        logger.warn('CS_JOIN_ROOM missing roomId');
        return;
      }
  
      const room = roomStore.findById(roomId);
      console.log('Room found in store:', room ? 'YES' : 'NO');
      
      if (!room) {
        console.log('❌ Room not found!');
        socket.emit('error', { message: 'Room not found' });
        return;
      }
  
      // Subscribe this socket to the room's broadcast channel
      socket.join(`room:${roomId}`);
      console.log(`✅ Socket joined room:${roomId}`);
  
      if (playerName) {
        const player = { id: playerId || socket.id, name: playerName };
        const updatedRoom = roomStore.addPlayer(roomId, player);
        
        console.log(`📡 BROADCASTING to room:${roomId}`);
        io.to(`room:${roomId}`).emit(SC_ROOM_PLAYER_JOINED, {
          roomId,
          player,
          room: updatedRoom,
        });
  
        console.log(`✅ Broadcast complete!`);
        logger.info(`[BROADCAST] SC_ROOM_PLAYER_JOINED -> room:${roomId}`, { player, socketId: socket.id });
      }
    } catch (error) {
      console.error('💥 Error in CS_JOIN_ROOM:', error);
      logger.error('Error in CS_JOIN_ROOM handler:', error);
    }
  });

  socket.on(CS_DISCONNECT, () => {
    try {
      const seat = findSeatBySocketId(socket.id);
      if (seat && seat.player) {
        updatePlayerBankroll(seat.player, seat.stack);
      }

      delete players[socket.id];
      removeFromTables(socket.id);

      socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
      socket.broadcast.emit(SC_PLAYERS_UPDATED, getCurrentPlayers());

      logger.info('Player disconnected:', socket.id);
    } catch (error) {
      logger.error('Error in CS_DISCONNECT handler:', error);
    }
  });

  // Handle socket disconnection
  socket.on('disconnect', () => {
    try {
      const seat = findSeatBySocketId(socket.id);
      if (seat && seat.player && players[socket.id]) {
        updatePlayerBankroll(seat.player, seat.stack);
      }

      delete players[socket.id];
      removeFromTables(socket.id);

      socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
      socket.broadcast.emit(SC_PLAYERS_UPDATED, getCurrentPlayers());

      logger.info('Socket disconnected:', socket.id);
    } catch (error) {
      logger.error('Error handling socket disconnect:', error);
    }
  });

  /**
   * Update player's bankroll
   * @param {Player} player - Player object
   * @param {number} amount - Amount to add/subtract
   */
  function updatePlayerBankroll(player, amount) {
    if (!player || !players[socket.id]) {
      return;
    }
    players[socket.id].bankroll += amount;
    io.to(socket.id).emit(SC_PLAYERS_UPDATED, getCurrentPlayers());
  }

  /**
   * Find seat by socket ID across all tables
   * @param {string} socketId - Socket ID to search for
   * @returns {Seat|null} Found seat or null
   */
  function findSeatBySocketId(socketId) {
    for (const table of Object.values(tables)) {
      for (const seat of Object.values(table.seats)) {
        if (seat && seat.player?.socketId === socketId) {
          return seat;
        }
      }
    }
    return null;
  }

  /**
   * Remove player from all tables
   * @param {string} socketId - Socket ID of player to remove
   */
  function removeFromTables(socketId) {
    Object.values(tables).forEach((table) => {
      table.removePlayer(socketId);
    });
  }

  /**
   * Broadcast table state to all players at the table
   * @param {Table} table - Table object
   * @param {string|null} message - Optional message to broadcast
   * @param {string|null} from - Optional sender identifier
   */
  function broadcastToTable(table, message = null, from = null) {
    if (!table || !table.players) {
      return;
    }

    table.players.forEach((player) => {
      const socketId = player.socketId;
      if (socketId === BOT_SOCKET_ID) return; // Don't emit to bot
      const tableCopy = hideOpponentCards(table, socketId);
      io.to(socketId).emit(SC_TABLE_UPDATED, {
        table: tableCopy,
        message,
        from,
      });
    });

    // Schedule bot action if it's the bot's turn
    if (table.turn && table.seats[table.turn]?.player?.socketId === BOT_SOCKET_ID) {
      setTimeout(() => {
        const seat = table.seats[table.turn];
        if (!seat || seat.player?.socketId !== BOT_SOCKET_ID) return;
        let result;
        if (table.callAmount === 0 || seat.bet >= table.callAmount) {
          result = table.handleCheck(BOT_SOCKET_ID);
        } else if (seat.stack + seat.bet >= table.callAmount) {
          result = table.handleCall(BOT_SOCKET_ID);
        } else {
          result = table.handleFold(BOT_SOCKET_ID);
        }
        if (result) {
          broadcastToTable(table, result.message);
          changeTurnAndBroadcast(table, result.seatId);
        }
      }, 2000);
    }
  }

  /**
   * Change turn and broadcast updated table state
   * @param {Table} table - Table object
   * @param {number} seatId - Seat ID of player who just acted
   */
  function changeTurnAndBroadcast(table, seatId) {
    setTimeout(() => {
      table.changeTurn(seatId);
      broadcastToTable(table);

      if (table.handOver) {
        initNewHand(table);
      }
    }, 1000);
  }

  /**
   * Initialize a new poker hand
   * @param {Table} table - Table object
   */
  function initNewHand(table) {
    if (table.activePlayers().length > 1) {
      broadcastToTable(table, '---New hand starting in 5 seconds---');
    }
    
    setTimeout(() => {
      table.clearWinMessages();
      table.startHand();
      broadcastToTable(table, '--- New hand started ---');
    }, 5000);
  }

  /**
   * Clear table state when only one player remains
   * @param {Table} table - Table object
   */
  function clearForOnePlayer(table) {
    table.clearWinMessages();
    setTimeout(() => {
      table.clearSeatHands();
      table.resetBoardAndPot();
      broadcastToTable(table, 'Waiting for more players');
    }, 5000);
  }

  /**
   * Hide opponent cards from a specific player's view
   * @param {Table} table - Table object
   * @param {string} socketId - Socket ID of the viewing player
   * @returns {Object} Deep copy of table with hidden cards
   */
  function hideOpponentCards(table, socketId) {
    const tableCopy = JSON.parse(JSON.stringify(table));
    const hiddenCard = { suit: 'hidden', rank: 'hidden' };
    const hiddenHand = [hiddenCard, hiddenCard];

    for (let i = 1; i <= tableCopy.maxPlayers; i++) {
      const seat = tableCopy.seats[i];
      if (
        seat &&
        seat.hand?.length > 0 &&
        seat.player?.socketId !== socketId &&
        !(seat.lastAction === WINNER && tableCopy.wentToShowdown)
      ) {
        seat.hand = hiddenHand;
      }
    }
    return tableCopy;
  }
};


module.exports = { init }; 