const MAX_BODY = 65536;
const EDITIONS = new Set(["player", "staff"]);
const KINDS = new Set(["debug", "feedback", "request"]);

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {status, headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}});
}

function clean(value, limit) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, limit);
}

function validInstallId(value) {
  return typeof value === "string" && /^[a-f0-9-]{24,64}$/.test(value);
}

export function validateSubmission(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {error: "body must be an object"};
  if (!EDITIONS.has(input.edition)) return {error: "edition must be player or staff"};
  if (!KINDS.has(input.kind)) return {error: "kind is invalid"};
  if (!validInstallId(input.install_id)) return {error: "install_id is invalid"};
  if (input.website) return {error: "submission rejected"};
  const message = clean(input.message, 12000);
  const diagnostic = clean(input.diagnostic, 40000);
  if (!message && !diagnostic) return {error: "message or diagnostic is required"};
  return {value: {edition: input.edition, kind: input.kind, install_id: input.install_id, version: clean(input.version, 32), message, diagnostic}};
}

function issueBody(item, reportId) {
  return [
    `Anonymous DGHUD submission: **${reportId}**`,
    `Edition: **${item.edition}**`,
    `HUD version: **${item.version || "unknown"}**`,
    "",
    "### Player description",
    item.message || "_(none supplied)_",
    "",
    "### Sanitized diagnostic",
    "```text",
    item.diagnostic || "(none supplied)",
    "```",
    "",
    "_Submitted through the DGHUD receiver. The HUD is designed to omit credentials, IP addresses, chat, room prose, character names, and command history._"
  ].join("\n");
}

async function createIssue(env, item, reportId) {
  const repo = item.edition === "staff" ? env.STAFF_REPO : env.PLAYER_REPO;
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${repo}/issues`, {
    method: "POST",
    headers: {"accept": "application/vnd.github+json", "authorization": `Bearer ${env.GITHUB_TOKEN}`, "content-type": "application/json", "user-agent": "DGHUD-feedback-service", "x-github-api-version": "2022-11-28"},
    body: JSON.stringify({title: `[Anonymous ${item.kind}] ${reportId}`, body: issueBody(item, reportId), labels: ["anonymous-submission"]})
  });
  if (!response.ok) throw new Error(`GitHub rejected submission (${response.status})`);
  return response.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return json({ok: true, service: "dghud-feedback"});
    if (request.method !== "POST" || url.pathname !== "/v1/submissions") return json({error: "not found"}, 404);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_BODY) return json({error: "submission is too large"}, 413);
    let input; try { input = JSON.parse(await request.text()); } catch { return json({error: "invalid JSON"}, 400); }
    const checked = validateSubmission(input); if (checked.error) return json({error: checked.error}, 400);
    const actor = await env.SUBMISSIONS.limit({key: checked.value.install_id});
    const global = await env.GLOBAL_SUBMISSIONS.limit({key: "all"});
    if (!actor.success || !global.success) return json({error: "too many submissions; try again later"}, 429);
    const reportId = `DG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      const issue = await createIssue(env, checked.value, reportId);
      return json({ok: true, report_id: reportId, issue_number: issue.number});
    } catch (error) {
      console.error(reportId, error instanceof Error ? error.message : "submission failed");
      return json({error: "submission service is temporarily unavailable", report_id: reportId}, 502);
    }
  }
};
