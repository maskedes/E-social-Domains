/**
 * Available domain extensions (zones) on the E-Social platform.
 *
 * Every entry is a real Cloudflare zone provisioned for the platform
 * (NS: kristin.ns.cloudflare.com + rommy.ns.cloudflare.com). Zones marked
 * `active: false` are awaiting eu.org delegation approval and cannot be
 * registered into yet — they render disabled in the register dropdown.
 */
export interface DomainExtension {
  /** Full zone name, e.g. "ixdns.eu.org" */
  name: string;
  /** Cloudflare zone id (used by the DNS API plugin) */
  zoneId: string;
  /** Whether users can register subdomains under this zone now */
  active: boolean;
  /** Human-readable status */
  status: string;
}

export const DEFAULT_EXTENSION = 'esocialzdomains.eu.org';

export const EXTENSIONS: DomainExtension[] = [
  { name: 'esocialzdomains.eu.org', zoneId: '363e3aec260ef9a84038b4723e12c101', active: true, status: 'live' },
  { name: 'ixdns.eu.org', zoneId: '47eed47df427912834bc166bd1edee7b', active: false, status: 'pending eu.org approval' },
  { name: 'ixweb.eu.org', zoneId: '90d108d0d3b74137ddb2dd7f8d4515ab', active: false, status: 'pending eu.org approval' },
  { name: 'ixhost.eu.org', zoneId: '70f3a1c21b66ea4bc577cf1ebf0bf4c5', active: false, status: 'pending eu.org approval' },
  { name: 'ixzone.eu.org', zoneId: 'b79866126cca16771192579bc850f98f', active: false, status: 'pending eu.org approval' },
  { name: 'ixdomain.eu.org', zoneId: 'cbe4bd76489c67c7008ea926254b3bed', active: false, status: 'pending eu.org approval' },
  { name: 'ixmail.eu.org', zoneId: 'd9bf9eba13326b60d8914c75fa241b48', active: false, status: 'pending eu.org approval' },
  { name: 'ixapp.eu.org', zoneId: '455a3bca6112175bc82550359ac1bb1e', active: false, status: 'pending eu.org approval' },
  { name: 'ixdns2.eu.org', zoneId: '29065ea3ad77690f4ba214e0e0fe729b', active: false, status: 'pending eu.org approval' },
  { name: 'ixcloud.eu.org', zoneId: '269ff423f1cde34f14d60baebc146438', active: false, status: 'pending eu.org approval' },
  { name: 'ixsite.eu.org', zoneId: 'fef1e47c96ff49f1bebbcebfc25bba78', active: false, status: 'pending eu.org approval' },
  { name: 'ixug.eu.org', zoneId: 'd9eeaef9c3cc6686989b72ea62bff3b8', active: false, status: 'pending eu.org approval' },
  { name: 'parterne.eu.org', zoneId: 'babe3340697d0361074667be3e989bef', active: false, status: 'pending eu.org approval' },
  { name: 'ixfree.eu.org', zoneId: 'e108fdc86c099a883dfb6748d1aed8d4', active: false, status: 'pending eu.org approval' },
  { name: 'ixpro.eu.org', zoneId: '9e791983d95768cbc434e16700d5570b', active: false, status: 'pending eu.org approval' },
  { name: 'ixnet.eu.org', zoneId: '2be9fd805452cf45d942b7cd38e650b0', active: false, status: 'pending eu.org approval' },
  { name: 'ixgo.eu.org', zoneId: '88d64ee573afedfcaf1e878a0b716ab0', active: false, status: 'pending eu.org approval' },
  { name: 'ixhub.eu.org', zoneId: 'e00b8d507b78f2f1b7f8f405b8312183', active: false, status: 'pending eu.org approval' },
  { name: 'ixlink.eu.org', zoneId: 'a2df37625fccba0235cb39b3ac1487d1', active: false, status: 'pending eu.org approval' },
  { name: 'ixpage.eu.org', zoneId: '9162545cef4a5effa7b183612cd040b4', active: false, status: 'pending eu.org approval' },
  { name: 'ixdata.eu.org', zoneId: '175746a524d9521da8ece646631af09e', active: false, status: 'pending eu.org approval' },
];
