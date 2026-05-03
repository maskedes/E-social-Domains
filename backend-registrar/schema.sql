-- Domain Registry Schema (PostgreSQL)

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Domains Table
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    extension TEXT NOT NULL,
    owner_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'active', -- active, expired, pending, locked
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    last_audit_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cloudflare_zone_id TEXT,
    UNIQUE(name, extension)
);

-- DNS Records Table
CREATE TABLE IF NOT EXISTS dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- A, AAAA, CNAME, MX, TXT, NS, etc.
    name TEXT NOT NULL, -- @, www, mail, etc.
    value TEXT NOT NULL,
    ttl INTEGER DEFAULT 3600,
    priority INTEGER, -- for MX records
    cloudflare_record_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- DNS_UPDATE, DOMAIN_REGISTRATION, DOMAIN_TRANSFER, etc.
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
