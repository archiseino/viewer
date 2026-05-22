import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pdfjsDist = resolve(root, '../packages/foliate-js/node_modules/pdfjs-dist');
const dest = resolve(root, 'public/vendor/pdfjs');

if (!existsSync(pdfjsDist)) {
  console.error(
    '✖ pdfjs-dist not found at',
    pdfjsDist,
    '\n  Make sure dependencies are installed (pnpm install)',
  );
  process.exit(1);
}

mkdirSync(dest, { recursive: true });

const buildDir = resolve(pdfjsDist, 'legacy', 'build');

copyFileSync(
  resolve(buildDir, 'pdf.worker.mjs'),
  resolve(dest, 'pdf.worker.mjs'),
);
console.log('  ✓ pdf.worker.mjs');

copyFileSync(resolve(buildDir, 'pdf.mjs'), resolve(dest, 'pdf.mjs'));
console.log('  ✓ pdf.mjs');

for (const dir of ['cmaps', 'standard_fonts']) {
  const srcDir = resolve(pdfjsDist, dir);
  const destDir = resolve(dest, dir);
  if (existsSync(srcDir)) {
    cpSync(srcDir, destDir, { recursive: true, force: true });
    const count = readdirSync(destDir).length;
    console.log(`  ✓ ${dir}/ (${count} files)`);
  }
}

console.log('\n✅ PDF.js vendor files copied to public/vendor/pdfjs/');
