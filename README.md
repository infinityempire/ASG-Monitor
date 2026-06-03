# ASG Monitor

Minimal monitoring repository for Infinity Empire services.

## Purpose

This repository is prepared to hold uptime checks, deployment health checks, and automation monitoring scripts.

## Current health check

Run:

```bash
python3 scripts/healthcheck.py https://example.com
```

The script exits with code `0` when the URL returns a successful HTTP response, and non-zero when the check fails.
