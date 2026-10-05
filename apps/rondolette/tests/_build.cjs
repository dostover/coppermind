// Builds a test copy of ../index.html: swaps the Firebase CDN scripts for the mock and
// adds a hook so a test can force a spin's result (window.__fake = () => result).
const fs = require('fs'), path = require('path'), http = require('http');
function buildTestPage(outDir){
  let s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  s = s.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+"><\/script>\n?/g, '');
  if (!s.includes('<head>')) throw new Error('index.html has no <head>');
  s = s.replace('<head>', '<head><script src="mock-firebase.js"></script>');
  const hook = 'function turnResult(){';
  if (!s.includes(hook)) throw new Error('turnResult() not found: update the test hook in _build.cjs');
  s = s.replace(hook, hook + '\n  if (window.__fake) return window.__fake();');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), s);
  fs.copyFileSync(path.join(__dirname, 'mock-firebase.js'), path.join(outDir, 'mock-firebase.js'));
}
function serve(dir, port){
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/$/, '/index.html'));
      if (!f.startsWith(dir) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(port, () => res(srv));
  });
}
module.exports = { buildTestPage, serve };
