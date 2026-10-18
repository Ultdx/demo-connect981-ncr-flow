import { copyFileSync, mkdirSync } from 'node:fs';

// TypeScript emits JavaScript only; keep runtime SDL and ERP fixtures beside it.
mkdirSync('dist/src/erp', { recursive: true });
copyFileSync('src/schema.graphql', 'dist/src/schema.graphql');
copyFileSync('src/erp/erp.json', 'dist/src/erp/erp.json');
