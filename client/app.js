/* ==========================================================================
   BPO VAULT CLIENT CONTROLLER JAVASCRIPT
   ========================================================================== */

const token = sessionStorage.getItem('token');
const userUsername = sessionStorage.getItem('username');
const userName = sessionStorage.getItem('name');
const userRole = sessionStorage.getItem('role');
const userAvatar = sessionStorage.getItem('avatar');
const userIsAdmin = sessionStorage.getItem('isAdmin') === 'true';

// Connect to real-time Socket.io server
const socket = typeof io !== 'undefined' ? io({
    auth: { token }
}) : null;

// App State
let state = {
    quotes: [],
    catchphrases: [],
    memes: [],
    participants: [],
    polls: [],
    countdowns: [],
    leaderboard: {},
    profiles: [],
    confessions: [],
    teaUnlocked: false
};

// Web Audio API Synthesizer setup
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSoundEffect(type) {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        
        if (type === 'tada') {
            const notes = [261.63, 329.63, 392.00, 523.25];
            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + index * 0.1);
                gain.gain.setValueAtTime(0.15, now + index * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.1 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + index * 0.1);
                osc.stop(now + index * 0.1 + 0.35);
            });
        } 
        else if (type === 'fail') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.5);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.6);
        } 
        else if (type === 'bell') {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(987.77, now);
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1479.98, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.8);
            osc2.stop(now + 0.8);
        } 
        else if (type === 'laughter') {
            for (let i = 0; i < 5; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const startTime = now + i * 0.15;
                osc.type = 'sine';
                osc.frequency.setValueAtTime(350 + Math.random() * 50, startTime);
                osc.frequency.exponentialRampToValueAtTime(450, startTime + 0.1);
                gain.gain.setValueAtTime(0.12, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.12);
            }
        }
        else if (type === 'tick') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.05);
        }
    } catch (e) {
        console.error("Audio Context initialization failed or blocked.", e);
    }
}

// Text to speech parameters
function speakText(text, pitch = 1.0, speed = 1.0) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.pitch = parseFloat(pitch);
        utterance.rate = parseFloat(speed);
        
        const voices = window.speechSynthesis.getVoices();
        const hiVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('HI'));
        if (hiVoice) {
            utterance.voice = hiVoice;
        }
        window.speechSynthesis.speak(utterance);
    }
}

// --- App Load Event ---
document.addEventListener('DOMContentLoaded', () => {
    // Populate user profile info in navbar
    document.getElementById('user-avatar').innerText = userAvatar;
    document.getElementById('user-fullname').innerText = userName;
    document.getElementById('user-role').innerText = userRole;

    if (userIsAdmin) {
        const adminBtn = document.getElementById('admin-panel-btn');
        adminBtn.style.display = 'block';
        adminBtn.addEventListener('click', () => {
            window.location.href = '/admin.html';
        });
    }

    // Logout button handler
    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = '/login.html';
    });

    initTabNavigation();
    setupModals();
    setupEventHandlers();
    
    // Periodically update countdown timers
    setInterval(updateAllCountdowns, 1000);
});

// --- Tab Pane Switching ---
function initTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const targetPane = document.getElementById(`${tab.dataset.tab}-tab`);
            if (targetPane) {
                targetPane.classList.add('active');
            }
            
            if (tab.dataset.tab === 'hangout') {
                setTimeout(drawWheel, 100);
            }
        });
    });
}

// --- Socket Receivers for Real-Time Synchronization ---

if (socket) {
    socket.on('connect', () => {
        document.getElementById('floor-status').innerText = "Logged In: Realtime Active";
        const statusDot = document.querySelector('.status-indicator');
        statusDot.className = 'status-indicator online';
    });

    socket.on('disconnect', () => {
        document.getElementById('floor-status').innerText = "Logged Out: Connecting...";
        const statusDot = document.querySelector('.status-indicator');
        statusDot.className = 'status-indicator';
    });

    socket.on('error_alert', (msg) => {
        alert(msg);
    });

    socket.on('init_state', (data) => {
        state.quotes = data.quotes;
        state.catchphrases = data.catchphrases;
        state.memes = data.memes;
        state.participants = data.participants;
        state.polls = data.polls;
        state.countdowns = data.countdowns;
        state.leaderboard = data.leaderboard;
        state.profiles = data.profiles;
        state.confessions = data.confessions;
        
        renderQuotes();
        renderSoundboard();
        renderMemes();
        renderWheel();
        renderPolls();
        renderCountdowns();
        renderLeaderboard();
        renderProfiles();
        renderConfessions();
    });

    socket.on('update_quotes', (quotes) => {
        state.quotes = quotes;
        renderQuotes();
    });

    socket.on('update_catchphrases', (catchphrases) => {
        state.catchphrases = catchphrases;
        renderSoundboard();
    });

    socket.on('update_memes', (memes) => {
        state.memes = memes;
        renderMemes();
    });

    socket.on('update_polls', (polls) => {
        state.polls = polls;
        renderPolls();
    });

    socket.on('update_countdowns', (countdowns) => {
        state.countdowns = countdowns;
        renderCountdowns();
    });

    socket.on('update_leaderboard', (leaderboard) => {
        state.leaderboard = leaderboard;
        renderLeaderboard();
    });

    socket.on('update_profiles', (profiles) => {
        state.profiles = profiles;
        // Also sync wheel names
        state.participants = profiles.map(u => u.name);
        renderProfiles();
        renderWheel();
    });

    socket.on('update_confessions', (confessions) => {
        state.confessions = confessions;
        renderConfessions();
    });
}

// --- RENDER LOGIC BY MODULE ---

// 1. Quote of the Week Module
let currentQuoteIndex = 0;
function renderQuotes() {
    const container = document.getElementById('quote-slider');
    if (!container) return;
    
    if (state.quotes.length === 0) {
        container.innerHTML = `<div class="quote-card"><p class="quote-text">No nominated quotes yet. Click Nominate Quote!</p></div>`;
        return;
    }
    
    if (currentQuoteIndex >= state.quotes.length) {
        currentQuoteIndex = 0;
    }
    
    const quote = state.quotes[currentQuoteIndex];
    let html = `
        <div class="quote-card">
            <p class="quote-text">${escapeHTML(quote.text)}</p>
            <p class="quote-speaker">— ${escapeHTML(quote.speaker)}</p>
            ${quote.context ? `<p class="quote-context">(${escapeHTML(quote.context)})</p>` : ''}
        </div>
        <div class="quote-navigation">
    `;
    
    state.quotes.forEach((_, index) => {
        html += `<button class="quote-nav-dot ${index === currentQuoteIndex ? 'active' : ''}" onclick="setQuoteIndex(${index})"></button>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

window.setQuoteIndex = function(index) {
    currentQuoteIndex = index;
    renderQuotes();
};

// 2. Catchphrase Soundboard Module
function renderSoundboard() {
    const grid = document.getElementById('soundboard-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    state.catchphrases.forEach((c) => {
        const button = document.createElement('button');
        button.className = 'sound-btn';
        button.innerHTML = `
            <i data-lucide="play-circle"></i>
            <span class="sound-title">"${escapeHTML(c.phrase)}"</span>
            <span class="sound-speaker">${escapeHTML(c.speaker)}</span>
        `;
        button.addEventListener('click', () => {
            button.classList.add('playing');
            if (c.effect && c.effect !== 'none') {
                playSoundEffect(c.effect);
                setTimeout(() => {
                    speakText(c.phrase, c.pitch, c.speed);
                }, 300);
            } else {
                speakText(c.phrase, c.pitch, c.speed);
            }
            setTimeout(() => {
                button.classList.remove('playing');
            }, 1500);
        });
        grid.appendChild(button);
    });
    lucide.createIcons();
}

// 3. Meme Gallery Module
function renderMemes() {
    const grid = document.getElementById('meme-gallery-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    if (state.memes.length === 0) {
        grid.innerHTML = `<p class="section-subtitle" style="grid-column: 1/-1; text-align:center;">No memes uploaded yet. Click Upload Meme!</p>`;
        return;
    }
    
    state.memes.forEach((meme, index) => {
        const item = document.createElement('div');
        item.className = 'meme-item';
        item.innerHTML = `
            <img src="${meme}" alt="Meme ${index + 1}" loading="lazy">
            <div class="meme-overlay">
                <span class="meme-likes"><i data-lucide="heart"></i> Live Floor Meme</span>
            </div>
        `;
        grid.appendChild(item);
    });
    lucide.createIcons();
}

// 4. Spin the Wheel Module
let isSpinning = false;
let startAngle = 0;
let spinArcStart = 10;
let spinTime = 0;
let spinTimeTotal = 0;
let spinAngleStart = 0;
let targetIndex = 0;
let ctx;

const wheelColors = ["#10b981", "#6366f1", "#f59e0b", "#ff7a59", "#ec4899", "#8b5cf6", "#06b6d4", "#e11d48"];

function renderWheel() {
    drawWheel();
    renderWheelChips();
}

function drawWheel() {
    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    const count = state.participants.length;
    if (count === 0) {
        ctx.clearRect(0, 0, 360, 360);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Outfit';
        ctx.fillText("Register profiles to draw wheel", 60, 180);
        return;
    }
    
    const arc = Math.PI / (count / 2);
    ctx.clearRect(0, 0, 360, 360);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    
    const outsideRadius = 170;
    const textRadius = 120;
    const insideRadius = 40;
    
    for (let i = 0; i < count; i++) {
        const angle = startAngle + i * arc;
        ctx.fillStyle = wheelColors[i % wheelColors.length];
        
        ctx.beginPath();
        ctx.arc(180, 180, outsideRadius, angle, angle + arc, false);
        ctx.arc(180, 180, insideRadius, angle + arc, angle, true);
        ctx.stroke();
        ctx.fill();
        
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.translate(180 + Math.cos(angle + arc / 2) * textRadius, 
                      180 + Math.sin(angle + arc / 2) * textRadius);
        ctx.rotate(angle + arc / 2 + Math.PI / 2);
        
        const text = state.participants[i];
        ctx.font = 'bold 12px Outfit';
        ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
        ctx.restore();
    }
}

function renderWheelChips() {
    const container = document.getElementById('wheel-participants');
    if (!container) return;
    
    container.innerHTML = '';
    state.participants.forEach((name) => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.innerHTML = `<span>${escapeHTML(name)}</span>`;
        container.appendChild(chip);
    });
    
    const select = document.getElementById('nominate-select');
    if (select) {
        select.innerHTML = '<option value="" disabled selected>Select coworker...</option>';
        state.participants.forEach(name => {
            select.innerHTML += `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`;
        });
    }
}

// Socket listener for synchronised wheel spins
if (socket) {
    socket.on('spin_wheel_start', (data) => {
        if (isSpinning) return;
        
        isSpinning = true;
        spinTime = 0;
        spinTimeTotal = data.spinTimeTotal;
        spinAngleStart = data.spinAngleStart;
        targetIndex = data.targetIndex;
        
        const meta = document.getElementById('wheel-trigger-meta');
        meta.innerText = `${data.spinner} triggered the wheel spin!`;
        
        const banner = document.getElementById('wheel-result-banner');
        banner.innerText = "Spinning... Synchronizing floor...";
        banner.style.color = "var(--text-secondary)";
        
        rotateWheel();
    });
}

let lastTickAngle = 0;
function rotateWheel() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
        stopRotateWheel();
        return;
    }
    
    const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
    startAngle += (spinAngle * Math.PI / 180);
    drawWheel();
    
    const arc = Math.PI / (state.participants.length / 2);
    const normalizedAngle = (startAngle % (Math.PI * 2));
    const currentSegmentIndex = Math.floor((Math.PI * 2 - normalizedAngle) / arc) % state.participants.length;
    
    if (currentSegmentIndex !== lastTickAngle) {
        playSoundEffect('tick');
        lastTickAngle = currentSegmentIndex;
    }
    
    requestAnimationFrame(rotateWheel);
}

function stopRotateWheel() {
    isSpinning = false;
    
    // Instead of local random, we align with the server targetIndex
    const winner = state.participants[targetIndex];
    
    const banner = document.getElementById('wheel-result-banner');
    banner.innerHTML = `🎉 <strong>${escapeHTML(winner)}</strong> gets to sponsor today's party!`;
    banner.style.color = "var(--accent-gold)";
    
    playSoundEffect('tada');
    triggerConfetti();
}

function easeOut(t, b, c, d) {
    const ts = (t /= d) * t;
    const tc = ts * t;
    return b + c * (tc + -3 * ts + 3 * t);
}

// Confetti System
let confettiActive = false;
let confettiParticles = [];
function triggerConfetti() {
    if (confettiActive) return;
    confettiActive = true;
    
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '999';
    document.body.appendChild(canvas);
    
    const cCtx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    confettiParticles = [];
    const colors = ['#ffd54f', '#ff8a80', '#81c784', '#4fc3f7', '#ba68c8', '#10b981'];
    
    for (let i = 0; i < 120; i++) {
        confettiParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            r: Math.random() * 6 + 4,
            d: Math.random() * canvas.height,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10 - 5,
            tiltAngleIncremental: Math.random() * 0.07 + 0.02,
            tiltAngle: 0
        });
    }
    
    let frames = 0;
    function drawConfetti() {
        cCtx.clearRect(0, 0, canvas.width, canvas.height);
        confettiParticles.forEach((p, idx) => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
            p.x += Math.sin(p.tiltAngle);
            p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;
            
            cCtx.beginPath();
            cCtx.lineWidth = p.r;
            cCtx.strokeStyle = p.color;
            cCtx.moveTo(p.x + p.tilt + p.r / 2, p.y);
            cCtx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
            cCtx.stroke();
        });
        
        frames++;
        const active = confettiParticles.some(p => p.y < canvas.height);
        if (active && frames < 200) {
            requestAnimationFrame(drawConfetti);
        } else {
            document.body.removeChild(canvas);
            confettiActive = false;
        }
    }
    drawConfetti();
}

// 5. Poll System Module
function renderPolls() {
    const container = document.getElementById('polls-container');
    if (!container) return;
    
    container.innerHTML = '';
    if (state.polls.length === 0) {
        container.innerHTML = `<p class="section-subtitle">No active polls. Click New Poll to create one.</p>`;
        return;
    }
    
    state.polls.forEach(poll => {
        const voted = poll.votedUsers.includes(userUsername);
        const card = document.createElement('div');
        card.className = 'poll-card';
        
        let optionsHtml = '';
        poll.options.forEach((opt, idx) => {
            const percentage = poll.votersCount > 0 ? Math.round((opt.votes / poll.votersCount) * 100) : 0;
            optionsHtml += `
                <div class="poll-option-row" onclick="votePoll(${poll.id}, ${idx})">
                    <div class="poll-option-bg" style="width: ${voted ? percentage : 0}%"></div>
                    <span class="poll-option-text">${escapeHTML(opt.text)}</span>
                    <span class="poll-option-percentage">${voted ? `${percentage}% (${opt.votes})` : ''}</span>
                </div>
            `;
        });
        
        card.innerHTML = `
            <div class="poll-question">${escapeHTML(poll.question)}</div>
            <div class="poll-options">
                ${optionsHtml}
            </div>
            <div class="poll-meta">
                <span>Total Anonymous Votes: ${poll.votersCount}</span>
                ${userIsAdmin ? `<button class="delete-poll-btn" onclick="deletePoll(${poll.id})"><i data-lucide="trash-2"></i></button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
    lucide.createIcons();
}

window.votePoll = function(pollId, optionIndex) {
    socket.emit('vote_poll', { pollId, optionIndex });
};

window.deletePoll = function(pollId) {
    if (confirm("Delete this poll?")) {
        socket.emit('delete_poll', pollId);
    }
};

// 6. Countdown Timers Module
function renderCountdowns() {
    const container = document.getElementById('countdown-container');
    if (!container) return;
    
    container.innerHTML = '';
    if (state.countdowns.length === 0) {
        container.innerHTML = `<p class="section-subtitle" style="grid-column: 1/-1; text-align:center;">No countdown timers configured.</p>`;
        return;
    }
    
    state.countdowns.forEach(c => {
        const box = document.createElement('div');
        box.className = 'countdown-box';
        box.id = `countdown-box-${c.id}`;
        box.innerHTML = `
            ${userIsAdmin ? `<button class="delete-countdown-btn" onclick="deleteCountdown(${c.id})"><i data-lucide="x"></i></button>` : ''}
            <div class="countdown-emoji">${c.emoji}</div>
            <div class="countdown-title">${escapeHTML(c.name)}</div>
            <div class="countdown-time-container" id="time-vals-${c.id}">
                <div class="countdown-item"><div class="countdown-number">00</div><div class="countdown-label">Days</div></div>
                <div class="countdown-item"><div class="countdown-number">00</div><div class="countdown-label">Hrs</div></div>
                <div class="countdown-item"><div class="countdown-number">00</div><div class="countdown-label">Min</div></div>
            </div>
        `;
        container.appendChild(box);
    });
    updateAllCountdowns();
    lucide.createIcons();
}

function updateAllCountdowns() {
    state.countdowns.forEach(c => {
        const elem = document.getElementById(`time-vals-${c.id}`);
        if (!elem) return;
        
        const diff = new Date(c.target).getTime() - new Date().getTime();
        if (diff <= 0) {
            elem.innerHTML = `<div style="color:var(--primary); font-weight:bold; font-size: 0.9rem;">🎉 Time Reached!</div>`;
            return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        
        elem.innerHTML = `
            <div class="countdown-item"><div class="countdown-number">${padZero(days)}</div><div class="countdown-label">D</div></div>
            <div class="countdown-item"><div class="countdown-number">${padZero(hours)}</div><div class="countdown-label">H</div></div>
            <div class="countdown-item"><div class="countdown-number">${padZero(mins)}</div><div class="countdown-label">M</div></div>
            <div class="countdown-item"><div class="countdown-number">${padZero(secs)}</div><div class="countdown-label">S</div></div>
        `;
    });
}

function padZero(num) {
    return num < 10 ? `0${num}` : num;
}

window.deleteCountdown = function(id) {
    if (confirm("Delete this countdown event?")) {
        socket.emit('delete_countdown', id);
    }
};

// 7. Wall of Fame Module
let activeLeaderboardCategory = 'late';
function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    
    list.innerHTML = '';
    const categoryData = state.leaderboard[activeLeaderboardCategory] || [];
    
    const sorted = [...categoryData].sort((a, b) => b.score - a.score);
    if (sorted.length === 0) {
        list.innerHTML = `<p class="section-subtitle" style="text-align:center; padding-top:20px;">No nominations yet. Be the first to nominate someone!</p>`;
        return;
    }
    
    sorted.forEach((row, index) => {
        const rank = index + 1;
        const card = document.createElement('div');
        card.className = 'leaderboard-row';
        card.innerHTML = `
            <div class="leaderboard-left">
                <span class="leaderboard-rank">${rank}</span>
                <span class="leaderboard-name">${escapeHTML(row.name)}</span>
            </div>
            <div class="leaderboard-right">
                <span class="leaderboard-score">${row.score} Votes</span>
                <button class="upvote-badge" onclick="upvoteNominee('${escapeHTML(row.name)}')"><i data-lucide="arrow-up-circle"></i> Vote</button>
            </div>
        `;
        list.appendChild(card);
    });
    lucide.createIcons();
}

window.upvoteNominee = function(name) {
    socket.emit('vote_leaderboard', { category: activeLeaderboardCategory, name });
    playSoundEffect('bell');
};

// Toggle categories
const categoryBtns = document.querySelectorAll('.leaderboard-tab-btn');
categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLeaderboardCategory = btn.dataset.category;
        renderLeaderboard();
    });
});

// Profile Cards Grid Module
function renderProfiles() {
    const grid = document.getElementById('profiles-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    state.profiles.forEach(p => {
        const card = document.createElement('div');
        card.className = 'profile-card';
        const isSelf = p.username === userUsername;
        const editBtnHtml = isSelf ? `<button class="delete-profile-btn" onclick="openEditProfile()" style="display:block; opacity:1;"><i data-lucide="edit-3" style="color:var(--primary);"></i></button>` : '';

        card.innerHTML = `
            ${editBtnHtml}
            <div class="profile-avatar">${p.avatar}</div>
            <div class="profile-name">${escapeHTML(p.name)}</div>
            <div class="profile-role">${escapeHTML(p.role)}</div>
            <div class="profile-id" style="font-size: 0.75rem; color: var(--text-muted); margin-top: -8px; margin-bottom: 12px; font-weight: 600; text-transform: uppercase;">ID: ${escapeHTML(p.employeeId || 'N/A')}</div>
            <div class="profile-details">
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Superpower</span>
                    <span class="profile-detail-val">${escapeHTML(p.superpower)}</span>
                </div>
                <div class="profile-detail-item" style="margin-top: 6px;">
                    <span class="profile-detail-label">Weakness</span>
                    <span class="profile-detail-val">${escapeHTML(p.weakness)}</span>
                </div>
            </div>
            <div class="profile-karma">
                <span class="profile-detail-label">Karma Points:</span>
                <span class="karma-points">${p.karma}</span>
                <button class="karma-plus-btn" onclick="addKarma(${p.id})"><i data-lucide="plus-circle"></i></button>
            </div>
        `;
        grid.appendChild(card);
    });
    lucide.createIcons();
}

window.addKarma = function(id) {
    socket.emit('add_karma', id);
    playSoundEffect('bell');
};

window.openEditProfile = function() {
    const myProfile = state.profiles.find(p => p.username === userUsername);
    if (!myProfile) return;
    
    document.getElementById('edit-profile-name').value = myProfile.name || '';
    document.getElementById('edit-profile-role').value = myProfile.role || '';
    document.getElementById('edit-profile-superpower').value = myProfile.superpower || '';
    document.getElementById('edit-profile-weakness').value = myProfile.weakness || '';
    
    const avatar = myProfile.avatar || '💻';
    const radio = document.querySelector(`input[name="edit-avatar"][value="${avatar}"]`);
    if (radio) {
        radio.checked = true;
    }
    
    document.getElementById('edit-profile-modal').classList.add('active');
};

// 8. Anonymous Tea Box Module
function checkTeaBoxLock() {
    const lockOverlay = document.getElementById('tea-lock-overlay');
    const unlockedContent = document.getElementById('tea-unlocked-content');
    
    if (state.teaUnlocked) {
        lockOverlay.style.display = 'none';
        unlockedContent.style.display = 'block';
    } else {
        lockOverlay.style.display = 'flex';
        unlockedContent.style.display = 'none';
    }
}

let currentConfessionFilter = 'all';
function renderConfessions() {
    checkTeaBoxLock();
    
    const board = document.getElementById('confessions-board');
    if (!board) return;
    
    board.innerHTML = '';
    const filtered = state.confessions.filter(c => {
        if (currentConfessionFilter === 'all') return true;
        return c.type === currentConfessionFilter;
    });
    
    if (filtered.length === 0) {
        board.innerHTML = `<p class="section-subtitle" style="grid-column: 1/-1; text-align:center; padding-top:40px;">No confessions in this category yet. Be the first to spill the tea!</p>`;
        return;
    }
    
    const colors = ["#ffd54f", "#ff8a80", "#81c784", "#4fc3f7", "#ba68c8"];
    const tags = {
        gossip: "🤫 Gossip",
        rant: "😡 Rant",
        chai: "☕ Chai",
        funny: "😂 Observation"
    };
    
    filtered.forEach((c, idx) => {
        const card = document.createElement('div');
        card.className = 'confession-sticky';
        
        const noteBg = colors[idx % colors.length];
        card.style.backgroundColor = noteBg;
        
        const reacted = c.likedBy.includes(userUsername);
        
        card.innerHTML = `
            <span class="confession-tag">${tags[c.type]}</span>
            <div class="confession-text">${escapeHTML(c.text)}</div>
            <div class="confession-footer">
                <button class="confession-react" onclick="reactConfession(${c.id})">
                    <i data-lucide="heart" style="${reacted ? 'fill:var(--accent-red); color:var(--accent-red);' : ''}"></i> 
                    <span>${c.votes} Likes</span>
                </button>
                <span>${c.date}</span>
            </div>
        `;
        board.appendChild(card);
    });
    lucide.createIcons();
}

window.reactConfession = function(id) {
    socket.emit('like_confession', id);
    playSoundEffect('bell');
};

const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentConfessionFilter = btn.dataset.filter;
        renderConfessions();
    });
});

// --- MODAL DIALOG POPUPS SETUP ---

function setupModals() {
    const modalHooks = [
        { btnId: 'add-quote-btn', modalId: 'add-quote-modal' },
        { btnId: 'add-catchphrase-btn', modalId: 'add-catchphrase-modal' },
        { btnId: 'create-poll-btn', modalId: 'create-poll-modal' },
        { btnId: 'add-countdown-btn', modalId: 'add-countdown-modal' },
        { btnId: 'add-confession-btn', modalId: 'add-confession-modal' },
        { btnId: null, modalId: 'edit-profile-modal' }
    ];
    
    modalHooks.forEach(hook => {
        const btn = hook.btnId ? document.getElementById(hook.btnId) : null;
        const modal = document.getElementById(hook.modalId);
        if (modal) {
            if (btn) {
                btn.addEventListener('click', () => {
                    modal.classList.add('active');
                });
            }
            const closeBtn = modal.querySelector('.modal-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.classList.remove('active');
                });
            }
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }
    });
}

// --- FORM SUBMIT HANDLERS (EMIT TO SERVER) ---

function setupEventHandlers() {
    // 1. Nominate Quote
    const quoteForm = document.getElementById('quote-form');
    if (quoteForm) {
        quoteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = document.getElementById('quote-text').value;
            const speaker = document.getElementById('quote-speaker').value;
            const context = document.getElementById('quote-context').value;
            
            socket.emit('new_quote', { text, speaker, context });
            
            document.getElementById('add-quote-modal').classList.remove('active');
            playSoundEffect('tada');
            quoteForm.reset();
        });
    }
    
    // 2. Add Catchphrase
    const catchphraseForm = document.getElementById('catchphrase-form');
    if (catchphraseForm) {
        catchphraseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const phrase = document.getElementById('catch-phrase').value;
            const speaker = document.getElementById('catch-speaker').value;
            const pitch = document.getElementById('catch-pitch').value;
            const speed = document.getElementById('catch-speed').value;
            const effect = document.getElementById('catch-effect').value;
            
            socket.emit('new_catchphrase', { phrase, speaker, pitch, speed, effect });
            
            document.getElementById('add-catchphrase-modal').classList.remove('active');
            playSoundEffect('bell');
            catchphraseForm.reset();
        });
    }
    
    // 3. Meme File Upload
    const uploadInput = document.getElementById('meme-upload');
    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(evt) {
                socket.emit('upload_meme', evt.target.result);
                playSoundEffect('tada');
            };
            reader.readAsDataURL(file);
        });
    }
    
    // 4. Spin Wheel Button
    const spinBtn = document.getElementById('spin-btn');
    if (spinBtn) {
        spinBtn.addEventListener('click', () => {
            if (isSpinning) return;
            socket.emit('spin_wheel_trigger');
        });
    }
    
    // 5. Create Poll Form
    const addPollOptionBtn = document.getElementById('add-poll-option-input-btn');
    const optionsContainer = document.getElementById('poll-options-inputs');
    if (addPollOptionBtn && optionsContainer) {
        addPollOptionBtn.addEventListener('click', () => {
            const count = optionsContainer.querySelectorAll('.poll-option-input').length;
            if (count >= 6) {
                alert("Maximum 6 options allowed!");
                return;
            }
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'poll-option-input';
            input.placeholder = `Option ${count + 1}`;
            input.required = true;
            optionsContainer.appendChild(input);
        });
    }
    
    const pollForm = document.getElementById('poll-form');
    if (pollForm) {
        pollForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const question = document.getElementById('poll-question').value;
            const inputElements = optionsContainer.querySelectorAll('.poll-option-input');
            const options = [];
            inputElements.forEach(inp => {
                const text = inp.value.trim();
                if (text) options.push(text);
            });
            
            socket.emit('new_poll', { question, options });
            
            document.getElementById('create-poll-modal').classList.remove('active');
            playSoundEffect('tada');
            pollForm.reset();
            
            optionsContainer.innerHTML = `
                <label>Options</label>
                <input type="text" class="poll-option-input" placeholder="Option 1" required>
                <input type="text" class="poll-option-input" placeholder="Option 2" required>
            `;
        });
    }
    
    // 6. Add Countdown Form
    const countdownForm = document.getElementById('countdown-form');
    if (countdownForm) {
        countdownForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('event-name').value;
            const targetDateStr = document.getElementById('event-date').value;
            const emoji = document.getElementById('event-emoji').value;
            
            socket.emit('new_countdown', {
                name,
                target: new Date(targetDateStr).toISOString(),
                emoji
            });
            
            document.getElementById('add-countdown-modal').classList.remove('active');
            playSoundEffect('bell');
            countdownForm.reset();
        });
    }
    
    // 7. Leaderboard Nomination Form
    const nominateForm = document.getElementById('nominate-form');
    if (nominateForm) {
        nominateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const select = document.getElementById('nominate-select');
            const name = select.value;
            if (name) {
                socket.emit('vote_leaderboard', { category: activeLeaderboardCategory, name });
                select.selectedIndex = 0;
            }
        });
    }
    
    // 8. Confession Form
    const confessionForm = document.getElementById('confession-form');
    if (confessionForm) {
        confessionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const type = document.getElementById('confession-type').value;
            const text = document.getElementById('confession-text').value;
            
            socket.emit('new_confession', { type, text });
            
            document.getElementById('add-confession-modal').classList.remove('active');
            playSoundEffect('tada');
            confessionForm.reset();
        });
    }
    
    // 9. Confession Password Lock check
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const pwdInput = document.getElementById('tea-password');
            const errorMsg = document.getElementById('password-error');
            
            if (pwdInput.value.toLowerCase() === 'chai') {
                state.teaUnlocked = true;
                errorMsg.style.display = 'none';
                playSoundEffect('tada');
                renderConfessions();
            } else {
                errorMsg.style.display = 'block';
                playSoundEffect('fail');
                pwdInput.value = '';
                pwdInput.focus();
            }
        });
    }
    
    // 10. Lock Confessions Button
    const lockBtn = document.getElementById('lock-tea-box-btn');
    if (lockBtn) {
        lockBtn.addEventListener('click', () => {
            state.teaUnlocked = false;
            document.getElementById('tea-password').value = '';
            playSoundEffect('fail');
            checkTeaBoxLock();
        });
    }
    
    // 11. Edit Profile Form
    const editProfileForm = document.getElementById('edit-profile-form');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('edit-profile-name').value;
            const role = document.getElementById('edit-profile-role').value;
            const superpower = document.getElementById('edit-profile-superpower').value;
            const weakness = document.getElementById('edit-profile-weakness').value;
            
            const avatarRadio = document.querySelector('input[name="edit-avatar"]:checked');
            const avatar = avatarRadio ? avatarRadio.value : '💻';
            
            socket.emit('update_profile', { name, role, superpower, weakness, avatar });
            
            sessionStorage.setItem('name', name);
            sessionStorage.setItem('role', role);
            sessionStorage.setItem('avatar', avatar);
            
            const userAvatarEl = document.getElementById('user-avatar');
            const userFullnameEl = document.getElementById('user-fullname');
            const userRoleEl = document.getElementById('user-role');
            if (userAvatarEl) userAvatarEl.innerText = avatar;
            if (userFullnameEl) userFullnameEl.innerText = name;
            if (userRoleEl) userRoleEl.innerText = role;
            
            document.getElementById('edit-profile-modal').classList.remove('active');
            playSoundEffect('tada');
        });
    }
    
    // Gradient card mouse spotlights
    document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// Utility HTML escape function
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
