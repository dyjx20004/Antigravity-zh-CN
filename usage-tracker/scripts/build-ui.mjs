import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

async function main() {
  const [css, bundledUi] = await Promise.all([
    readFile(path.join(ROOT, 'src', 'ui', 'styles.css'), 'utf8'),
    esbuild.build({
      entryPoints: [path.join(ROOT, 'src', 'ui', 'app.js')],
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: ['es2022'],
      minify: true,
      write: false,
    }),
  ]);

  const js = bundledUi.outputFiles[0].text;
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Token 用量统计</title>
  <style>${css}</style>
</head>
<body>
  <div id="app"></div>
  <script>${js}</script>
</body>
</html>
`;

  const outHtml = path.join(ROOT, 'dist', 'card.html');
  await mkdir(path.dirname(outHtml), { recursive: true });
  await writeFile(outHtml, html, 'utf8');
  console.log(`Built ${outHtml} (${Buffer.byteLength(html, 'utf8')} bytes)`);

  const outServer = path.join(ROOT, 'dist', 'mcp-server.cjs');
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src', 'server', 'mcp-server.mjs')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: ['node18'],
    minify: true,
    outfile: outServer,
    define: {
      'import.meta.url': '""',
    },
  });
  console.log(`Built ${outServer}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
