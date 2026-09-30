# Deployment

The supplied Dockerfiles are root-context, multi-stage builds that install from `pnpm-lock.yaml`, run as non-root users, and expose health checks. Build them using the commands in the README. Supply runtime variables through the deployment platform's secret/config mechanism, never baked into images.

Deploy PostgreSQL, Redis, and an S3-compatible bucket as managed dependencies or equivalent services. Set `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE`, `CORS_ORIGINS`, `WS_ENABLED`, `WS_NAMESPACE`, `WS_ALLOWED_ORIGINS`, `SOCKET_IO_REDIS_CHANNEL_PREFIX`, notification-outbox settings, and ports. Route the API `/api/v1/health/live` as a liveness probe and `/api/v1/health/ready` as a dependency-aware readiness probe.

Terminate TLS at a trusted proxy and forward both ordinary API traffic and Socket.IO upgrade/polling traffic at `/socket.io/`. Preserve `Origin` and cookie headers. If the polling transport remains enabled behind a load balancer, configure sticky sessions for the Engine.IO connection lifecycle; the Redis adapter distributes Socket.IO room fanout between API instances but does not replace transport affinity. Keep Redis authenticated and on private networking. Do not publish storage, Redis, session, or Socket.IO adapter credentials to browser clients.

Real-time notifications are a latency optimization over durable PostgreSQL notifications. Monitor outbox retries/failures and Redis adapter health, but do not treat a temporary real-time publish failure as task-data loss: clients reconcile unread notifications through the authenticated REST API after connection/reconnection. Browser-closed delivery is not available without a separately designed Web Push service.
