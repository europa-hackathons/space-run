// Turns the Vite build in dist/ into one self-contained HTML page for a Claude artifact.
// CSS and JS are inlined; the .glb models are packed as base64 into models.json next to the page,
// because artifacts do not serve .glb files.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const assets = readdirSync('dist/assets');
const css = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.js'))}`, 'utf8').replaceAll('</script', '<\\/script');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

const page = `<title>Space Run</title>
<meta name="theme-color" content="#04050d" />
<style>${css}</style>
${body.trim()}
<script type="module">${js}</script>
`;
writeFileSync('dist/space-run.html', page);
const pack = {};
for (const f of readdirSync('dist/models')) pack[f] = readFileSync(`dist/models/${f}`).toString('base64');
writeFileSync('dist/models.json', JSON.stringify(pack));
console.log(`dist/models.json ${(JSON.stringify(pack).length / 1024).toFixed(0)} kB`);
console.log(`dist/space-run.html ${(page.length / 1024).toFixed(0)} kB`);
