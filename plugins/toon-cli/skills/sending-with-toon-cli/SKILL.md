---
name: sending-with-toon-cli
description: "Send, query and watch Nostr events with toon_cli's `toon` binary: publish, sign without publishing, query a relay, watch your own relay, subscribe to another relay, find a relay's price, send and list private messages, tip an agent identity, and publish a NIP draft. The sending skill the data skills (social, authoring-a-nip, git, compute) hand off to. Use whenever a data skill says to send something with your client's sending skill and your client is toon_cli. Run toon --version first."
toon_cli: ">=0.6, <0.7"
---

# Sending with toon_cli

The data skills (`social`, `authoring-a-nip`, `git`, `compute`) say what goes in an event and which
relay it goes to, and name no client. This skill says how `toon`, the binary of
[toon_cli](https://github.com/toon-protocol/toon_cli), does each thing they ask for. It says
nothing about what an event holds: that is the data skill's.

## First, check the version

This skill covers the `toon_cli` versions in its `toon_cli` field above. Before anything else run:

```
toon --version
```

It prints `toon <version> (connector …, relay …)`. If the version is outside that range, or the
output is not in that form (another client also installs a binary named `toon`), stop: do not
run the commands below, and tell the operator which version you found and which this skill
covers. If a command here is then missing from `toon --help`, trust `--help`.

For what every `toon` command shares (`--json`, exit codes, `--yes`, the passphrase, the spending
limit) and for setting up the agent node, read the skill `operating-an-agent-node`. Pass `--json`
to read a result as one document, and branch on `error.code`, not on the message.

## The actions, and their commands

| What the data skill asks for | Command |
| --- | --- |
| Publish to your own relay | `toon event publish --kind <n> --content <text> --tags <json>` |
| Publish to another relay (paid) | `toon event publish --kind <n> --content <text> --tags <json> --relay <ws-url> --yes` |
| Sign without publishing | `toon event sign --kind <n> --content <text> --tags <json>` |
| Query a relay | `toon event query <ws-url> --filter <json>` |
| Watch your own relay | `toon event watch --filter <json>` |
| Subscribe to another relay | `toon relay subscribe <ws-url> --filter <json> --amount <n> --yes` |
| Find a relay's price | `toon relay describe <ws-url>` |
| Read the spending limit | `toon limit show` |
| Your key | `toon wallet show` (the agent identity) |
| Send a private message | `toon message send <pubkey>... --content <text>` |
| List private messages | `toon message list` |
| Write a NIP draft from the template | `toon nip new <title>` |
| Publish a NIP draft | `toon nip publish <file> --relay <ws-url>` |

## Publishing

A data skill gives an event as its **kind**, its **content** and its **tags**, and a **to** when
it goes to another relay. They become `--kind`, `--content` and `--tags`; an event with no
**to** goes to your own relay, and one with a **to** takes `--relay <ws-url> --yes`. A kind `0`
profile to your own relay:

```
toon event publish --kind 0 --content '{"name":"scout","about":"an agent that reads relays"}'
```

A reaction, to the relay the note is on:

```
toon event publish --kind 7 --content '+' --tags '[["e","<id>","<ws-url>","<author>"],["p","<author>"],["k","1"]]' --relay <ws-url> --yes
```

- `--tags` is a JSON array of arrays of strings, and defaults to none; `--content` defaults to
  empty. If your commands are fixed tools, see "If your commands are fixed tools" in
  `operating-an-agent-node` for `--tags` and `--yes`.
- It signs with the agent identity and reports the event it signed, id included. You cannot set
  `created_at` or choose another key. It encrypts nothing.
- `--amount <n>` is what the write is paid, in base units. To your own relay it defaults to 0 and
  must meet the write price `toon relay config` shows; it pays nothing out of the wallet and is not
  counted against the spending limit (`toon limit show` does not change). With `--relay` it
  defaults to the relay's price. If a connector in between charges to forward, read "Sending" in
  `operating-an-agent-node`.
- `toon event publish` opens the keystore, so it needs the passphrase.
- `toon event sign` takes the same `--kind`, `--content` and `--tags` and prints the signed
  event without publishing or paying; without `--json` the output is the event alone.

## Querying

`toon event query <ws-url> --filter <json>` prints the stored events of a relay that match one
NIP-01 filter, and costs nothing. A data skill's read is the filter, given as `--filter '<json>'`:

```
toon event query <ws-url> --filter '{"kinds":[1],"authors":["<key>"],"limit":20}'
```

- Your own relay is read at the `ws://host:port` that `toon status` prints for it (`read_address`
  of the app `relay` in `toon status --json`). It is not the write address the status also shows.
- With `--following`, `authors` is the keys in your follow list (the newest kind 3 you signed, on
  your own relay, which must be running), and `--filter` is optional. A `--filter` that has
  `authors` is `usage`, and no follow list, or an empty one, is `no_follow_list`.
- `toon event query` does not authenticate (NIP-42). Your own relay answers a filter for kind
  `1059` with `auth-required:`: read private messages with `toon message list`. A private
  NIP-29 group cannot be read with it either; report the group as unavailable.

## Watching

`toon event watch` prints the live events of your own relay, one JSON document to a line, as they
arrive. It takes no relay URL, needs no subscription and pays nothing.

- `--filter` is one NIP-01 filter (its `limit` is dropped); without it every live event is
  printed. `--following` sets `authors` to your follow list, read once when the command starts,
  with the same refusals as on `event query`.
- It runs until it is interrupted or the relay ends the read, and exits 1 with the reason. It does
  not return, so a tool with no timeout hangs on it. To read for a bounded time, run
  `toon event query` on your own relay with `since` in the filter, as often as you need.

## Prices, peerings and the spending limit

- `toon relay describe <ws-url>` pays nothing and needs no `--yes` or passphrase. It prints the
  relay's write price, its subscribe and broadcast prices (or that it sells no feed) and whether
  a peering of yours reaches the relay. `relay_not_payable` means the relay does not say where a
  write is paid for.
- A paying command with no peering that reaches the relay fails with `peering_needed`, pays
  nothing, and names the `toon peer add` and `toon route add` to run. With a peering, and without
  `--yes`, it fails with `not_confirmed` and states the price. Do not run a paying command without
  `--yes` to learn a price: use `toon relay describe`.
- Read `toon limit show` before you pay. A payment past it fails with `spending_limit`. Do not
  raise the limit to get past it unless the operator who gave you the task said to.

## Subscribing

`toon relay subscribe <ws-url> --filter <json> --amount <n>` buys the live feed of another relay
with one filter, and the supervisor writes each event it sends into your own relay.

- It needs a peering that reaches the relay, and fails with `peering_needed` (naming the deposit
  it needs) until there is one. Then, without `--yes`, it fails with `not_confirmed` and says what the relay charges
  per subscribe packet, what it charges per event and how many events the amount buys. Run it
  again with `--yes` to pay.
- `--following` builds the filter's `authors` from your follow list, with the same refusals as on
  `event query`. The filter is a snapshot: run `subscribe --following` again, and pay, to refresh it.
- `toon relay subscriptions` shows the balance and filter at each relay. When the balance runs out
  the feed ends, and `toon event watch` sees nothing new from that relay until you subscribe again.
- If a connector in between rejects its packets with `F03`, state the cost with
  `--packet-amount <cost>`, as "Sending" in `operating-an-agent-node` says.
- Whether the supervisor receives a feed is `feed` in `toon status --json`; read "Sending" in
  `operating-an-agent-node`.

## Private messages

`toon message send` seals and wraps a private message (NIP-17); `toon message list` reads them.
Never publish a kind `14` or kind `4` with `toon event publish`: it would be public.

```
toon message send <recipient-pubkey-hex>... --content "<text>" [--reply-to <id>] [--subject "<text>"]
```

- The recipients are public keys in hex; give several for one conversation among all of them.
  `--reply-to` is the id of the message answered, `--subject` the conversation's subject.
- Each recipient gets a wrap, and the sender's own copy is written to the agent node's own relay.
  Sending opens the keystore, so it needs the passphrase.
- Without `--relay` the wraps go to the agent node's own relay. `--relay <ws-url>` sends the
  recipients' wraps to that relay instead, paying its write price for each; without `--yes`
  nothing is paid and it fails with `not_confirmed`, stating the total (or with `peering_needed`
  when no peering of the agent node reaches that relay). Add `--yes` only once you know the price
  and `toon limit show` has room for it.
- `toon message send` does not read a recipient's kind `10050`. To choose `--relay`, query for it
  yourself, as `references/nip-17.md` of the `social` skill shows.

```
toon message list [--with <pubkey>...] [--since <unix time>] [--limit <n>]
```

- It prints the private messages the supervisor has opened, oldest first. With `--json`, each of
  `messages` has `id`, `conversation`, `participants`, `sent` (true when you sent it), `from`,
  `created_at`, `kind`, `content` and `tags`. `--with` keeps the one conversation among you and
  those keys, `--since` the messages sent at or after a time, `--limit` the newest `n`.
- Reading needs **no passphrase**: the supervisor opens the messages that reach the agent node's
  own relay with the agent identity's secret, which the agent node keeps for it
  ([ADR 0008](https://github.com/toon-protocol/toon_cli/blob/main/docs/adr/0008-the-agent-identitys-secret-is-kept-for-the-supervisor.md)),
  and keeps them opened.
- `agent_key_not_kept` means the agent node's home holds no such secret yet, so nothing has been
  opened. Run a command that opens the keystore, such as `toon event publish` or
  `toon message send`, and list again.
- Wraps left at another relay arrive once you subscribe there for kind `1059` addressed to your key:

```
toon relay subscribe <ws-url> --filter '{"kinds":[1059],"#p":["<your key>"]}' --amount <n> --yes
```

## Tips

`toon tip send <npub|hex> --amount <n> --yes` tips an agent identity: one paid packet carrying a
signed tip receipt, which is never published. `--amount` is what you send, not what arrives.
"Tips" in `operating-an-agent-node` has its flags, its refusals and how to read its report.

## NIP drafts

`authoring-a-nip` says what a draft holds; these commands write and publish one.

- `toon nip new "<title>"` writes `<identifier>.md` from the template into the directory the
  command runs in. It never overwrites a file: if `<identifier>.md` exists, it fails with
  `draft_refused`.
- `toon nip publish <identifier>.md --relay <ws-url>` derives the kind `30817` event from the file,
  asks the relay for the draft's current revision, signs with the agent identity and writes it.
  It writes only to your own relay: give your own relay's address. `--topic <topic>` adds a topic
  in lower case and may be repeated. `--amount <n>` must meet your relay's write price.
- `draft_refused` means the file is not a valid draft, for one of the reasons in step 3 of
  `authoring-a-nip`. Fix the file. Pass `--title-changed` only when you did change the title of
  your own draft.
- Comments, approvals and deletion requests on a draft are ordinary events: publish them with
  `toon event publish`, adding `--relay <ws-url> --yes` for a relay that is not yours.

## Git repositories

`git`'s events are ordinary events, and its upload authorizations (kind `24242`) are signed
without publishing, as above. `toon` makes no request to a Blossom server.

- `HEAD` and `GET` are free and go straight to the Blossom server over `https`, with any HTTP
  client.
- `PUT /upload` is a paid request through the connector's upload route, not a request to the
  server. Find the route with `toon describe <connector-url>`: look for a route ending in
  `.blossom.upload`.
- `toon` 0.3 cannot pay for that request: its `send` cannot set the `Authorization: Nostr …` or
  `X-SHA-256` headers
  ([toon_cli#270](https://github.com/toon-protocol/toon_cli/issues/270)).
- Today a push needs `toon-client` for the uploads: follow the `sending-with-toon-client` skill's
  "Uploading to a Blossom server" section, with each kind `24242` authorization signed by the
  agent identity using `toon event sign`.
- Without `toon-client`, stop before the first upload and tell the operator. Do not publish a
  `30618` that points at blobs that were never uploaded.

## Relay settings the data skills mention

They are the operator's, and "Relay settings" in `operating-an-agent-node` has them: `toon relay
config` shows whether your relay honours expiry (NIP-40), and `toon relay config --expiry
honour --yes` (or `ignore`) changes it; `--block <event-id>` refuses one event (NIP-56). Either
change restarts the relay.

## Reading a skill's files from the binary

When a harness cannot open a file beside `SKILL.md`, read the text from the binary: `toon skill
list` names each skill it ships and its references, and `toon skill show social
references/<file>` prints one reference. The binary prints the copy it was built with, which may
be older than this plugin: a `toon_cli` 0.3 binary prints `social` as it was before it moved
here, with the `toon` commands written into it. Where it and this plugin differ, follow this plugin.
