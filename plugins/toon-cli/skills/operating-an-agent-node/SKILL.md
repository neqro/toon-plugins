---
name: operating-an-agent-node
description: "Operate an agent node with the `toon` CLI: set up the wallet, fund it, add and create TOON apps, peer, set routes and prices, find out what another connector offers before paying it, manage channels, configure the relay, send packets, send and receive tips, make a connector a zk edge, back up and restore. Use when asked to run, change or inspect an agent node, or to pay anything through it."
---

# Operating an agent node

This skill ships inside the `toon` binary and describes the commands of that binary. If a
command here is missing from `toon --help`, the skill is out of date: trust `--help`.

## Terms

- **Agent node**: everything one operator runs through the CLI on one machine: one wallet and
  one or more TOON apps. Always two words.
- **TOON app**: one connector together with the apps behind it. **App**: the service alone, a
  payment-oblivious HTTP service the connector delivers to. The relay is an app. Never call an
  app a "TOON app": a TOON app is a connector with its apps, an app is the service alone.
- **Connector**: the paid reverse proxy at the front of a TOON app.
- **Supervisor**: the one process per machine that runs the agent node and its connectors.
- **Operator**: whoever runs the agent node. That is you.
- **Wallet**, **spending limit**, **agent identity**: see below. The agent identity is a Nostr
  key that is not a payment key.
- **Hidden service**: a connector reachable only at its onion endpoint, a `.anyone` address.
  **Clearnet** is an ordinary public hostname, and is never the default.
- **Zk edge**: a connector that also takes packets paid from zk allowances, priced in MINA.
  **Zk allowance**: a budget a payer opens at a zk edge against a note in a vault, without
  saying which note. Always two words: a bare "allowance" is something you let an app do.

## How every command behaves

- Pass `--json` and read the one JSON document on standard output. Success and failure both
  print one; a failure is `{"error": {"code": ..., "message": ...}}`. Branch on `code`, never on
  `message`.
- Exit codes: 0 done, 1 failed (the error code says why), 2 command line not understood,
  3 no agent node on this machine. `toon --help` lists them; the error codes to branch on are
  named where they arise below.
- No command prompts or reads standard input. The wallet passphrase comes from the file named by
  `TOON_PASSPHRASE_FILE`, else from `TOON_PASSPHRASE`, never from a flag. `toon init` creates no
  passphrase file: the operator chooses where it is and names it with `TOON_PASSPHRASE_FILE`.
- `--app <name>` says which TOON app a command about a connector is about; the first one is the
  default. Amounts are in the token's base units.
- Ask for help with `toon --help` or `toon <command> --help`; there is no `help` subcommand.

## Money: read this before running anything

These commands spend, and each one needs an explicit amount and `--yes`:

- `toon send <address> --amount <n> --yes`
- `toon probe <address> --amount <n> --yes` (a probe with no `--amount` carries nothing: it pays nothing and needs no `--yes`)
- `toon peer add <address> --deposit <n> --yes`
- `toon join <network> --deposit <n> --yes`
- `toon create <name> --deposit <n> --yes` (the two channels count twice against the limit)
- `toon event publish --relay <ws-url> --yes` (pays the price the relay states; add `--amount <n>` when a connector in between charges to forward)
- `toon message send <pubkey>... --content <text> --relay <ws-url> --yes` (pays the relay's price for each recipient's wrap)
- `toon relay subscribe <ws-url> --filter <json> --amount <n> --yes` (prepays a subscription at another relay: the balance its live feed draws down; `--packet-amount <n>` when a connector in between charges to forward)

Without `--yes` nothing moves and the command fails with `not_confirmed`. Never add `--yes` to
see what a command would do: run it without, or read the price first.

The **spending limit** is the most the wallet pays out per command and per UTC day. A payment
over either is refused with `spending_limit` before anything is sent, and the message says
which limit and how much of the day remains. `toon limit show` prints the limits and what is
left today. `toon limit set --max-per-command <n> --max-per-day <n>` changes them and needs the
passphrase. Do not raise the limit to get past a refusal unless the operator who gave you this
task said to; report the refusal instead. A packet that was rejected costs what your
connector's outbound channels moved by across it: possibly its whole amount, shown as `paid` in
the report, counted against the limit, and visible as the outbound `watermark` in
`toon channel list`. A packet your own connector rejected before signing costs nothing. A
payment whose packet was never sent is not counted either (the key could not be read, the
identity to seal to could not be fetched, the packet could not be sealed, the connector's `send` refused its
arguments, or the connector refused the packet write with 401, its signature, or with 400, a
packet that did not decode, as for an address that is not an ILP address); any other failure stays counted, because the packet may have left.

`toon channel open` and `toon channel fund` also put collateral in a channel; they take no
`--yes`, so state the deposit deliberately and check `toon limit show` and `toon wallet balances`
first.

Commands that restart a connector (`toon add`, `toon remove`, `toon route price`,
`toon relay price`) drop the packets it holds. `toon change` and `toon relay config` restart one
app, and its connector only if the app comes back somewhere else (`restarted` in `--json` says
whether it did). They need `--yes` once the connector is running, or fail with
`confirmation_required` and change nothing.

A write to the agent node's own relay (`toon event publish` without `--relay`) must meet the
relay's write price, but pays nothing out of the wallet and is not counted against the spending
limit: `toon limit show` does not change.

## If your commands are fixed tools

You may be given each `toon` command as a tool with typed arguments, not a shell. What every
command shares then:

- A tool may have `--yes` written into it. Then the command cannot be run without it to see a
  price, so learn what a send costs with `toon describe` and `toon probe` (see "Finding out what a
  connector offers"), and what a relay charges with `toon relay describe <ws-url>`, before you use
  the tool.
- `--body`, `--request` and `--terms` take a file. You need somewhere you can write one; if you
  have none, say so instead of guessing.
- `TOON_PASSPHRASE_FILE` (or `TOON_PASSPHRASE`) is set by whatever starts you, when you cannot set
  a variable yourself.
- A `--tags` or `--filter` value is JSON whatever carries it: `--tags` is a JSON array of arrays
  of strings. The quotes in the examples are for a shell and are not part of the value.

## What is not yours when the agent node is already running

If you were handed an agent node that is already running, these are not yours: ask whoever
handed it to you instead of running them. If you set the agent node up, they are yours.

- `toon init`, `toon up` and `toon down` start or stop the agent node.
- `toon wallet backup` and `toon wallet restore` hold or replace the wallet.
- `toon limit set` changes the spending limit that constrains you.
- `toon tip enable` and `toon tip disable` restart a connector, dropping the packets it holds.
- `toon zk enable` and `toon zk disable` restart a connector, and a zk edge without a collector
  and a challenger beside it loses money.
- `toon skill install` replaces the skills you were given.

## Setup

1. `toon init --network devnet --accept-anyone-terms` creates the wallet and the first TOON app,
   the relay TOON app, as a hidden service. The mnemonic is shown once: record it where the
   operator keeps secrets. `--network` is `devnet` (default), `sandbox` or `mainnet`.
   `mainnet` names one operator's node (Drew's, `g.drew`) as its connector and relay;
   `--connector-url` and `--relay-url` on `init` name others. `sandbox` allows plaintext peers by itself; a
   hidden agent node on it records no connector, and names the sandbox's hub with
   `--connector-url http://<hub>.anyone:3200/ilp` (and `--relay-url ws://<hub>.anyone:7100`),
   else `toon join sandbox` is refused (`join_refused`).
   `--clearnet <hostname>` asks for clearnet instead and needs no terms flag; the certificate and
   reverse proxy are yours to provide. If the overlay will not bootstrap, `init` fails with
   `overlay_unavailable` and never falls back to clearnet. On a hidden agent node the requests
   the commands make themselves (`wallet fund`, `wallet balances`, `event publish --relay`,
   `event query`, `relay subscribe`, `relay subscriptions`, `send --seal-to`) go
   through the overlay too, except to a plain `http://` or `ws://` endpoint on this machine, and
   fail with `overlay_unavailable` when it is not there. `--max-per-command` and `--max-per-day`
   set the spending limit. `--solana` adds Solana as a settlement chain. The settlement chains
   are chosen at `init`; no command adds one later, so decide before running it.
2. Fund the wallet (next section).
3. `toon up` starts the supervisor as a `systemd --user` unit. `toon up --foreground` runs it in
   the current process. `toon down` stops it.
4. `toon status` reports the agent node, each TOON app and its apps (for the relay, a write address and the
   `ws://` URL it is read at, `read_address` in `--json`, which `toon event query <ws-url>` takes), and how often the supervisor
   restarted a connector. `toon logs <app>` shows what an app wrote to its output, also after it
   failed to start or while the agent node is stopped; `toon logs <name> --connector` shows the
   connector's log of the TOON app the name belongs to, and so does `toon logs <TOON app>` when
   no app has that name. An app served at a URL has no log of its own.
5. `toon wallet show` lists the addresses by chain and the agent identity.

## Funding

`toon up` fails with `unfunded` while a settlement key holds less than one whole token (on Solana,
also 0.01 SOL for fees); the message names each address and the amount. Without `--foreground`
the check runs in the supervisor the unit starts, so `toon up` fails with `systemd_failed` and its
message ends with what the supervisor said. An EVM connector starts
without gas. Gas (0.001 ETH) is needed where it is spent: `toon join`, `toon peer add` with a
deposit, `toon create` with a deposit and `toon channel open`, `fund`, `withdraw` and `land` fail
with `unfunded` without it, before anything is charged or sent. A connector that refuses a
write because the chain would not estimate it for lack of gas is reported as `unfunded` too: nothing was
sent and nothing is counted.

- On the devnet, `toon wallet fund` asks the faucet. It sends the token and no ETH: Base Sepolia
  ETH comes from a public Base Sepolia faucet, which you cannot use, so say so and stop. It asks for
  every address whatever the faucet answers for the others: a refusal for one address (an EVM
  cooldown, say) does not stop the rest. The report lists each as funded or refused with the
  faucet's reason; the command succeeds if any was funded, and fails with `faucet_unavailable`
  naming each address when none was.
- On `sandbox` and `mainnet` there is no faucet (`faucet_unavailable`): the operator sends funds
  to the addresses `toon wallet show` lists. You cannot do that, so say so and stop.
- `toon wallet balances` shows the balance of every address by TOON app and chain.

## Add an app: `toon add`

`toon add <app> --to <toon-app> --image <image>` puts a new app behind the connector of a TOON
app that exists already; `--url <url>` names an app you already serve and runs nothing. `--price`
is what a client pays the connector for a packet to the app, `--address` the ILP prefix
(`g.toon.<segment>.<app>` by default). It restarts that connector, so it needs `--yes`. `toon remove <app>`
takes an app and its route away. An agent node has one relay, the one `toon init` made: `add`
refuses the relay's image (any tag or digest) with `one_relay`.
`--request <file>` takes a file holding one JSON object that says what a client should send the
app; the connector publishes it, unread, as the route's `request` on `GET /ilp` and `toon route
list`. Example: `toon add echo --to relay --image echo-app --request request.json --yes`, with
`{"protocol": "http", "method": "POST", "path": "/"}` in `request.json`. A file that is not one
JSON object, or holds `null`, is refused with `usage`. To change it, remove the app and add it again.

An image given with `--image` must:

- listen on port 3100 inside the container (`TOON_BLS_PORT`),
- answer `GET /health` with `200` within two minutes of starting,
- keep what it must not lose under `/data` (`TOON_DATA_DIR`).

The app is given `TOON_BLS_PORT`, `TOON_DATA_DIR` and what the operator adds it with: `--env
NAME=value`, `--secret NAME=<file>` (a variable with the file's contents less one trailing newline;
anyone who can use docker can read it) and `--secret-file <path>=<file>` (the file mounted
read-only at `<path>`). Each is repeatable, only with `--image`, and refused with `usage` for a
name beginning `TOON_`, a bad name or path, or an empty, unreadable or over-64-KiB file. Only the
operator supplies a secret. With an agent key, `--secret NAME` and `--secret-file <path>` (no file) name a
secret the app needs; the add is held as a pending app, and the operator gives a file for each on
`toon approve`, exactly the set named. `NAME=<file>` with an agent key is refused with `needs_home`. To change one, use `toon change` (below); a backup holds none.
An image that needs another variable to start fails with `app_failed`; `toon logs <app>` says why. Do not
assume a published image meets this: the one image known to run unchanged is the minimal app in
[Adding an app](https://github.com/toon-protocol/toon_cli/blob/main/docs/guide/adding-an-app.md),
built with `docker build`; the end-to-end run adds an app built the same way.

Every app runs confined ([ADR 0011](https://github.com/toon-protocol/toon_cli/blob/main/docs/adr/0011-an-app-is-confined-and-reaches-nothing-unless-allowed.md)): on a docker network of its own that publishes no port and
leads nowhere, as the user of the process that runs `toon`, with no capabilities, a read-only
root filesystem (only `/data`, a 64 MB `/tmp` and scratch paths are writable), 512 MB of memory,
1 CPU and 256 processes. `toon status --json` shows it as `confinement`. Make an allowance when
adding the app, with `toon add` or `toon create` and only with `--image`: `--allow-egress` (the
app may open connections out; an app that calls a chain or an API needs it), `--scratch <path>`
(repeatable), `--memory <size>`, `--cpus <n>`, `--pids <n>`. A value that cannot be used, or an
allowance with `--url`, is refused with `usage`. To change an allowance, variable or secret, use
`toon change <app> ... --yes`: it takes the same flags and `--no-allow-egress`, `--unset-scratch`,
`--unset-env`, `--unset-secret` and `--unset-secret-file`, and `default` for `--memory`, `--cpus`
and `--pids`; it keeps everything it does not name, restarts the app (so it needs `--yes`), and
its connector only if the app comes back somewhere else, and puts the change back with `app_failed` if the app does not start. A name is one
thing: `--secret NAME=<file>` replaces a variable `NAME`, and `--env` replaces a secret. It is
refused with `usage` for no flag, no difference, taking away what the app lacks, an app at a
`--url`, and on the relay anything but `--memory`, `--cpus` and `--pids`. An image that needs root or a capability is not supported, and neither is rootless
docker. An app that does not start or answer its health check fails with `app_failed`.

An app's address is not a way to pay it. A request made straight to it does not arrive
as a packet through the connector, so it is unpaid work: never do it in place of a payment.

## Create a TOON app: `toon create`

`toon create <name> --app <from> --image <image>` starts a new TOON app: a new connector with its
own identity and keys, and an app behind it. It peers with `<from>` in both directions, each
channel opened with `--deposit`, so it moves money (see above); `--no-peer` creates no peerings
and needs no deposit. It refuses the relay's image with `one_relay`, as `add` does. `--clearnet`
and `--accept-anyone-terms` work as for `init`.
`toon destroy <name>` stops and removes a TOON app, and refuses with `funds_held` while a
channel still holds funds; the last TOON app is never removed.

## Peering

A **peering** is one connector's standing arrangement to forward packets to another, paid on a
channel it opens toward it. Yours alone forwards nothing back: the other connector forwards
back only if its operator creates a peering in return.

- `toon peer add <address> --deposit <n> --yes` peers toward the `/ilp` URL of another connector.
  `--id` labels it, `--fee` is what you keep of each packet forwarded, `--max-packet-amount` caps
  one packet. `peer_not_peerable` means the refusal is on the other side. `--chain evm|solana`
  names the settlement chain; it is needed when both connectors settle on more than one (an
  agent node with `--solana`). Without it the connector refuses, `peer_failed` says to run again
  with `--chain`, and nothing is counted against the limit. `join` and `create --deposit` take it too.
- `toon describe [<ilp-url>]` prints what a connector offers before you pay it: its addresses,
  settlement terms, and each route with its price and the `request` it states, if any, as JSON. With
  `--json` the self-description is unaltered under `description`. Without a URL it describes your
  own connector (`--app` chooses which). It pays nothing, and fails with `describe_failed`.
- `toon peer list` shows the peerings and their labels; `toon peer remove <id>` removes one.
- `toon join <network> --deposit <n> --yes` peers toward the network's own connector and reads
  its relay. The network must be the one `init` was given; it is done once.

## Routes and prices

- `toon route list` shows the routes the connector terminates (to an app) and forwards (to a peer).
- `toon route add <prefix> --peer <id>` forwards an ILP address prefix to a peering. `--price` is
  what a client pays on that route.
- `toon route price <prefix> <price>` sets what a client pays for a packet to an app.
- `toon route remove <prefix>` stops forwarding a prefix.

## Packets

`toon packet count` is free: it needs no passphrase and moves no money. It prints how many packets
the connector fulfilled and rejected, the rejects by RFC-0027 code (`F02`, `T04`), and the fees
earned in the token's base units; `--app` chooses the TOON app. The counts restart with the
connector, so a restart begins again at 0. With `--json` it prints `toon_app`, `packets`
(`fulfilled`, `rejected`), `rejects` and `fees_earned`, a decimal string as other amounts are. It fails with `not_running` when the agent
node is stopped.

`toon packet list` is free as well. It lists the last rejected packets of the connector, newest
first, from its log: each line shows the time, the destination, the reject code and the reject
message. `-n` / `--limit` says how many (20 by default). It works while the agent node is stopped,
and lists rejects from before a restart. Fulfilled packets are not listed, only counted by
`toon packet count`. With `--json` it prints `toon_app` and `packets`, each with `time`,
`destination`, `outcome` (`rejected`), `code` and `message`; `packets` is `[]` when nothing was
rejected.

`toon packet history` is free too. It lists the connector's recent packets, newest first, from its
packet history, fulfilled and rejected alike, where `toon packet list` has only rejects from the
log. A row shows the `time`, the `direction`, the `destination`, `from` (a peering or channel),
`to` (a peering), the `amount`, the `fee` of a fulfilled forward, the `outcome` and, for a reject,
its `code` and `message`. The direction is `delivered` (it ended at one of the connector's apps),
`forwarded` (it arrived from one side and left toward a peer) or `sent` (you originated it); a
packet that expired or could not be routed has none, and any field a row lacks is left out. The
history is recent packets only (1,000) and is forgotten when the connector restarts;
`toon packet count` has the totals. `-n` / `--limit` says how many (20 by default); `--app`
chooses the TOON app. With `--json` it prints `toon_app`, `dropped` (rows the connector could not
keep) and `packets`, `[]` when there are none. It fails with `not_running` when the agent node is
stopped.

## Channels

`toon channel list` shows both directions with collateral and status. `toon channel open --terms
<file> --deposit <n>` opens an outbound channel from the counterparty's `batchSettlements` entry.
`toon channel fund <id> --amount <n>` adds to an outbound channel. `toon channel withdraw <id>`
starts or finishes withdrawing collateral. `toon channel land <id>` lands the latest voucher on an
inbound channel now; its `--json` holds `channel` and `transactions`, each with `chain`, `network`
and `hash`, `[]` when the connector did not report the settlement transaction.

## Relay settings

`toon relay config` shows the relay's settings and prices. With `--name`, `--description`,
`--expiry honour|ignore`, `--block <event-id>` or `--unblock <event-id>` it changes them and restarts
the relay (`--yes`), on the ports it had if they are free, and its connector only if the relay
comes back somewhere else. `toon relay price <amount>` sets the price of one write to the relay's
route. `toon relay describe <ws-url>` is the other direction: it prints what
another relay charges for a write and for its live feed, and whether a peering of this agent node
reaches it. It pays nothing and needs no passphrase or `--yes`.

To sell the relay's live feed ([ADR 0005](https://github.com/toon-protocol/toon_cli/blob/main/docs/adr/0005-a-subscription-is-a-paid-live-feed.md)), `toon relay price --subscribe <amount> --broadcast <amount>`
sets what a subscribe packet costs and credits, on a new route of the connector, and what the relay
debits for each event it broadcasts to a subscriber. The two come together, and a price of `0` stops
selling. `toon relay subscriptions --incoming` asks the running relay who subscribed and what each
has left. The counts are in `toon status` (subscriptions held with a balance and exhausted, and subscriber
keys of its own relay with a balance, or unknown while the relay does not answer), and in `totals` of
`toon relay subscriptions` and of `toon relay subscriptions --incoming` with `--json`.

## Finding out what a connector offers

Before you send anything to a connector that is not yours, find out what it offers. Do it in
this order; the first three steps pay nothing.

1. Read its self-description: `toon describe <ilp-url> --json`, where `<ilp-url>` is the
   connector's `/ilp` URL. It gives the addresses the connector answers to, how it settles and
   its routes. Without a URL it describes your own connector.
2. Read each route's price and its `request`, which says what to send it (method, path and so
   on). The self-description is where a `request` is read: a probe's answer states a cost and
   carries no `request`. A route with no `request` does not say what to send: do not guess a
   method, a path or a body, and tell the operator that the route states none.
3. Probe the path with the real request: `toon probe <address> --seal-to <ilp-url> --method
   <method> --path <path> --body <file> --json`. A probe is a packet that carries nothing by
   default, so it pays nothing. Read `cost` (base units, a string). If `"complete": true` it is the
   path's cost: state it on `toon send --amount`. If `"complete": false` the probe stopped at a
   connector it could not pay and `cost` is the amount to carry to get past that connector, not the
   whole cost: probe again with `--amount <cost> --yes`. A probe with an amount spends it (it is
   counted against the spending limit as a send is), and a probe that is fulfilled has delivered
   the request and paid for it. A route that charges nothing is fulfilled by an amount-0 probe,
   so the app receives the request: a probe that pays nothing can still deliver. A reject with no
   `cost` (no route, a peer that could not be reached and the like) states none; do not guess one.
   Unlike `toon send`, a probe exits 0 when it is rejected with a `cost`, as it is expected to be,
   and when it is fulfilled; it exits 1 on a reject that states no `cost`, on a wrong
   fulfilment and when no answer came.
4. Pay with a request: `toon send <address> --amount <n> --seal-to <ilp-url> --method <method>
   --path <path> --body <file> --yes` (see "Paying an app"). Never call the app on a loopback
   address: that is unpaid work, not a payment.

The price you read in step 2 is that connector's price alone. A connector on the way to it may
charge to forward. Learn the path's cost with the probe of step 3, not by sending the price and
reading a rejected `toon send`. Do not guess an amount, and do not raise the amount step by step
until a send is fulfilled.

If you are the operator publishing an app, declare its `request` when you add it
(`toon add <app> --to <toon-app> --request <file>`, above), so that others can do step 2.

## Sending

`toon send <address> --amount <n> --yes` sends one packet, its body read from the file
`--body <file>` names, and reports fulfilled or rejected. It exits 1 when the packet was rejected, and the reject code is in `reject.code`; `paid` is what it
cost, which for a rejected packet may still be its whole amount; it also exits 1
with `"outcome": "wrong_fulfilment"` when the fulfilment does not match. `--seal-to <url>` seals
the payload to the identity of a connector that is not yours.

`toon event publish --kind <n> --content <text>` signs an event with the agent identity and
writes it to your own relay, which pays nothing out of the wallet and is not counted against the
spending limit; `toon event query <ws-url> --filter <json>` reads a relay. Publishing
to someone else's relay is `toon event publish --relay <ws-url> --yes` and needs a peering that
reaches that relay's connector, or it fails with `peering_needed` and pays nothing. It sends
the relay's price; if a connector in between charges to forward and rejects the write with
`F03`, read `cost` from the rejected packet's report and state it with `--amount <cost>` (below
the relay's price is refused); treat `"complete": false` as a floor, not the whole cost, and do
not raise the amount step by step.
`toon relay subscribe <ws-url> --filter <json> --amount <n> --yes` buys the live feed of another
relay: a prepaid balance at that relay, with one filter, drawn down for each event it sends.
The supervisor writes those events into your own relay ([ADR 0005](https://github.com/toon-protocol/toon_cli/blob/main/docs/adr/0005-a-subscription-is-a-paid-live-feed.md)). It needs a peering too, and
without `--yes` it fails with `not_confirmed` and says what the relay charges. `toon relay
subscriptions` reads the current balance from each relay, and needs no passphrase once
`subscribe` has run; the balance in `toon status` is the last one read, with its time
(`read_at`). To know whether the supervisor receives a subscription, read
`feed` in `toon status --json` (or in `toon relay subscriptions --json`): `state` is `connecting`,
`live`, `retrying` or `exhausted`, `last_event_at` is when your own relay last accepted an event
from it, and `last_error` says what went wrong; `feed` is null when the supervisor is not running.
Do not infer delivery from your own relay holding or lacking an event. It is not the follow list,
which is an event you publish. It is the same as publishing in one way: if a connector in
between rejects its packets with `F03`,
read `cost` from the rejected packet's report (`response.cost`) and state it with
`--packet-amount <cost>`, treating `"complete": false` as a floor; `--amount` stays the total,
paid as whole packets of that amount, and each packet still credits only the subscribe price.

### Private messages

`toon message send <pubkey>... --content <text>` sends a private message from the agent identity
and, like `event publish`, opens the keystore, so it needs the passphrase;
`--relay <ws-url> --yes` sends the recipients' wraps to another relay and pays its price.
`toon message list` is free: it needs no passphrase and reads what the supervisor opened. It
fails with `agent_key_not_kept` on an agent node that keeps no agent secret yet (one made before
the secret was kept, until a command opens the keystore). The `social` skill's
`references/nip-17.md` says what a private message holds, and `sending-with-toon-cli` has the
details of both commands.

### Paying an app

An app you added is used by paying it, not by calling its loopback address, which does the work
unpaid. `toon send <app address> --amount <n> --method <method> --path <path> --body <file> --yes`
carries one request in one paid packet: `--method` is `POST` and `--path` is `/` when absent, and
`--path` is the path and query the app receives. `--body` is a file whose bytes are the body, sent as
`application/json`; with none, there is no body. The report's `response` has the app's status and
body. A body file that cannot be read fails before anything is sent and costs nothing.

When the route's `request` asks for a signed event as the body, sign it without publishing it:
`toon event sign --kind <n> --content <text> --tags <json>` prints an event signed with the agent
identity and sends it nowhere. Without `--json` the output is the event alone, so write it to
the `--body` file; with `--json` it is under `event`. `toon event publish` would also store the
event on your own relay, where others can read it. `event sign` opens the keystore, so it needs
the passphrase; the agent node must exist (`toon init`) and need not be running.

## Tips

`toon tip send <npub|hex> --amount <n> --yes` tips an agent identity that has turned tips on. It
reads the recipient's newest tip route from your own relay, the relay your profile follows and
each `--relay`, checks it against the connector it names, and sends one packet sealed to the key
the tip route pins. It refuses, sending nothing, with `tip_route_not_found`,
`tip_route_not_listed`, `tip_seal_key_mismatch`, `peering_needed` or `tip_below_minimum`; the last
states the least `--amount` that would do. **`--amount` is what you send, not what arrives**: the
connectors on the path keep their fees, so read `sent`, `path_cost` and `arrives_about` from the
report of a fulfilled tip, and treat `path_cost` as a floor when `path_cost_complete` is `false`.
`--for <event id | kind:pubkey:d>` says what the tip is for and can be repeated, `--message <text>`
goes to the recipient, and `--anonymous` asks the recipient not to name you. The packet counts
against the spending limit as `toon send` does, and a rejected packet is reported the same way. A
fulfilled packet means the money arrived, not that the tip counts: the recipient's acknowledgement
is the record, and the `social` skill's `references/tips.md` says how to read it. An agent key needs
its `tip` and `send` scopes, and with one `--relay` answers `needs_home`.

`toon tip enable --minimum <n> --yes` lets others tip this agent identity. The agent node must be
running with the agent secret kept (`agent_key_not_kept` otherwise), and its profile must follow a
relay (`no_profile_relay`). It adds a tip route to the connector of the relay's TOON app, or of the
one `--app` names, and **restarts that connector**, dropping the packets it holds in flight; moving
the route with `--app` restarts the connector it leaves too. It publishes the tip route to your own
relay and the followed relay; the second write is paid within the spending limit. `toon tip disable
--yes` removes the route, restarts the connector and publishes a deletion to the same two relays,
and answers `tips_not_enabled` when tips are off. Run `enable` again to change `--minimum`.

Every tip that arrives is fulfilled and the money stays. The supervisor acknowledges one only when
its receipt is valid, for this identity, in the unit of the chain it arrived on, and not acknowledged
before. Any other is never acknowledged, and only the supervisor's log records it. An
acknowledgement that cannot be published waits and is retried; `agent_node.tips.acknowledgements`
in `toon status --json` has `waiting` and `last_error`.

## Zk edge

`toon zk enable` makes the connector of the first TOON app, or of the one `--app` names, a zk edge.
It needs the passphrase, because it derives the zk edge's state key from the wallet, and it
**restarts that connector**, so it needs `--yes`. Name every setting:

```sh
toon zk enable --vault <B62…> --network mina:devnet \
  --graphql-url <daemon graphql> --archive-url <archive graphql> \
  --tier <nanomina> --open-budget-cap <nanomina> --rate <tokens per MINA> --yes --json
```

- `--tier` is a zk allowance budget in nanomina. Repeat it for more; each must be one zk_toon
  publishes. `--open-budget-cap` is the most all open zk allowances may add up to, which is what
  you risk at once.
- `--zk-allowance-lifetime <seconds>` defaults to 3600 and is at most 43200. `--subsidy-budget
  <nanomina>` defaults to 0, which offers no subsidised zk allowance.
- `--rate` is whole settlement tokens per MINA, such as `0.40` or `2/5`. It is static until the next
  restart, so **declare it below what MINA is worth**: forwarding at a rate above MINA's value pays
  out more than comes in. A TOON app that settles on a chain is refused without it.

`toon` checks the settings with the connector's own validation **before** anything restarts. A
setting the connector refuses, such as a tier zk_toon does not publish or a missing `--rate`,
answers `zk_edge_invalid` with the connector's reason, and nothing changes. A vault the connector
cannot read when it starts fails the restart instead, and the change is rolled back. Run `enable`
again to change the settings, naming every one. The report's `state_key` is the key payers see the
zk edge sign with.

**What `toon` does not run.** Tell whoever handed you the agent node, and do not turn a zk edge on
unless both of these run beside it: a **collector**, without which the zk edge is never paid out of
the vault, and a **challenger** (`zk-toon-challenger`), without which a payer's dishonest escape
keeps money the zk edge already forwarded. Until the zk edge signs mutual-close clearances, its
payers leave the vault only by escape.

`toon zk disable --yes` removes the zk edge settings and restarts the connector, and answers
`zk_edge_not_enabled` when that TOON app is not a zk edge. Zk allowances still open can no longer be
paid there, and their payers leave by escape, which the challenger still has to watch. Paying from a
zk allowance is not something `toon` does: that is the wallet in `toon-client`.

## Backup and restore

- `toon wallet backup --out <file>` seals the mnemonic and every onion endpoint's address key under
  the passphrase. The file must not exist. Keep the passphrase apart from the file.
- `toon wallet restore <file>` recreates the wallet on a machine with no wallet, then `toon init`
  makes the TOON app on the same keys, at the same onion endpoints.
- `toon init --from-mnemonic` restores from a mnemonic alone (`TOON_MNEMONIC_FILE`, else
  `TOON_MNEMONIC`). The hidden service then gets new onion endpoints, because a mnemonic does not
  hold the address keys.

## The hidden service

A new TOON app is a hidden service: its connector listens on loopback only and is reachable at its
onion endpoint, a `.anyone` address, and all its outbound traffic, settlement RPC included, goes
through the overlay. The endpoint is stable across restarts and is restored by a backup. It hides
where the TOON app is reachable, not who it pays: payments are on a public chain. Clearnet is only
for an operator who asks for it with `--clearnet`.

## Installing this skill

`toon skill install` copies the skills shipped in the binary to `~/.claude/skills`, or to the
directory given with `--dir`. It is safe to run again after an upgrade: it replaces what it
installed with the version in the binary.

When a harness cannot open a file beside `SKILL.md`, or an installed copy may be older than the
binary, read the text from the binary: `toon skill list` names each skill and its references, and
`toon skill show <skill>` prints a skill's `SKILL.md`, `toon skill show <skill> <reference>` one
reference. Neither needs an agent node.
