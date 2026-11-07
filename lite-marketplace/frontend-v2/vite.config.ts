import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * dnsApiPlugin — server-side realtime DNS provisioning for E-Social Domains.
 *
 * Exposes /api/dns/* endpoints that proxy to the Cloudflare API using the
 * zone-scoped token in scripts/.env.cloudflare. The token never reaches the
 * browser. Endpoints:
 *   GET    /api/dns/zone                    → zone status + assigned nameservers
 *   GET    /api/dns/records?name=<fqdn>     → DNS records (optionally name-filtered)
 *   POST   /api/dns/records                 → create record { type, name, content, ttl, proxied }
 *   DELETE /api/dns/records/:id             → delete record
 */
const dnsApiPlugin = (): Plugin => {
  const ZONE = 'esocialzdomains.eu.org'
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), 'scripts/.env.cloudflare')
  const cfRoot = 'https://api.cloudflare.com/client/v4'
  let cachedZoneId: string | null = null

  const loadEnv = () => {
    const env: Record<string, string> = {}
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      if (!line.includes('=') || line.trim().startsWith('#')) continue
      const i = line.indexOf('=')
      env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
    return env
  }

  const cf = async (path: string, init: RequestInit = {}, token?: string) => {
    const res = await fetch(`${cfRoot}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token ?? loadEnv().CF_API_TOKEN}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body.success === false) {
      throw new Error(body.errors?.[0]?.message ?? `Cloudflare API ${res.status}`)
    }
    return body.result
  }

  const getZoneId = async () => {
    if (cachedZoneId) return cachedZoneId
    const zones = (await cf(`/zones?name=${ZONE}`)) as Array<{ id: string; name_servers?: string[]; status?: string }>
    cachedZoneId = zones[0]?.id ?? null
    return cachedZoneId
  }

  const json = (res: import('node:http').ServerResponse, code: number, data: unknown) => {
    res.statusCode = code
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(data))
  }

  const readBody = (req: import('node:http').IncomingMessage) =>
    new Promise<object>((ok) => {
      let raw = ''
      req.on('data', (c) => { raw += c })
      req.on('end', () => { try { ok(JSON.parse(raw || '{}')) } catch { ok({}) } })
    })

  return {
    name: 'dns-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/dns', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://local')
          const zoneId = await getZoneId()
          if (!zoneId) return json(res, 503, { error: `Zone ${ZONE} not found on Cloudflare yet` })

          if (url.pathname === '/zone' && req.method === 'GET') {
            const zone = await cf(`/zones/${zoneId}`) as { status?: string; name_servers?: string[] }
            return json(res, 200, { name: ZONE, status: zone.status, nameServers: zone.name_servers })
          }

          if (url.pathname === '/records' && req.method === 'GET') {
            const name = url.searchParams.get('name')
            const q = name ? `?name=${encodeURIComponent(name)}&per_page=100` : '?per_page=100'
            return json(res, 200, { records: await cf(`/zones/${zoneId}/dns_records${q}`) })
          }

          if (url.pathname === '/records' && req.method === 'POST') {
            const b = await readBody(req) as { type?: string; name?: string; content?: string; ttl?: number; proxied?: boolean; priority?: number; essential?: boolean }
            if (!b.type || !b.name || !b.content) return json(res, 400, { error: 'type, name and content are required' })
            const recType = b.type.toUpperCase()
            const payload: Record<string, unknown> = {
              type: recType,
              name: b.name,
              content: b.content,
              ttl: b.ttl ?? 1,
              proxied: b.proxied ?? false,
            }
            // MX and SRV carry a numeric priority (lower = preferred)
            if ((recType === 'MX' || recType === 'SRV') && b.priority !== undefined) payload.priority = Number(b.priority)
            const record = await cf(`/zones/${zoneId}/dns_records`, { method: 'POST', body: JSON.stringify(payload) })
            return json(res, 200, { record, essential: Boolean(b.essential) })
          }

          const delMatch = url.pathname.match(/^\/records\/([0-9a-f]+)$/)
          if (delMatch && req.method === 'DELETE') {
            await cf(`/zones/${zoneId}/dns_records/${delMatch[1]}`, { method: 'DELETE' })
            return json(res, 200, { ok: true })
          }

          return json(res, 404, { error: 'unknown /api/dns route' })
        } catch (e) {
          return json(res, 502, { error: (e as Error).message })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dnsApiPlugin()],
})
