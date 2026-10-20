#!/usr/bin/env python3
"""Local dev server: serves the static app and proxies chat to Gemini so the key stays in .env.

    python3 server.py [port]      (default 8000, localhost only)

Python 3 standard library only.
"""
import json, os, ssl, sys, urllib.request, urllib.error
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


def ssl_context():
    # python.org builds on macOS ship without CA certs; fall back to certifi or the system bundle.
    ctx = ssl.create_default_context()
    if ctx.cert_store_stats()['x509_ca']:
        return ctx
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context(cafile='/etc/ssl/cert.pem')


SSL_CTX = ssl_context()


def load_env():
    env = {}
    try:
        with open(os.path.join(ROOT, '.env')) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip().strip('"\'')
    except FileNotFoundError:
        pass
    return env


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def _json(self, status, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split('?')[0] in ('/.env', '/server.py') or '/.git' in self.path:
            return self.send_error(404)
        super().do_GET()

    def do_POST(self):
        if self.path != '/api/chat':
            return self.send_error(404)
        env = load_env()
        key, model = env.get('GEMINI_API_KEY'), env.get('GEMINI_MODEL') or 'gemini-3.5-flash-lite'
        if not key:
            return self._json(500, {'error': 'No GEMINI_API_KEY in .env. Add it and retry (no restart needed).'})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            payload = {
                'system_instruction': {'parts': [{'text': str(req['system'])[:12000]}]},
                'contents': [{'role': 'model' if m['role'] == 'model' else 'user', 'parts': [{'text': str(m['text'])[:2000]}]}
                             for m in req['messages'][-20:]],
                'generationConfig': {'temperature': 1.0, 'maxOutputTokens': 400,
                                     'thinkingConfig': {'thinkingLevel': 'low'}},
            }
        except (KeyError, ValueError, TypeError):
            return self._json(400, {'error': 'Bad request'})
        r = urllib.request.Request(
            f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            data=json.dumps(payload).encode(),
            headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
        try:
            with urllib.request.urlopen(r, timeout=30, context=SSL_CTX) as resp:
                data = json.load(resp)
            text = ''.join(p.get('text', '') for p in data['candidates'][0]['content']['parts']).strip()
            self._json(200, {'text': text or '...'})
        except urllib.error.HTTPError as e:
            msg = ''
            try:
                msg = json.load(e).get('error', {}).get('message', '')
            except Exception:
                pass
            self._json(502, {'error': f'Gemini error {e.code}: {msg}'[:300]})
        except Exception as e:
            self._json(502, {'error': f'Could not reach Gemini: {e}'[:300]})


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'Serving on http://localhost:{port}')
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
