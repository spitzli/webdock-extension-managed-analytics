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
