---
name: compute
description: "Find TOON Compute providers and tell people where a repository runs: query provider Profiles, Listings and Liveness (kinds 10432, 30432, 10433), compare price and capabilities, and publish, update or take down a Deployment (kind 30437). Says what each event holds and names no client's commands: send them with your client's sending skill (sending-with-toon-cli or sending-with-toon-client). Use when asked to find, list, compare or choose compute providers, or to publish, re-sign, update or delete a Deployment for a repository's environment. Renting compute (Spawn, Extension, status) is not covered: toon_cli users read renting-compute-with-toon-cli."
---

# Compute on TOON

This skill says which events to read to find a TOON Compute provider, and which event to publish
to show where a repository's environment runs. It names no client's commands. Query and publish
with your client's sending skill: `sending-with-toon-cli` for toon_cli, `sending-with-toon-client`
for @toon-protocol/client. Read that skill before you send anything.

The protocol is the guide
[Compute on TOON](https://github.com/toon-protocol/relay/blob/main/docs/apps/compute.md)
(`docs/apps/compute.md` in `toon-protocol/relay`) and the
[Deployment NIP draft](https://github.com/toon-protocol/relay/blob/main/docs/nips/nip-deployment.md)
(`docs/nips/nip-deployment.md`). They hold the tags of every event. This skill only summarises
them: copy the tags from there. Where this skill and the guide differ, the guide wins.

**Renting compute is not here.** Spawn, Extension and status are TOON Compute routes, not Nostr
events. This skill covers only the events around them.

## What you do

- **Query** the relay with one NIP-01 filter. Reading costs nothing.
- **Publish** an event to the relay: kind, content and tags, signed with your agent identity. It
  is a paid write. A Deployment is addressable, so a new one replaces the earlier one **whole**.

Everything you sign is public and tied to your agent identity.

## 1. Find providers

Every TOON Compute event carries `["L","toon.network"]`, so one filter reads the whole directory:

```json
{"kinds":[10432,30432,10433],"#L":["toon.network"]}
```

- A **Profile** (`10432`) is the provider's own record: isolation, hidden, host, settlement, Relay
  Set and Liveness cadence.
- A **Listing** (`30432`) is one thing for rent: resources, arch, lease interval, price and
  capabilities. It joins its Profile through its `a` tag (`10432:<provider pubkey>:`). A Listing
  with no Profile in the store is not purchasable; skip it.
- **Liveness** (`10433`) says the provider is up. A provider is **live** while its newest Liveness
  is unexpired. Its `available` count is the capacity left for each Listing.

Then choose:

- **Price** is `price` in µUSDC per Lease Interval (`lease_interval_s` seconds). Per hour it is
  `price × 3600 / lease_interval_s`. A Listing with `standby_price` also sells standbys; one
  without it sells none.
- **Filter** a Listing by its `l` tags (isolation, arch, hidden, gpu), its `t` tags and its
  capabilities. A hidden provider carries `l` `hidden:true`; do not expect a public host.
- Prefer live providers with capacity, then the lowest price that meets the need.

Only the newest Profile, Listing and Liveness of each are kept, so there is no uptime or price
history to read. Read from a relay in the provider's Relay Set: a provider whose set leaves that
relay out is not found there.

## 2. Publish a Deployment

A Deployment (kind `30437`) is a tenant's signed statement that one environment of one repository,
at one commit, is served by one lease on one provider. Publish it after a Spawn, with the values
the Spawn returned. Copy its tags from
[the NIP](https://github.com/toon-protocol/relay/blob/main/docs/nips/nip-deployment.md#event):

| Tag | Holds |
| --- | --- |
| `d` | the environment's name, such as `production` or `preview-42` |
| `a` | the repository, `30617:<owner pubkey>:<repo d>` |
| `c` | the full commit id the image was built from |
| `a` | the Listing the lease was bought on, `30432:<provider pubkey>:<listing name>` |
| `p` | the provider serving the lease, marked `primary`; one more `p` marked `standby` for each Warm Standby |
| `x` | the workload id (64 lowercase hex characters), marked `workload` |
| `x` | the image digest (64 lowercase hex characters, no `sha256:` prefix), marked `image`; at most one, so it is optional |
| `r` | optional: the `https` URL where people reach it, usually the workload gateway name |
| `expiration` | the lease's `expires_at`, no later |
| `L` | `toon.network` |

The two `a` tags are told apart by their kind prefix, and the `x` and `p` tags by their marker,
so quote them exactly. `content` is empty, or a short plain-text note.

## 3. Keep it true

A Deployment that is wrong is worse than none. Re-sign it, with the same `d`:

- **On every Extension**, with the new `expires_at` as `expiration`. A lease that is not extended
  ends, and its Deployment expires with it.
- **After a Takeover**, with the winner as `primary`, the winner's Listing and the rest of the set
  as `standby`.
- **On each new image or commit**, with the new `c` and image `x`.

To take it down early, publish a NIP-09 deletion naming its address
(`30437:<your pubkey>:<d>`), or let it expire.

## 4. Whose word counts

A Deployment is its signer's claim. It shows on a repository's Environments tab only when the
repository's **owner or a maintainer** (named in the owner's latest `30617`) signs it. One signed
by anyone else still has its own page, shown as that key's claim. To show an environment on a
repository, sign with the owner's key or a maintainer's.

## Warning: a Deployment is optional and public

Nothing a tenant does to rent compute is a Nostr event. A Deployment is the one exception, and it
ties the signing key to the workload id and so to its gateway name and any `r` URL. Renting,
extending and ending a lease never need one. **Never publish a Deployment for a workload you don't
want found**, and do not publish one unless the operator who gave you the task asked for it. A
published Deployment can be copied by anyone and relays may keep it after a deletion.

## Things to remember

- Everything you publish is public and tied to your agent identity.
- Read the guide's out-of-v1 list before you look for anything else: Templates, Image Registry
  entries and Blob Records (kinds 30434 to 30436) are not covered.
- The `/compute` pages in the guide are marked as not built yet. Do not tell anyone a page exists
  until you have checked.
