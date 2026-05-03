import socket
import logging
import json
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

DB_FILE = os.path.join(os.path.dirname(__file__), 'database.json')

def get_whois_data(query):
    try:
        if not os.path.exists(DB_FILE):
            return f"No database found\n"

        with open(DB_FILE, 'r') as f:
            db = json.load(f)
        
        identity = db.get('identities', {}).get(query)

        if not identity:
            return f"Domain Not Found: {query}\n"

        # Start Professional WHOIS Response
        response = [
            f"Domain Name: {query}",
            f"Registrar: E-Socialz World Registrar",
            f"Updated Date: {identity.get('regDate')}",
            f"Creation Date: {identity.get('regDate')}",
            f"Registry Expiry Date: {identity.get('expDate')}",
            f"Domain Status: active",
        ]

        # DYNAMICALLY ADD DNS RECORDS (A, AAAA, MX, TXT)
        records = identity.get('records', [])
        for rec in records:
            # Format A and AAAA records according to standard WHOIS lookups
            if rec['type'] == 'A':
                response.append(f"A-Record (IPv4): [TTL {rec.get('ttl', 3600)}] {rec['value']}")
            elif rec['type'] == 'AAAA':
                response.append(f"AAAA-Record (IPv6): [TTL {rec.get('ttl', 3600)}] {rec['value']}")
            elif rec['type'] == 'CNAME':
                response.append(f"Canonical Alias (CNAME): {rec['value']}")
            elif rec['type'] == 'MX':
                priority = rec.get('priority', 10)
                response.append(f"Mail Exchange Gateway (MX): [Priority {priority}] {rec['value']}")
            elif rec['type'] == 'TXT':
                val = rec['value']
                label = "Text-Record (TXT)"
                if val.startswith('v=spf1'): label = "Security Policy (SPF)"
                elif val.startswith('v=DMARC1'): label = "Security Policy (DMARC)"
                elif 'google-site-verification' in val: label = "Verification (Google)"
                response.append(f"{label}: [TTL {rec.get('ttl', 3600)}] {val}")
            elif rec['type'] == 'NS':
                response.append(f"Name Server: [TTL {rec.get('ttl', 86400)}] {rec['value']}")

        if identity.get('privacy'):
            response.append("Registrant Contact: REDACTED FOR PRIVACY")
        else:
            response.append("Registrant Name: Mask Edes")

        return "\n".join(response) + "\n"

    except Exception as e:
        return f"Internal Server Error: {e}\n"

def main():
    host = '0.0.0.0'
    port = 43 # We attempt port 43 first
    try:
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.bind((host, port))
        server_socket.listen(5)
        logging.info(f"✅ WHOIS Protocol Active on Port {port}")
    except PermissionError:
        port = 4343
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.bind((host, port))
        server_socket.listen(5)
        logging.warning(f"⚠️ Port 43 restricted. Falling back to {port}")

    while True:
        client_socket, addr = server_socket.accept()
        with client_socket:
            data = client_socket.recv(1024).strip()
            if not data: continue
            query = data.decode('utf-8')
            response = get_whois_data(query)
            client_socket.sendall(response.encode('utf-8'))

if __name__ == "__main__":
    main()
