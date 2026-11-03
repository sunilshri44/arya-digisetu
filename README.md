# Arya DigiSetu — Starter MVP

A small, low-cost starter for an agent-registration and admin-approval portal on Cloudflare Workers + D1.

## Included
- Public landing page
- Agent registration form
- Admin login (credentials supplied as Worker secrets)
- Admin view of agent applications
- Approve / reject actions
- D1 database schema

## Important scope and safety
This is a starter MVP, not an authorized MPOnline integration. It does not submit applications to government departments, issue certificates, or verify Aadhaar/PAN. Add government integrations only with formal authorization and approved APIs.
Do not collect Aadhaar numbers, OTPs, bank credentials, or unnecessary sensitive documents in this starter.
Use HTTPS, strong secrets, backups, access controls, and a privacy notice before real customer use.

## Deploy outline
1. Create a GitHub repository and upload these files.
2. In Cloudflare Dashboard, open Workers & Pages and create a Worker.
3. Connect the GitHub repository (or deploy with Wrangler).
4. Create a D1 database named `arya-digisetu-db`.
5. In the Worker settings, add a D1 binding:
   - Variable name: `DB`
   - Database: `arya-digisetu-db`
6. Run `schema.sql` against the D1 database using the Cloudflare D1 console, or:
   `npx wrangler d1 execute arya-digisetu-db --remote --file=./schema.sql`
7. Add Worker secrets:
   - `ADMIN_USERNAME` = your chosen admin username
   - `ADMIN_PASSWORD` = a long unique password
   - `AUTH_SECRET` = a long random secret (at least 32 characters)
8. Deploy the Worker. The site and `/api/*` endpoints are served by the same Worker.

## Local development
Install Node.js, then:
```bash
npm install
npx wrangler dev
```
For local D1, configure the database in `wrangler.toml` and use Wrangler's local D1 commands.

## Free-plan note
Cloudflare's free limits can change and are not unlimited. Check current Workers and D1 quotas before production use. A custom domain usually costs money; use the free `workers.dev` subdomain to start.
