---
name: renting-compute-with-toon-cli
description: "Rent TOON Compute for a task with toon_cli's `toon compute`: choose a Listing, cap the spend, spawn a workload from a pinned image, extend the prepaid lease while the task runs, terminate it when the task ends, keep the lease's root secret, and report what was spent. Use when asked to rent, run or deploy a workload (an image) on TOON Compute, or to extend, check or end such a lease. Finding providers and publishing a Deployment event are the `compute` data skill's. Run toon --version first."
toon_cli: ">=0.5, <0.6"
---

# Renting compute with toon_cli

This skill says how `toon compute` rents TOON Compute and runs a workload on it. It does not say
how to find or compare providers, or what a Deployment event holds: that is the `compute` data
skill's. For what every `toon` command shares (`--json`, exit codes, `--yes`, the passphrase, the
spending limit) read `operating-an-agent-node`; for the other things `toon` sends, read
`sending-with-toon-cli`. Run `toon --version` first, as that skill says. If it is outside
`>=0.5, <0.6`, stop and tell the operator.

Pass `--json` to read a result as one document, and branch on `error.code`, not on the message.
If a flag here is missing from `toon compute <command> --help`, trust `--help`.

## The cost rule

- A lease is **prepaid**, per Lease Interval, **up front**. Nothing runs in the background and
  nothing extends by itself.
- **Nothing is refunded**, not even the time left when you run `terminate`.
- A provider bills a wrong-shape body or an error answer all the same. `lease_refused` marks the
  lease file `failed` and names the amount that was paid.
- Everything you pay counts against the cap, the spending limit (`toon limit show`) and your
  agent key's limit. `toon` refuses before sending when a payment would pass one.

## 1. Read the request

Get each of these from the operator's request, and ask for what is missing (or use what you
control) rather than guessing:

- **The Listing**: an `naddr` or `30432:<pubkey>:<d>`. With none given, use the `compute` data
  skill to find and choose one (the cheapest live Listing whose resources, arch and capabilities
  fit). Don't restate its rules here.
- **The image**, pinned by digest: `<repo>@sha256:<hex>`, or `sha256:<hex>` with
  `--registry-entry`. A tag is refused (`image_not_pinned`): resolve it to its digest first, or
  ask.
- **Ports, env, entrypoint and args**, and `--volume-gb` if it needs a volume.
- **The SSH key**: `spawn` requires `--ssh-key`. Use the one the operator gives you, or one you
  make and control. Pass the public key.
- **How long**, and **the cap** in base units (µUSDC for USDC).

A Listing's resources are fixed, so "how much compute" means which Listing, and "for how long"
means how many Lease Intervals.

## 2. Choose the duration and the cap

`--for <duration>` rounds up to whole intervals and prints the count and the total before paying.
`--intervals <n>` is the explicit form. The cap is `--max <base units>`: the lease limit over
everything the lease pays, extends included. Check that the total fits the cap before you spend.
Keep the free availability check `spawn` makes first: never pass `--no-check`.

## 3. Spawn

```
toon compute spawn <listing> --image <repo>@sha256:<hex> --ssh-key <public-key> \
  --port <n> --env NAME=value --max <base-units> --for 2h --yes
```

`--port`, `--env`, `--entrypoint`, `--arg` and `--volume-gb` are optional. On success note the
workload id, `expires_at` and the `access` details.

- A **Warm Standby** is `--standby <listing>`, repeatable, for a Listing that has a
  `standby_price`. Every total and limit counts every member. Add one only when asked.
- If the error is `lease_partly_paid`, the message and the lease file say what was bought and the
  real `expires_at`. `toon` never retries a paid route by itself: decide whether to extend, and
  do not simply run `spawn` again.
- Other errors you may meet: `lease_limit`, `listing_not_found`, `lease_refused`,
  `deployment_refused`.

## 4. While the task runs

```
toon compute status <workload>
toon compute extend <workload> --intervals <n> --yes
toon compute list --check
```

`status` is free. Read it, and **before `expires_at`** run `extend` for as many intervals as the
task still needs (`--max` changes the limit). **Never extend once the task is done.** `list`
shows the leases held here; `--check` asks the provider about each.

## 5. When the task ends

```
toon compute terminate <workload> --yes
```

It ends the workload. The unused time is not refunded, so do it as soon as the task is done and
don't extend first.

## 6. Keep the root secret

The lease's root secret lives in its lease file (toon_cli ADR 0015), in the home's `leases/` or
in `leases/` beside the agent key file. **Never print it or copy it into chat, logs or a
commit.**

- With a home, `toon wallet backup` seals the lease files with the wallet.
- With an agent key, no backup holds the leases: tell the holder to back up the directory beside
  the key.
- **Never run `toon compute forget` on a lease that may still be live.** It drops the secret, and
  then nobody can read, extend or end the lease. Forget only a lease that has ended or `failed`.
- `toon compute rotate <workload>` replaces the access token. Run it again on
  `rotation_incomplete`.

## 7. A Deployment, only when asked

`--deployment <environment>` with `--repo`, `--commit` and `--url` publishes the lease's
Deployment (kind 30437) after the spawn and again on each `extend`. Use it **only when the
operator asked for one**. A Deployment is public and ties your key to the workload: read the
warning in the `compute` data skill first. A failed publish only warns, and names the
`toon deployment` command that retries it.

## 8. Report

Tell the operator what you spent (intervals and µUSDC), the `access` details (not the root
secret), the workload id and `expires_at`, and, once it ends, what `terminate` ended.
