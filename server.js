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
    host: 'kpa-database-dnahaziq077-fa96.l.aivencloud.com', // e.g., xxx.aivencloud.com
    user: 'avnadmin',        // usually 'avnadmin'
    password: 'AVNS_wd3aO-6gdoGbiD74Ubw',
    database: 'defaultdb',
    port: 24023,
    ssl: { rejectUnauthorized: true }
});

pool.getConnection()
    .then(() => console.log('✅ Connected to Aiven MySQL Database!'))
    .catch(err => console.error('❌ DB Connection Error:', err));

// 3. THE API ROUTES (The New Bridge)

// Receive a new student application
app.post('/api/submit', async (req, res) => {
    try {
        const { studentName, matric, phone, student_email, programs, totalScore } = req.body;
        const programsJson = JSON.stringify(programs); // Convert image data to text for the DB

        await pool.execute(
            'INSERT INTO submissions (studentName, matric, phone, student_email, programs, totalScore) VALUES (?, ?, ?, ?, ?, ?)',
            [studentName, matric, phone, student_email, programsJson, totalScore]
        );
        res.status(200).json({ message: "Success" });
    } catch (err) {
        console.error(err);
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

// 4. START THE SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 HTTP Server is actively listening on port ${PORT}...`);
});