const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();

// 1. SECURITY & LIMITS
app.use(cors()); // Allows your Vercel website to talk to this server
app.use(express.json({ limit: '50mb' })); // Allows giant image uploads without crashing!
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 2. CONNECT TO AIVEN DATABASE
const pool = mysql.createPool({
    host: 'kpa-database-dnahaziq077-fa96.l.aivencloud.com',
    user: 'avnadmin',
    password: process.env.DB_PASSWORD, // <--- HIDDEN PASSWORD!
    database: 'defaultdb',
    port: 24023,
    ssl: { rejectUnauthorized: false } 
});

pool.getConnection()
    .then(() => console.log('✅ Connected to Aiven MySQL Database!'))
    .catch(err => console.error('❌ DB Connection Error:', err));

// =======================================================================
// 3. THE API ROUTES (The Bridge)
// =======================================================================

// --- CLOUD AUTHENTICATION ---

// Register a new user
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if email already exists
        const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "Email already registered." });
        }

        // Save new user
        await pool.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, password]);
        res.status(200).json({ message: "Registration successful!" });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: "Failed to register account." });
    }
});

// Login an existing user
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        if (users.length > 0) {
            // Send back the user data (excluding the password for security)
            const user = { name: users[0].name, email: users[0].email };
            res.status(200).json({ message: "Login successful", user });
        } else {
            res.status(401).json({ error: "Invalid credentials." });
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Login failed due to server error." });
    }
});

// --- GLOBAL SYSTEM SETTINGS ---

// Get the live Merit Scores
app.get('/api/settings/merit', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT merit_scores FROM system_settings WHERE id = 1');
        if (rows.length > 0) {
            res.status(200).json(rows[0].merit_scores);
        } else {
            res.status(404).json({ error: "No settings found" });
        }
    } catch (err) {
        console.error("Fetch Settings Error:", err);
        res.status(500).json({ error: "Failed to fetch merit scores." });
    }
});

// Update the live Merit Scores (Admin Only)
app.post('/api/settings/merit', async (req, res) => {
    try {
        const scoresJson = JSON.stringify(req.body);
        
        // This command inserts row #1, but if row #1 already exists, it just updates it!
        await pool.execute(
            'INSERT INTO system_settings (id, merit_scores) VALUES (1, ?) ON DUPLICATE KEY UPDATE merit_scores = ?',
            [scoresJson, scoresJson]
        );
        res.status(200).json({ message: "Global Merit Scores Updated!" });
    } catch (err) {
        console.error("Save Settings Error:", err);
        res.status(500).json({ error: "Failed to update merit scores." });
    }
});

// --- APPLICATION SUBMISSIONS ---

// Receive a new student application
app.post('/api/submit', async (req, res) => {
    try {
        const { studentName, matric, phone, student_email, programs, totalScore } = req.body;
        const programsJson = JSON.stringify(programs);

        await pool.execute(
            'INSERT INTO submissions (studentName, matric, phone, student_email, programs, totalScore) VALUES (?, ?, ?, ?, ?, ?)',
            [studentName, matric, phone, student_email, programsJson, totalScore]
        );
        res.status(200).json({ message: "Success" });
    } catch (err) {
        console.error("Submit Error:", err);
        res.status(500).json({ error: "Failed to save submission" });
    }
});

// Send all data to the Admin Dashboard
app.get('/api/submissions', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM submissions ORDER BY totalScore DESC');
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

// Admin updates a score
app.post('/api/update', async (req, res) => {
    try {
        const { id, newScore } = req.body;
        await pool.execute('UPDATE submissions SET totalScore = ? WHERE id = ?', [newScore, id]);
        res.status(200).json({ message: "Score updated" });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

// Admin deletes a record
app.post('/api/delete', async (req, res) => {
    try {
        const { id } = req.body;
        await pool.execute('DELETE FROM submissions WHERE id = ?', [id]);
        res.status(200).json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// =======================================================================
// 4. START THE SERVER
// =======================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 HTTP Server is actively listening on port ${PORT}...`);
});