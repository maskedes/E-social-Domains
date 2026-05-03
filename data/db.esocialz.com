$TTL 86400
@   IN  SOA ns1.esocialz.com. admin.esocialz.com. (
        2026050301 ; Serial
        3600       ; Refresh
        1800       ; Retry
        1209600    ; Expire
        86400 )    ; Minimum TTL

@       IN  NS      ns1.esocialz.com.
ns1     IN  A       192.168.1.10

; Main Site
@       IN  A       192.168.1.20
www     IN  A       192.168.1.20

; Wildcard for Subdomain Marketplace
; Any subdomain not explicitly defined will point to the marketplace landing page
*       IN  A       192.168.1.25

; User Subdomains (Dynamically added below)
; [MARKER:USER_RECORDS]
ali     IN  A       192.168.1.100
shop    IN  A       192.168.1.101
