#!/usr/bin/env python3
"""Local-only controller: no request fields are used as network input."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from subprocess import run

class Controller(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/run':
            self.send_error(404)
            return
        result = run(['/usr/sbin/hping3', '-S', '-p', '80', '-c', '60', '-i', 'u100000', 'victim'], capture_output=True, text=True, timeout=12)
        self.send_response(200 if result.returncode == 0 else 500)
        self.end_headers()
        self.wfile.write(b'CONTROLLED_SYN_COMPLETE target=victim count=60 rate=10pps duration=6s\n')
    def log_message(self, *_args):
        pass

HTTPServer(('127.0.0.1', 18081), Controller).serve_forever()
