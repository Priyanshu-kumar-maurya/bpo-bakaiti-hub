const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

// Default initial BPO mock data
const initialData = {
    users: [], // Filled when agents register
    quotes: [],
    catchphrases: [],
    memes: [], // Empty initially, loaded by agents
    polls: [],
    countdowns: [],
    leaderboard: {
        late: [],
        sleeper: [],
        chai: [],
        excel: []
    },
    confessions: []
};

function getNextFriday7AM() {
    const date = new Date();
    const resultDate = new Date(date.getTime());
    resultDate.setDate(date.getDate() + (7 + 5 - date.getDay()) % 7);
    resultDate.setHours(7, 0, 0, 0);
    if (resultDate.getTime() <= date.getTime()) {
        resultDate.setDate(resultDate.getDate() + 7);
    }
    return resultDate;
}

// Ensure the db file exists
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
}

// Database wrapper functions
const db = {
    read() {
        try {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error("Error reading database file, resetting to initialData", e);
            this.write(initialData);
            return initialData;
        }
    },
    
    write(data) {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    },

    get(table) {
        const data = this.read();
        return data[table] || [];
    },

    set(table, records) {
        const data = this.read();
        data[table] = records;
        this.write(data);
    },

    // Users
    findUserByUsername(username) {
        const users = this.get('users');
        return users.find(u => u.username.toLowerCase() === username.toLowerCase());
    },

    findUserById(id) {
        const users = this.get('users');
        return users.find(u => u.id === id);
    },

    addUser(user) {
        const users = this.get('users');
        user.id = Date.now();
        user.karma = 0;
        // Make first user an admin
        user.isAdmin = (users.length === 0);
        users.push(user);
        this.set('users', users);
        return user;
    },

    updateUserKarma(id, amount) {
        const users = this.get('users');
        const user = users.find(u => u.id === id);
        if (user) {
            user.karma += amount;
            this.set('users', users);
            return user.karma;
        }
        return 0;
    },

    // Quotes
    addQuote(text, speaker, context) {
        const quotes = this.get('quotes');
        const newQuote = { id: Date.now(), text, speaker, context };
        quotes.push(newQuote);
        this.set('quotes', quotes);
        return newQuote;
    },

    deleteQuote(id) {
        let quotes = this.get('quotes');
        quotes = quotes.filter(q => q.id !== parseInt(id));
        this.set('quotes', quotes);
    },

    // Memes
    addMeme(base64Data) {
        const memes = this.get('memes');
        // Add to the front
        memes.unshift(base64Data);
        this.set('memes', memes);
        return memes;
    },

    deleteMeme(index) {
        const memes = this.get('memes');
        memes.splice(index, 1);
        this.set('memes', memes);
        return memes;
    },

    // Catchphrases
    addCatchphrase(phrase, speaker, pitch, speed, effect) {
        const catchphrases = this.get('catchphrases');
        const newC = { id: Date.now(), phrase, speaker, pitch: parseFloat(pitch), speed: parseFloat(speed), effect };
        catchphrases.push(newC);
        this.set('catchphrases', catchphrases);
        return newC;
    },

    // Polls
    addPoll(question, options) {
        const polls = this.get('polls');
        const newPoll = {
            id: Date.now(),
            question,
            options: options.map(opt => ({ text: opt, votes: 0 })),
            votersCount: 0,
            votedUsers: []
        };
        polls.unshift(newPoll);
        this.set('polls', polls);
        return newPoll;
    },

    votePoll(pollId, optionIndex, username) {
        const polls = this.get('polls');
        const poll = polls.find(p => p.id === parseInt(pollId));
        if (poll) {
            if (poll.votedUsers.includes(username)) {
                return { success: false, message: "Already voted" };
            }
            poll.options[optionIndex].votes += 1;
            poll.votersCount += 1;
            poll.votedUsers.push(username);
            this.set('polls', polls);
            return { success: true, poll };
        }
        return { success: false, message: "Poll not found" };
    },

    deletePoll(pollId) {
        let polls = this.get('polls');
        polls = polls.filter(p => p.id !== parseInt(pollId));
        this.set('polls', polls);
    },

    // Countdowns
    addCountdown(name, target, emoji) {
        const countdowns = this.get('countdowns');
        const newC = { id: Date.now(), name, target, emoji };
        countdowns.push(newC);
        this.set('countdowns', countdowns);
        return newC;
    },

    deleteCountdown(id) {
        let countdowns = this.get('countdowns');
        countdowns = countdowns.filter(c => c.id !== parseInt(id));
        this.set('countdowns', countdowns);
    },

    // Leaderboard
    voteLeaderboard(category, name) {
        const data = this.read();
        if (!data.leaderboard[category]) {
            data.leaderboard[category] = [];
        }
        const nominee = data.leaderboard[category].find(n => n.name.toLowerCase() === name.toLowerCase());
        if (nominee) {
            nominee.score += 1;
        } else {
            data.leaderboard[category].push({ name, score: 1 });
        }
        this.write(data);
        return data.leaderboard[category];
    },

    // Confessions
    addConfession(type, text) {
        const confessions = this.get('confessions');
        const newConf = {
            id: Date.now(),
            type,
            text,
            votes: 0,
            date: "Just now",
            likedBy: []
        };
        confessions.unshift(newConf);
        this.set('confessions', confessions);
        return newConf;
    },

    likeConfession(id, username) {
        const confessions = this.get('confessions');
        const conf = confessions.find(c => c.id === parseInt(id));
        if (conf) {
            if (conf.likedBy.includes(username)) {
                return { success: false, message: "Already liked" };
            }
            conf.votes += 1;
            conf.likedBy.push(username);
            this.set('confessions', confessions);
            return { success: true, confession: conf };
        }
        return { success: false, message: "Confession not found" };
    },

    deleteConfession(id) {
        let confessions = this.get('confessions');
        confessions = confessions.filter(c => c.id !== parseInt(id));
        this.set('confessions', confessions);
    },

    updateUserProfile(username, data) {
        const users = this.get('users');
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (user) {
            user.name = data.name || user.name;
            user.role = data.role || user.role;
            user.superpower = data.superpower || user.superpower;
            user.weakness = data.weakness || user.weakness;
            user.avatar = data.avatar || user.avatar;
            this.set('users', users);
            return user;
        }
        return null;
    }
};

module.exports = db;
