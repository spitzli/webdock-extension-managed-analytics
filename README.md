# Managed Analytics

An external Webdock extension backed by Umami. The ElysiaJS runtime provides one action implementation for Console, HTTP API and MCP.

Work in progress: local tests pass; no production plugin installation or public release is claimed yet.

- Enable one analytics website per project, with retry-safe deterministic identity.
- Retrieve the tracking script configuration and website statistics.
- Project-specific provider credentials remain in the Webdock host's named HTTP binding.
- Core data stores the project mapping; the plugin receives no database or provider passwords.

## Actions and routes

| Action | HTTP route (under the host's plugin/project prefix) | MCP tool |
|---|---|---|
| `analytics.provision` | `POST /site` | `plugin__managed_analytics__provision` |
| `analytics.configuration` | `GET /configuration` | `plugin__managed_analytics__configuration` |
| `analytics.stats` | `GET /stats` | `plugin__managed_analytics__stats` |

GET requests take an `input` JSON query parameter. Mutations require `Idempotency-Key`. Authentication, current project authority, manifest capabilities and an explicit project grant are checked by the host for all transports.

## Development

```sh
npm ci
bun test
npm run build
```

The vendored SDK is a local prerelease built from the Webdock working branch. It is not an npm release. The image digest in the development manifest is replaced by `webdock plugin pack` before publishing.

## Optional custom tracking domain

Custom domains are an operator-managed option. The default remains the provider origin; Webdock itself uses `moon.webdock.dev`.

1. Generate a project-bound request with `bun scripts/domain.ts request PROJECT_ID track.customer.example moon.webdock.dev > request.json`.
2. The customer creates a CNAME from that tracking subdomain to `moon.webdock.dev` and a TXT record at `_webdock-analytics.TRACKING_DOMAIN` containing `webdock-analytics=PROJECT_ID:TOKEN` from the request.
3. Run `bun scripts/domain.ts verify request.json`. Both DNS records must match. Preserve the request for audit.
4. Export the provider cluster's current ingress inventory, then run `bun scripts/domain.ts plan request.json target.json ingresses.json`. The target specifies the provider's namespace, service, port and namespace-scoped ACME issuer. The planner refuses a conflicting existing hostname binding. Apply the reviewed plan without overwriting another project's resource.
5. Wait for the TLS certificate and verify `/script.js` and `/api/send` through the new domain. `/login`, `/api/websites` and `/` must remain unavailable: the generated ingress exposes only the two exact collection paths.
6. In the host's private runtime settings, set `publicConfiguration[PROJECT_ID].tracking_origin` to the verified HTTPS origin. The host selects only the current project's override and validates it against the plugin manifest. Reload the plugin panel and install its returned script configuration.

This does not automatically change a customer's DNS or expose provider administration. The DNS/route/TLS step requires the operator; self-service domain automation is not claimed.
