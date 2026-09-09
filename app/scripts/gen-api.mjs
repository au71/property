#!/usr/bin/env node
/**
 * Regenerates the typed API client from the API's OpenAPI document.
 *
 * The generated output is committed so a build never depends on the API being
 * reachable. Run this after any API contract change, and commit the diff — the
 * type errors it produces are the point.
 *
 *   npm run gen:api                       # from ../api/openapi.json
 *   npm run gen:api -- http://host/openapi.json
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = 'src/lib/api/generated';
const source = process.argv[2] ?? resolve('..', 'api', 'openapi.json');

mkdirSync(OUT_DIR, { recursive: true });

let input = source;
if (!source.startsWith('http')) {
  if (!existsSync(source)) {
    console.error(`No OpenAPI document at ${source}.`);
    console.error('Run `npm run openapi` in the api project first, or pass a URL.');
    process.exit(1);
  }
  copyFileSync(source, resolve(OUT_DIR, 'openapi.json'));
  input = resolve(OUT_DIR, 'openapi.json');
}

execFileSync('npx', ['openapi-typescript', input, '-o', resolve(OUT_DIR, 'schema.d.ts')], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

console.log('\nGenerated src/lib/api/generated/schema.d.ts');
