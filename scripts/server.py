#!/usr/bin/env python3
"""Tiny local dev server for thesamwatts.com editor.

Serves the static site plus:
  POST /api/save     -> write a file (index.html) into the repo
  POST /api/upload   -> save a base64 image/video into assets/published/
  POST /api/publish  -> git add -A && commit && push

Run:  python3 scripts/server.py
Then: open http://127.0.0.1:8765/admin/
"""
import http.server
import socketserver
import json
import subprocess
import sys
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8765
PUBLISHED = ROOT / "assets" / "published"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {fmt % args}\n")

    def _json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path == "/api/save":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                rel = (body.get("path") or "").lstrip("/")
                content = body.get("content", "")
                if not rel or not isinstance(content, str):
                    return self._json(400, {"error": "missing path or content"})
                target = (ROOT / rel).resolve()
                # must stay inside ROOT
                if ROOT not in target.parents and target != ROOT:
                    return self._json(403, {"error": "path escapes root"})
                # only allow html files for now
                if target.suffix.lower() not in (".html", ".json"):
                    return self._json(403, {"error": "only .html/.json savable"})
                # backup-on-save (latest only)
                if target.exists():
                    (target.with_suffix(target.suffix + ".bak")).write_text(
                        target.read_text(encoding="utf-8"), encoding="utf-8"
                    )
                target.write_text(content, encoding="utf-8")
                return self._json(200, {"ok": True, "path": str(target.relative_to(ROOT))})
            except Exception as e:
                return self._json(500, {"error": str(e)})

        if self.path == "/api/upload":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                rel = (body.get("path") or "").lstrip("/")
                b64 = body.get("contentB64") or ""
                if not rel or not b64:
                    return self._json(400, {"error": "missing path or contentB64"})
                # must land under assets/uploads or assets/published
                if not (rel.startswith("assets/uploads/") or rel.startswith("assets/published/")):
                    return self._json(403, {"error": "uploads only allowed under assets/uploads/ or assets/published/"})
                target = (ROOT / rel).resolve()
                if ROOT not in target.parents:
                    return self._json(403, {"error": "path escapes root"})
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(base64.b64decode(b64))
                return self._json(200, {"ok": True, "path": str(target.relative_to(ROOT))})
            except Exception as e:
                return self._json(500, {"error": str(e)})

        if self.path == "/api/publish":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                msg = (body.get("message") or "editor: publish from admin").strip()
                files = body.get("files") or []

                # write each file first (HTML or base64 blob)
                ALLOWED = ("index.html", "dashboard.html", "assets/published/", "media-browser/index.json")
                for f in files:
                    p = (f.get("path") or "").lstrip("/")
                    if not p or not any(p == a or p.startswith(a) for a in ALLOWED):
                        return self._json(403, {"error": f"path not allowed: {p}"})
                    target = (ROOT / p).resolve()
                    if ROOT not in target.parents and target != ROOT:
                        return self._json(403, {"error": "path escapes root"})
                    target.parent.mkdir(parents=True, exist_ok=True)
                    if isinstance(f.get("contentB64"), str):
                        target.write_bytes(base64.b64decode(f["contentB64"]))
                    elif isinstance(f.get("content"), str):
                        target.write_text(f["content"], encoding="utf-8")
                    else:
                        return self._json(400, {"error": f"file {p} needs content or contentB64"})

                log_path = ROOT / "scripts" / "publish.log"
                log = open(log_path, "w")
                def run(cmd):
                    log.write(f"\n$ {' '.join(cmd)}\n")
                    log.flush()
                    r = subprocess.run(cmd, cwd=str(ROOT), stdout=log, stderr=subprocess.STDOUT)
                    return r.returncode
                if run(["git", "add", "-A"]) != 0:
                    log.close()
                    return self._json(500, {"error": "git add failed", "log": "scripts/publish.log"})
                commit_rc = run(["git", "commit", "-m", msg])
                if commit_rc not in (0, 1):
                    log.close()
                    return self._json(500, {"error": "git commit failed", "log": "scripts/publish.log"})
                push_rc = run(["git", "push"])
                log.close()
                if push_rc != 0:
                    return self._json(500, {"error": "git push failed — check scripts/publish.log", "log": "scripts/publish.log"})
                return self._json(200, {"ok": True, "committed": commit_rc == 0, "pushed": True, "files": len(files)})
            except Exception as e:
                return self._json(500, {"error": str(e)})

        return self._json(404, {"error": "not found"})


def main():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        url = f"http://127.0.0.1:{PORT}/admin/editor.html"
        print(f"\n  samwatts editor\n  → {url}\n  (ctrl-c to stop)\n", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  bye.")


if __name__ == "__main__":
    main()
