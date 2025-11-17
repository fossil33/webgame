const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const PORT = 8080;

require('dotenv').config();

app.use(cors());
app.use(express.json({
    verify: (req, res, buf, encoding) => {
        if (buf && buf.toString() === 'null') {
            req.body = Buffer.from('{}');
        }
    }
}));

let dialogueData = []; // 기본값 빈 배열
let questData = []; // 기본값 빈 배열
try {
    const dialogueJsonPath = path.join(__dirname, '..', 'gamehomepage', 'TemplateData', 'gameData', 'dialogue.json');
    const dialogueJson = fs.readFileSync(dialogueJsonPath, 'utf8');
    dialogueData = JSON.parse(dialogueJson);
    console.log("✅ Dialogue data loaded successfully.");

    const questJsonPath = path.join(__dirname, '..', 'gamehomepage', 'TemplateData', 'gameData', 'questData.json');
    const questJson = fs.readFileSync(questJsonPath, 'utf8');
    questData = JSON.parse(questJson);
    console.log("✅ Quest data loaded successfully.");

} catch (error) {
    console.error("🚨 Error loading game data:", error);
}

// createConnection -> createPool 로 변경 및 promise() 사용
const dbPool = mysql.createPool({
    host: process.env.DB_HOST,      
    user: process.env.DB_USER,       
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// 연결 테스트 DBPOOL되는지 확인
dbPool.getConnection()
  .then(connection => {
    console.log('✅ MySQL Pool 연결 성공 (테스트 연결)');
    connection.release();
  })
  .catch(err => {
    console.error('🚨 MySQL Pool 연결 실패:', err);
  });

function safeJSON(v, fallback = {}) {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

const publicPath = path.resolve(__dirname, '../gamehomepage');
app.use(express.static(publicPath));

app.get('/', (req, res) => res.sendFile(path.join(publicPath, '4_main.html')));

const io = new Server(server, {
  cors: {
    origin: [
        "http://localhost:8080",
        "http://localhost:3000",
        "https://xn--479aqgv87cx8e1va.site",
        "http://xn--479aqgv87cx8e1va.site"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});
const onlineUsers = new Map();
const socketIdToUserId = new Map();
const gamePlayers = {};
const SINGLE_PLAYER_SCENES = ["Combat"]; 

io.on('connection', (socket) => {
    console.log(`[Socket.IO] User connected: ${socket.id}`);

    socket.on('login', async ({ userId, nickname }) => { 
        console.log(`[Chat] User logged in: ${nickname} (${userId})`);
        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, { nickname, socketIds: new Set() });
        }
        onlineUsers.get(userId).socketIds.add(socket.id);
        socketIdToUserId.set(socket.id, userId);
        io.emit('chat:system', `${nickname}님이 입장했습니다.`);
        const userList = Array.from(onlineUsers.entries()).map(([id, data]) => ({ userId: id, nickname: data.nickname }));
        io.emit('presence:list', userList);
    });
    socket.on('chat:msg', ({ message }) => {
        const userId = socketIdToUserId.get(socket.id);
        if (!userId) return;
        const nickname = onlineUsers.get(userId)?.nickname;
        io.emit('chat:msg', { userId, user: nickname, message, ts: Date.now() });
    });
    socket.on('chat:dm', ({ toUserId, message }) => {
        const fromUserId = socketIdToUserId.get(socket.id);
        if (!fromUserId || !toUserId || !message) return;
        const fromUserInfo = onlineUsers.get(fromUserId);
        const targetUserInfo = onlineUsers.get(toUserId);
        if (fromUserInfo && targetUserInfo) {
            const payload = { fromUserId, from: fromUserInfo.nickname, toUserId, message, ts: Date.now() };
            targetUserInfo.socketIds.forEach(targetSocketId => io.to(targetSocketId).emit('chat:dm', payload));
            socket.emit('chat:dm', payload);
        }
    });

socket.on('initialize', async (data) => { 
    
    let userId;
    let nickname = 'Guest';
    let isGuest = false;

    if (typeof data === 'string') {
        userId = data;
    } else if (data && data.userId) {
        userId = data.userId;
        nickname = data.nickname || 'Guest';
        isGuest = data.isGuest === true;
    } else {
        console.error(`[Game] Invalid initialize data from socket ${socket.id}:`, data);
        return;
    }
    
    isGuest = isGuest || String(userId).startsWith('guest_');

    console.log(`[Game] Initializing player: ${userId} (Guest: ${isGuest}) for socket ${socket.id}`);
    socketIdToUserId.set(socket.id, userId);

    if (isGuest) {
        const existingPlayer = gamePlayers[userId];

        if (existingPlayer) {
            console.log(`[Game] GUEST ${existingPlayer.nickname} (${userId}) 재초기화. (씬: ${existingPlayer.currentSceneName})`);
            
            socket.emit('initializeComplete', existingPlayer);
        } else {
            console.log(`[Game] GUEST ${nickname} (${userId}) 최초 초기화.`);
            
            const chatUserInfo = onlineUsers.get(userId);
            if (chatUserInfo && chatUserInfo.nickname) {
                nickname = chatUserInfo.nickname;
                console.log(`[Game] GUEST nickname updated to '${nickname}' from chat session.`);
            }
            
            const defaultInventory = [
                {
                    slotIndex: 1,
                    slotType: 'Equipment',
                    itemId: 101,
                    itemCount: 1,
                    itemSpec: { "damage": 5, "defense": 10, "hp": 10 }
                },
                {
                    slotIndex: 0,
                    slotType: 'Consumption',
                    itemId: 1,
                    itemCount: 10,
                    itemSpec: { "hp": 10 }
                },
                {
                    slotIndex: 2,
                    slotType: 'Equipment',
                    itemId: 301,
                    itemCount: 1,
                    itemSpec: { "damage": 5, "defense": 5 }
                }
            ];

            const playerData = { 
                id: userId,
                nickname: nickname,
                position: { x: -15.76, y: 3.866, z: 49.78 },
                rotation: { x: 0, y: 0, z: 0 },
                currentSceneName: 'Main',
                inventory: defaultInventory
            };
            gamePlayers[userId] = playerData;
            socket.emit('initializeComplete', playerData);
        }

    } else {
        const sql = `SELECT c.character_id, c.character_name, c.position_x, c.position_y, c.position_z, c.rotation_y, c.current_scene_name, u.nickname 
                     FROM characters c 
                     LEFT JOIN users u ON c.user_id = u.user_id 
                     WHERE c.user_id = ?`;
        try {
            const [results] = await dbPool.query(sql, [userId]);
            let playerData;
            if (results.length === 0) {
                console.log(`[Game] DB에서 ${userId}의 위치 정보를 찾지 못해 기본값으로 설정합니다.`);
                playerData = { 
                    id: userId,
                    nickname: nickname,
                    position: { x: -15.76, y: 3.866, z: 49.78 },
                    rotation: { x: 0, y: 0, z: 0 },
                    currentSceneName: 'Main'
                };
            } else {
                const dbData = results[0];
                playerData = { 
                    id: userId,
                    nickname: dbData.nickname || dbData.character_name,
                    position: { 
                        x: dbData.position_x || -15.76,
                        y: dbData.position_y || 3.866,
                        z: dbData.position_z || 49.78
                    }, 
                    rotation: { x: 0, y: dbData.rotation_y || 0, z: 0 },
                    currentSceneName: dbData.current_scene_name || 'Main'
                };
            }
            gamePlayers[userId] = playerData;
            socket.emit('initializeComplete', playerData);
        } catch (err) {
            console.error('[Game] Initialize DB error:', err);
            const playerData = { 
                id: userId,
                nickname: 'ErrorPlayer',
                position: { x: -15.76, y: 3.866, z: 49.78 },
                rotation: { x: 0, y: 0, z: 0 },
                currentSceneName: 'Main'
            };
            gamePlayers[userId] = playerData;
            socket.emit('initializeComplete', playerData);
        }
    }
});

    socket.on('requestSceneChange', async (data) => {
        const userId = socketIdToUserId.get(socket.id);
        
        const isGuest = String(userId).startsWith('guest_');
        

        if (!userId || !gamePlayers[userId]) {
            console.error(`[SceneChange] User not found for socket ${socket.id}. Sending respawn to unfreeze.`);
            socket.emit('respawn');
            return;
        }

        try {
            if (!data || !data.scene || !data.pos) {
                 console.error(`[SceneChange] Invalid scene change data from ${userId}. Data:`, data);
                 socket.emit('respawn'); 
                 return;
            }

            const newScene = data.scene;
            const newPos = data.pos;
            const oldScene = gamePlayers[userId].currentSceneName;

            if (!isGuest) {
                await dbPool.query(
                    `UPDATE characters SET current_scene_name = ?, position_x = ?, position_y = ?, position_z = ? WHERE user_id = ?`,
                    [newScene, newPos.x, newPos.y, newPos.z, userId]
                );
                console.log(`[SceneChange] User ${userId} moving from ${oldScene} to ${newScene} (DB Update Complete)`);
            } else {
                console.log(`[SceneChange] GUEST ${userId} moving from ${oldScene} to ${newScene} (No DB Save)`);
            }

            // 서버 메모리 갱신 (게스트/유저 공통)
            gamePlayers[userId].currentSceneName = newScene;
            gamePlayers[userId].position = newPos;

            // 이전 씬(Room)에서 나감
            if (oldScene && !SINGLE_PLAYER_SCENES.includes(oldScene)) {
                socket.leave(oldScene);
                socket.to(oldScene).emit('playerDisconnected', userId);
            }
            
            socket.emit('respawn'); 

        } catch (e) {
            console.error("[SceneChange] Failed to parse request (Critical Error):", e);
            socket.emit('respawn');
        }
    });

    // 씬 로딩이 완료되면 Room에 입장하고, 씬(맵) 안의 유저 정보만 받음
    socket.on('LoadSceneComplete', () => {
        const userId = socketIdToUserId.get(socket.id);
        if (!userId || !gamePlayers[userId]) {
            console.log(`[Socket.IO] User for socket ${socket.id} not found.`);
            return;
        }

        const player = gamePlayers[userId];
        const sceneName = player.currentSceneName;

        if (!sceneName) {
            console.error(`[Socket.IO] User ${userId} has no sceneName.`);
            return;
        }
        
        // 1인용 씬("Combat" 등)이 아닐 경우에만 Room 로직 처리
        if (sceneName && !SINGLE_PLAYER_SCENES.includes(sceneName)) {
            socket.join(sceneName); 
            console.log(`[Game] Player ${userId} joined room: ${sceneName}`);

            const otherPlayers = Object.values(gamePlayers).filter(p =>
                p.id !== userId && p.currentSceneName === sceneName
            );
            
            // 나에게 "같은 씬에 있던 유저 목록" 전송
            socket.emit('currentPlayers', { players: otherPlayers });
            
            socket.to(sceneName).emit('newPlayer', player);

        } else {
            // 1인용 씬일 경우
            console.log(`[Game] Player ${userId} entered single-player scene: ${sceneName}`);
            socket.emit('currentPlayers', { players: [] }); // 빈 목록을 보내 접속 완료
        }
    });

    socket.on('playerMovement', (movementData) => {
        const userId = socketIdToUserId.get(socket.id);
        if (!userId || !gamePlayers[userId]) return;

        const playerData = gamePlayers[userId];
        const sceneName = playerData.currentSceneName;

        if (movementData && movementData.position && movementData.rotation) {
            // 서버 메모리에 위치 정보 업데이트
            playerData.position = movementData.position;
            playerData.rotation = movementData.rotation;

            // 1인용 씬이 아닐 경우에만 룸에 브로드캐스트
            if (sceneName && !SINGLE_PLAYER_SCENES.includes(sceneName)) {
                socket.to(sceneName).emit('updatePlayerMovement', { id: userId, ...movementData });
            }
        }
    });

    // playerAnimation: 같은 씬(Room) 유저에게만 전송
    socket.on('playerAnimation', (animData) => {
        const userId = socketIdToUserId.get(socket.id);
        if (!userId || !gamePlayers[userId]) return;

        const playerData = gamePlayers[userId];
        const sceneName = playerData.currentSceneName;

        // 1인용 씬이 아닐 경우에만 룸에 브로드캐스트
        if (sceneName && !SINGLE_PLAYER_SCENES.includes(sceneName)) {
            socket.to(sceneName).emit('updatePlayerAnimation', { id: userId, ...animData });
        }
    });
    
    socket.on('playerAttack', () => {
        const userId = socketIdToUserId.get(socket.id);
        if (!userId || !gamePlayers[userId]) return;
        const sceneName = gamePlayers[userId].currentSceneName;

        if (sceneName && !SINGLE_PLAYER_SCENES.includes(sceneName)) {
            socket.to(sceneName).emit('updateAttack', { id: userId });
        }
    });

    socket.on('playerDied', async () => {
        const userId = socketIdToUserId.get(socket.id); 
        
        const isGuest = String(userId).startsWith('guest_');
        

        if (!userId || !gamePlayers[userId]) {
             console.error(`Player data for userId (from socket ${socket.id}) not found on death.`);
             return;
        }
        
        console.log(`[Game] Player ${userId} (Guest: ${isGuest}) died. Resetting data...`);

        // 부활 위치 및 씬 설정
        const respawnPosition = { x: -15.76, y: 3.866, z: 49.78 }; 
        const respawnScene = 'Main';

        if (!isGuest) {
            try {
                await dbPool.query(
                    `UPDATE characters SET current_scene_name = ?, position_x = ?, position_y = ?, position_z = ?, level = 1, gold = 0 WHERE user_id = ?`,
                    [respawnScene, respawnPosition.x, respawnPosition.y, respawnPosition.z, userId]
                );
                await dbPool.query(
                    `UPDATE characterstats SET currentHp = maxHp, experience = 0 WHERE character_id = (SELECT character_id FROM characters WHERE user_id = ? LIMIT 1)`,
                    [userId]
                );
            } catch (err) {
                console.error(`[Game] DB Error on playerDied for ${userId}:`, err);
            }
        }
 
        gamePlayers[userId].position = respawnPosition;
        gamePlayers[userId].currentSceneName = respawnScene;
 
        socket.emit('respawn');
    });


    socket.on('disconnect', () => {
        console.log(`[Socket.IO] User disconnected: ${socket.id}`);
        const userId = socketIdToUserId.get(socket.id);
        if (!userId) return;

        const playerData = gamePlayers[userId];
        if (playerData) {
            const oldScene = playerData.currentSceneName; 
            delete gamePlayers[userId];

            if (oldScene && !SINGLE_PLAYER_SCENES.includes(oldScene)) {
                io.to(oldScene).emit('playerDisconnected', userId);
            }
            console.log(`[Game] Player disconnected: ${userId} from scene ${oldScene}`);
        }
        
        const userInfo = onlineUsers.get(userId);
        if (userInfo) {
            userInfo.socketIds.delete(socket.id);
            if (userInfo.socketIds.size === 0) {
                onlineUsers.delete(userId); 
                io.emit('chat:system', `${userInfo.nickname}님이 퇴장했습니다.`);
                const userList = Array.from(onlineUsers.entries()).map(([id, data]) => ({ userId: id, nickname: data.nickname }));
                io.emit('presence:list', userList);
                console.log(`[Chat] User logged out: ${userInfo.nickname}`);
            }
        }
        socketIdToUserId.delete(socket.id);
    });
});
// Socket.IO 끝

// --- REST API ---

// /auth/kakao API
app.post('/auth/kakao', async (req, res) => {
    const { id, nickname, email, profile_image } = req.body;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const userSql = `INSERT INTO users (user_id, nickname, email, profile_image) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), email = VALUES(email), profile_image = VALUES(profile_image)`;
        await connection.query(userSql, [id, nickname, email, profile_image]);

        const [characters] = await connection.query(`SELECT character_id FROM characters WHERE user_id = ?`, [id]);

        if (characters.length === 0) {
           const sql = `
                INSERT INTO characters 
                    (user_id, character_name, position_x, position_y, position_z, rotation_y) 
                VALUES 
                    (?, ?, -15.76, 3.866, 49.78, 0)
            `;
            
            const [characterResult] = await connection.query(sql, [id, id]);

            const newCharacterId = characterResult.insertId;

            await connection.query(`INSERT INTO characterstats (character_id) VALUES (?)`, [newCharacterId]);

            const item1Spec = JSON.stringify({ "damage": 5, "defense": 5 });
            await connection.query(
                `REPLACE INTO inventory (character_id, inventory_type, inventory_slot, item_id, quantity, item_spec)
                 VALUES (?, 'Equipment', 0, 101, 1, ?)`,
                [newCharacterId, item1Spec]
            );
            const item2Spec = JSON.stringify({ "damage": 5, "defense": 5 });
            await connection.query(
                `REPLACE INTO inventory (character_id, inventory_type, inventory_slot, item_id, quantity, item_spec)
                 VALUES (?, 'Equipment', 1, 201, 1, ?)`,
                [newCharacterId, item2Spec]
            );
            const item3Spec = JSON.stringify({ "damage": 5, "defense": 5 });
            await connection.query(
                `REPLACE INTO inventory (character_id, inventory_type, inventory_slot, item_id, quantity, item_spec)
                 VALUES (?, 'Equipment', 2, 301, 1, ?)`,
                [newCharacterId, item3Spec]
            );
            const item4Spec = JSON.stringify({ "damage": 5, "defense": 5 });
            await connection.query(
                `REPLACE INTO inventory (character_id, inventory_type, inventory_slot, item_id, quantity, item_spec)
                 VALUES (?, 'Equipment', 3, 401, 1, ?)`,
                [newCharacterId, item4Spec]
            );
            const item5Spec = JSON.stringify({ "damage": 5, "defense": 5 });
            await connection.query(
                `REPLACE INTO inventory (character_id, inventory_type, inventory_slot, item_id, quantity, item_spec)
                 VALUES (?, 'Equipment', 4, 501, 1, ?)`,
                [newCharacterId, item5Spec]
            );
            // 포션 지급
            await connection.query(
                `REPLACE INTO inventory (character_id, inventory_type, inventory_slot, item_id, quantity, item_spec)
                 VALUES (?, 'Consumption', 0, 1, 10, NULL)`,
                [newCharacterId]
            );
        }

        await connection.commit();
        res.send(characters.length === 0 ? '로그인 및 캐릭터/능력치/인벤토리 생성 완료' : '로그인 완료');

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Auth/Kakao Error:', err);
        res.status(500).send('서버 오류');
        
    } finally {
        if (connection) connection.release();
    }
});

// 게시글 등록
app.post('/api/posts', async (req, res) => {
    const { userId } = req.body; 

    if (String(userId).startsWith('guest_')) {
        return res.status(200).json({ success: true, message: '게스트 활동은 저장되지 않습니다.' });
    }

    const { title, content, board_type } = req.body;
    if (!title || !content || !board_type || !userId) return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
    try {
        const [characters] = await dbPool.query(`SELECT character_id FROM characters WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`, [userId]); 
        const author_character_id = (characters.length > 0) ? characters[0].character_id : null;
        const [results] = await dbPool.query(`INSERT INTO posts (title, content, board_type, author_character_id, author_user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())`, 
            [title, content, board_type, author_character_id, userId]);
        res.status(201).json({ message: '게시글이 성공적으로 등록되었습니다.', postId: results.insertId });
    } catch (err) {
        console.error('Post creation error:', err);
        res.status(500).json({ message: 'DB 오류 발생' });
    }
});

// 게시글 목록 조회
app.get('/api/posts', async (req, res) => {
    const { board_type, searchType, keyword, userId } = req.query;
    if (!board_type) return res.status(400).json({ message: 'board_type을 지정해주세요.' });
    let sql = `
        SELECT
            p.post_id, p.title, u.nickname as author_name,
            DATE_FORMAT(DATE_ADD(p.created_at, INTERVAL 9 HOUR), '%Y-%m-%d %H:%i') as date,
            p.view_count, p.like_count, p.comments_count,
            CASE WHEN ? IS NOT NULL THEN (SELECT COUNT(*) FROM like_user lu WHERE lu.post_id = p.post_id AND lu.user_id = ?) > 0 ELSE 0 END AS userHasLiked
        FROM posts p
        LEFT JOIN users u ON p.author_user_id = u.user_id
        WHERE p.board_type = ? AND (p.is_deleted IS NULL OR p.is_deleted = false)
    `;
    const params = [userId, userId, board_type];
    if (keyword?.trim()) {
        if (searchType === 'title') {
            sql += ' AND p.title LIKE ?'; params.push(`%${keyword.trim()}%`);
        } else if (searchType === 'writer') {
            sql += ' AND u.nickname LIKE ?'; params.push(`%${keyword.trim()}%`);
        }
    }
    sql += ' ORDER BY p.post_id DESC';
    try {
        const [results] = await dbPool.query(sql, params); 
        const clientResults = results.map(post => ({ id: post.post_id, title: post.title, nickname: post.author_name, date: post.date, like_count: post.like_count, comments_count: post.comments_count, board_type: board_type, view_count: post.view_count, userHasLiked: Boolean(post.userHasLiked) }));
        res.json(clientResults);
    } catch (err) {
        console.error('Error fetching posts:', err);
        res.status(500).json({ message: 'DB 오류' });
    }
});

// 게시글 상세 조회
app.get('/api/posts/:id', async (req, res) => {
    const postId = req.params.id;
    let connection;
    try {
        connection = await dbPool.getConnection(); 
        await connection.query(`UPDATE posts SET view_count = view_count + 1 WHERE post_id = ?`, [postId]);
        const sql = `
          SELECT
            p.post_id, p.title, p.content, u.nickname as author_name,
            DATE_FORMAT(DATE_ADD(p.created_at, INTERVAL 9 HOUR), '%Y-%m-%d %H:%i') as date,
            p.like_count, p.view_count, p.comments_count, p.author_user_id, p.board_type,
            CASE WHEN p.board_type = 'event' AND NOW() > p.event_end_date THEN 'ended' ELSE 'ongoing' END AS status,
            CASE WHEN p.board_type = 'event' AND NOW() > p.event_end_date THEN '종료' ELSE '진행중' END AS badgeText
          FROM posts p
          LEFT JOIN users u ON p.author_user_id = u.user_id
          WHERE p.post_id = ? AND (p.is_deleted IS NULL OR p.is_deleted = false)
        `;
        const [results] = await connection.query(sql, [postId]); 
        if (results.length === 0) {
            res.status(404).json({ message: '게시글 없음' });
        } else {
            const post = results[0];
            res.json({ id: post.post_id, title: post.title, content: post.content, nickname: post.author_name, date: post.date, like_count: post.like_count, view_count: post.view_count, comments_count: post.comments_count, author_user_id: post.author_user_id, board_type: post.board_type, status: post.status, badgeText: post.badgeText });
        }
    } catch (err) {
        console.error('Error getting post details:', err);
        res.status(500).json({ message: 'DB 오류' });
    } finally {
        if (connection) connection.release();
    }
});

// 이벤트 목록 API (async/await 적용)
app.get('/api/events', async (req, res) => { 
  const status = (req.query.status || 'all').toLowerCase();
  const statusExpr = `((p.event_start_date IS NULL OR p.event_start_date <= NOW()) AND (p.event_end_date IS NULL OR p.event_end_date >= NOW()))`;
  let where = `WHERE p.board_type IN ('event','이벤트')`;
  if (status === 'ongoing') where += ` AND ${statusExpr}`;
  if (status === 'ended')   where += ` AND NOT ${statusExpr}`;

  const sql = `
    SELECT
      p.post_id AS id, p.title, p.content, p.created_at, p.view_count, p.like_count,
      p.event_start_date, p.event_end_date,
      CASE WHEN ${statusExpr} THEN 'ongoing' ELSE 'ended' END AS status,
      COALESCE(u.nickname, c.character_name, 'GM') AS author
    FROM posts p
    LEFT JOIN characters c ON p.author_character_id = c.character_id
    LEFT JOIN users u ON p.author_user_id = u.user_id
    ${where}
    ORDER BY CASE WHEN ${statusExpr} THEN 0 ELSE 1 END ASC,                                  
  CASE                                                                               
    WHEN ${statusExpr} THEN COALESCE(p.event_start_date, p.created_at)            
    ELSE COALESCE(p.event_end_date,   p.created_at)                               
  END DESC,
  p.created_at DESC                                                            
LIMIT 200;
  `;
  try {
    const [rows] = await dbPool.query(sql); 
    res.json({ events: rows || [] });
  } catch (err) {
    console.error('Error fetching events:', err); // 에러 로그 추가
    res.status(500).json({ message: 'DB error' });
  }
});

// 이벤트 상세 API (async/await 적용)
app.get('/api/events/:id', async (req, res) => { 
  const { id } = req.params;
  const sql = `
    SELECT
      p.post_id AS id, p.title, p.content, p.created_at, p.view_count, p.like_count,
      p.event_start_date, p.event_end_date,
      CASE WHEN ((p.event_start_date IS NULL OR p.event_start_date <= NOW()) AND (p.event_end_date IS NULL OR p.event_end_date >= NOW())) THEN 'ongoing' ELSE 'ended' END AS status,
      COALESCE(u.nickname, c.character_name, 'GM') AS author
    FROM posts p
    LEFT JOIN characters c ON p.author_character_id = c.character_id
    LEFT JOIN users u ON p.author_user_id = u.user_id
    WHERE p.board_type IN ('event','이벤트') AND p.post_id = ?;
  `;
  try {
    const [rows] = await dbPool.query(sql, [id]); 
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(`Error fetching event ${id}:`, err); // 에러 로그 추가
    res.status(500).json({ message: 'DB error' });
  }
});

// 게시글 좋아요
app.post('/api/like', async (req, res) => {

    const { user_id } = req.body;

    if (String(user_id).startsWith('guest_')) {
        return res.status(200).json({ success: true, message: '게스트 활동은 저장되지 않습니다.' });
    }

    const { post_id } = req.body;
    if (!user_id || !post_id) return res.status(400).json({ message: '필수 항목(user_id, post_id)이 누락되었습니다.' });
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [results] = await connection.query('SELECT * FROM like_user WHERE user_id = ? AND post_id = ?', [user_id, post_id]);
        let liked = false;
        if (results.length > 0) {
            await connection.query('DELETE FROM like_user WHERE user_id = ? AND post_id = ?', [user_id, post_id]);
            await connection.query('UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE post_id = ?', [post_id]);
            liked = false;
        } else {
            await connection.query('INSERT INTO like_user (user_id, post_id) VALUES (?, ?)', [user_id, post_id]);
            await connection.query('UPDATE posts SET like_count = like_count + 1 WHERE post_id = ?', [post_id]);
            liked = true;
        }
        const [countResult] = await connection.query('SELECT like_count FROM posts WHERE post_id = ?', [post_id]);
        await connection.commit();
        res.json({ message: liked ? '좋아요가 반영되었습니다.' : '좋아요가 취소되었습니다.', liked: liked, newLikeCount: countResult[0]?.like_count ?? 0 });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Like processing error:', err);
        res.status(500).json({ message: 'DB 오류' });
    } finally {
        if (connection) connection.release();
    }
});

// 댓글 조회
app.get('/api/comments', async (req, res) => {
    const { post_id } = req.query;
    if (!post_id) return res.status(400).json({ message: 'post_id가 필요합니다.' });
    const sql = `
        SELECT c.comment_id, c.content, DATE_FORMAT(DATE_ADD(c.created_at, INTERVAL 9 HOUR), '%Y-%m-%d %H:%i') as created_at, u.nickname as author_name, c.parent_comment_id
        FROM comments c LEFT JOIN users u ON c.author_user_id = u.user_id
        WHERE c.post_id = ? AND (c.is_deleted IS NULL OR c.is_deleted = false) ORDER BY c.created_at ASC
    `;
    try {
        const [results] = await dbPool.query(sql, [post_id]); 
        const clientResults = results.map(comment => ({ ...comment, user_nickname: comment.author_name }));
        res.json(clientResults);
    } catch (err) {
        console.error('Error fetching comments:', err);
        res.status(500).json({ message: '데이터베이스 오류로 댓글을 조회할 수 없습니다.' });
    }
});

// 댓글 등록
app.post('/api/comments', async (req, res) => {
    const { userId } = req.body;

    if (String(userId).startsWith('guest_')) {
        return res.status(200).json({ success: true, message: '게스트 활동은 저장되지 않습니다.' });
    }

    const { post_id, content } = req.body;
    if (!post_id || !userId || !content) return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [characters] = await connection.query(`SELECT character_id FROM characters WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`, [userId]);
        const author_character_id = (characters.length > 0) ? characters[0].character_id : null;
        await connection.query(`INSERT INTO comments (post_id, author_character_id, author_user_id, content, created_at) VALUES (?, ?, ?, ?, NOW())`, [post_id, author_character_id, userId, content]);
        await connection.query(`UPDATE posts SET comments_count = comments_count + 1 WHERE post_id = ?`, [post_id]);
        await connection.commit();
        res.status(201).json({ message: '댓글이 등록되었습니다.' });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Comment creation error:', err);
        res.status(500).json({ message: 'DB 오류 발생' });
    } finally {
        if (connection) connection.release();
    }
});

// 댓글 삭제
app.delete('/api/comments/:id', async (req, res) => {
    const commentId = req.params.id;
    const { userId } = req.query;

    if (String(userId).startsWith('guest_')) {
        return res.status(200).json({ success: true, message: '게스트 활동은 저장되지 않습니다.' });
    }

    if (!userId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [comments] = await connection.query(`SELECT post_id, author_user_id FROM comments WHERE comment_id = ? AND (is_deleted IS NULL OR is_deleted = false)`, [commentId]);
        if (comments.length === 0) {
            await connection.rollback(); return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });
        }
        const comment = comments[0];
        if (String(comment.author_user_id) !== String(userId)) {
            await connection.rollback(); return res.status(403).json({ message: '댓글을 삭제할 권한이 없습니다.' });
        }
        const [updateResult] = await connection.query(`UPDATE comments SET is_deleted = true WHERE comment_id = ?`, [commentId]);
        if (updateResult.affectedRows === 0) {
            await connection.rollback(); return res.status(404).json({ message: '삭제할 댓글을 찾지 못했습니다.' });
        }
        await connection.query(`UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE post_id = ?`, [comment.post_id]);
        await connection.commit();
        res.json({ message: '댓글이 성공적으로 삭제되었습니다.' });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Comment deletion error:', err);
        res.status(500).json({ message: 'DB 오류 발생' });
    } finally {
        if (connection) connection.release();
    }
});

// 인기 게시글 조회
app.get('/api/popular-posts', async (req, res) => {
    const sql = `SELECT post_id as id, title, like_count, comments_count, board_type, DATE_FORMAT(DATE_ADD(created_at, INTERVAL 9 HOUR), '%Y-%m-%d %H:%i') as date FROM posts WHERE board_type = 'popular' AND (is_deleted IS NULL OR is_deleted = false) ORDER BY like_count DESC, comments_count DESC, created_at DESC LIMIT 5`;
    try {
        const [results] = await dbPool.query(sql); 
        res.json(results);
    } catch (err) {
        console.error('Error fetching popular posts:', err);
        res.status(500).send('DB 오류');
    }
});

// 공략 게시글 조회
app.get('/api/target-posts', async (req, res) => {
    const sql = `SELECT post_id as id, title, like_count, comments_count, board_type, DATE_FORMAT(DATE_ADD(created_at, INTERVAL 9 HOUR), '%Y-%m-%d %H:%i') as date FROM posts WHERE board_type = 'target' AND (is_deleted IS NULL OR is_deleted = false) ORDER BY like_count DESC, comments_count DESC, created_at DESC LIMIT 5`;
    try {
        const [results] = await dbPool.query(sql);
        res.json(results);
    } catch (err) {
        console.error('Error fetching target posts:', err);
        res.status(500).send('DB 오류');
    }
});

// 랭킹 조회 API
app.get('/api/rankings', async (req, res) => { 
    const { type } = req.query;
    if (!type) return res.status(400).json({ message: '랭킹 타입을 지정해주세요.' });
    const sql = `
        SELECT r.rank, r.ranking_value, COALESCE(c.character_name, u.nickname) as name
        FROM rankings r
        LEFT JOIN characters c ON r.character_id = c.character_id
        LEFT JOIN users u ON c.user_id = u.user_id
        WHERE r.ranking_type = ? ORDER BY r.rank ASC LIMIT 10
    `;
    try {
        const [results] = await dbPool.query(sql, [type]);
        res.json(results);
    } catch (err) {
        console.error(`Error fetching rankings for type ${type}:`, err);
        res.status(500).json({ message: 'DB 오류 발생' });
    }
});

// 게시글 삭제
app.delete('/api/posts/:id', async (req, res) => {
    const postId = req.params.id;
    const { userId } = req.query;

    if (String(userId).startsWith('guest_')) {
        return res.status(200).json({ success: true, message: '게스트 활동은 저장되지 않습니다.' });
    }

    if (!userId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    try {
        const [posts] = await dbPool.query(`SELECT author_user_id FROM posts WHERE post_id = ? AND (is_deleted IS NULL OR is_deleted = false)`, [postId]); 
        if (posts.length === 0) return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        if (String(posts[0].author_user_id) !== String(userId)) return res.status(403).json({ message: '게시물을 삭제할 권한이 없습니다.' });
        const [result] = await dbPool.query(`UPDATE posts SET is_deleted = true WHERE post_id = ?`, [postId]); 
        if (result.affectedRows === 0) return res.status(404).json({ message: '삭제할 게시물을 찾지 못했습니다.' });
        res.json({ message: '게시물이 성공적으로 삭제되었습니다.' });
    } catch (err) {
        console.error('Post deletion error:', err);
        res.status(500).json({ message: 'DB 오류 발생' });
    }
});

// 인벤토리 조회
app.get('/playerData/inventory/:userId', async (req, res) => { 
    const { userId } = req.params;
    console.log(`[inventory Check] 1. userId: ${userId}`);

    
    if (String(userId).startsWith('guest_')) {
        console.log(`[inventory Check] GUEST ${userId}. Reading inventory from memory.`);
        
        // 1. 서버 메모리에서 게스트 플레이어 정보를 찾습니다.
        const playerData = gamePlayers[userId];
        
        if (playerData && playerData.inventory) {
            // 2. 메모리에 저장된 인벤토리를 반환합니다.
            return res.json({ inventory: playerData.inventory });
        } else {
            // 3. 메모리에 없으면 빈 인벤토리를 반환합니다.
            console.warn(`[inventory Check] GUEST ${userId} not found in memory. Sending empty array.`);
            return res.json({ inventory: [] });
        }
    }

    try {
        const [characters] = await dbPool.query(`SELECT character_id FROM characters WHERE user_id = ? LIMIT 1`, [userId]);
        if (characters.length === 0) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        const characterId = characters[0].character_id;
        console.log(`[inventory Check] 2. characterId: ${characterId}`);

        const invSql = `
          SELECT
            inv.inventory_slot AS slotIndex,
            CASE
                WHEN inv.inventory_type IS NOT NULL AND inv.inventory_type != ''
                THEN inv.inventory_type
                ELSE (
                    CASE 
                      WHEN TRIM(i.item_type) = 'Weapon' THEN 'Equipment'
                      WHEN TRIM(i.item_type) = 'Armor' THEN 'Equipment'
                      WHEN TRIM(i.item_type) = 'Helmet' THEN 'Equipment' 
                      WHEN TRIM(i.item_type) = 'Gloves' THEN 'Equipment'
                      WHEN TRIM(i.item_type) = 'Boots' THEN 'Equipment'
                      WHEN TRIM(i.item_type) = 'Potion' THEN 'Consumption'
                      WHEN TRIM(i.item_type) = 'Food' THEN 'Consumption'
                      WHEN TRIM(i.item_type) = 'Scroll' THEN 'Consumption'
                      WHEN TRIM(i.item_type) = 'Profile' THEN 'Profile'
                      WHEN TRIM(i.item_type) = 'Quick' THEN 'Quick'
                      ELSE 'Other'
                    END
                )
            END AS slotType,
            inv.item_id AS itemId,
            inv.quantity AS itemCount,
            inv.item_spec
          FROM inventory inv
          LEFT JOIN items i ON inv.item_id = i.item_id 
          WHERE inv.character_id = ?
            AND inv.item_id IS NOT NULL
            AND inv.item_id != 0
          ORDER BY inv.inventory_type, inv.inventory_slot ASC
        `;

        const [results] = await dbPool.query(invSql, [characterId]);
        console.log(`[inventory Check] 3. ${results.length} items found.`);

        const inventory = results.map(item => ({
            slotIndex: item.slotIndex,
            slotType: item.slotType, 
            itemId: item.itemId,
            itemCount: item.itemCount,
            itemSpec: safeJSON(item.item_spec, {}) 
        }));

        console.log('[inventory Check] 4. Response data:', { inventory: inventory });
        res.json({ inventory: inventory });
    } catch (err) {
        console.error('[inventory Check] 3. DB Error:', err);
        res.status(500).json({ message: '서버 오류' });
    }
});

// 인벤토리 저장
app.post('/playerData/inventory/:userId', async (req, res) => { 
    const { userId } = req.params;

    
    if (String(userId).startsWith('guest_')) {
        const playerData = gamePlayers[userId];
        if (!playerData) {
            return res.status(404).json({ success: false, message: 'Guest player not found in memory.' });
        }
        if (!playerData.inventory) {
            playerData.inventory = []; 
        }

        const slotData = req.body;
        const { slotType, slotIndex, itemId, itemCount, itemSpec, hasItem } = slotData;

        if (typeof slotType === 'undefined' || typeof slotIndex === 'undefined') {
            console.error('Guest Inventory POST error: slotType/slotIndex missing.', req.body);
            return res.status(400).json({ success: false, message: 'Guest slot info missing.' });
        }

        let normalizedSlotType;
        const clientSlotType = slotData.slotType; 
        const itemIdNum = parseInt(itemId, 10);
        const typeMap = { 0: 'Equipment', 1: 'Consumption', 2: 'Other', 3: 'Profile', 4: 'Quick', 5: 'Equipment' };

        if (clientSlotType === 'Equipment' || clientSlotType === 'Quick' || clientSlotType === 'Profile') {
            normalizedSlotType = clientSlotType;
        } 
        else if (typeof clientSlotType === 'number' || /^[0-9]+$/.test(clientSlotType)) {
            normalizedSlotType = typeMap[clientSlotType] ?? 'Other';
        }
        else {
            if (clientSlotType) {
                normalizedSlotType = clientSlotType; 
            } else {
                if (itemIdNum >= 1 && itemIdNum <= 9) { normalizedSlotType = 'Consumption'; }
                else if ((itemIdNum >= 101 && itemIdNum <= 110) || (itemIdNum >= 201 && itemIdNum <= 210) || (itemIdNum >= 301 && itemIdNum <= 310)) { normalizedSlotType = 'Equipment'; }
                else { normalizedSlotType = 'Other'; }
            }
        }

        // 메모리 상의 인벤토리에서 해당 아이템을 찾습니다.
        const itemIndex = playerData.inventory.findIndex(
            item => item.slotType === normalizedSlotType && item.slotIndex === slotIndex
        );

        if (hasItem !== false && itemId) {
            const newItemData = {
                slotIndex: slotIndex,
                slotType: normalizedSlotType,
                itemId: itemId,
                itemCount: itemCount,
                itemSpec: itemSpec || {}
            };
            
            if (itemIndex > -1) {
                playerData.inventory[itemIndex] = newItemData;
            } else {
                playerData.inventory.push(newItemData);
            }
        } else {
            if (itemIndex > -1) {
                playerData.inventory.splice(itemIndex, 1);
            }
        }
        
        console.log(`[GUEST] Inventory for ${userId} updated in memory.`);
        return res.status(200).json({ success: true, message: '게스트 활동이 임시 저장되었습니다.' });
    }
    

    const slotData = req.body;
    const { slotType, slotIndex, itemId, itemCount, itemSpec, hasItem } = slotData;

    if (typeof slotType === 'undefined' || typeof slotIndex === 'undefined') {
        console.error('Inventory POST error: slotType 또는 slotIndex가 없습니다.', req.body);
        return res.status(400).json({ success: false, message: '슬롯 정보(slotType, slotIndex)가 누락되었습니다.' });
    }

    let normalizedSlotType;
    const clientSlotType = slotData.slotType; 
    const itemIdNum = parseInt(itemId, 10);
    const typeMap = { 0: 'Equipment', 1: 'Consumption', 2: 'Other', 3: 'Profile', 4: 'Quick', 5: 'Equipment' };

    if (clientSlotType === 'Equipment' || clientSlotType === 'Quick' || clientSlotType === 'Profile') { // 'Profile' 추가
        normalizedSlotType = clientSlotType;
    } 
    else if (typeof clientSlotType === 'number' || /^[0-9]+$/.test(clientSlotType)) {
        normalizedSlotType = typeMap[clientSlotType] ?? 'Other';
    }
    else {
        if (clientSlotType) {
            normalizedSlotType = clientSlotType; 
        } else {
            if (itemIdNum >= 1 && itemIdNum <= 9) { 
                normalizedSlotType = 'Consumption';
            } else if ((itemIdNum >= 101 && itemIdNum <= 110) || 
                       (itemIdNum >= 201 && itemIdNum <= 210) || 
                       (itemIdNum >= 301 && itemIdNum <= 310)) { 
                normalizedSlotType = 'Equipment';
            } else {
                normalizedSlotType = 'Other'; 
            }
        }
    }

    let connection;
    try {
        const [characters] = await dbPool.query(`SELECT character_id FROM characters WHERE user_id = ? LIMIT 1`, [userId]);
        if (characters.length === 0) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        const characterId = characters[0].character_id;

        const itemSpecJson = itemSpec ? JSON.stringify(itemSpec) : null;

        if (hasItem !== false && itemId) {
            const sql = `
                 REPLACE INTO inventory 
                 (character_id, inventory_type, inventory_slot, item_id, quantity, item_spec) 
                 VALUES (?, ?, ?, ?, ?, ?)
             `;
            await dbPool.query(sql, [
                characterId,
                normalizedSlotType,
                slotIndex,
                itemId,
                itemCount,
                itemSpecJson
            ]);
        } else {
            await dbPool.query(
               `DELETE FROM inventory WHERE character_id = ? AND inventory_type = ? AND inventory_slot = ?`,
               [characterId, normalizedSlotType, slotIndex]
            );
        }

        res.status(201).json({ success: true, message: '인벤토리 업데이트 성공' });
    } catch (err) {
        console.error('inventory save error:', err);
        res.status(500).json({ success: false, message: 'DB 오류' });
    } finally {
        if (connection) connection.release();
    }
});

// 거래소 API

// 전체 판매 목록
app.get('/market/items', async (req, res) => {
    const { userId } = req.query; 
    console.log(`[GET] 전체 판매 목록 조회 요청 (요청자: ${userId || 'None'})`);

    let characterId = null;

    if (userId) {
        try {
            const [characters] = await dbPool.query(`SELECT character_id FROM characters WHERE user_id = ? LIMIT 1`, [userId]);
            if (characters.length > 0) {
                characterId = characters[0].character_id;
            }
        } catch (err) {
            console.error(`[Market] character_id 조회 실패 (userId: ${userId}):`, err);
        }
    }

    let sql;
    const params = [];
    if (characterId) {
        console.log(`[Market] ${userId}(${characterId})의 아이템을 제외하고 목록 조회`);
        sql = `SELECT 
                 ml.listing_id AS marketId, ml.item_id AS ItemId, ml.quantity AS ItemCount, ml.price,
                 c.user_id AS userId 
               FROM marketlistings ml
               LEFT JOIN characters c ON ml.seller_character_id = c.character_id
               WHERE ml.expires_at > NOW() 
               AND ml.seller_character_id != ?
               ORDER BY ml.listed_at DESC;`;
        params.push(characterId);
    } 
    else {
        console.log(`[Market] 모든 아이템 목록 조회 (요청자 ID 없거나 찾을 수 없음)`);
        sql = `SELECT 
                 ml.listing_id AS marketId, ml.item_id AS ItemId, ml.quantity AS ItemCount, ml.price,
                 c.user_id AS userId
               FROM marketlistings ml
               LEFT JOIN characters c ON ml.seller_character_id = c.character_id
               WHERE ml.expires_at > NOW() 
               ORDER BY ml.listed_at DESC;`;
    }

    try {
        const [results] = await dbPool.query(sql, params); 
        res.json(results);
    } catch (err) {
        console.error('Error fetching market items:', err);
        res.status(500).json({ message: 'DB 오류' });
    }
});

// 내 판매 목록
app.get('/market/items/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log(`[GET] ${userId}의 판매 목록 조회 요청`);
    try {
        const [characters] = await dbPool.query(`SELECT character_id FROM characters WHERE user_id = ? LIMIT 1`, [userId]); 
        if (characters.length === 0) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        const characterId = characters[0].character_id;
        const sql = `SELECT listing_id AS marketId, item_id AS ItemId, quantity AS ItemCount, price FROM marketlistings WHERE seller_character_id = ? AND expires_at > NOW() ORDER BY listed_at DESC;`;
        const [results] = await dbPool.query(sql, [characterId]); 
        res.json(results);
    } catch (err) {
        console.error('Error fetching user market items:', err);
        res.status(500).json({ message: 'DB 오류' });
    }
});

// 아이템 판매 등록
app.post('/market/items', async (req, res) => {
    const { userId, ItemId, ItemData, itemSpec, itemCount, price, slotType, slotIndex } = req.body;

    // 게스트인지 확인하고 차단합니다.
    if (String(userId).startsWith('guest_')) {
        console.log(`[Market] GUEST ${userId}가 아이템 판매를 시도했습니다. (Blocked)`);
        
        // 게스트는 "권한 없음" 오류를 반환합니다.
        return res.status(403).json({ 
            success: false, 
            message: '게스트는 아이템을 판매할 수 없습니다.'
        });
    }

    console.log("판매 요청 데이터:", req.body);
    
    if (typeof slotType === 'undefined' || typeof slotIndex === 'undefined') {
        console.error('Market POST error: slotType 또는 slotIndex가 없습니다.', req.body);
        return res.status(400).json({ success: false, message: '판매 아이템의 원본 슬롯 정보(slotType, slotIndex)가 누락되었습니다.' });
    }

    let normalizedSlotType;
    const itemIdNum = parseInt(ItemId, 10);

    if (itemIdNum >= 1 && itemIdNum <= 9) {
        normalizedSlotType = 'Consumption';
    } else if ((itemIdNum >= 101 && itemIdNum <= 110) ||
               (itemIdNum >= 201 && itemIdNum <= 210) || 
               (itemIdNum >= 301 && itemIdNum <= 310)) { 
        normalizedSlotType = 'Equipment';
    } 
    else {
        const clientSlotType = slotType;
        const typeMap = { 0: 'Equipment', 1: 'Consumption', 2: 'Other', 3: 'Profile', 4: 'Quick', 5: 'Equipment' };

        if (clientSlotType === 'Equipment' || clientSlotType === 'Quick') {
            normalizedSlotType = clientSlotType;
        } 
        else if (typeof clientSlotType === 'number' || /^[0-9]+$/.test(clientSlotType)) {
            normalizedSlotType = typeMap[clientSlotType] ?? 'Other';
        }
        else {
            normalizedSlotType = clientSlotType || 'Other';
        }
    }

    console.log(`[POST] ${userId} 판매 등록 요청 (Slot: ${slotType}/${slotIndex} -> ${normalizedSlotType})`);
    
    const specObjectToSave = ItemData || itemSpec || {};
    const itemSpecJson = JSON.stringify(specObjectToSave);

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const [characters] = await connection.query(`SELECT character_id FROM characters WHERE user_id = ? LIMIT 1`, [userId]);
        if (characters.length === 0) {
            throw new Error('캐릭터를 찾을 수 없습니다.');
        }
        const seller_character_id = characters[0].character_id;
        
        const [invRows] = await connection.query(
          `SELECT quantity FROM inventory
           WHERE character_id = ? AND inventory_type = ? AND inventory_slot = ? AND item_id = ?
           FOR UPDATE`,
          [seller_character_id, normalizedSlotType, slotIndex, ItemId]
        );

        if (invRows.length === 0) {
          console.warn(`[Market] ${userId}가 존재하지 않는 인벤토리 아이템 판매 시도 (Slot: ${slotType}/${slotIndex}, Item: ${ItemId})`);
          throw new Error('인벤토리에서 해당 아이템을 찾을 수 없습니다.');
        }

        const haveQty = Number(invRows[0].quantity ?? 0);
        const sellQty = Number(itemCount ?? 0);
        if (sellQty <= 0) throw new Error('판매 수량이 올바르지 않습니다.');
        if (haveQty < sellQty) throw new Error('판매 수량이 보유 수량을 초과합니다.');

        const remain = haveQty - sellQty;
        if (remain > 0) {
          await connection.query(
            `UPDATE inventory
             SET quantity = ?
             WHERE character_id = ? AND inventory_type = ? AND inventory_slot = ? AND item_id = ?`,
            [remain, seller_character_id, normalizedSlotType, slotIndex, ItemId]
          );
        } else {
          await connection.query(
            `DELETE FROM inventory
             WHERE character_id = ? AND inventory_type = ? AND inventory_slot = ? AND item_id = ?`,
            [seller_character_id, normalizedSlotType, slotIndex, ItemId]
          );
        }
        const addItemSql = 'INSERT INTO marketlistings (seller_character_id, item_id, quantity, price, item_spec, listed_at, expires_at) VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY))';
        const [result] = await connection.query(addItemSql, [seller_character_id, ItemId, sellQty, price, itemSpecJson]);
        
        await connection.commit();

        res.status(200).json({
            success: true, 
            message: '아이템 등록 성공!', 
            marketId: result.insertId, 
            ItemId: ItemId, 
            slotType: slotType,
            slotIndex: slotIndex,
            ItemCount: parseInt(itemCount, 10), 
            price: parseInt(price, 10) 
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("거래소 등록 실패:", err);
        
        const clientMessage = (err.message === '인벤토리에서 해당 아이템을 찾을 수 없습니다.')
            ? '존재하지 않는 아이템' 
            : '거래소 등록 실패';

        res.status(500).json({ success: false, message: clientMessage });
    } finally {
        if (connection) connection.release();
    }
});

// 아이템 구매
app.get('/market/buy', async (req, res) => {
    const { userId, marketId, count } = req.query;

    const isGuest = String(userId).startsWith('guest_');
    
    const purchaseCount = parseInt(count, 10);
    console.log(`[GET] ${userId} 구매 요청 (marketId: ${marketId}, 수량: ${purchaseCount}, Guest: ${isGuest})`);
    
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const [listings] = await connection.query(
            `SELECT * FROM marketlistings WHERE listing_id = ? ${isGuest ? '' : 'FOR UPDATE'}`, 
            [marketId]
        );

        if (listings.length === 0) throw new Error('판매 물품 없음');
        const listing = listings[0];
        const { seller_character_id, item_id, quantity, price, item_spec } = listing;
        
        if (quantity < purchaseCount) throw new Error('아이템 개수 부족');

        if (isGuest) {
            await connection.rollback();
            console.log(`[Market] GUEST ${userId}가 아이템 구매를 시도했습니다. (Blocked)`);
            
            // 게스트는 "권한 없음" 오류를 반환합니다.
            return res.status(403).json({ 
                success: false, 
                message: '게스트는 아이템을 구매할 수 없습니다.'
            });
        }
        

        const [characters] = await connection.query(`SELECT character_id FROM characters WHERE user_id = ? LIMIT 1`, [userId]);
        if (characters.length === 0) throw new Error('구매자 캐릭터 없음');
        const buyer_character_id = characters[0].character_id;
        
        const totalPrice = price * purchaseCount;
        const [payResult] = await connection.query('UPDATE characters SET gold = gold - ? WHERE character_id = ? AND gold >= ?', [totalPrice, buyer_character_id, totalPrice]);
        if (payResult.affectedRows === 0) throw new Error('골드 부족');
        
        await connection.query('UPDATE characters SET gold = gold + ? WHERE character_id = ?', [totalPrice, seller_character_id]);
        await connection.query('UPDATE marketlistings SET quantity = quantity - ? WHERE listing_id = ?', [purchaseCount, marketId]);
        await connection.query('DELETE FROM marketlistings WHERE listing_id = ? AND quantity <= 0', [marketId]);
        await connection.commit();

        const [goldResults] = await dbPool.query(`SELECT character_id, gold FROM characters WHERE character_id IN (?, ?)`, [buyer_character_id, seller_character_id]);
        const buyerGold = goldResults.find(r => r.character_id === buyer_character_id)?.gold;
        const sellerGold = goldResults.find(r => r.character_id === seller_character_id)?.gold;
        const remainingItemCount = quantity - purchaseCount;

        try {
            const [sellerUsers] = await connection.query(
                `SELECT user_id FROM characters WHERE character_id = ? LIMIT 1`,
                [seller_character_id]
            );

            if (sellerUsers.length > 0) {
                const sellerUserId = sellerUsers[0].user_id;
                const sellerInfo = onlineUsers.get(sellerUserId);
                
                if (sellerInfo && sellerInfo.socketIds.size > 0) {
                    console.log(`[Market] 판매자(${sellerUserId})에게 골드(${sellerGold}) 업데이트 실시간 알림 전송`);
                    sellerInfo.socketIds.forEach(socketId => {

                        io.to(socketId).emit('updateGold', { gold: sellerGold, Gold: sellerGold });
                        
                    });
                }
            }
        } catch (notifyError) {
            console.error('[Market] 판매자 알림 전송 중 오류:', notifyError);
        }

        res.json({ success: true, message: '아이템 구매 성공.', marketId: parseInt(marketId), ItemId: item_id, spec: JSON.parse(item_spec || '{}'), purchasedItemCount: purchaseCount, remainingItemCount: remainingItemCount, gold: buyerGold, sellerGold: sellerGold });

    } catch (err) { 
        if (connection) await connection.rollback();
        console.error('Market buy error:', err);
        res.status(err.message === '골드 부족' || err.message === '아이템 개수 부족' || err.message === '판매 물품 없음' || err.message === '구매자 캐릭터 없음' ? 400 : 500)
           .json({ success: false, message: err.message || '구매 처리 실패' });
    } finally { 
        if (connection) connection.release();
    }
});

// 아이템 판매 취소
app.delete('/market/items/:userId/:marketId', async (req, res) => { 
    const { userId, marketId } = req.params;
    
    const isGuest = String(userId).startsWith('guest_');
    
    const listingId = Number(marketId);
    if (!Number.isInteger(listingId)) return res.status(400).json({ success: false, message: '잘못된 marketId 형식입니다.' });
    
    try {
        if (isGuest) {
            console.log(`[Market] GUEST ${userId}가 판매 취소를 시도했습니다. (Blocked)`);
            // 게스트는 "권한 없음" 오류를 반환합니다.
            return res.status(403).json({ 
                success: false, 
                message: '게스트는 판매를 취소할 수 없습니다.'
            });
        }

        const findSql = `SELECT ml.listing_id, ml.item_id, ml.quantity, ml.price, ml.item_spec, c.user_id FROM marketlistings ml JOIN characters c ON ml.seller_character_id = c.character_id WHERE ml.listing_id = ?`;
        const [rows] = await dbPool.query(findSql, [listingId]);
        
        if (rows.length === 0) return res.status(404).json({ success: false, message: '해당 마켓 아이템을 찾을 수 없습니다.' });
        
        const row = rows[0];
        
        if (String(row.user_id) !== String(userId)) {
            return res.status(403).json({ success: false, message: '아이템을 삭제할 권한이 없습니다.' });
        }

        await dbPool.query('DELETE FROM marketlistings WHERE listing_id = ?', [listingId]);
        return res.status(200).json({ success: true, message: '아이템 등록이 취소되었습니다.', marketId: listingId, ItemId: row.item_id, ItemCount: row.quantity, price: row.price, spec: safeJSON(row.item_spec) });
    
    } catch (err) {
        console.error('Market item deletion error:', err);
        return res.status(500).json({ success: false, message: '삭제 실패' });
    }
});

// 플레이어 데이터 불러오기
app.get('/playerData/:userId', async (req, res) => { 
    const { userId } = req.params;
    console.log(`[GET] ${userId} 플레이어 데이터 요청`);

    if (String(userId).startsWith('guest_')) {
        console.log(`[GET /playerData] GUEST ${userId}에게 기본 스탯 데이터를 전송합니다.`);
        
        const guestData = {
            id: userId,
            nickname: "Guest", 
            currentHp: 100,   
            maxHp: 100,       
            level: 1,        
            exp: 0,            
            speed: 5,          
            defense: 5,        
            damage: 10,        
            dead: false,
            gold: 500,       
            position: { x: -15.76, y: 3.866, z: 49.78 }, // 기본 스폰 위치
            rotation: { x: 0, y: 0, z: 0 }
        };
        
        return res.json(guestData);
    }

    const playerDataQuery = `SELECT u.user_id as id, u.nickname, c.level, c.gold, c.position_x, c.position_y, c.position_z, c.rotation_y, cs.currentHp, cs.maxHp, cs.experience AS exp, cs.speed, cs.defense, cs.damage FROM users u LEFT JOIN characters c ON u.user_id = c.user_id LEFT JOIN characterstats cs ON c.character_id = cs.character_id WHERE u.user_id = ? LIMIT 1;`;
    try {
        const [results] = await dbPool.query(playerDataQuery, [userId]); 
        if (results.length === 0) return res.status(404).send('플레이어 정보를 찾을 수 없습니다.');
        const data = results[0];
        const response = { 
            id: data.id, 
            nickname: data.nickname, 
            currentHp: data.currentHp, 
            maxHp: data.maxHp, 
            level: data.level, 
            exp: data.exp, 
            speed: data.speed, 
            defense: data.defense, 
            damage: data.damage, 
            dead: false, 
            gold: data.gold, 
            position: { 
                x: data.position_x || -15.76, 
                y: data.position_y || 3.866, 
                z: data.position_z || 49.78 
            }, 
            rotation: { x: 0, y: data.rotation_y, z: 0 } 
        };
        res.json(response);
    } catch (err) {
        console.error('DB 오류:', err);
        return res.status(500).send('서버 오류');
    }
});
app.post('/playerData/:userId', async (req, res) => {
  const { userId } = req.params;
  if (String(userId).startsWith('guest_')) {
      console.log(`[POST /playerData] GUEST ${userId} data save skipped.`);
      return res.status(200).json({ success: true, message: '게스트 활동은 저장되지 않습니다.' });
  }
  const incoming = req.body || {};
  console.log(`[POST /playerData] User ${userId} sent data:\n`, JSON.stringify(incoming, null, 2));

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // 캐릭터 식별
    const [characters] = await connection.query(
      `SELECT character_id FROM characters WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (characters.length === 0) throw new Error('캐릭터 없음');
    const characterId = characters[0].character_id;

    // 현재 DB 값 읽기
    const [[curChar]] = await connection.query(
      `SELECT level, gold, position_x, position_y, position_z, rotation_y
       FROM characters WHERE character_id = ? LIMIT 1`,
      [characterId]
    );
    const [[curStats]] = await connection.query(
      `SELECT currentHp, maxHp, experience AS exp, speed, defense, damage
       FROM characterstats WHERE character_id = ? LIMIT 1`,
      [characterId]
    );

    // 최종 값: 들어온 값이 있으면 사용, 없으면 기존 DB 유지
    const finalLevel = curChar?.level ?? 1;
    const finalGold  = curChar?.gold  ?? 0;

    const finalPosX = incoming.position?.x ?? curChar?.position_x ?? -15.76;
    const finalPosY = incoming.position?.y ?? curChar?.position_y ?? 3.866;
    const finalPosZ = incoming.position?.z ?? curChar?.position_z ?? 49.78;
    const finalRotY = incoming.rotation?.y ?? curChar?.rotation_y ?? 0;

    const finalHpCur = (typeof incoming.currentHp === 'number') ? incoming.currentHp : curStats?.currentHp ?? 100;
    const finalHpMax = (typeof incoming.maxHp    === 'number') ? incoming.maxHp    : curStats?.maxHp    ?? 100;
    const finalExp   = curStats?.exp      ?? 0;
    const finalSpd   = (typeof incoming.speed    === 'number') ? incoming.speed    : curStats?.speed    ?? 3;
    const finalDef   = (typeof incoming.defense  === 'number') ? incoming.defense  : curStats?.defense  ?? 5;
    const finalDmg   = (typeof incoming.damage   === 'number') ? incoming.damage   : curStats?.damage   ?? 1;

    // 저장
    await connection.query(
      `UPDATE characters
         SET level = ?, gold = ?, position_x = ?, position_y = ?, position_z = ?, rotation_y = ?
       WHERE character_id = ?`,
      [finalLevel, finalGold, finalPosX, finalPosY, finalPosZ, finalRotY, characterId]
    );

    await connection.query(
      `UPDATE characterstats
         SET currentHp = ?, maxHp = ?, experience = ?, speed = ?, defense = ?, damage = ?
       WHERE character_id = ?`,
      [finalHpCur, finalHpMax, finalExp, finalSpd, finalDef, finalDmg, characterId]
    );

    await connection.commit();
    console.log(`[POST] ${userId} 데이터 저장 완료`);
    res.status(200).json({ success: true, message: 'Player data saved successfully.' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Player data save error:', err);
    res.status(err.message === '캐릭터 없음' ? 404 : 500)
       .send(err.message === '캐릭터 없음' ? '캐릭터를 찾을 수 없습니다.' : '데이터 저장 실패');
  } finally {
    if (connection) connection.release();
  }
});


// 퀘스트 API
app.get('/dialogue', (req, res) => {
    console.log('[GET] 퀘스트 대화 데이터 요청');
    res.status(200).json(dialogueData);
});

// 퀘스트 API (퀘스트 목록 불러오기)
app.get('/quest/:userId', async (req, res) => {
    const { userId } = req.params;
    
    console.log(`[GET /quest] ${userId}의 퀘스트 데이터 요청함.`);

    if (String(userId).startsWith('guest_')) {
        console.log(`[GET /quest] GUEST ${userId}에게 '시작 가능' 퀘스트 목록을 전송합니다. (모든 MissionProgress 키 포함)`);
        
        const defaultQuestStatuses = questData.map(quest => {
            
            // 퀘스트 전체에서 사용할 하나의 MissionProgress 객체를 생성합니다.
            const defaultProgress = {};

            // 퀘스트의 "모든" 단계를 순회합니다.
            if (quest.steps) {
                quest.steps.forEach(step => {
                    // "모든" 단계의 "모든" 미션을 순회합니다.
                    if (step.missions) {
                        step.missions.forEach((mission, index) => {
                            
                            // 미션 유형에 따라 다른 Key를 사용합니다.
                            if (mission.type === "Kill") {
                                defaultProgress[mission.targetId] = 0;
                            } else {
                                defaultProgress[index] = 0;
                            }
                        });
                    }
                });
            }

            // 최종 생성된 객체
            console.log(`[GUEST] Quest ${quest.questID} MissionProgress 생성:`, defaultProgress);

            return {
                questId: quest.questID,
                state: 0,               
                currentStepIndex: 0,
                IsFocused: false,
                MissionProgress: defaultProgress 
            };
        });

        const responseData = {
            questData: questData,                 
            questStatuses: defaultQuestStatuses  
        };
        
        return res.status(200).json(responseData);
    }
    try {
        const [characters] = await dbPool.query(`SELECT character_id FROM characters WHERE user_id = ? LIMIT 1`, [userId]);
        
        if (characters.length === 0) {
            console.warn(`[GET /quest] ${userId}에 해당하는 캐릭터를 찾을 수 없음.`);
            return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        }
        
        const characterId = characters[0].character_id;

        const getProgressSql = `SELECT quest_id AS questId, current_progress_data FROM questprogress WHERE character_id = ?`;
        const [results] = await dbPool.query(getProgressSql, [characterId]);

        const questStatuses = results.map(row => {
            let progressData = {};
            try { 
                if (row.current_progress_data) {
                    progressData = JSON.parse(row.current_progress_data);
                }
            } catch (e) { 
                console.error(`[GET /quest] JSON 파싱 오류 (characterId: ${characterId}, questId: ${row.questId}):`, row.current_progress_data); 
            }
            
            return { 
                questId: row.questId, 
                state: progressData.state || 0,
                currentStepIndex: progressData.step || 0,
                IsFocused: progressData.IsFocused || false,       
                MissionProgress: progressData.MissionProgress || {} 
            };
        });

        const responseData = {
            questData: questData,       
            questStatuses: questStatuses  
        };

        console.log(`[GET /quest] ${userId}에게 DB 진행도 데이터를 전송합니다.`);
        res.status(200).json(responseData);

    } catch (err) {
        console.error(`[GET /quest] DB 오류 (UserId: ${userId}):`, err);
        res.status(500).json({ message: 'DB 오류 (questprogress)' });
    }
});

app.post('/quest/:userId', async (req, res) => { 
    const { userId } = req.params;
    if (String(userId).startsWith('guest_')) {
        return res.status(200).json({ success: true, message: '게스트 활동은 저장되지 않습니다.' });
    }
    const questStatus = req.body || {};
    console.log(`[POST] ${userId} 퀘스트 진행도 저장 요청`, questStatus);
    if (typeof questStatus.questId === 'undefined') return res.status(200).json({ message: '유효하지 않은 퀘스트 데이터 (무시됨)' });
    try {
        const [characters] = await dbPool.query(`SELECT character_id FROM characters WHERE user_id = ? LIMIT 1`, [userId]); 
        if (characters.length === 0) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        const characterId = characters[0].character_id;
        const progressDataJson = JSON.stringify({ 
            step: questStatus.currentStepIndex, 
            state: questStatus.state,
            IsFocused: questStatus.IsFocused,        
            MissionProgress: questStatus.MissionProgress 
        });
        const upsertSql = `INSERT INTO questprogress (character_id, quest_id, current_progress_data) VALUES (?, ?, ?) AS new ON DUPLICATE KEY UPDATE current_progress_data = new.current_progress_data`;
        await dbPool.query(upsertSql, [characterId, questStatus.questId, progressDataJson]); 
        console.log(`[DB] 퀘스트 진행도 저장 성공 (CharacterID: ${characterId}, QuestID: ${questStatus.questId})`);
        res.status(200).json({ message: '퀘스트 진행도 저장 성공' });
    } catch (err) {
        console.error("퀘스트 진행도 저장 실패:", err);
        res.status(500).json({ message: 'DB 오류' });
    }
});

// 랭킹 API
const POWER_WEIGHT = { LVL: 15, ATK: 4, DEF: 3, SPD: 2, HP: 0.05 };
const POWER_SCORES_WSQL = (limit) => `WITH inv AS ( SELECT character_id, COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(item_spec, '$.damage')) AS SIGNED)), 0) AS s_dmg, COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(item_spec, '$.defense')) AS SIGNED)), 0) AS s_def, COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(item_spec, '$.speed'))  AS SIGNED)), 0) AS s_spd, COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(item_spec, '$.hp'))     AS SIGNED)), 0) AS s_hp FROM \`inventory\` WHERE item_id IS NOT NULL GROUP BY character_id ), base AS ( SELECT c.character_id, u.nickname AS character_name, COALESCE(c.level,1) AS level, COALESCE(NULLIF(cs.attack,0), cs.damage, 0) AS dmg, COALESCE(cs.defense,0) AS defn, COALESCE(cs.speed,  0) AS spd, GREATEST(COALESCE(cs.maxHp,0),1) AS hp FROM \`characters\` c LEFT JOIN \`characterstats\` cs ON cs.character_id = c.character_id LEFT JOIN \`users\` u ON c.user_id = u.user_id ), scores AS ( SELECT b.character_id, b.character_name, b.level, (${POWER_WEIGHT.LVL}*b.level) + (${POWER_WEIGHT.ATK}*(b.dmg + COALESCE(i.s_dmg,0))) + (${POWER_WEIGHT.DEF}*(b.defn+ COALESCE(i.s_def,0))) + (${POWER_WEIGHT.SPD}*(b.spd + COALESCE(i.s_spd,0))) + (${POWER_WEIGHT.HP} *(b.hp  + COALESCE(i.s_hp,0))) AS power FROM base b LEFT JOIN inv i ON i.character_id=b.character_id ) SELECT ROW_NUMBER() OVER (ORDER BY power DESC) AS \`rank\`, character_id, character_name, level, power FROM scores ORDER BY power DESC LIMIT ${Number(limit)}`;
const POWER_ME_WSQL = `WITH inv AS ( SELECT character_id, COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(item_spec, '$.damage')) AS SIGNED)), 0) AS s_dmg, COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(item_spec, '$.defense')) AS SIGNED)), 0) AS s_def, COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(item_spec, '$.speed'))  AS SIGNED)), 0) AS s_spd, COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(item_spec, '$.hp'))     AS SIGNED)), 0) AS s_hp FROM \`inventory\` WHERE item_id IS NOT NULL GROUP BY character_id ), base AS ( SELECT c.character_id, u.nickname AS character_name, COALESCE(c.level,1) AS level, COALESCE(NULLIF(cs.attack,0), cs.damage, 0) AS dmg, COALESCE(cs.defense,0) AS defn, COALESCE(cs.speed,  0) AS spd, GREATEST(COALESCE(cs.maxHp,0),1) AS hp FROM \`characters\` c LEFT JOIN \`characterstats\` cs ON cs.character_id = c.character_id LEFT JOIN \`users\` u ON c.user_id = u.user_id ), scores AS ( SELECT b.character_id, b.character_name, b.level, (${POWER_WEIGHT.LVL}*b.level) + (${POWER_WEIGHT.ATK}*(b.dmg + COALESCE(i.s_dmg,0))) + (${POWER_WEIGHT.DEF}*(b.defn+ COALESCE(i.s_def,0))) + (${POWER_WEIGHT.SPD}*(b.spd + COALESCE(i.s_spd,0))) + (${POWER_WEIGHT.HP} *(b.hp  + COALESCE(i.s_hp,0))) AS power FROM base b LEFT JOIN inv i ON i.character_id=b.character_id ) SELECT * FROM ( SELECT ROW_NUMBER() OVER (ORDER BY power DESC) AS \`rank\`, character_id, character_name, level, power FROM scores ) t WHERE character_id = ? LIMIT 1;`;
const LEVEL_SCORES_WSQL = (limit) => `SELECT ROW_NUMBER() OVER (ORDER BY c.level DESC) AS \`rank\`, c.character_id, u.nickname AS character_name, c.level FROM \`characters\` c LEFT JOIN \`users\` u ON c.user_id = u.user_id ORDER BY c.level DESC LIMIT ${Number(limit)}`;
const LEVEL_ME_WSQL = `WITH ranked AS ( SELECT ROW_NUMBER() OVER (ORDER BY level DESC) AS \`rank\`, c.character_id, u.nickname AS character_name, c.level FROM \`characters\` c LEFT JOIN \`users\` u ON c.user_id = u.user_id ) SELECT * FROM ranked WHERE character_id = ? LIMIT 1;`;

app.get('/api/rankings/power', async (req, res) => { 
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    try {
        const [rows] = await dbPool.query(POWER_SCORES_WSQL(limit)); 
        res.json(rows);
    } catch (err) {
        console.error('POWER_RANK err:', err);
        res.status(500).json({ message: '랭킹 계산 실패' });
    }
});
app.get('/api/rankings/power/me/:characterId', async (req, res) => { 
    try {
        const [rows] = await dbPool.query(POWER_ME_WSQL, [req.params.characterId]); 
        if (!rows.length) return res.status(404).json({ message: '캐릭터 없음' });
        res.json(rows[0]);
    } catch (err) {
        console.error('POWER_ME err:', err);
        res.status(500).json({ message: '내 순위 계산 실패' });
    }
});
app.get('/api/rankings/level', async (req, res) => { 
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    try {
        const [rows] = await dbPool.query(LEVEL_SCORES_WSQL(limit)); 
        res.json(rows);
    } catch (err) {
        console.error('LEVEL_RANK err:', err);
        res.status(500).json({ message: '랭킹 계산 실패' });
    }
});
app.get('/api/rankings/level/me/:characterId', async (req, res) => { 
    try {
        const [rows] = await dbPool.query(LEVEL_ME_WSQL, [req.params.characterId]); 
        if (!rows.length) return res.status(404).json({ message: '캐릭터 없음' });
        res.json(rows[0]);
    } catch (err) {
        console.error('LEVEL_ME err:', err);
        res.status(500).json({ message: '내 순위 계산 실패' });
    }
});

//챗봇 API키
app.get('/api/chat-config', (req, res) => {
    try {
        const config = {
            botId: process.env.LEX_BOT_ID,
            identityPoolId: process.env.LEX_IDENTITY_POOL_ID,
            region: 'ap-northeast-2'
        };

        if (!config.botId || !config.identityPoolId) {
            console.error("🚨 챗봇 설정(.env)이 누락되었습니다. LEX_BOT_ID 또는 LEX_IDENTITY_POOL_ID를 확인하세요.");
            return res.status(500).json({ message: "챗봇 설정이 서버에 없습니다." });
        }
        
        res.json(config);
        
    } catch (err) {
        console.error('Error fetching chat-config:', err);
        res.status(500).json({ message: '설정 로드 중 서버 오류 발생' });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});