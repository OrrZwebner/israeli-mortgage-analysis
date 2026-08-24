# Decisions

## 2026-08-24 — Distribute locally; do not host the dashboard

**Decided.** The web dashboard stays a local, single-user app. Sharing it with other people
happens by distributing the program (`npx @orrzwebner/israeli-mortgage-analysis`), not by
putting it on a URL. Hosted BYOK is explicitly deferred, not rejected.

**Why.**
1. *Policy.* Anthropic does not permit third-party developers to offer claude.ai login, to
   route requests through Free/Pro/Max credentials on a user's behalf, or to collect or
   intermediate claude.ai credentials; Agent SDK apps must use Console API-key auth
   (code.claude.com/docs/en/legal-and-compliance; /docs/en/agent-sdk/overview). A "log in
   with Claude" dashboard is therefore not buildable as intended.
2. *Economics.* One measured analysis costs **$6.09** (88 min, 53 turns, claude-opus-5,
   measured on the author's own run). Paying for other people's runs does not scale;
   BYOK pushes an Anthropic Console account with billing onto borrowers, which the intended
   audience will not have.
3. *Privacy.* Hosting would place third parties' mortgage statements — personal financial
   data under חוק הגנת הפרטיות — on our server, and would forfeit the product's own claim
   that the documents never leave the borrower's disk.

**Touches.** Nothing in the shipped code — the local dashboard stays exactly as it is
(`git clone` + `./run.sh`). The npm/`npx` packaging route was planned and then **deferred**;
the plan and its test cases are kept in `DISTRIBUTION-PLAN.md` in case it is picked up later.

**Revisit if.** Anthropic approves third-party claude.ai login for this use, or the audience
shifts to people who already hold Console API keys.
