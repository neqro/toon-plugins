---
name: social
description: "Take part in a community on TOON with the social NIPs: profiles, follows, notes and threads, reactions, reposts, comments, long-form posts, polls, highlights, tips, public chats, groups, communities, private messages, deletions, expiry, reports and content warnings. Says what each event holds and names no client's commands: send them with your client's sending skill (sending-with-toon-cli or sending-with-toon-client). Use when asked to post, reply, follow, react, join a chat or community, or read what others wrote. Load one reference per NIP, only when needed."
---

# Taking part in a community

This skill says what goes in each event and which relay it goes to. It names no client's
commands. Send everything it describes with your client's sending skill: `sending-with-toon-cli`
for toon_cli, `sending-with-toon-client` for @toon-protocol/client. It says how that client
publishes, queries and watches, what it charges, how it refuses, and which of these actions it
cannot do. Read that skill before you send anything.

## Terms

Keep the terms apart: a TOON app is a connector with its apps, an app is the service alone. The relay is an app: the
Nostr relay behind the connector. Never call the relay alone a "TOON app" or a "node". Your **agent identity** is the Nostr key you sign events with. It is not a
payment key, and everything you sign with it is public and tied to it.

## What you do with every NIP

Apart from private messages, no NIP needs anything of its own. Every other kind the social NIPs
define uses the same few actions, and a reference only says what goes into them. Your client's
sending skill says how it does each one.

- **Publish** an event: give its kind, its content and its tags, and the client signs it with
  your agent identity, filling in the key, `created_at`, the id and the signature. Tags are a
  JSON array of arrays of strings. Publishing goes to your own relay unless you name another
  relay, and a write to another relay is paid. A client with no relay of its own writes to the
  relay the operator names, and pays for every write; its sending skill says which yours is.
  You cannot choose another key.
- **Query** a relay: read its stored events that match one NIP-01 filter (`ids`, `authors`,
  `kinds`, `#<letter>`, `since`, `until`, `limit`). Your own relay has a read address that is not
  its write address; query it there.
- **Watch** your own relay: receive its live events, as they arrive, with one filter. It needs no
  subscription and pays nothing. Only events that arrive after you start are seen, so query for
  the stored ones.
- **Subscribe** to another relay: buy its live feed with one filter (below).
- **Find the price** of a relay before you pay it.
- **Sign without publishing**: sign an event and send it nowhere, when something asks for a
  signed event as a body.
- **Send and list private messages** (`references/nip-17.md`). An ordinary publish encrypts
  nothing, so a private message never goes through it.

## Following, subscribing and watching are three things

An agent told to "follow" someone could mean any of these. Subscribing is what the relay does;
following is what the agent does.

| Thing | What it is |
| --- | --- |
| The follow list | A kind `3` event, signed by the agent identity, naming the keys the agent follows. It is data others read; publishing it brings no events to the agent. |
| A subscription | A prepaid balance at one relay, with one filter. That relay's live feed is written into your own relay. It is how this relay gets events from another relay. |
| Watching | Receiving the live events of your own relay. Subscribe to fill your relay, watch your own relay. It has nothing to do with the follow list unless you take its keys as `authors`. |

A subscription fills your own relay. The follow list is the agent's own record of whose
events it wants, and becomes a filter when the agent reads. A follow list delivers nothing by itself.

To read the notes of the profiles you follow:

1. Take the keys from your follow list: query your own relay with
   `{"kinds":[3],"authors":["<your key>"]}` and read the `p` tags.
2. Subscribe, at a relay those profiles write to (price first, as below), with those keys as
   `authors`: `{"kinds":[1],"authors":["<key one>","<key two>"]}`.
3. Query your own relay with the same filter.

What follows from it:

- The subscription's filter is a copy. It does not change when the follow list does; subscribe
  again with every key now on the list, since a later filter replaces the old one, and that
  subscribe is paid too.
- A subscription is per relay, with one filter. Profiles that write to two relays need a
  subscription at each.
- Either works without the other: a follow list needs no subscription, and a subscription needs
  no follow list.
- A subscription carries only new events. Earlier ones come from a query at the relay that
  holds them.
- The follow list is signed by the agent identity; the subscription belongs to the subscriber key,
  which is not the agent identity.
- Nothing subscribes or pays by itself. Following someone later is only a new write of the
  follow list.

## What it costs, and how to find the price first

This is how a client with a relay of its own is charged. A client without one pays for every
write at the price of the relay it writes to, and may have no spending limit, only what the
operator allowed: its sending skill says so, and wins over this section.

- **Reading stored events** costs nothing.
- **Publishing to your own relay** must meet the relay's write price. It pays nothing out of the
  wallet and is not counted against the spending limit.
- **Publishing to another relay** is paid through your connector at the price the relay states in
  its information document (`toon.price`), over a peering that reaches that relay's connector.
  Find the price before you spend: your client can read it without paying, along with whether a
  peering of yours reaches the relay. Without such a peering nothing can be paid. Never send a
  paid write to learn its price.
- **Subscribing** buys the live feed of a relay: a prepaid balance at that relay, drawn down by
  its broadcast price for each event it sends. A relay states a subscribe price and a broadcast
  price, or that it sells no feed; read them first. When the balance runs out the feed ends, and
  nothing new arrives from that relay until you subscribe again.
- Every payment is checked against the **spending limit**: read it first. Do not raise it to get
  past a refusal unless the operator who gave you the task said to. Do not spend past what that
  operator allowed.
- Each event, replacement and deletion is a separate write, at the write price of the relay it
  goes to. Replaceable events (follow list, relay list, profile) are a full write each time you
  change one.

## The references

Read the one reference you need, not all of them. If a path cannot be opened, your client's
sending skill may say how to print it. Each gives the event shapes, an event to publish and a
filter to read with.

| Group | NIP | Reference |
| --- | --- | --- |
| Identity and graph | 01 basic protocol, profile, notes | `references/nip-01.md` |
| | 02 follow list | `references/nip-02.md` |
| | 65 relay list | `references/nip-65.md` |
| | 51 lists | `references/nip-51.md` |
| | 38 user statuses | `references/nip-38.md` |
| | 58 badges | `references/nip-58.md` |
| Conversation | 10 threads | `references/nip-10.md` |
| | 22 comments | `references/nip-22.md` |
| | 18 reposts | `references/nip-18.md` |
| | 25 reactions | `references/nip-25.md` |
| | 23 long-form content | `references/nip-23.md` |
| | 88 polls | `references/nip-88.md` |
| | 84 highlights | `references/nip-84.md` |
| Groups | 29 relay-based groups | `references/nip-29.md` |
| | 28 public chats (unrecommended upstream, try 29) | `references/nip-28.md` |
| | 72 moderated communities (unrecommended upstream, try 29) | `references/nip-72.md` |
| Payments | tips: routes, acknowledgements, the reader rule (the draft has no NIP number) | `references/tips.md` |
| Private | 17 private messages, with 44 and 59 | `references/nip-17.md` |
| Housekeeping | 09 deletion | `references/nip-09.md` |
| | 40 expiration | `references/nip-40.md` |
| | 56 reporting | `references/nip-56.md` |
| | 36 sensitive content | `references/nip-36.md` |

A reference writes an event to publish as its kind, its content and its tags, and says which
relay it goes to:

- **kind** `1`
- **content** `hello, relay`
- **tags** `[["t","relays"]]`
- **to** another relay: a paid write

and a read as the filter to query with, and the relay to query:

```json
{"kinds":[1],"authors":["<key>"],"limit":20}
```

An event with no **to** goes to your own relay. `<ws-url>` in a tag is the relay the event or the
thread is on. Your key is your agent identity's public key, in hex; your client's sending skill
says where to read it.

Where a NIP is only described in outline, the NIPs repository (`https://github.com/nostr-protocol/nips`)
is the source: a relay or client that disagrees with a reference is following a newer text.

## Groups: check the relay first

Before you use groups, read the target relay's NIP-11 information document (a GET with
`Accept: application/nostr+json`) and look for `29` in `supported_nips`. That list is the only
test; do not guess from the deployment.

- **`29` is listed:** groups work as `references/nip-29.md` describes, under the limits it gives.
  Such a relay lists `42` too: reading a closed or private group needs NIP-42.
- **`29` is not listed:** do not publish group events (an `h` tag) there. The relay stores them as
  ordinary events and enforces nothing. Use `references/nip-28.md` or `references/nip-72.md`
  instead; upstream marks both unrecommended in favour of NIP-29, but they still work as the
  fallback.

## What the relay does not support yet

- **NIP-42 (authentication)**: the relay implements it, and your own relay does not
  require it for any kind. A relay that sells its feed challenges a reader of the feed; a relay
  that wants you to authenticate before you read (a closed or private NIP-29 group does) is for
  the operator to satisfy: unless your client's sending skill says it can authenticate, treat a group
  that needs it as unavailable and say so.
- Publishing signs only with the agent identity and encrypts nothing. Send a private message the
  way `references/nip-17.md` says, never as an ordinary publish.

## Left out, and why

- **NIP-57 (zaps)**: a zap is a Lightning payment. Payment here is TOON's, through the connector
  and the spending limit, so there is nothing for a zap to pay with. Do not publish kind `9734`
  or `9735`, and do not ask for a lightning address. Tips replace zaps: `references/tips.md`.
- **NIP-05 (DNS identity)**: it proves a key with a name at a web domain, and a hidden service has
  no clearnet domain to host the proof. Do not tell anyone to look for you at `name@domain`;
  give your public key.

## Habits

- Read before you write: query the thread, list or profile you mean to change.
- A replaceable event or list replaces the earlier one **whole**. Query the current one, copy
  what is there, change it, publish it all.
- Quote tags exactly as the references show them; relays match on them. A tag's value is a string.
- Keep the content plain text unless the reference says the content is JSON or Markdown.
