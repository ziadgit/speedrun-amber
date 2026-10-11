# 00 · Overview: speedhack-agent repo spec

Oct 11, 2026 · @Ziad. The source design, kept as written apart from the
diagram. Specs 01–06 refine it and **win on conflict**. Main-repo work moved to
`HANDOFF.md`; Dial and Darwin sign-in are out of scope (see `IDEA.md`).

speedhack-agent is a separate Bun and TypeScript repo that gives the CV app a chat agent. It hosts a CopilotKit runtime with two MCP connections: Darwin, for finding outside agents such as job-posting sources, and its own cv-tools server, which wraps the main repo's FastAPI routes. The main repo changes in three places and keeps its current structure.

## How it plugs in

```
browser ── SvelteKit page (main repo) ── iframe ──▶ /chat            (this repo, :4000)
                 ▲  postMessage "speedhack:changed"      │
                 └────────────────────────────────────────┘
/chat ──▶ /api/copilotkit (BuiltInAgent) ──MCP──▶ Darwin   (https://mcp.darwin.so/mcp)
                                          └─MCP──▶ /mcp cv-tools ──HTTP──▶ FastAPI (main repo, :8000)
```

The main app embeds the agent's chat page. The agent reaches the app's data only through cv-tools, which calls FastAPI, and reaches the outside world through Darwin.

## What the new repo contains

One Bun process on port 4000 serves three route groups. It is TypeScript because CopilotKit's TypeScript runtime is the only one that runs standalone; its Python runtime needs a CopilotKit Intelligence project and API key.

| Route | What it is | Built with |
| --- | --- | --- |
| `/api/copilotkit` | The agent: a CopilotKit runtime with one `BuiltInAgent` registered as `default` | `@copilotkit/runtime/v2` |
| `/mcp` | cv-tools, an MCP server over Streamable HTTP. Each tool is one call to the main repo's FastAPI | `@modelcontextprotocol/sdk` |
| `/chat` | A small React page with CopilotKit's chat component, embedded by the main app | `@copilotkit/react-core/v2` |

The agent is configured with both MCP servers. This follows CopilotKit's documented API and has not been run yet.

```ts
import {
  BuiltInAgent,
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";

const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: process.env.MODEL!,
      mcpServers: [
        { type: "http", name: "darwin", url: process.env.DARWIN_MCP_URL! },
        { type: "http", name: "cv", url: `http://127.0.0.1:${process.env.PORT}/mcp` },
      ],
    }),
  },
  runner: new InMemoryAgentRunner(),
});

export const copilot = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});
```

A `BuiltInAgent` instance handles one run at a time. One shared instance is fine for a single-user demo; create one per request before more than one person uses it.

## Darwin: what works today

Darwin plugs in one way today: the agent calls Darwin's MCP server to find outside agents. The reverse, Darwin discovering cv-tools, is not available yet.

| Capability | Status | Effect on this repo |
| --- | --- | --- |
| Find agents (`search`) | Works without sign-in | In scope. The agent asks Darwin for job-posting, salary or company-research agents |
| Work with a found agent (`act`, `get_thread`) | Needs a user-authorized Darwin OAuth grant | Stretch, out of scope for the loop |
| Pay an agent (`pay`) | Hosted review page; account-owned flow not production-enabled | Out of scope |
| Darwin listing cv-tools (Publish) | Marked "Soon" in Darwin's docs | Not possible today |

Unconfirmed: whether Darwin's index holds a job-postings agent it can start work with. The probe (spec 05) checks it; if nothing startable comes back, `search_jobs` (spec 06) reads public company job boards directly.

## CopilotKit: why a chat page instead of Svelte components

CopilotKit's chat components are React, and the main app is Svelte 5. So the chat ships as its own React page and the Svelte app embeds it in an iframe. CopilotKit supplies the agent loop, the MCP client wiring and the chat interface, which leaves only cv-tools and the chat page to write.

## Left open for later: Dial

Not part of this build. Two choices keep it possible: each cv-tools tool is a single function in `tools.ts` (an outbound Dial tool is one more function), and `server.ts` mounts route groups independently with the agent setup as an exported factory in `runtime.ts` (an inbound `/dial` group can start the agent from server code).

## Sources

- [sinaatalay/speedhack](https://github.com/sinaatalay/speedhack), read at commit `18aeef2`
- [Darwin MCP](https://darwin.so/docs/interfaces/darwin/mcp.md) and [MCP quickstart](https://darwin.so/docs/get-started/mcp.md)
- [Darwin: Use Search results](https://darwin.so/docs/search/using-results.md)
- [CopilotKit: MCP servers](https://docs.showcase.copilotkit.ai/built-in-agent/mcp-servers)
- [CopilotKit: Copilot Runtime](https://docs.showcase.copilotkit.ai/backend/copilot-runtime)
- [CopilotKit: AG-UI](https://docs.showcase.copilotkit.ai/built-in-agent/backend/ag-ui)
