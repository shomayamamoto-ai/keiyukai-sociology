#!/usr/bin/env python3
"""
即時反映 dev server (stdlib only).

- 全レスポンスに Cache-Control: no-store を付与
- If-Modified-Since / If-None-Match を剥がして必ず 200 を返す
- 作業ツリーの mtime を監視し、変更があれば SSE で接続中の全タブに reload を送る
- HTML レスポンスの末尾に小さな自動再接続スクリプトを注入する
- ThreadingHTTPServer なので SSE の長期接続が他リクエストを止めない

Usage:
    python3 serve.py            # http://localhost:8000
    python3 serve.py 8080       # ポート指定
    python3 serve.py 8080 --no-livereload   # 自動リロード無効化
"""
from __future__ import annotations

import http.server
import os
import socketserver
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8000
LIVERELOAD = True

# 引数パース（位置引数=ポート / --no-livereload で無効化）
for a in sys.argv[1:]:
    if a == "--no-livereload":
        LIVERELOAD = False
    elif a.isdigit():
        PORT = int(a)

# 監視対象から外すパス（.git, node_modules, dist など）
IGNORED_DIRS = {".git", ".github", "node_modules", "dist", "build", "__pycache__", ".venv", "venv"}
WATCH_EXTS = {".html", ".css", ".js", ".mjs", ".svg", ".webmanifest", ".json", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".woff", ".woff2"}

# 接続中の SSE クライアントが reload を観測するためのバージョン
_version = 0
_version_lock = threading.Lock()
_version_event = threading.Event()


def bump_version() -> None:
    """ファイル変更を検出したら呼ぶ。SSE クライアントに reload を通知する。"""
    global _version
    with _version_lock:
        _version += 1
    _version_event.set()
    _version_event.clear()


def snapshot() -> dict[str, float]:
    """ROOT 配下の対象ファイル mtime を全部スキャン。"""
    out: dict[str, float] = {}
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS and not d.startswith(".")]
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext not in WATCH_EXTS:
                continue
            p = os.path.join(dirpath, f)
            try:
                out[p] = os.path.getmtime(p)
            except OSError:
                pass
    return out


def watcher_thread() -> None:
    """0.4 秒ごとに mtime を比較して、変化があれば bump_version()。"""
    last = snapshot()
    while True:
        time.sleep(0.4)
        try:
            now = snapshot()
        except Exception:
            continue
        if now != last:
            changed = sorted(set(now) ^ set(last)) or [
                p for p in now if last.get(p) != now.get(p)
            ]
            rels = [os.path.relpath(p, ROOT) for p in changed[:5]]
            extra = "" if len(changed) <= 5 else f" (+{len(changed) - 5} more)"
            print(f"[livereload] change: {', '.join(rels)}{extra}")
            last = now
            bump_version()


# クライアントに注入する小さな再接続つき SSE リスナ。
# - ページ復帰時 (pageshow) に再接続
# - reload イベントで location.reload(true)
LIVERELOAD_SNIPPET = b"""
<script>(function(){
  if (!window.EventSource) return;
  var src;
  function open(){
    try { src = new EventSource('/__livereload'); } catch(_) { return; }
    src.addEventListener('reload', function(){ location.reload(); });
    src.onerror = function(){ try{src.close();}catch(_){}; setTimeout(open, 800); };
  }
  open();
  window.addEventListener('pageshow', function(e){ if(e.persisted){ try{src&&src.close();}catch(_){}; open(); }});
})();</script>
"""


class DevHandler(http.server.SimpleHTTPRequestHandler):
    # ROOT 配下を配信
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # ANSI でログを少し見やすく
    def log_message(self, fmt, *args):
        sys.stderr.write("\033[90m[%s] %s\033[0m\n" % (self.log_date_time_string(), fmt % args))

    # 304 を返さないために条件付きヘッダを除去
    def _strip_conditional(self) -> None:
        for h in ("If-Modified-Since", "If-None-Match"):
            if h in self.headers:
                del self.headers[h]

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    # SSE エンドポイント。接続を保持して reload を push する。
    def _serve_livereload(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        try:
            with _version_lock:
                seen = _version
            self.wfile.write(b"retry: 800\n\n")
            self.wfile.flush()
            while True:
                # 15 秒ごとに ping、または変更通知まで起きる
                _version_event.wait(timeout=15)
                with _version_lock:
                    cur = _version
                if cur != seen:
                    seen = cur
                    self.wfile.write(b"event: reload\ndata: 1\n\n")
                else:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return
        except Exception:
            return

    def do_GET(self) -> None:  # noqa: N802
        if LIVERELOAD and self.path.split("?", 1)[0] == "/__livereload":
            self._serve_livereload()
            return
        self._strip_conditional()
        # HTML だけは body を一旦読み出して </body> 直前に snippet を注入
        if LIVERELOAD and self._looks_like_html_request():
            self._serve_html_with_inject()
            return
        super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802
        self._strip_conditional()
        super().do_HEAD()

    def _looks_like_html_request(self) -> bool:
        path = self.translate_path(self.path.split("?", 1)[0])
        if os.path.isdir(path):
            for idx in ("index.html", "index.htm"):
                if os.path.isfile(os.path.join(path, idx)):
                    return True
            return False
        return path.lower().endswith((".html", ".htm"))

    def _serve_html_with_inject(self) -> None:
        path = self.translate_path(self.path.split("?", 1)[0])
        if os.path.isdir(path):
            for idx in ("index.html", "index.htm"):
                cand = os.path.join(path, idx)
                if os.path.isfile(cand):
                    path = cand
                    break
            else:
                self.send_error(404)
                return
        if not os.path.isfile(path):
            self.send_error(404)
            return
        try:
            with open(path, "rb") as f:
                data = f.read()
        except OSError:
            self.send_error(404)
            return

        # </body> の直前、なければ末尾に注入
        lower = data.lower()
        idx = lower.rfind(b"</body>")
        if idx == -1:
            payload = data + LIVERELOAD_SNIPPET
        else:
            payload = data[:idx] + LIVERELOAD_SNIPPET + data[idx:]

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main() -> None:
    if LIVERELOAD:
        threading.Thread(target=watcher_thread, daemon=True).start()
    with ThreadingServer(("", PORT), DevHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"\033[1m\033[96m Sha-Zemi Lab dev server\033[0m  →  \033[4m{url}\033[0m")
        print(f"   livereload : {'on' if LIVERELOAD else 'off'}")
        print(f"   no-cache   : on (304 を返しません)")
        print("   Ctrl+C で停止")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
