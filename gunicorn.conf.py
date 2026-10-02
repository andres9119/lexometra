"""Gunicorn configuration for Lexometra.

Usage:
  gunicorn -c gunicorn.conf.py lexometra_proj.wsgi:application
"""
import os
import multiprocessing

# ── Socket ────────────────────────────────────────────
bind = os.getenv("GUNICORN_BIND", "unix:/run/lexometra.sock")
backlog = 2048

# ── Worker processes ──────────────────────────────────
workers = os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1)
worker_class = "sync"
threads = os.getenv("GUNICORN_THREADS", 4)
timeout = 120
graceful_timeout = 30

# ── Master / Logging ─────────────────────────────────
proc_name = "lexometra"
pidfile = "/run/lexometra.pid"
umask = 0o007

accesslog = "/var/log/lexometra/access.log"
errorlog = "/var/log/lexometra/error.log"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
capture_output = True

# ── Security / Limits ────────────────────────────────
limit_request_line = 4096
limit_request_fields = 50
