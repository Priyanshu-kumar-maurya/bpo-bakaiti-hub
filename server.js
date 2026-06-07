const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./server/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'bpo-floor-confidential-secret-key-123';

// Express Middlewares
app.use(express.json({ limit: '10mb' })); // support large base64 meme uploads
app.use(express.static(path.join(__dirname, 'client')));

// Token verification middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ message: "Access Token Required" });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid or Expired Token" });
        req.user = user;
        next();
    });
}

// Admin only middleware
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: "Admin Privilege Required" });
    }
    next();
}

// --- REST API Endpoints ---

// Register Agent
app.post('/api/register', (req, res) => {
    const { name, username, password, employeeId } = req.body;
    
    if (!name || !username || !password || !employeeId) {
        return res.status(400).json({ message: "Required fields missing" });
    }
    
    const existing = db.findUserByUsername(username);
    if (existing) {
        return res.status(400).json({ message: "Username already registered on the floor" });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = db.addUser({
        name,
        username,
        employeeId,
        role: "Floor Agent / Support",
        superpower: "Mute par client ki mimicry karna",
        weakness: "Log-out time ka wait karna",
        avatar: "💻",
        password: hashedPassword
    });
    
    res.status(201).json({ success: true, message: "Agent registered successfully", user: { username: newUser.username, isAdmin: newUser.isAdmin } });
});

// Login Agent
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: "Required fields missing" });
    }
    
    const user = db.findUserByUsername(username);
    if (!user) {
        return res.status(401).json({ message: "Username not registered on the floor" });
    }
    
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
        return res.status(401).json({ message: "Incorrect password" });
    }
    
    // Create JWT
    const token = jwt.sign({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
        superpower: user.superpower,
        weakness: user.weakness
    }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
        success: true,
        token,
        user: {
            name: user.name,
            username: user.username,
            role: user.role,
            avatar: user.avatar,
            isAdmin: user.isAdmin
        }
    });
});

// Get profiles list
app.get('/api/profiles', authenticateToken, (req, res) => {
    const users = db.get('users').map(u => ({
        id: u.id,
        username: u.username,
        employeeId: u.employeeId,
        name: u.name,
        role: u.role,
        superpower: u.superpower,
        weakness: u.weakness,
        avatar: u.avatar,
        karma: u.karma,
        isAdmin: u.isAdmin
    }));
    res.json(users);
});

// Get admin stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    const usersCount = db.get('users').length;
    const confessionsCount = db.get('confessions').length;
    const activeConnections = io.engine.clientsCount;
    
    res.json({
        usersCount,
        confessionsCount,
        activeConnections
    });
});

// Delete moderation endpoints (Admin only)
app.delete('/api/admin/confession/:id', authenticateToken, requireAdmin, (req, res) => {
    db.deleteConfession(req.params.id);
    io.emit('update_confessions', db.get('confessions'));
    res.json({ success: true, message: "Confession deleted by admin" });
});

app.delete('/api/admin/meme/:index', authenticateToken, requireAdmin, (req, res) => {
    const memes = db.deleteMeme(req.params.index);
    io.emit('update_memes', memes);
    res.json({ success: true, message: "Meme deleted by admin" });
});

app.delete('/api/admin/quote/:id', authenticateToken, requireAdmin, (req, res) => {
    db.deleteQuote(req.params.id);
    io.emit('update_quotes', db.get('quotes'));
    res.json({ success: true, message: "Quote deleted by admin" });
});

// Catch-all route to serve login page if not authenticated
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'login.html'));
});

// --- Socket.io Real-Time Synchronization ---

// Authenticate socket connections using query token
io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
        return next(new Error("Authentication error"));
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("Authentication error"));
        socket.user = decoded;
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`Agent ${socket.user.username} logged into BPO Floor channels`);
    
    // Send current database state to newly connected client
    socket.emit('init_state', {
        quotes: db.get('quotes'),
        catchphrases: db.get('catchphrases'),
        memes: db.get('memes'),
        participants: db.get('users').map(u => u.name),
        polls: db.get('polls'),
        countdowns: db.get('countdowns'),
        leaderboard: db.get('leaderboard'),
        profiles: db.get('users').map(u => ({
            id: u.id,
            username: u.username,
            employeeId: u.employeeId,
            name: u.name,
            role: u.role,
            superpower: u.superpower,
            weakness: u.weakness,
            avatar: u.avatar,
            karma: u.karma,
            isAdmin: u.isAdmin
        })),
        confessions: db.get('confessions')
    });
    
    // 1. Quotes events
    socket.on('new_quote', (data) => {
        db.addQuote(data.text, data.speaker, data.context);
        io.emit('update_quotes', db.get('quotes'));
    });
    
    // 2. Soundboard events
    socket.on('new_catchphrase', (data) => {
        db.addCatchphrase(data.phrase, data.speaker, data.pitch, data.speed, data.effect);
        io.emit('update_catchphrases', db.get('catchphrases'));
    });
    
    // 3. Memes events
    socket.on('upload_meme', (base64) => {
        const memes = db.addMeme(base64);
        io.emit('update_memes', memes);
    });
    
    // 4. Poll events
    socket.on('new_poll', (data) => {
        db.addPoll(data.question, data.options);
        io.emit('update_polls', db.get('polls'));
    });
    
    socket.on('vote_poll', (data) => {
        const result = db.votePoll(data.pollId, data.optionIndex, socket.user.username);
        if (result.success) {
            io.emit('update_polls', db.get('polls'));
        } else {
            socket.emit('error_alert', result.message);
        }
    });
    
    socket.on('delete_poll', (pollId) => {
        db.deletePoll(pollId);
        io.emit('update_polls', db.get('polls'));
    });
    
    // 5. Countdown events
    socket.on('new_countdown', (data) => {
        db.addCountdown(data.name, data.target, data.emoji);
        io.emit('update_countdowns', db.get('countdowns'));
    });
    
    socket.on('delete_countdown', (id) => {
        db.deleteCountdown(id);
        io.emit('update_countdowns', db.get('countdowns'));
    });
    
    // 6. Wall of Fame / Leaderboard events
    socket.on('vote_leaderboard', (data) => {
        db.voteLeaderboard(data.category, data.name);
        io.emit('update_leaderboard', db.get('leaderboard'));
    });
    
    socket.on('add_karma', (profileId) => {
        db.updateUserKarma(profileId, 1);
        // Refresh profiles to all agents
        const refreshedProfiles = db.get('users').map(u => ({
            id: u.id,
            username: u.username,
            employeeId: u.employeeId,
            name: u.name,
            role: u.role,
            superpower: u.superpower,
            weakness: u.weakness,
            avatar: u.avatar,
            karma: u.karma,
            isAdmin: u.isAdmin
        }));
        io.emit('update_profiles', refreshedProfiles);
    });

    socket.on('update_profile', (data) => {
        db.updateUserProfile(socket.user.username, data);
        const refreshedProfiles = db.get('users').map(u => ({
            id: u.id,
            username: u.username,
            employeeId: u.employeeId,
            name: u.name,
            role: u.role,
            superpower: u.superpower,
            weakness: u.weakness,
            avatar: u.avatar,
            karma: u.karma,
            isAdmin: u.isAdmin
        }));
        io.emit('update_profiles', refreshedProfiles);
    });
    
    // 7. Confessions events
    socket.on('new_confession', (data) => {
        db.addConfession(data.type, data.text);
        io.emit('update_confessions', db.get('confessions'));
    });
    
    socket.on('like_confession', (confId) => {
        const result = db.likeConfession(confId, socket.user.username);
        if (result.success) {
            io.emit('update_confessions', db.get('confessions'));
        }
    });
    
    // 8. Real-time Synchronised Spin the Wheel
    socket.on('spin_wheel_trigger', () => {
        const participants = db.get('users').map(u => u.name);
        if (participants.length === 0) return;
        
        // Randomise ending parameters on the server to keep them aligned
        const spinTimeTotal = Math.random() * 2000 + 4000;
        const spinAngleStart = Math.random() * 10 + 10;
        const targetIndex = Math.floor(Math.random() * participants.length);
        
        // Broadcast to all floor agents (including sender) to begin rotation
        io.emit('spin_wheel_start', {
            spinTimeTotal,
            spinAngleStart,
            targetIndex,
            spinner: socket.user.name
        });
    });

    socket.on('disconnect', () => {
        console.log(`Agent ${socket.user.username} logged out from channels`);
    });
});

// Initialize database and run server
db.init().then(() => {
    server.listen(PORT, () => {
        console.log(`===================================================`);
        console.log(` BPO Vault Real-time Server Running on Port ${PORT}`);
        console.log(` Access link: http://localhost:${PORT}`);
        console.log(`===================================================`);
    });
}).catch(err => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
});
