# toon-plugins

A Claude Code plugin marketplace of agent skills for TOON Protocol: `toon-nostr` (the data),
`toon-cli` and `toon-client` (how each client sends it). See `README.md`.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on toon-protocol/toon-plugins, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## The AFK factory

`ready-for-agent` is the factory's queue (`docs/agents/triage-labels.md`). When an issue
carries it and its blockers are closed, `.github/workflows/agent-implement.yml` runs
`.sandcastle/agent-implement-issue.ts`, which runs `/mattpocock-skills:implement`, then
`/mattpocock-skills:code-review` against `main` in a fresh session, then the gate, then
pushes `sandcastle/issue-N` and opens a PR labelled `ready-for-human`. A failed run moves
the issue to `needs-triage`. Specs, blocked issues, issues with an open PR and any issue
labelled `wayfinder:*` are skipped (`.sandcastle/ready-issues.ts`). A human merges every PR.

**The gate reads its steps from CI.** The gate is the `run:` steps of the `gate` job
(else the `checks` job) of `.github/workflows/ci.yml` **on `main`**, in order. If there is
no `ci.yml`, no such job, or no runnable step, the gate runs nothing and logs that loudly.
Today `ci.yml`'s `gate` job runs `checks/skill-commands.mjs`, which fails when a skill
names a `toon` or `toon-client` command, or a long flag of one, that the lowest version in
its sending skill's frontmatter range lacks, or names another plugin's binary. A command
whose `--help` exits 0 still fails when a command before it lists subcommands and its help
does not name the word (toon-client 5.0 answers `channel <anything> --help` with the
channel help). It fetches both clients, so the gate needs network access. Keep the job's
`run:` steps free of `if:` and `${{ }}`: the gate skips those.
The rule lives in one place, `gateFromCi` in `.sandcastle/run-gate.ts`, tested by
`.sandcastle/run-gate.test.ts`.

The runner's own commands, from `.sandcastle/`: `npm ci`, `npm test`, `npm run typecheck`.
The runner's only Node manifest is `.sandcastle/package.json`, separate from anything at
the repository root. The sandbox image is the shared
`ghcr.io/toon-protocol/sandcastle-agent`; this repo has no Dockerfile for it.
`close-linked-issues.yml` is identical in every factory repo. Its source is
`templates/factory/` in `toon-protocol/toon-meta`, so change it there first.
