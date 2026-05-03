const Cloudflare = require('cloudflare');

const cf = new Cloudflare({
    token: process.env.CLOUDFLARE_API_TOKEN
});

/**
 * Syncs a DNS record to Cloudflare
 * @param {string} zoneId - The Cloudflare Zone ID
 * @param {object} record - The DNS record object
 */
async function syncRecord(zoneId, record) {
    try {
        if (record.cloudflare_record_id) {
            // Update existing record
            return await cf.dns.records.edit(zoneId, record.cloudflare_record_id, {
                type: record.type,
                name: record.name,
                content: record.value,
                ttl: record.ttl,
                proxied: false
            });
        } else {
            // Create new record
            const result = await cf.dns.records.add(zoneId, {
                type: record.type,
                name: record.name,
                content: record.value,
                ttl: record.ttl,
                proxied: false
            });
            return result;
        }
    } catch (error) {
        console.error('Cloudflare Sync Error:', error);
        throw error;
    }
}

/**
 * Deletes a DNS record from Cloudflare
 */
async function deleteRecord(zoneId, recordId) {
    try {
        return await cf.dns.records.del(zoneId, recordId);
    } catch (error) {
        console.error('Cloudflare Delete Error:', error);
        throw error;
    }
}

module.exports = {
    syncRecord,
    deleteRecord
};
