import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { checkRepo, lowestVersion, namedCommands, namedFlags, outsideCodeBlocks } from './skill-commands.mjs';

/** A repository holding `files` (path → text), as a directory. */
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'skill-commands-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/** A SKILL.md whose frontmatter states `range` under `rangeKey`. */
const skill = (rangeKey, range, body = '# Sending') =>
  `---\nname: sending\n${rangeKey}: "${range}"\n---\n\n${body}\n`;
const sendingWithToonCli = (body) => skill('toon_cli', '>=0.3, <0.4', body);
const sendingWithToonClient = (body) => skill('toon-client', '>=5.0.0, <6', body);

/**
 * A fake binary that has only `commands` (each `binary@version path [--flag...]`), recording
 * each call. A command's help is its usage line followed by the flags it lists.
 */
function binaries(...commands) {
  const calls = [];
  const known = new Map(
    commands.map((entry) => {
      const words = entry.split(' ');
      const flags = words.filter((word) => word.startsWith('--'));
      return [words.filter((word) => !word.startsWith('--')).join(' '), flags];
    }),
  );
  const runHelp = async (binary, version, path) => {
    const command = `${binary}@${version} ${path.join(' ')}`.trim();
    calls.push(command);
    const flags = known.get(command);
    return flags !== undefined
      ? { exitCode: 0, stdout: `Usage: ${[binary, ...path].join(' ')} [OPTIONS]\n${flags.join('\n')}\n`, stderr: '' }
      : { exitCode: 2, stdout: '', stderr: `error: unrecognized subcommand` };
  };
  return { runHelp, calls };
}

test('collects inline code spans and code-block lines that start with the binary', () => {
  const text = [
    'Run `toon event publish --kind 1` to post, or `toon --version` first.',
    'This is `toon` alone, and `toon-client send g.toon.relay` is another binary.',
    '',
    '```',
    '  toon channel open <peer> --deposit 10',
    'toonish line',
    '```',
  ].join('\n');

  assert.deepEqual(namedCommands(text, 'toon'), [['event', 'publish'], [], ['channel', 'open']]);
  assert.deepEqual(namedCommands(text, 'toon-client'), [['send']]);
});

test('reads the lowest version of a range from a skill\'s frontmatter', () => {
  assert.equal(lowestVersion(skill('toon_cli', '>=0.3, <0.4'), 'toon_cli'), '0.3.0');
  assert.equal(lowestVersion(skill('toon-client', '>=5.0.2, <6'), 'toon-client'), '5.0.2');
  assert.throws(() => lowestVersion(skill('toon_cli', '<0.4'), 'toon_cli'), /no lower bound/);
  assert.throws(() => lowestVersion(skill('toon_cli', '>=0.3'), 'toon-client'), /no `toon-client` key/);
});

test('a toon-cli skill naming a command the lowest toon_cli lacks fails', async () => {
  const root = repo({
    'plugins/toon-cli/skills/sending-with-toon-cli/SKILL.md': sendingWithToonCli(
      'Run `toon --version`, then `toon event publish --kind 1`.',
    ),
    'plugins/toon-cli/skills/operating-an-agent-node/references/peering.md':
      '```\ntoon frobnicate <peer>\n```',
  });
  const { runHelp, calls } = binaries('toon@0.3.0 --version', 'toon@0.3.0 event publish --kind');

  const problems = await checkRepo(root, runHelp);

  assert.deepEqual(calls.sort(), ['toon@0.3.0', 'toon@0.3.0 event publish', 'toon@0.3.0 frobnicate']);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /operating-an-agent-node\/references\/peering\.md/);
  assert.match(problems[0], /`toon frobnicate` is not a command of toon 0\.3\.0/);
  assert.match(problems[0], /unrecognized subcommand/);
});

test('a toon-nostr skill naming any client command fails, whether or not the command exists', async () => {
  const root = repo({
    'plugins/toon-cli/skills/sending-with-toon-cli/SKILL.md': sendingWithToonCli('`toon --version`'),
    'plugins/toon-nostr/skills/social/SKILL.md': 'Post with `toon event publish`.',
    'plugins/toon-nostr/skills/social/references/nip-25.md': '```\ntoon-client send g.toon.relay\n```',
  });
  const { runHelp } = binaries('toon@0.3.0 --version', 'toon@0.3.0 event publish', 'toon-client@5.0.0 send');

  const problems = await checkRepo(root, runHelp);

  assert.deepEqual(problems, [
    'plugins/toon-nostr/skills/social/SKILL.md: names `toon event publish`, but only toon-cli skills may name `toon` commands',
    'plugins/toon-nostr/skills/social/references/nip-25.md: names `toon-client send`, but only toon-client skills may name `toon-client` commands',
  ]);
});

test('a toon-client skill naming an unknown toon-client command, or a bare toon one, fails', async () => {
  const root = repo({
    'plugins/toon-client/skills/sending-with-toon-client/SKILL.md': sendingWithToonClient(
      'Run `toon-client --version`, then `toon-client frobnicate`, not `toon send` or `toon`.',
    ),
  });
  const { runHelp, calls } = binaries('toon-client@5.0.0 --version');

  const problems = await checkRepo(root, runHelp);

  assert.deepEqual(calls.sort(), ['toon-client@5.0.0', 'toon-client@5.0.0 frobnicate']);
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /`toon-client frobnicate` is not a command of toon-client 5\.0\.0/);
  assert.match(problems.join('\n'), /names `toon send`, but only toon-cli skills may name `toon` commands/);
});

test('collects the long flags each named command passes', () => {
  const text = [
    'Run `toon event publish --kind 1 --relay=wss://r --help` or `toon-client send -H a:b --amount 5`.',
    '```',
    'toon channel open <peer> --deposit 10 --deposit 20',
    '```',
  ].join('\n');

  assert.deepEqual(namedFlags(text, 'toon'), [
    { command: ['event', 'publish'], flag: '--kind' },
    { command: ['event', 'publish'], flag: '--relay' },
    { command: ['channel', 'open'], flag: '--deposit' },
  ]);
  assert.deepEqual(namedFlags(text, 'toon-client'), [{ command: ['send'], flag: '--amount' }]);
});

test('a flag the lowest version lacks fails, and a global flag on the binary passes', async () => {
  const root = repo({
    'plugins/toon-client/skills/sending-with-toon-client/SKILL.md': sendingWithToonClient(
      'Run `toon-client send g.toon.relay --amount 5 --seal-to KEY --connector URL`.',
    ),
  });
  const { runHelp } = binaries('toon-client@5.0.0 --connector', 'toon-client@5.0.0 send --amount');

  const problems = await checkRepo(root, runHelp);

  assert.deepEqual(problems, [
    'plugins/toon-client/skills/sending-with-toon-client/SKILL.md: `toon-client send --seal-to` is not a flag' +
      ' of toon-client 5.0.0 (neither `toon-client send --help` nor `toon-client --help` names it)',
  ]);
});

test('a subcommand whose --help exits 0 but shows only its parent\'s help fails', async () => {
  const root = repo({
    'plugins/toon-client/skills/sending-with-toon-client/SKILL.md': sendingWithToonClient(
      'Run `toon-client channel status`, then `toon-client channel frobnicate`.',
    ),
  });
  // toon-client 5.0 answers `channel <anything> --help` with the channel help, exiting 0.
  const channel = { exitCode: 0, stdout: 'toon-client channel open|deposit <amount>|close|settle|status\n', stderr: '' };
  const top = { exitCode: 0, stdout: 'Usage: toon-client <command>\n\nCommands:\n  channel\n', stderr: '' };
  const runHelp = async (_binary, _version, path) => (path.length === 0 ? top : channel);

  const problems = await checkRepo(root, runHelp);

  assert.deepEqual(problems, [
    'plugins/toon-client/skills/sending-with-toon-client/SKILL.md: `toon-client channel frobnicate` is not' +
      ' a command of toon-client 5.0.0 (`toon-client channel frobnicate --help` does not name `frobnicate`)',
  ]);
});

test('a plain word after a command that lists no subcommands is its argument, not a command', async () => {
  const root = repo({
    'plugins/toon-cli/skills/sending-with-toon-cli/SKILL.md': sendingWithToonCli('Run `toon add echo --yes`.'),
  });
  const help = {
    'toon@0.3.0': 'Usage: toon [OPTIONS] <COMMAND>\n\nCommands:\n  add\n',
    'toon@0.3.0 add': 'Usage: toon add [OPTIONS] <APP>\n\nArguments:\n  <APP>\n      --yes\n',
  };
  // clap answers `add echo --help` with the help of `add`.
  const runHelp = async (binary, version, path) => ({
    exitCode: 0,
    stdout: help[`${binary}@${version} ${path.slice(0, 1).join(' ')}`.trim()],
    stderr: '',
  });

  assert.deepEqual(await checkRepo(root, runHelp), []);
});

test('a backtick inside a code block does not hide the inline spans after it', () => {
  const text = [
    '```sh',
    "awk '{ gsub(/[`]/, \"\") }' file",
    '```',
    '',
    'Then run `toon-client channel status` and `toon-client send g.toon.relay --amount 5`.',
  ].join('\n');

  assert.deepEqual(namedCommands(text, 'toon-client'), [['channel', 'status'], ['send']]);
  assert.deepEqual(namedFlags(text, 'toon-client'), [{ command: ['send'], flag: '--amount' }]);
});

test('a flag after a pipe, `&&`, `;`, `)` or a bare `--` is not the command\'s', () => {
  const text = [
    '```',
    'toon event query --kind 1 | jq --raw-output',
    'toon-client send g.toon.relay --amount 5 && nak event --sec K',
    'toon x -- --literal',
    'toon y --a; toon z --b',
    '(toon w --c) --outside',
    '```',
  ].join('\n');

  assert.deepEqual(namedFlags(text, 'toon'), [
    { command: ['event', 'query'], flag: '--kind' },
    { command: ['y'], flag: '--a' },
  ]);
  assert.deepEqual(namedFlags(text, 'toon-client'), [{ command: ['send'], flag: '--amount' }]);
  assert.deepEqual(namedCommands(text, 'toon'), [['event', 'query'], ['x'], ['y']]);
});

test('a flag on a line continued with a backslash is the command\'s', () => {
  const text = ['```sh', 'toon send <to> \\', '  --max-fee 3 \\', '  --relay r', '```'].join('\n');

  assert.deepEqual(namedCommands(text, 'toon'), [['send']]);
  assert.deepEqual(namedFlags(text, 'toon'), [
    { command: ['send'], flag: '--max-fee' },
    { command: ['send'], flag: '--relay' },
  ]);
});

test('a made-up word in the middle of a command path fails, not only the last one', async () => {
  const root = repo({
    'plugins/toon-client/skills/sending-with-toon-client/SKILL.md': sendingWithToonClient(
      'Run `toon-client channel status`, not `toon-client channel frobnicate status`.',
    ),
  });
  // toon-client 5.0 answers `channel <anything> --help` with the channel help, exiting 0.
  const channel = { exitCode: 0, stdout: 'toon-client channel open|deposit <amount>|close|settle|status\n', stderr: '' };
  const top = { exitCode: 0, stdout: 'Usage: toon-client <command>\n\nCommands:\n  channel\n', stderr: '' };
  const runHelp = async (_binary, _version, path) => (path.length === 0 ? top : channel);

  assert.deepEqual(await checkRepo(root, runHelp), [
    'plugins/toon-client/skills/sending-with-toon-client/SKILL.md: `toon-client channel frobnicate status` is not' +
      ' a command of toon-client 5.0.0 (`toon-client channel frobnicate --help` does not name `frobnicate`)',
  ]);
});

test('a subcommand its parent\'s own `Commands:` section lists passes, and one it does not fails', async () => {
  const root = repo({
    'plugins/toon-cli/skills/sending-with-toon-cli/SKILL.md': sendingWithToonCli(
      'Run `toon event publish`, then `toon event frobnicate`.',
    ),
  });
  const help = {
    '': 'Usage: toon [OPTIONS] <COMMAND>\n\nCommands:\n  event\n',
    event: 'Usage: toon event <COMMAND>\n\nCommands:\n  publish\n  query\n',
    'event publish': 'Usage: toon event publish [OPTIONS]\n',
  };
  // Like toon-client 5.0, this client answers an unknown subcommand with its parent's help.
  const runHelp = async (_binary, _version, path) => ({
    exitCode: 0,
    stdout: help[path.join(' ')] ?? help[path.slice(0, -1).join(' ')],
    stderr: '',
  });

  assert.deepEqual(await checkRepo(root, runHelp), [
    'plugins/toon-cli/skills/sending-with-toon-cli/SKILL.md: `toon event frobnicate` is not' +
      ' a command of toon 0.3.0 (`toon event frobnicate --help` does not name `frobnicate`)',
  ]);
});

test('a flag on the bare binary that its help lacks fails, naming only that help', async () => {
  const root = repo({
    'plugins/toon-cli/skills/sending-with-toon-cli/SKILL.md': sendingWithToonCli('Run `toon --version --frob`.'),
  });
  const { runHelp } = binaries('toon@0.3.0 --version');

  assert.deepEqual(await checkRepo(root, runHelp), [
    'plugins/toon-cli/skills/sending-with-toon-cli/SKILL.md: `toon --frob` is not a flag of toon 0.3.0' +
      ' (`toon --help` does not name it)',
  ]);
});

test('a `~~~` fence hides a backtick too, and a fence indented four spaces is not one', () => {
  const text = [
    '~~~',
    "awk '{ gsub(/[`]/, \"\") }' file",
    '~~~',
    'Then run `toon-client channel status`.',
  ].join('\n');
  assert.deepEqual(namedCommands(text, 'toon-client'), [['channel', 'status']]);

  const indented = ['    ```', 'a `toon-client send` span', '    ```'].join('\n');
  assert.equal(outsideCodeBlocks(indented), indented);
});

test('blanking fenced blocks keeps every line in its place', () => {
  const text = ['before', '```sh', 'toon send x', '```', 'after `toon y`'].join('\n');
  const blanked = outsideCodeBlocks(text);

  assert.deepEqual(blanked.split('\n'), ['before', '', '', '', 'after `toon y`']);
});
