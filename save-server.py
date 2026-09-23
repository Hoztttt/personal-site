#!/usr/bin/env python3
"""
Tiny local save endpoint for edit mode.

Listens on 127.0.0.1:8001 and accepts POST /save with {"html": "..."},
writing it to index.html. Backs up the previous version to .edit-backups/
every time, so nothing is ever lost.

Localhost only. Not part of the website — never deploy this.
"""
import http.server, socketserver, os, json, datetime, shutil

ROOT    = os.path.dirname(os.path.abspath(__file__))
TARGET  = os.path.join(ROOT, "index.html")
BACKUPS = os.path.join(ROOT, ".edit-backups")
KEEP    = 40          # how many backups to retain


class Handler(http.server.BaseHTTPRequestHandler):

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        if self.path != "/save":
            return self._json(404, {"ok": False, "error": "not found"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            html = json.loads(self.rfile.read(n).decode("utf-8"))["html"]
        except Exception as e:
            return self._json(400, {"ok": False, "error": f"bad payload: {e}"})

        # Guardrails: refuse anything that looks truncated or structurally broken,
        # rather than overwriting a good file with a bad one.
        if len(html) < 5000:
            return self._json(400, {"ok": False, "error": "payload suspiciously small"})
        for needle in ("</html>", "<section id=", "</style>"):
            if needle not in html:
                return self._json(400, {"ok": False, "error": f"missing {needle}"})

        os.makedirs(BACKUPS, exist_ok=True)
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        if os.path.exists(TARGET):
            shutil.copy2(TARGET, os.path.join(BACKUPS, f"index-{stamp}.html"))
        old = sorted(os.listdir(BACKUPS))
        for f in old[:-KEEP]:
            os.remove(os.path.join(BACKUPS, f))

        with open(TARGET, "w", encoding="utf-8") as fh:
            fh.write(html)
        return self._json(200, {"ok": True, "bytes": len(html), "backup": stamp})

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 8001), Handler) as srv:
    print("save endpoint listening on http://127.0.0.1:8001/save")
    srv.serve_forever()
