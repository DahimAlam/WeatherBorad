import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

await mkdir('dist/icons', { recursive: true });
const icon = await readFile('public/favicon.svg');
await Promise.all([192, 512].map(size => sharp(icon).resize(size, size).png().toFile(`dist/icons/icon-${size}.png`)));
const maskable = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#263f35"/><g transform="translate(96 96) scale(5)">' + icon.toString().replace(/<svg[^>]*>/, '').replace('</svg>', '') + '</g></svg>');
await sharp(maskable).png().toFile('dist/icons/maskable-512.png');
async function files(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const all = await Promise.all(entries.map(e => e.isDirectory() ? files(`${directory}/${e.name}`, `${prefix}/${e.name}`) : `${prefix}/${e.name}`));
  return all.flat().filter(p => p !== '/sw.js');
}
const shell = ['/', ...await files('dist')];
const template = await readFile('src/sw-template.js', 'utf8');
const hash = createHash('sha256').update(template);
for (const file of shell.filter(file => file !== '/')) hash.update(await readFile(`dist${file}`));
const version = hash.digest('hex').slice(0, 12);
const worker = template.replace('__CACHE_VERSION__', version).replace('__SHELL_FILES__', JSON.stringify(shell));
await writeFile('dist/sw.js', worker);
console.log(`PWA ready: ${shell.length} shell files, cache ${version}, 192/512px icons.`);
