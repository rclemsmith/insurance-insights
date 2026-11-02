#!/usr/bin/env python3
"""
Emerson Insurance - Local Analytics Dashboard Server & Clarity API Proxy
Reads CLARITY_API_TOKEN securely from the environment or .env file.
Zero third-party dependencies: runs purely on Python 3 standard library.

Usage:
    python server.py
Then open:
    http://localhost:8000
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import urllib.parse
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def load_env_file():
    """Load variables from .env file into os.environ if present"""
    env_path = os.path.join(DIRECTORY, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception as e:
            print(f"Warning: Could not read .env file: {e}")

class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        # Check server environment status
        if parsed.path == "/api/status":
            token_set = bool(os.environ.get("CLARITY_API_TOKEN"))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(f'{{"tokenConfigured": {str(token_set).lower()}}}'.encode("utf-8"))
            return

        # Proxy Clarity API requests using server-side environment token
        if parsed.path == "/api/insights":
            self.handle_clarity_proxy(parsed.query)
        else:
            super().do_GET()

    def handle_clarity_proxy(self, query):
        token = os.environ.get("CLARITY_API_TOKEN")
        if not token:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"error": "CLARITY_API_TOKEN is not set in environment or .env file"}')
            return

        target_url = f"https://www.clarity.ms/export-data/api/v1/project-live-insights?{query}"
        req = urllib.request.Request(
            target_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "User-Agent": "Emerson-Insurance-Dashboard/1.0"
            }
        )

        try:
            with urllib.request.urlopen(req) as response:
                content = response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(content)
        except urllib.error.HTTPError as e:
            err_content = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(err_content if err_content else b'{"error": "Clarity API error"}')
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(f'{{"error": "{str(e)}"}}'.encode("utf-8"))

def run():
    load_env_file()
    token_status = "Configured in ENV" if os.environ.get("CLARITY_API_TOKEN") else "NOT SET (set CLARITY_API_TOKEN in .env)"

    with socketserver.TCPServer(("", PORT), DashboardHandler) as httpd:
        print(f"\n=======================================================")
        print(f"  Emerson Insurance - Analytics Dashboard Server")
        print(f"  Live at: http://localhost:{PORT}")
        print(f"  Token Status: {token_status}")
        print(f"  Serving files from: {DIRECTORY}")
        print(f"  Press Ctrl+C to stop.")
        print(f"=======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    run()
