const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite Database File
const db = new sqlite3.Database('./safepath.db', (err) => {
    if (err) {
        console.error('❌ Error connecting to SQLite database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database (safepath.db).');
    }
});

// Create Database Tables from Scratch
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        problem TEXT NOT NULL,
        customComment TEXT,
        details TEXT,
        timeSlot TEXT,
        status TEXT DEFAULT 'remaining',
        overrideColor TEXT,
        trueVotes INTEGER DEFAULT 0,
        falseVotes INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (!err) console.log("📁 'complaints' table verified/created.");
    });
});

// --- API ENDPOINTS ---

// 1. Health Check Route
app.get('/', (req, res) => {
    res.json({ message: "SafePath Backend API is running successfully!" });
});

// 2. Get All Safety Complaints
app.get('/api/complaints', (req, res) => {
    db.all(`SELECT * FROM complaints ORDER BY id DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, complaints: rows });
    });
});

// 3. Post a New Safety Complaint
app.post('/api/complaints', (req, res) => {
    const { lat, lng, problem, customComment, details, timeSlot, overrideColor } = req.body;

    if (!lat || !lng || !problem) {
        return res.status(400).json({ error: "Latitude, longitude, and problem description are required." });
    }

    const query = `INSERT INTO complaints (lat, lng, problem, customComment, details, timeSlot, overrideColor, trueVotes, falseVotes) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`;
    
    db.run(query, [lat, lng, problem, customComment || '', details || '', timeSlot || 'day', overrideColor || '#ef4444'], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ 
            success: true, 
            message: "Complaint successfully recorded", 
            id: this.lastID 
        });
    });
});

// 4. Community Verification Voting (True / False)
app.post('/api/complaints/:id/vote', (req, res) => {
    const { id } = req.params;
    const { voteType } = req.body; 

    if (voteType !== 'true' && voteType !== 'false') {
        return res.status(400).json({ error: "Invalid vote type. Must be 'true' or 'false'." });
    }

    const column = voteType === 'true' ? 'trueVotes' : 'falseVotes';

    db.run(`UPDATE complaints SET ${column} = ${column} + 1 WHERE id = ?`, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (voteType === 'false') {
            db.get(`SELECT falseVotes FROM complaints WHERE id = ?`, [id], (err, row) => {
                if (row && row.falseVotes > 50) {
                    db.run(`DELETE FROM complaints WHERE id = ?`, [id], () => {
                        return res.json({ success: true, message: "Report removed due to excessive false community flags." });
                    });
                } else {
                    res.json({ success: true, message: "False vote recorded." });
                }
            });
        } else {
            res.json({ success: true, message: "True vote recorded." });
        }
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 SafePath server running on http://localhost:${PORT}`);
});