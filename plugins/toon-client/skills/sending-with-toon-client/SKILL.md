---
name: sending-with-toon-client
description: "Pay for Nostr writes with @toon-protocol/client's `toon-client` binary: find a relay's write route and price, open and fund the payment channel, send a signed event to the relay as one paid request, read the answer, send a private message, upload a blob to a TOON Blossom server, and pay a relay's subscribe route. Signing, sealing and reading are done with a Nostr tool such as nak, since toon-client holds no Nostr key. The sending skill the data skills (social, authoring-a-nip, git, compute) hand off to. Use whenever a data skill says to send something with your client's sending skill and your client is toon-client. Run toon-client --version first."
toon-client: ">=5.0.0, <6"
---

# Sending with toon-client

The data skills (`social`, `authoring-a-nip`, `git`, `compute`) say what goes in an event and which
relay it goes to, and name no client. This skill says how `toon-client`, the binary of
[@toon-protocol/client](https://github.com/toon-protocol/toon-client), does each thing they ask
for. It says nothing about what an event holds: that is the data skill's.

## First, check the version

This skill covers the `@toon-protocol/client` versions in its `toon-client` field above. Before
anything else run:

```
toon-client --version
```

It prints the version alone, such as `5.1.0`. If the version is outside that range, or the
command is missing, stop: do not run the commands below, and tell the operator which version you
found and which this skill covers. `toon` is not this client: it is the Rust binary of
`toon_cli`, whose sending skill is `sending-with-toon-cli`. If a command here is then missing
from `toon-client help`, trust `help`.

Every option, setting and exit code is in the
[CLI reference](https://github.com/toon-protocol/toon-client/blob/main/docs/cli.md) and in
`toon-client help <command>`. Pass `--json` to read a result as one document on stdout, and
`--quiet` to keep stderr to errors.

## What toon-client does, and what it does not

`toon-client` pays for one HTTP request at a time, through a connector, from a payment channel.
A relay write is such a request. It holds **no Nostr key**: its keystore holds payment keys only.
So, unlike what the data skills assume of a client:

- **It does not sign.** Sign each event with your agent identity in a Nostr tool, filling in
  `pubkey`, `created_at`, `id` and `sig` (NIP-01), then send the signed event. The examples here
  use [nak](https://github.com/fiatjaf/nak) ("Signing and reading with nak", below); any tool
  that prints a signed NIP-01 event will do. If you hold no agent identity, stop and tell the
  operator: you cannot publish. `toon-client identity` shows payment addresses, never your agent
  identity's key.
- **It does not read relays.** Querying and watching are free NIP-01 reads over WebSocket, at
  the relay's read URL. Use nak or any Nostr client for them; `toon-client` has no command for
  either.
- **It has no relay of its own.** An event with no **to** goes to the relay the operator told you
  to write to. Every write is paid, at that relay's write price. Wherever a data skill or
  reference says *your own relay*, read *the relay the operator named*. It is still another
  relay in every other sense: it may serve what you write to anyone.
- **It does not seal or authenticate.** nak does: a private message (NIP-17) is sealed and
  wrapped with `nak gift wrap`, and the wrap is sent like any other event ("Private messages",
  below). Private list items (NIP-51) are not covered here. A read that needs NIP-42 `AUTH`
  takes `nak req --auth` (below); a relay that wants `AUTH` before a write cannot be written to
  through a connector, so report it as unavailable.
- **It has no spending limit.** What a channel holds is what can be spent from it, so keep your
  own count against what the operator allowed: each `send --json` reports `claim.amount` (this
  payment) and `claim.cumulative` (everything signed on the channel so far). Where a data skill
  says to read the spending limit, read the operator's allowance and `channel status` instead.
  Opening or topping up a channel locks the operator's funds, and `transfer` moves them out: run
  them only when the operator who gave you the task said to.

## The actions, and their commands

`<ilp-address>` and `<connector-url>` are the relay's, from its NIP-11 document (below). Pass
the same `--connector` to every command that talks to the connector: without it, a command falls back to the devnet
connector, with a warning.

| What you need | How |
| --- | --- |
| Find where a relay's writes are paid for | the relay's NIP-11 document (below) |
| Find a relay's price | `toon-client price <ilp-address> --connector <connector-url>` |
| Read a connector's routes and prices | `toon-client describe <connector-url>` |
| Publish a signed event (paid) | `toon-client send <ilp-address> --connector <connector-url> --json-body --body-file <file>` |
| Pay a relay's subscribe route | `toon-client send <subscribe-address> --connector <connector-url> -H 'Authorization: Nostr <nip-98>' --json-body --body <json>` |
| Sign an event, without publishing it | `nak event`, with the event on stdin (below) |
| Query a relay | `nak req <ws-url>`, with the filter on stdin (below) |
| Watch a relay | `nak req --stream <ws-url>`, with the filter on stdin (below) |
| Your key | `echo '{}' \| nak event \| jq -r .pubkey` |
| Send a private message (paid, one write per wrap) | `nak gift wrap`, then `toon-client send` ("Private messages", below) |
| Read your private messages | `nak req --auth <ws-url>`, then `nak gift unwrap` (below) |
| Upload a blob to a TOON Blossom server (paid) | `toon-client send <upload-address> --connector <connector-url> --method PUT -H 'Authorization: Nostr <kind 24242>' --body-file <file>` ("Uploading to a Blossom server", below) |
| Open the payment channel | `toon-client channel open --connector <connector-url> --deposit <base units>` |
| Top up the channel (Base) | `toon-client channel deposit <base units> --connector <connector-url>` |
| Read what the channel holds and what you have signed | `toon-client channel status --connector <connector-url>` |
| Read what the connector has claimed | `toon-client claim-state --connector <connector-url>` |
| Learn a path's cost, paying nothing | `toon-client probe <ilp-address> --connector <connector-url>` |
| Read the chain balances | `toon-client balances` |
| Create or import the keystore (the operator's) | `toon-client init` |

## Where a relay's writes are paid for

A relay states it in its NIP-11 document. `GET` the relay's URL, as `https://`, with the header
`Accept: application/nostr+json`. Its `toon` object holds:

- `ilp_address`: the destination a write is sent to, such as `g.toon.relay`.
- `connector_url`: the connector that takes the payment, such as `https://toonprotocol.dev/ilp`.
- `price`: the write price, in the settlement token's base units.

Send to that connector with `--connector`: it is where the route ends.
`toon-client price <ilp-address> --connector <connector-url>` confirms the price for free, and
`toon-client describe <connector-url>` lists every route the connector serves and what each
costs. Neither needs a key or a channel. A relay with no `toon` object does not say where a
write is paid for: tell the operator.

- **Reading is free and goes to the same host.** The relay's read address is its URL as
  `wss://` (for `https://relay.toonprotocol.dev`, `wss://relay.toonprotocol.dev`). Only writes go
  through the connector.
- **What one send costs.** A route lists `price`, and may list `pricePerKib`; only `--json`
  shows `pricePerKib` (`toon-client describe <connector-url> --json`, or
  `toon-client price <ilp-address> --connector <connector-url> --json`). One send costs
  `price + pricePerKib × ⌈bytes / 1024⌉`, where the bytes are the whole HTTP request the packet
  carries: the body **and** its headers, so a long `Authorization` header counts, plus a few
  hundred bytes the client adds. To bound a budget, count one KiB more than the body and your
  headers fill. A route with no
  `pricePerKib` (a relay's write route) is flat: every event costs `price`, whatever its size.
- **A route may name its carriage.** `describe` shows `requiredTransport` (and NIP-11 shows
  `carriage`), such as `btp` for a relay's writes. The default `--transport auto` honours it;
  leave it.

## Paying for writes: the channel

`toon-client send` pays from a channel with the connector and never opens one by itself. The
first send to a connector you hold no channel with exits `4` and says to open one.

```
toon-client channel open --connector https://toonprotocol.dev/ilp --deposit 100000
```

- `--deposit` is in the token's base units: `100000` is 0.10 USDC. Opening costs no gas.
- `toon-client channel status` shows each channel's `depositTotal` and what you have `signed`;
  what is left is the one less the other. `toon-client claim-state` shows it directly, as
  `available`. When it runs out, sends exit `4` again; `toon-client channel deposit <base units>` tops
  up a Base channel, and a Solana channel is replaced by a fresh one on the next payment.
- On the devnet, `toon-client faucet` drips test funds onto this keystore's address;
  `toon-client balances` shows what the wallet holds.
- `toon-client claim-state` shows the connector's own watermark for your channels, and works
  when a channel has run dry: read it when a refusal says your voucher and the connector's
  record disagree. `toon-client probe <ilp-address>` learns a path's cost on a channel you have
  already paid on, and moves no value.
- Leaving a channel (`toon-client channel close`, then `toon-client channel settle` once its
  window has passed) costs native gas. It is the operator's decision, not a data skill's.

Every command that pays needs the operator's payment keys: `TOON_MNEMONIC` when the operator has
set it, else the keystore (`TOON_KEYSTORE`, default `~/.toon/keystore.json`). With neither it
exits `2` and says to run `toon-client init`: setting one up is the operator's, so tell them. A
keystore needs its password: with no terminal to prompt on, give it with
`--password-file <path>` or `TOON_KEYSTORE_PASSWORD`, or the command exits `2` saying so.
`TOON_CHANNEL_STORE` (default `~/.toon/channels.json`) is where your signed total for each
channel is kept: keep it, or the client loses count of what it has signed.

## Signing and reading with nak

nak signs with the secret key in `NOSTR_SECRET_KEY`: a hex or `nsec` key, or a bunker URL. That
key is your agent identity, and the operator gives it to you. An `ncryptsec` asks for its
password on a terminal, which a tool with no terminal cannot answer: ask the operator for
another form.

- Check that `NOSTR_SECRET_KEY` is set before you sign anything. Without it nak signs with a
  default key of its own, specific to the machine, and the event is tied to that key instead. If
  it is not set, stop and tell the operator.
- Never pass the key as an argument (`--sec <key>`): arguments are kept in shell history and are
  readable in `ps` by everyone on the machine.
- Your key, the public half in hex, is the `pubkey` of an event nak signs:
  `echo '{}' | nak event | jq -r .pubkey`. The event is printed, not published.

Give `nak event` the data skill's **kind**, **content** and **tags** as a partial event on stdin.
It fills in `pubkey`, `created_at` and `id`, signs, and prints the signed event:

```
echo '{"kind":7,"content":"+","tags":[["e","<id>","<ws-url>","<author>"],["p","<author>"],["k","1"]]}' | nak event
```

Do not give `nak event` a relay URL. It would publish the event itself, unpaid, over WebSocket,
and a TOON relay takes writes only through its connector.

Query with the data skill's filter on stdin and the relay's `wss://` URL. It prints one event a
line and returns at the end of the stored events:

```
echo '{"kinds":[1],"authors":["<key>"],"limit":20}' | nak req <ws-url> 2>/dev/null
```

nak writes progress (`connecting to … ok.`) to stderr: keep stderr out of anything that parses
its output.

A relay that answers `auth-required:` wants NIP-42 `AUTH` first: add `--auth`, and nak answers
the challenge with your agent identity.

`nak req --stream` keeps the subscription open and prints live events as they arrive, until it
is interrupted. It does not return, so a tool with no timeout hangs on it: to read for a bounded
time, query with `since` in the filter as often as you need.

## Publishing

A data skill gives an event as its **kind**, its **content** and its **tags**, and a **to** when
it names a relay. Sign it with your agent identity, then send the relay the body
`{"event": <the signed event>}`:

```
toon-client send g.toon.relay --connector https://toonprotocol.dev/ilp --json-body --body-file write.json --json
```

where `write.json` holds:

```json
{"event":{"id":"<id>","pubkey":"<key>","created_at":1761130000,"kind":1,"tags":[["t","relays"]],"content":"hello, relay","sig":"<sig>"}}
```

Or sign and send in one pipeline, wrapping the signed event with `jq`:

```
echo '{"kind":1,"content":"hello, relay","tags":[["t","relays"]]}' \
  | nak event \
  | jq -c '{event: .}' \
  | toon-client send g.toon.relay --connector https://toonprotocol.dev/ilp --json-body --body - --json
```

- `--body-file` sends the file's bytes as they are; `--body '<json>'` or `--body -` (stdin) do
  the same. `--json-body` checks the body is JSON and sends it as `application/json`. The method
  defaults to `POST` and the path to the route's handler, which is the relay's write: leave both.
- The price is the route's, read from the connector. Leave `--amount` out.
- Each event is one send, and one payment. A replaceable event (profile, follow list, relay list)
  is a full write each time it changes.

## Reading the answer

The status `toon-client send` prints is **the relay's own**, and it is paid for whatever it is.
With `--json`, `fulfilled` is `true`, `status` is the relay's HTTP status and `text` its body
(`body` is the same bytes in base64):

| `status` | The relay's `text` | Meaning |
| --- | --- | --- |
| `200` | `{"eventId":…,"storedAt":…,"payment":…}` | Accepted. Also the answer when the relay already held the event, holds a newer one at the same address, or refuses it unseen (the operator blocked or retracted it) |
| `400` | `{"error":…}` | The body is not JSON, or has no `event` |
| `422` | `{"error":…}` | The event does not parse, or does not verify: a wrong `id` or `sig` |
| `501` | `{"error":…}` | The relay does not store that kind yet |
| other `4xx` | `{"error":…}` | A NIP-29 group refused the event; the `error` says why |
| `500` | `{"error":…}` | The relay could not store it |

Every one of these cost the write price, and only a `200` was accepted. Check the id and signature before you
send, and fix the event rather than resending it.

When the exit code is not `0`, the relay gave no answer:

| Exit | Meaning | What to do |
| --- | --- | --- |
| `1` | An unexpected error | Report it to the operator with the message |
| `2` | A usage mistake, or a setting it could not resolve | Read the message; it names the flag or setting |
| `3` | The packet was refused short of the relay (`fulfilled: false`) | `code` in the JSON says which refusal; the message says what to do |
| `4` | No channel, or not enough in it | `toon-client channel status`, then ask the operator before you open or top up |
| `5` | The connector or network failed | Query the relay for the event's id before you send it again: it may have arrived |
| `6` | Payment or another carriage is required | If the message names a carriage, run again with `--transport <it>` |

Branch on the exit code and the refusal's `code`, not on the message. The codes are in
[errors.md](https://github.com/toon-protocol/toon-client/blob/main/docs/errors.md).

## NIP drafts

`toon-client` has no draft command: fetch the
[template](https://raw.githubusercontent.com/toon-protocol/toon_cli/main/nips/TEMPLATE.md), write
the file from it, then derive the kind `30817` event yourself, as steps 2 and 3 of
`authoring-a-nip` say. This bash script builds the unsigned event in `draft.json` from
`<identifier>.md`. It asks the relay for the current revision first, stops on a file that is not
a draft or on a title that differs from the current revision's, and adds the topics you give:

```
set -e; f=<identifier>.md; relay=<ws-url>; topics='["<topic>"]'; renamed=no
id=$(basename "$f" .md); title=$(head -n1 "$f" | sed -n 's/^# //p'); key=$(echo '{}' | nak event | jq -r .pubkey)
[[ $id =~ ^[a-z0-9-]{1,64}$ ]] && [ -n "$title" ] && iconv -f UTF-8 -t UTF-8 "$f" >/dev/null \
  || { echo "refuse: the name, the '# ' title or the UTF-8 of $f"; exit 1; }
current=$(echo "{\"kinds\":[30817],\"authors\":[\"$key\"],\"#d\":[\"$id\"]}" \
  | nak req "$relay" 2>/dev/null | jq -s 'sort_by(.created_at, (.id | explode | map(-.))) | last')
prev=$(jq -r '.created_at // 0' <<<"$current"); was=$(jq -r '.tags[]? | select(.[0]=="title") | .[1]' <<<"$current")
[ -z "$was" ] || [ "$was" = "$title" ] || [ "$renamed" = yes ] \
  || { echo "refuse: the relay holds $id under the title '$was'"; exit 1; }
summary=$(awk 'p && /^[[:space:]]*$/ { if (s != "") exit; next } p { s = s (s ? " " : "") $0 }
  /^`draft`/ { p = 1 } END { if (s !~ /^<!--/) print s }' "$f")
kinds=$(awk '/^## / { k = ($0 == "## Kinds") } k && /This draft[[:space:]]*\|[[:space:]]*$/ {
  split($0, c, "|"); gsub(/[`[:space:]]/, "", c[2]); gsub(/^[[:space:]]+|[[:space:]]+$/, "", c[3]); print c[2] "\t" c[3] }' "$f")
now=$(date +%s); at=$(( now > prev ? now : prev + 1 ))
jq -n --rawfile content "$f" --arg d "$id" --arg title "$title" --arg summary "$summary" \
  --arg kinds "$kinds" --argjson at "$at" --argjson topics "$topics" '{kind: 30817, created_at: $at,
  content: $content, tags: ([["d", $d], ["title", $title]]
    + ($kinds | split("\n") | map(select(. != "") | split("\t") | ["k", .[0], .[1]]))
    + (if $summary == "" then [] else [["summary", $summary]] end)
    + ($topics | map(["t", .])))}' > draft.json
```

- A refusal over the title means the identifier belongs to another draft: choose another. Set
  `renamed=yes` only when you did change the title of your own draft.
- `nak event` keeps the `created_at` it is given, so the revision rule holds:
  `nak event < draft.json | jq -c '{event: .}'`, then send it as above.
- Comments, approvals and deletion requests on a draft are ordinary events, published the same
  way.

## Private messages

A private message (NIP-17) is a kind `14` that is never published as it is. nak seals it to the
recipient and wraps it under a one-time key, and the wrap (kind `1059`) is what you send. The
`social` skill's `references/nip-17.md` says what the message holds and where the wraps go.

1. Write the kind `14` with `nak event`, which prints it and sends it nowhere:

   ```
   echo '{"kind":14,"content":"hi","tags":[["p","<recipient>"]]}' | nak event > message.json
   ```

2. Wrap it once for each recipient, and once for yourself so you keep a copy. Each wrap is one
   paid write:

   ```
   for to in <recipient> <your key>; do
     nak gift wrap -p "$to" < message.json \
       | jq -c '{event: .}' \
       | toon-client send <ilp-address> --connector <connector-url> --json-body --body - --json
   done
   ```

   `nak gift wrap` seals with your agent identity (`NOSTR_SECRET_KEY`) and signs the wrap with a
   fresh key, so the relay sees neither the sender nor the text. It notes on stderr which keys it
   used.

   Before the first wrap, check that the relay keeps wraps private, as `references/nip-17.md`
   says: `echo '{"kinds":[1059],"limit":1}' | nak req <ws-url>`, with no `--auth`. If it returns
   a wrap rather than `auth-required:`, anyone can see who you message, and when: tell the
   operator before you send.

3. Read yours: query for wraps addressed to you, with `AUTH`, since a relay may serve a wrap only
   to the key it is addressed to, and open them:

   ```
   echo '{"kinds":[1059],"#p":["<your key>"]}' | nak req --auth <ws-url> 2>/dev/null | nak gift unwrap
   ```

   Each line out is a message: its `pubkey` is the sender, read from inside the seal.

Never send the kind `14` itself, or a kind `4`: either would be public.

## Uploading to a Blossom server

A TOON Blossom server takes an upload only as a paid request through a connector. A `PUT /upload`
sent straight to the server is refused with `403` (`uploads go through TOON`). Reads
(`GET` or `HEAD /<sha256>`) and the free preflight `HEAD /upload` go straight to the server over
`https`, with no payment.

1. **Find the upload route.** The server does not say which connector sells its uploads. Read
   `toon-client describe <connector-url>`, for the connector the operator named or else the
   connector of the relay you write to. Then look for a route ending in `.blossom.upload` (on
   the devnet, `g.toon.blossom.upload` at `https://toonprotocol.dev/ilp`). If there is none,
   tell the operator and upload nothing.
2. **Sign the authorization** (kind `24242`), as the data skill says, and encode it as unpadded
   base64url. It goes in the header and is never published:

   ```
   AUTH=$(echo '{"kind":24242,"content":"Upload <name>","tags":[["t","upload"],["x","<blob id>"],["expiration","<unix time>"]]}' \
     | nak event | base64 -w0 | tr '+/' '-_' | tr -d '=')
   ```

3. **Send the bytes**, as they are:

   ```
   toon-client send g.toon.blossom.upload --connector https://toonprotocol.dev/ilp --method PUT \
     -H "Authorization: Nostr $AUTH" -H 'X-SHA-256: <blob id>' -H 'Content-Type: application/octet-stream' \
     --body-file <file> --json
   ```

   - Leave out `--json-body`: the body is the raw bytes.
   - `status` `201` is accepted. The `text` is the blob descriptor; check that its `sha256` is
     your blob id.
   - A `4xx` is the server's refusal, paid like any answer. The `text` says why: an
     authorization with no matching `x`, an expired authorization, a hash that does not match.

- **Cost.** Each upload costs the route's `price` plus `pricePerKib` for each started KiB of the
  whole request, and the `Authorization` header counts. One blob id per authorization keeps the
  header small. An authorization that lists many `x` tags is paid for again on every upload that
  carries it.
- **Renewing.** Uploading identical bytes again is a new paid upload. On a TOON Blossom server it
  extends what you hold: see the server's own rules for how long.

## A relay's paid live feed

Stored reads are free. A relay that sells its live feed lists `toon_subscription` in its NIP-11
document, with the subscribe route's address and price. `toon-client` can pay that route: send
`{"filter": <one NIP-01 filter>}` to its address, with a NIP-98 `Authorization` header signed by
your agent identity, and each packet credits the route's price to that key. Reading the feed
then needs NIP-42 `AUTH` with the same key: `nak req --auth --stream <ws-url>`. nak also signs
the NIP-98 event (kind `27235`) for the header; the relay's
[paid-feed](https://github.com/toon-protocol/relay/blob/main/docs/paid-feed.md) page says what it
is signed over, and has each step. If you cannot build the header, report the feed as
unavailable.
