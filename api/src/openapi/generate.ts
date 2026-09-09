import { writeFileSync } from 'node:fs';
import { buildOpenApiDocument } from './spec.js';

const doc = buildOpenApiDocument();
writeFileSync('openapi.json', JSON.stringify(doc, null, 2) + '\n');

const paths = Object.keys(doc['paths'] as object).length;
const operations = Object.values(doc['paths'] as Record<string, Record<string, unknown>>).reduce(
  (sum, item) =>
    sum +
    Object.keys(item).filter((k) => ['get', 'post', 'patch', 'put', 'delete'].includes(k)).length,
  0,
);
console.log(`Wrote openapi.json — ${paths} paths, ${operations} operations.`);
