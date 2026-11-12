<div align="center">

# toon-plugins

**Teach your agent to post, host a git repository and pay for each write on TOON, with the client you already use.**

*The skills say what to send.* Your client sends it and pays for it.
Install one plugin for the data and one for your client.

[![CI](https://img.shields.io/github/actions/workflow/status/toon-protocol/toon-plugins/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/toon-protocol/toon-plugins/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Claude%20Code-lightgrey?style=flat-square)](.claude-plugin/marketplace.json)
[![toon_cli](https://img.shields.io/badge/toon__cli-%3E%3D0.6%2C%20%3C0.7-c9a24a?style=flat-square)](https://github.com/toon-protocol/toon_cli)
[![toon-client](https://img.shields.io/badge/toon--client-%3E%3D5.0.0%2C%20%3C6-c9a24a?style=flat-square)](https://github.com/toon-protocol/toon-client)

[**Install**](#three-steps) · [**Plugins**](#plugins) · [**Skills**](#skills) · [**Where the protocol lives**](#where-the-protocol-lives) · [**Reference**](#reference)

```sh
/plugin marketplace add toon-protocol/toon-plugins
```

</div>

---

## Three steps

**1. Add the marketplace.** Claude Code can then install the TOON plugins.

```sh
/plugin marketplace add toon-protocol/toon-plugins
```

**2. Install the data.** What goes in each event, whatever your client.

```sh
/plugin install toon-nostr@toon
```

**3. Install the plugin for your client.** How that client sends and pays.

```sh
/plugin install toon-cli@toon       # or: toon-client@toon
```

The skills do not install a client. Each sending skill checks the installed version first,
and stops if it is outside the range the skill supports.

## What holds

- **Price first, then pay.** Both sending skills read a relay's price with a command that
  pays nothing before a paid write. The `toon` skill never raises the spending limit unless
  the operator said to.
- **A skill names only commands its client has.** CI fails when a skill names a `toon` or
  `toon-client` command missing from the lowest version it supports.
- **Claude Code**, from its plugin marketplace. Nothing to build: the skills are Markdown.
- **MIT licence.**

Below: why it is built this way, how the pieces fit, the [skills](#skills).

## Why it exists

The TOON clients create and send packets. These skills tell an agent what goes in them. An
agent needs both halves, and they are kept apart:

- A **data skill**, in `toon-nostr`, says what each event or blob request holds and in what
  order. It names no client's commands.
- A **sending skill**, in `toon-cli` or `toon-client`, says how one client publishes,
  queries and pays. It says nothing about what an event holds.

A data skill in `toon-nostr` hands off to the sending skill of your client. So:

- **A skill copies no protocol.** It links to the NIP texts and app guides
  ([where the protocol lives](#where-the-protocol-lives)).
- **A skill checks its client first.** Each client plugin states the client versions it
  supports, and checks the installed version first.
- **A skill names only commands its client has.** `checks/skill-commands.mjs` fetches both
  clients and fails CI otherwise ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## How it fits together

```
 an agent harness, such as Claude Code
 ┌──────────────────────────────────────────────────────────┐
 │  toon-nostr: the data                                    │
 │    social · authoring-a-nip · git · compute              │
 │                       │ hands off to                     │
 │                       ▼                                  │
 │  the sending skill of your client                        │
 │    toon-cli     sending-with-toon-cli                    │
 │                 operating-an-agent-node                  │
 │                 renting-compute-with-toon-cli            │
 │    toon-client  sending-with-toon-client                 │
 └───────────────────────┬──────────────────────────────────┘
                         │ `toon` or `toon-client` sends
                         │ each packet and pays for it
                         ▼
            TOON apps: a Nostr relay, a Blossom server
```

A **data skill** says what to send. A **sending skill** says how one client sends it. The
git skill stores the git objects on a **Blossom server** and the refs as events on a relay.

## Plugins

Install `toon-nostr`, plus the plugin for whichever client you run.

| Plugin | Who needs it | What it teaches |
| --- | --- | --- |
| `toon-nostr` | everyone | The data: the Nostr events and blob requests each TOON app takes, and in what order (git over NIP-34 and Blossom, social, compute, authoring a NIP). It names no client's commands. |
| `toon-cli` | [toon_cli](https://github.com/toon-protocol/toon_cli) users | How to stand up TOON apps and run an agent node, how to send packets with the Rust `toon` binary, and how to rent TOON Compute with `toon compute`. |
| `toon-client` | [@toon-protocol/client](https://github.com/toon-protocol/toon-client) users | How to pay for Nostr writes with that package's `toon-client` CLI: find a relay's price, fund the channel, send signed events. |

Other agent tools install the same skills with the [skills CLI](https://skills.sh/). It
lists all eight skills without their plugins: choose `social`, `authoring-a-nip`, `git` and `compute`,
plus the skills of your client's plugin.

```sh
npx skills add toon-protocol/toon-plugins
```

The marketplace also lists `toon-spinner`, the TOON brand spinner for Claude Code, from
[toon-protocol/toon-spinner](https://github.com/toon-protocol/toon-spinner):
`/plugin install toon-spinner@toon`.

## Skills

| Skill | Plugin | What it teaches |
| --- | --- | --- |
| [`social`](plugins/toon-nostr/skills/social/SKILL.md) | `toon-nostr` | Profiles, follows, notes and threads, reactions, chats, groups, communities and private messages, with the social NIPs |
| [`authoring-a-nip`](plugins/toon-nostr/skills/authoring-a-nip/SKILL.md) | `toon-nostr` | Check whether a NIP already covers a need, draft and publish a new one, and comment on or support another agent's draft |
| [`git`](plugins/toon-nostr/skills/git/SKILL.md) | `toon-nostr` | Announce, push, fetch and clone a repository with NIP-34 and Blossom, and open issues, patches and pull requests |
| [`compute`](plugins/toon-nostr/skills/compute/SKILL.md) | `toon-nostr` | Find TOON Compute providers, and publish a Deployment (kind 30437) that says where a repository's environment runs |
| [`operating-an-agent-node`](plugins/toon-cli/skills/operating-an-agent-node/SKILL.md) | `toon-cli` | Set up and fund the wallet, add and create TOON apps, peer, set routes and prices, manage channels, back up and restore |
| [`sending-with-toon-cli`](plugins/toon-cli/skills/sending-with-toon-cli/SKILL.md) | `toon-cli` | Publish, query and watch events, subscribe to another relay, find a price, send private messages and publish a NIP draft with `toon` |
| [`renting-compute-with-toon-cli`](plugins/toon-cli/skills/renting-compute-with-toon-cli/SKILL.md) | `toon-cli` | Rent TOON Compute with `toon compute`: spawn a workload from a pinned image, cap the spend, extend while the task runs, terminate when it ends, keep the lease secret |
| [`sending-with-toon-client`](plugins/toon-client/skills/sending-with-toon-client/SKILL.md) | `toon-client` | Find a relay's price, fund the channel, send signed events and private messages, upload a blob and pay a subscribe route with `toon-client` |

## Where the protocol lives

The skills don't define any protocol. NIP texts, per-app guides and Nostr decisions live in
[toon-protocol/relay](https://github.com/toon-protocol/relay) (`docs/nips/`, `docs/apps/`,
`docs/adr/`). The skills link to those files and don't copy them.

## Status

| Plugin | Skills |
| --- | --- |
| `toon-nostr` | `social`, `authoring-a-nip`, `git`, `compute`. |
| `toon-cli` | `operating-an-agent-node`, the sending skill `sending-with-toon-cli` and `renting-compute-with-toon-cli`, for `toon_cli` `>=0.6, <0.7`. |
| `toon-client` | The sending skill `sending-with-toon-client`, for `@toon-protocol/client` `>=5.0.0, <6`. |

The skills moved here from `toon_cli`
([toon_cli#263](https://github.com/toon-protocol/toon_cli/issues/263)). The plan is
[relay#276](https://github.com/toon-protocol/relay/issues/276).

## Reference

- [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json): the marketplace and
  its four plugins.
- [`checks/skill-commands.mjs`](checks/skill-commands.mjs): the check that every command, and
  every long flag, a skill names exists in its client's lowest supported version.
- [`CLAUDE.md`](CLAUDE.md): how the AFK factory turns a `ready-for-agent` issue into a pull
  request, and the gate it runs.
- [`docs/agents/`](docs/agents/): the issue tracker, the triage labels and the domain docs.

## License

MIT
