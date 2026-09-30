# EventFlow engineering rules

- Keep this repository a modular monolith: new business capabilities belong in bounded NestJS modules, not new services.
- Share public DTO/types through `packages/contracts`; never share Prisma entities or persistence implementation.
- Use strict TypeScript. Do not use `any`, unchecked casts, or `@ts-ignore`.
- Controllers are transport adapters only; put business and infrastructure logic in services.
- Validate configuration and all external input. Do not log credentials, tokens, connection strings, or stack traces in production responses.
- Add a Prisma migration for every schema change. Never edit an applied migration; create a new migration instead.
- New code needs proportionate unit tests; externally visible API behavior needs e2e coverage.
- Before completing work run the relevant lint, typecheck, tests, build, and document the exact results and any blocked checks.
