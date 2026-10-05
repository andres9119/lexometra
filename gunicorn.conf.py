"""Gunicorn configuration for Lexometra.

Usage:
  gunicorn -c gunicorn.conf.py lexometra_proj.wsgi:application
"""
import os
import multiprocessing

# ── Socket ────────────────────────────────────────────
# El socket va DENTRO de RuntimeDirectory=lexometra (creado por el unit con
# el usuario del servicio). /run es de root: un usuario sin privilegios no
# puede crear ni el socket ni el pidfile directamente en /run.
bind = os.getenv("GUNICORN_BIND", "unix:/run/lexometra/lexometra.sock")
backlog = 2048

# ── Worker processes ──────────────────────────────────
workers = os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1)
worker_class = "sync"
threads = os.getenv("GUNICORN_THREADS", 4)
timeout = 120
graceful_timeout = 30

# ── Python path ───────────────────────────────────────
# WorkingDirectory del unit es la raíz del repo, pero el proyecto Django vive
# en el paquete anidado repo/lexometra/. Sin esto: "No module named
# 'lexometra_proj'".
pythonpath = os.getenv("GUNICORN_PYTHONPATH", "/home/lexometra/lexometra/lexometra")

# ── Master / Logging ─────────────────────────────────
proc_name = "lexometra"
# Debe vivir dentro de RuntimeDirectory=lexometra (creado por el unit con
# el usuario del servicio); /run no es escribible por el usuario lexometra.
pidfile = os.getenv("GUNICORN_PIDFILE", "/run/lexometra/lexometra.pid")
umask = 0o007

accesslog = "/var/log/lexometra/access.log"
errorlog = "/var/log/lexometra/error.log"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
capture_output = True

# ── Security / Limits ────────────────────────────────
limit_request_line = 4096
limit_request_fields = 50
