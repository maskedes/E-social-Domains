const express = require('express');
const { execSync } = require('child_process');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DOMAIN = 'esocialz.com';
const KEY_FILE = '/etc/bind/named.conf.keys';

// Endpoint to claim a subdomain
app.post('/api/claim', (req, res) => {
    const { subdomain, ip } = req.body;

    if (!subdomain || !ip) {
        return res.status(400).json({ error: 'Subdomain and IP are required' });
    }

    const commands = [
        `server 127.0.0.1`,
        `zone ${DOMAIN}`,
        `update add ${subdomain}.${DOMAIN}. 86400 A ${ip}`,
        `send`
    ].join('\n');

    try {
        console.log(`Processing claim for ${subdomain}.${DOMAIN}`);
        // Send to BIND container
        execSync(`echo "${commands}" | nsupdate -k ${KEY_FILE}`);
        res.json({ message: `Successfully claimed ${subdomain}.${DOMAIN}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update DNS', details: err.message });
    }
});

// Real-time Portal view
app.get('/api/profile', (req, res) => {
    const domain = req.query.domain || 'Unknown';
    res.send(`
        <html>
            <head>
                <style>
                    body { background: #0f172a; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); padding: 3rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); text-align: center; }
                    h1 { margin: 0; font-size: 2.5rem; background: linear-gradient(to right, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                    p { color: #94a3b8; margin-top: 1rem; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Welcome to ${domain}</h1>
                    <p>This is your real-time E-Socialz space.</p>
                </div>
            </body>
        </html>
    `);
});

app.listen(3000, () => {
    console.log('Portal API running on port 3000');
});
