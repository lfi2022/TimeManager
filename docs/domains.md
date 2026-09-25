# Domains and branding

`tempopoint.lfinfo.be` is the canonical TempoPoint hostname. It is never assigned to a tenant. Client hostnames are optional and are only used for public branding.

A platform administrator creates a hostname for an explicit company context. TempoPoint returns a unique TXT challenge. The customer must publish:

`_tempopoint-verification.<hostname> TXT "tempopoint=<token>"`

The platform verifies that record before the hostname can resolve to a company brand. TLS is terminated and renewed by the reverse proxy or hosting provider after DNS verification. Do not proxy an unverified hostname to TempoPoint.

Branding has a logo URL and a hexadecimal primary colour. The public `/api/branding` endpoint provides only those fields and a display name. Authentication, sessions and API tenant access never use a hostname as their authority; they use the server-side session company context.