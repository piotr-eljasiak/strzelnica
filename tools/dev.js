/**
 * Runs the three processes the local setup needs, in one command (story 47).
 *
 * They stay three processes on three ports on purpose: the widget must be loaded from a
 * different origin than the app, or the embedding is not really being tested.
 */

import { spawn } from 'node:child_process';

const parts = [
  // --watch, because Vite reloads the browser on every edit but Node does not reload
  // itself. Without it the front end runs new code against an old API, and the mismatch
  // looks like a bug in the page rather than a stale process.
  { name: 'api  ', args: ['--watch', 'server/http/server.js'], colour: '\x1b[36m' },
  { name: 'web  ', args: ['node_modules/vite/bin/vite.js'], colour: '\x1b[35m' },
  { name: 'host ', args: ['tools/host-site.js'], colour: '\x1b[33m' },
];

const RESET = '\x1b[0m';
const children = [];

for (const part of parts) {
  // stdin is inherited, not ignored: Vite watches stdin for its keyboard shortcuts and
  // shuts down when it sees the stream end straight away -- which then took the other two
  // processes down with it.
  const child = spawn(process.execPath, part.args, { stdio: ['inherit', 'pipe', 'pipe'] });
  children.push(child);

  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      for (const line of chunk.split('\n')) {
        if (line.trim()) console.log(`${part.colour}${part.name}${RESET} ${line}`);
      }
    });
  }

  child.on('exit', (code) => {
    console.log(`${part.colour}${part.name}${RESET} zakończony (${code})`);
    stopAll();
  });
}

function stopAll() {
  for (const child of children) if (!child.killed) child.kill();
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

console.log(`
  Aplikacja        http://localhost:5173
  Strona strzelnicy http://localhost:5174   <- tu widget jest osadzony
  API              http://localhost:3000

  Konto testowe: strzelec@example.com / strzelec123
  Ctrl+C kończy wszystko.
`);
