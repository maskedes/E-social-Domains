const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Adds a new subdomain using nsupdate (RFC 2136)
 * This is the production-standard way to update DNS records.
 * @param {string} subdomain - The name of the subdomain
 * @param {string} ip - The target IP address
 */
function addSubdomain(subdomain, ip) {
    const KEY_FILE = '/etc/bind/named.conf.keys'; // Path inside container
    const DOMAIN = 'esocialz.com';

    // Construct the nsupdate commands
    const commands = [
        `server 127.0.0.1`,
        `zone ${DOMAIN}`,
        `update add ${subdomain}.${DOMAIN}. 86400 A ${ip}`,
        `show`,
        `send`
    ].join('\n');

    const tempFile = path.join(__dirname, 'nsupdate_cmd.txt');
    fs.writeFileSync(tempFile, commands);

    try {
        console.log(`Sending dynamic update for ${subdomain}.${DOMAIN}...`);
        
        // Execute nsupdate inside the running docker container
        // -k specifies the key file for TSIG authentication
        execSync(`docker exec -i bind9 nsupdate -k ${KEY_FILE} <<EOF\n${commands}\nEOF`);
        
        console.log(`Successfully added ${subdomain}.${DOMAIN} -> ${ip} via RFC 2136.`);
    } catch (err) {
        console.error('Error during nsupdate:', err.message);
        console.error('Ensure the bind9 container is running and the key is correct.');
    } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
}

const [,, sub, ip] = process.argv;
if (sub && ip) {
    addSubdomain(sub, ip);
} else {
    console.log('Usage: node add_subdomain.js <subdomain> <ip>');
}
