import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('public/fonts', { recursive: true });
for (const [name, family, repository] of [['dm-sans', 'DM+Sans', 'dmsans'], ['manrope', 'Manrope', 'manrope']]) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@400..800&display=swap`, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' } })).text();
  const latin = css.split('/* latin */').at(-1);
  const url = latin?.match(/url\((https:[^)]+)\)/)?.[1];
  if (!url) throw new Error(`Font source unavailable: ${name}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font download failed: ${name}`);
  await writeFile(`public/fonts/${name}.woff2`, Buffer.from(await response.arrayBuffer()));
  const license = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${repository}/OFL.txt`);
  if (!license.ok) throw new Error(`Font license unavailable: ${name}`);
  await writeFile(`public/fonts/${name}-OFL.txt`, await license.text());
  console.log(`Downloaded ${name} and its license.`);
}
