# Enterprise Observability Guide

This document outlines the structured logging and distributed tracing mechanisms implemented in the P2P ERP system. As we transition to a SaaS platform, standard `print()` statements and unstructured logs are insufficient. We have implemented a centralized, context-aware, JSON-based logging system.

## 1. Structured JSON Logging
In production, by setting the environment variable `JSON_LOGS=true`, all logs emitted by the application will be formatted as single-line JSON objects. 

**Why JSON?**
JSON logs are easily digestible by log aggregators like **Datadog**, **Grafana Loki**, and **Elasticsearch (ELK)**. Instead of using complex regex to parse text logs, these tools instantly index JSON fields (like `duration_ms` or `endpoint`), allowing you to build real-time dashboards (e.g., "P99 API Latency for the /login endpoint").

## 2. Request Tracing & Correlation IDs
We use `asgi-correlation-id` to trace requests. 
* When a request hits the FastAPI backend, a unique `X-Request-ID` is generated (or inherited from the frontend's `X-Correlation-ID`).
* This ID is stored in Python's `contextvars`.
* **Every log line** emitted during that request automatically includes the `correlation_id`, without developers needing to manually pass it to the logger.

## 3. Celery Task Tracing
Background jobs in Celery (like Tally syncs or Email notifications) also utilize structured logging.
* When a task starts, its `task_id` becomes its `correlation_id`.
* The `task_prerun` and `task_postrun` signals automatically log the task's entry and exit, including the exact `duration_ms` it took to execute.

## 4. API Timing Metrics
A custom `RequestLoggingMiddleware` intercepts every incoming API call. It records the exact time the request started, waits for the response, and then logs a single structured event containing:
* `endpoint` (e.g., `/api/auth/login`)
* `method` (e.g., `POST`)
* `status_code` (e.g., `200` or `500`)
* `duration_ms` (e.g., `45.23`)

## 5. Structured Exception Logging
When a fatal error occurs and crashes an endpoint, the `global_exception_handler` intercepts it. It uses `logger.exception()` to log the entire traceback inside the JSON structure, preserving the `correlation_id` so you can trace the exact sequence of events that led to the crash.

## 6. Local Development Mode
When `JSON_LOGS` is false or unset (the default locally), the application falls back to a human-readable, colorized terminal output format that includes the `[CorrID]`, `[Tenant]`, and `[User]` tags visually.

## Future Recommendations
* **Prometheus & Grafana:** Consider adding `prometheus-fastapi-instrumentator` in the future to expose a `/metrics` endpoint for time-series scraping.
* **Log Aggregation:** Connect Render's Log Streams to a provider like Datadog to instantly gain value from the JSON structure implemented here.
