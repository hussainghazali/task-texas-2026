/**
 * Socket Event Constants
 * Client-to-Server (CS) and Server-to-Client (SC) event names
 */

// Game Actions (Client → Server)
exports.CS_FOLD = 'CS_FOLD';
exports.CS_CHECK = 'CS_CHECK';
exports.CS_CALL = 'CS_CALL';
exports.CS_RAISE = 'CS_RAISE';
exports.CS_REBUY = 'CS_REBUY';
exports.CS_SIT_DOWN = 'CS_SIT_DOWN';
exports.CS_STAND_UP = 'CS_STAND_UP';

// Table Management (Client → Server)
exports.CS_JOIN_TABLE = 'CS_JOIN_TABLE';
exports.CS_LEAVE_TABLE = 'CS_LEAVE_TABLE';
exports.CS_FETCH_LOBBY_INFO = 'CS_FETCH_LOBBY_INFO';
exports.CS_DISCONNECT = 'CS_DISCONNECT';

// Lobby Events (Client → Server)
exports.CS_LOBBY_CONNECT = 'CS_LOBBY_CONNECT';
exports.CS_LOBBY_DISCONNECT = 'CS_LOBBY_DISCONNECT';
exports.CS_LOBBY_CHAT = 'CS_LOBBY_CHAT';

// Game State Updates (Server → Client)
exports.SC_TABLE_UPDATED = 'SC_TABLE_UPDATED';
exports.SC_TABLE_JOINED = 'SC_TABLE_JOINED';
exports.SC_TABLE_LEFT = 'SC_TABLE_LEFT';
exports.SC_TABLES_UPDATED = 'SC_TABLES_UPDATED';
exports.SC_RECEIVE_LOBBY_INFO = 'SC_RECEIVE_LOBBY_INFO';
exports.SC_PLAYERS_UPDATED = 'SC_PLAYERS_UPDATED';

// Lobby Events (Server → Client)
exports.SC_LOBBY_CONNECTED = 'SC_LOBBY_CONNECTED';
exports.SC_LOBBY_DISCONNECTED = 'SC_LOBBY_DISCONNECTED';
exports.SC_LOBBY_CHAT = 'SC_LOBBY_CHAT';

// Room Management (Client → Server)
exports.CS_JOIN_ROOM = 'CS_JOIN_ROOM';

// Room Events (Server → Client)
exports.SC_ROOM_PLAYER_JOINED = 'SC_ROOM_PLAYER_JOINED';

// Game State Constants
exports.WINNER = 'WINNER';
exports.TABLE_MESSAGE = 'TABLE_MESSAGE'; // Internal use only
exports.SITTING_OUT = 'SITTING_OUT'; // Internal use only
exports.SITTING_IN = 'SITTING_IN'; // Internal use only
