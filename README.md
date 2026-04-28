# Texas Hold'em Online - Real-Time Multiplayer Game

A full-stack, real-time multiplayer poker game built with Node.js, React, and Socket.io. This MVP version features complete Texas Hold'em game logic, WebSocket-based real-time synchronization, and a modern React frontend.

---

## Features

### Game Features
- **Real-time Multiplayer Poker**: Play Texas Hold'em with up to 5 players per table
- **Complete Game Logic**: Full implementation of poker rules including:
  - Pre-flop, flop, turn, and river betting rounds
  - Blinds system (small blind & big blind)
  - Side pot calculation for all-in scenarios
  - Hand evaluation using poker solver library
  - Automatic showdown and winner determination
- **Player Management**:
  - Join/leave tables
  - Sit down/stand up
  - Rebuy chips
  - Sit out functionality
- **Lobby System**: 
  - View available tables
  - Real-time player list
  - Lobby chat functionality

### Technical Features
- **Real-time Synchronization**: Socket.io for instant game state updates
- **Secure Authentication**: JWT-based authentication system
- **Responsive UI**: Modern React interface with Bootstrap and styled-components
- **State Management**: Zustand for client-side state
- **Card Visualization**: Custom card assets and SVG rendering

---

## Getting Started

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd texas-holdem-online
   ```

2. **Install server dependencies**
   ```bash
   npm install --force
   ```

3. **Install client dependencies**
   ```bash
   cd client
   npm install --force
   cd ..
   ```

4. **Start the development servers**
   ```bash
   npm start
   ```
   
   This will start both the backend server (port 7777) and the React development server (port 3000) concurrently.

   Or run them separately:
   ```bash
   # Terminal 1: Backend server
   npm run dev:server
   
   # Terminal 2: Frontend client
   npm run start:client
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:7777

---

## Game Rules & Mechanics

### Texas Hold'em Rules

This implementation follows standard Texas Hold'em poker rules:

1. **Blinds**: Small blind and big blind are posted before each hand
2. **Betting Rounds**:
   - **Pre-flop**: After receiving 2 hole cards
   - **Flop**: After 3 community cards are dealt
   - **Turn**: After 4th community card
   - **River**: After 5th community card
3. **Actions Available**:
   - **Fold**: Discard hand and forfeit pot
   - **Check**: Pass action (when no bet to call)
   - **Call**: Match the current bet
   - **Raise**: Increase the bet amount
4. **Showdown**: Best 5-card hand wins (using 2 hole cards + 5 community cards)
5. **Side Pots**: Automatically calculated when players go all-in

### Game Flow

1. Players join a table and sit down
2. When 2+ players are seated, a new hand starts automatically
3. Blinds are posted, cards are dealt
4. Betting rounds proceed (pre-flop → flop → turn → river)
5. Showdown determines winner(s)
6. Chips are distributed
7. New hand begins after 5 seconds

---

## Contributing

This is an MVP project. For improvements:
1. Review the code structure
2. Test game mechanics thoroughly
3. Ensure Socket.io events are properly handled
4. Maintain consistent code style

---

## License

This project is private and unlicensed.

---

## Enjoy Playing!

Good luck at the tables!# texas-2026
