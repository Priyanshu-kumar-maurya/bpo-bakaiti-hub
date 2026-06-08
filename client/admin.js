// Admin control operations
const token = sessionStorage.getItem('token');

// Establish socket connection to receive live counts and tables
const socket = typeof io !== 'undefined' ? io({
    auth: { token }
}) : null;

// Cache elements
const agentsVal = document.getElementById('stat-agents');
const confessionsVal = document.getElementById('stat-confessions');
const socketsVal = document.getElementById('stat-sockets');

const confessionsTable = document.getElementById('confessions-table-body');
const quotesTable = document.getElementById('quotes-table-body');
const memesTable = document.getElementById('memes-table-body');

// On connection or state updates
if (socket) {
    socket.on('init_state', (data) => {
        renderConfessions(data.confessions);
        renderQuotes(data.quotes);
        renderMemes(data.memes);
        fetchStats();
    });

    socket.on('update_confessions', (confessions) => {
        renderConfessions(confessions);
        fetchStats();
    });

    socket.on('update_quotes', (quotes) => {
        renderQuotes(quotes);
    });

    socket.on('update_memes', (memes) => {
        renderMemes(memes);
    });
}

// Fetch BPO stats from API
async function fetchStats() {
    try {
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            agentsVal.innerText = data.usersCount;
            confessionsVal.innerText = data.confessionsCount;
            socketsVal.innerText = data.activeConnections;
        }
    } catch (e) {
        console.error("Failed to fetch admin statistics", e);
    }
}

// Render confessions table
function renderConfessions(confessions) {
    confessionsTable.innerHTML = '';
    
    if (confessions.length === 0) {
        confessionsTable.innerHTML = `<tr><td colspan="4" style="text-align:center;">No confessions logged on the floor.</td></tr>`;
        return;
    }
    
    const tags = {
        gossip: "🤫 Gossip",
        rant: "😡 Rant",
        chai: "☕ Chai",
        funny: "😂 Observation"
    };

    confessions.forEach(c => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${tags[c.type] || c.type}</strong></td>
            <td>${escapeHTML(c.text)}</td>
            <td>${c.votes} Likes</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteConfession(${c.id})">
                    <i data-lucide="trash-2"></i> Delete
                </button>
            </td>
        `;
        confessionsTable.appendChild(row);
    });
    lucide.createIcons();
}

// Render quotes table
function renderQuotes(quotes) {
    quotesTable.innerHTML = '';
    
    if (quotes.length === 0) {
        quotesTable.innerHTML = `<tr><td colspan="4" style="text-align:center;">No nominated quotes.</td></tr>`;
        return;
    }

    quotes.forEach(q => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>"${escapeHTML(q.text)}"</td>
            <td><strong>${escapeHTML(q.speaker)}</strong></td>
            <td>${q.context ? escapeHTML(q.context) : 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteQuote(${q.id})">
                    <i data-lucide="trash-2"></i> Delete
                </button>
            </td>
        `;
        quotesTable.appendChild(row);
    });
    lucide.createIcons();
}

// Render memes table
function renderMemes(memes) {
    memesTable.innerHTML = '';
    
    if (memes.length === 0) {
        memesTable.innerHTML = `<tr><td colspan="3" style="text-align:center;">No uploaded memes.</td></tr>`;
        return;
    }

    memes.forEach((meme, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>Meme #${index + 1}</td>
            <td><img src="${meme}" class="meme-preview-img" alt="Floor Meme"></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteMeme(${index})">
                    <i data-lucide="trash-2"></i> Delete
                </button>
            </td>
        `;
        memesTable.appendChild(row);
    });
    lucide.createIcons();
}

// API delete handlers
window.deleteConfession = async function(id) {
    if (confirm("Are you sure you want to delete this confession?")) {
        const res = await fetch(`/api/admin/confession/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) fetchStats();
    }
};

window.deleteQuote = async function(id) {
    if (confirm("Are you sure you want to delete this quote?")) {
        await fetch(`/api/admin/quote/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }
};

window.deleteMeme = async function(index) {
    if (confirm("Are you sure you want to delete this meme?")) {
        await fetch(`/api/admin/meme/${index}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }
};

function escapeHTML(str) {
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
