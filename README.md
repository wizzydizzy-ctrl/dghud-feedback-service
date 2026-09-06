# DGHUD Feedback Service

Anonymous, consent-based receiver for Dragons Gate HUD diagnostics, feedback, and feature requests.

## End-user flow

Mudlet previews the sanitized payload, asks the player to send it, POSTs JSON to `/v1/submissions`, and displays the returned `DG-XXXXXXXX` report ID. Players need no browser or GitHub account.

## Security boundaries

- No GitHub credential is shipped in the HUD.
- Payloads are allowlisted and bounded to 64 KiB.
- Per-install and global Cloudflare rate limits reduce abuse.
- A honeypot field rejects simple bots.
- The service sends only to the configured Player or Staff repository.
- GitHub errors are not exposed to callers.

The receiver must not trust the client-side sanitizer. Server validation is mandatory; issue content remains untrusted user input.

## Deploy

1. Install Node.js 20+ and run `npm install`.
2. Run `npx wrangler login` and `npx wrangler deploy`.
3. Create a fine-grained GitHub token limited to Issues: write on the two HUD repositories.
4. Store it with `npx wrangler secret put GITHUB_TOKEN`.
5. Add the `anonymous-submission` label to both repositories.
6. Test `GET /health`, then submit a synthetic diagnostic before enabling the HUD endpoint.

Never commit `.dev.vars`, `.env`, or the GitHub token.
