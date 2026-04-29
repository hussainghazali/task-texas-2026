/**
 * Socket.IO integration test: CS_JOIN_ROOM -> SC_ROOM_PLAYER_JOINED broadcast
 * Run: node test-socket.js  (server must be on port 7777)
 */

const http = require('http');

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 7777,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Open a new Socket.IO polling connection, returns sid
async function sioOpen() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:7777/socket.io/?EIO=4&transport=polling', (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        // Packet format: "0{...json...}"
        const m = raw.match(/0(\{.*\})/s);
        if (!m) return reject(new Error('Bad open packet: ' + raw));
        resolve(JSON.parse(m[1]).sid);
      });
    }).on('error', reject);
  });
}

// Send a Socket.IO packet via POST
function sioPost(sid, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 7777,
        path: `/socket.io/?EIO=4&transport=polling&sid=${sid}`,
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => { res.resume(); res.on('end', resolve); },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Long-poll once for incoming packets, returns raw string
function sioPoll(sid, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 7777,
        path: `/socket.io/?EIO=4&transport=polling&sid=${sid}`,
        method: 'GET',
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve(raw));
      },
    );
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve('TIMEOUT'); });
    req.on('error', (e) => resolve('ERROR:' + e.message));
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function run() {
  console.log('=== Socket.IO Integration Test ===\n');

  // STEP 1: Create a room via REST
  console.log('STEP 1: Creating room via REST...');
  const createRes = await httpRequest('POST', '/api/rooms', { name: 'Broadcast Test Room', maxPlayers: 4 });
  const roomId = createRes.body?.data?.room?.id;
  if (!roomId) {
    console.error('FAIL: Could not extract roomId. Response:', JSON.stringify(createRes.body));
    process.exit(1);
  }
  console.log('  Room ID:', roomId);

  // STEP 2: Open two fresh Socket.IO connections
  console.log('\nSTEP 2: Opening two Socket.IO connections...');
  const sidA = await sioOpen(); // Sender
  const sidB = await sioOpen(); // Receiver
  console.log('  Sender   (A) sid:', sidA);
  console.log('  Receiver (B) sid:', sidB);

  // Send Socket.IO CONNECT packet on both (required before any events)
  await sioPost(sidA, '40');
  await sioPost(sidB, '40');
  await sleep(150);

  // Drain the CONNECT ack on both sockets ("40" response)
  await sioPoll(sidA, 1000);
  await sioPoll(sidB, 1000);
  await sleep(100);

  // STEP 3: Socket B subscribes to the room (no playerName = no broadcast)
  console.log('\nSTEP 3: Socket B subscribes to room (no playerName)...');
  await sioPost(sidB, `42${JSON.stringify(['CS_JOIN_ROOM', { roomId }])}`);
  await sleep(200);

  // STEP 4: Start Socket B long-poll BEFORE Socket A fires the event
  console.log('STEP 4: Socket B listening for SC_ROOM_PLAYER_JOINED...');
  const listenerPromise = sioPoll(sidB, 6000);
  await sleep(100);

  // STEP 5: Socket A joins with playerName -> triggers broadcast to all room members
  const eventPayload = `42${JSON.stringify(['CS_JOIN_ROOM', { roomId, playerName: 'Hussain', playerId: 'player_456' }])}`;
  console.log('STEP 5: Socket A sends CS_JOIN_ROOM:', eventPayload);
  await sioPost(sidA, eventPayload);

  // STEP 6: Wait for Socket B to receive the broadcast
  console.log('\nSTEP 6: Waiting for broadcast on Socket B...');
  const result = await listenerPromise;

  console.log('  Raw received:', result);

  if (result === 'TIMEOUT') {
    console.log('\nFAIL: Timed out. Check server logs for CS_JOIN_ROOM activity.');
    process.exit(1);
  }

  if (!result.includes('SC_ROOM_PLAYER_JOINED')) {
    console.log('\nFAIL: Expected SC_ROOM_PLAYER_JOINED but got:', result);
    process.exit(1);
  }

  console.log('\nPASS: Socket B received SC_ROOM_PLAYER_JOINED broadcast!');

  // Parse and pretty-print
  try {
    const packets = result.split('\x1e').filter(Boolean);
    for (const p of packets) {
      if (p.includes('SC_ROOM_PLAYER_JOINED')) {
        const json = JSON.parse(p.slice(p.indexOf('[')));
        console.log('\nEvent name :', json[0]);
        console.log('Payload    :', JSON.stringify(json[1], null, 2));
      }
    }
  } catch { /* non-fatal */ }
}

run().catch((err) => { console.error('Test error:', err); process.exit(1); });
