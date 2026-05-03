const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 80;
const DB_FILE = path.join(__dirname, 'database.json');

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ identities: {}, audit_log: [] }));
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

    // API: CLAIM IDENTITY (Updated with TTL defaults)
    if (parsedUrl.pathname === '/api/claim' && req.method === 'POST') {
        let body = ''; req.on('data', c => body += c);
        req.on('end', () => {
            const { subdomain: n, extension: e, ownerId: uid } = JSON.parse(body);
            const k = `${n}.${e}`;
            const r = new Date(); const x = new Date(); x.setFullYear(r.getFullYear() + 1);
            
            db.identities[k] = {
                name: n, extension: e, ownerId: uid,
                regDate: r.toISOString(),
                expDate: x.toISOString(),
                lastAudit: r.toISOString(),
                records: [
                    { type: 'A', name: '@', value: '127.0.0.1', ttl: 3600 },
                    { type: 'NS', name: '@', value: 'ns1.esocialz.com', ttl: 86400 }
                ]
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
            res.writeHead(200); res.end(JSON.stringify({ identity: db.identities[k] }));
        });
        return;
    }

    // API: LIST ALL IDENTITIES
    if (parsedUrl.pathname === '/api/list' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(db.identities));
        return;
    }

    // API: PRO DNS UPDATE (With Audit Logging)
    if (parsedUrl.pathname === '/api/dns-update' && req.method === 'POST') {
        let body = ''; req.on('data', c => body += c);
        req.on('end', () => {
            const { domain, records } = JSON.parse(body);
            if (db.identities[domain]) {
                db.identities[domain].records = records;
                db.identities[domain].lastAudit = new Date().toISOString();
                
                // Log the change
                db.audit_log.push({
                    domain, timestamp: new Date().toISOString(),
                    action: "DNS_RECORDS_UPDATED"
                });

                fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
                res.writeHead(200); res.end(JSON.stringify({ message: 'Success' }));
            }
        });
        return;
    }

    // API: FLUSH DNS SIMULATION
    if (parsedUrl.pathname === '/api/flush' && req.method === 'POST') {
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'Local DNS Cache Flushed' }));
        return;
    }

    // Serve Dashboard
    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }
    res.writeHead(404); res.end();
});

server.listen(PORT, () => console.log(`🚀 Master DNS Architecture v3.0 Active`));
