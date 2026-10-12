import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';

const root = fileURLToPath(new URL('../', import.meta.url));

async function copyFiles(source, destination, files) {
  await mkdir(resolve(root, destination), { recursive: true });
  await Promise.all(files.map((file) =>
    cp(resolve(source, file), resolve(root, destination, file))
  ));
}

await copyFiles(scramjetPath, 'scram', [
  'scramjet.all.js',
  'scramjet.sync.js',
  'scramjet.wasm.wasm'
]);
await copyFiles(baremuxPath, 'baremux', ['index.js', 'worker.js']);
await copyFiles(libcurlPath, 'libcurl', ['index.mjs']);
await Promise.all([
  cp(new URL('../node_modules/@mercuryworkshop/scramjet/LICENSE', import.meta.url), resolve(root, 'scram/LICENSE')),
  cp(new URL('../node_modules/@mercuryworkshop/bare-mux/LICENSE', import.meta.url), resolve(root, 'baremux/LICENSE')),
  cp(new URL('../node_modules/@mercuryworkshop/libcurl-transport/LICENSE', import.meta.url), resolve(root, 'libcurl/LICENSE'))
]);

console.log('Copied Scramjet browser assets into the static site.');
