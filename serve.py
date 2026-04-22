#!/usr/bin/env python3
"""
Aggressive no-cache dev server.
- Adds Cache-Control: no-store on every response
- Ignores If-Modified-Since so the server NEVER returns 304
Usage:  python3 serve.py  (serves ./ on port 8000)
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        # Strip conditional headers so parent class always returns 200
        self.headers.replace_header("If-Modified-Since", "") if "If-Modified-Since" in self.headers else None
        self.headers.replace_header("If-None-Match", "") if "If-None-Match" in self.headers else None
        # Safer: delete them entirely
        for h in ("If-Modified-Since", "If-None-Match"):
            if h in self.headers:
                del self.headers[h]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving with NO-CACHE headers (always 200) on http://localhost:{PORT}")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
