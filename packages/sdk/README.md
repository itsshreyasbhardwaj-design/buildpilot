# @buildpilot/sdk

TypeScript client for the [BuildPilot](https://github.com/itsshreyasbhardwaj-design/buildpilot)
REST API.

```bash
pnpm add @buildpilot/sdk
```

```ts
import { BuildPilotClient } from "@buildpilot/sdk";

const buildpilot = new BuildPilotClient({
  baseUrl: "https://your-buildpilot-instance",
  apiToken: process.env.BUILDPILOT_API_TOKEN!,
});

const build = await buildpilot.getBuild(buildId);
const analysis = await buildpilot.analyzeFailure(failureId);
```

See the main repo's [`docs/API.md`](../../docs/API.md) for the full endpoint
reference and `src/types.ts` for every response shape.

MIT licensed.
