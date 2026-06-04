const mqtt = require('mqtt');
const mysql = require('mysql2');

// 1. Connect to Aiven Cloud Database
const db = mysql.createConnection({
    host: 'kpa-database-dnahaziq077-fa96.l.aivencloud.com', 
    port: 24023,
    user: 'avnadmin',
    password: 'AVNS_wd3aO-6gdoGbiD74Ubw', 
    database: 'defaultdb',
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
    if (err) throw err;
    console.log('✅ Connected to AIVEN Cloud MySQL Database (defaultdb)');
});

// 2. Connect to TinkerCode MQTT Broker
const brokerUrl = 'wss://tinkercode.my:8001';
const client = mqtt.connect(brokerUrl, {
    clientId: 'kpa_server_' + Math.random().toString(16).substr(2, 8)
});

// Define our communication channels
const TOPIC_SUBMIT = 'utm/kpa/submit';
const TOPIC_REQ = 'utm/kpa/admin/request';
const TOPIC_RES = 'utm/kpa/admin/response';
const TOPIC_DEL = 'utm/kpa/admin/delete';
const TOPIC_UPDATE = 'utm/kpa/admin/update_score';

client.on('connect', () => {
    console.log('📡 Connected to TinkerCode MQTT Broker');
    client.subscribe([TOPIC_SUBMIT, TOPIC_REQ, TOPIC_DEL, TOPIC_UPDATE], (err) => {
        if (!err) console.log('👂 Server is actively listening for frontend commands...');
    });
});

// Function to fetch DB data and broadcast it to the Admin Dashboard
function broadcastLeaderboard() {
    db.execute('SELECT * FROM submissions ORDER BY total_score DESC', (err, results) => {
        if (err) return console.error('❌ DB Read Error:', err);
        
        const payloadList = results.map(row => {
            let fullData = JSON.parse(row.programs_json);
            fullData.id = row.id; // Use official Database ID
            fullData.totalScore = row.total_score; // Use official Database Score
            return fullData;
        });
        
        client.publish(TOPIC_RES, JSON.stringify(payloadList));
        console.log('📤 Leaderboard updated and broadcasted to Admin Dashboard.');
    });
}

// 3. Process Incoming Commands
client.on('message', (topic, message) => {
    try {
        if (topic === TOPIC_SUBMIT) {
            const payload = JSON.parse(message.toString());
            console.log(`\n📥 New submission from: ${payload.student_email}`);

            // Save the ENTIRE payload (including name, matric, phone, images) as JSON
            const fullJsonString = JSON.stringify(payload);
            const query = `INSERT INTO submissions (student_email, total_score, programs_json) VALUES (?, ?, ?)`;
            
            db.execute(query, [payload.student_email, payload.totalScore, fullJsonString], (err) => {
                if (!err) broadcastLeaderboard(); // Instantly update the admin!
            });
        }
        
        else if (topic === TOPIC_REQ) {
            // Admin just logged in and requested data
            broadcastLeaderboard();
        }
        
        else if (topic === TOPIC_DEL) {
            // Admin clicked Delete
            const dbId = message.toString();
            db.execute('DELETE FROM submissions WHERE id = ?', [dbId], (err) => {
                if (!err) {
                    console.log(`🗑️ Deleted submission ID: ${dbId}`);
                    broadcastLeaderboard();
                }
            });
        }
        
        else if (topic === TOPIC_UPDATE) {
            // Admin altered the score
            const data = JSON.parse(message.toString());
            db.execute('UPDATE submissions SET total_score = ? WHERE id = ?', [data.newScore, data.id], (err) => {
                if (!err) {
                    console.log(`✏️ Updated score for ID: ${data.id} to ${data.newScore}`);
                    broadcastLeaderboard();
                }
            });
        }

    } catch (error) {
        console.error('⚠️ Error processing message:', error.message);
    }
});

// Keep cloud hosting (Render) awake
const http = require('http');
http.createServer((req, res) => res.end('KPA Backend is running!')).listen(process.env.PORT || 3000);