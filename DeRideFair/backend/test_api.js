// Install dependencies before running:
// npm install axios csv-parser

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const csv = require('csv-parser');

const API_URL = "http://localhost:2000";
const USER_CSV = path.join(__dirname, "user_data1.csv");
const LOG_FILE = path.join(__dirname, "api_test_results.log");
const MAX_CONCURRENT = 10;

function log(msg) {
    fs.appendFileSync(LOG_FILE, msg + "\n");
}

async function registerUser(username, password) {
    try {
        const resp = await axios.post(`${API_URL}/register`, { username, password });
        log(`REGISTER ${username}: ${resp.status} ${JSON.stringify(resp.data)}`);
    } catch (err) {
        log(`REGISTER ${username}: ERROR ${err.response ? err.response.status : ''} ${err.response ? JSON.stringify(err.response.data) : err.message}`);
    }
}

async function processRow(row) {
    const username = row.ID;
    const password = "testpass123";
    await registerUser(username, password);
    await new Promise(r => setTimeout(r, 200));
}

async function main() {
    fs.writeFileSync(LOG_FILE, ""); // Clear log file
    const rows = [];
    fs.createReadStream(USER_CSV)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', async () => {
            let idx = 0;
            while (idx < rows.length) {
                const batch = [];
                for (let t = 0; t < MAX_CONCURRENT && idx < rows.length; ++t, ++idx) {
                    batch.push(processRow(rows[idx]));
                }
                await Promise.all(batch);
            }
            console.log("API test completed. See api_test_results.log for details.");
        });
}

main();
