# Scout: Version-accurate Pi SDK API — explicit `pi-web-access` extension + web-only tools

Read-only investigation. Repo: `E:/FPT/Semester_8/WDP301/test-pi-agent-2`. Date: 2026-10-01.
No repo source was modified; this file is the only artifact written.

---

## 1. Exact installed versions

| Artifact | Version | Location / evidence |
| :--- | :--- | :--- |
| `@earendil-works/pi-coding-agent` | **0.87.1** (declared `^0.87.1`) | Resolved dir: `node_modules/.bun/@earendil-works+pi-coding-agent@0.87.1+42866a2b24c39680/node_modules/@earendil-works/pi-coding-agent/` (`package.json` `"version": "0.87.1"`). Declared at `apps/api/package.json:11`, locked `bun.lock:138`. |
| `pi-web-access` | **0.35.0** | `C:/Users/ADMIN/.pi/agent/npm/node_modules/pi-web-access/package.json` (`"version": "0.35.0"`). |
| `pi-web-access` peer deps | `@earendil-works/pi-ai: "*"`, `@earendil-works/pi-coding-agent: "*"`, `@earendil-works/pi-tui: "*"`, `typebox: "*"` | Its `peerDependencies` — compatible with host 0.87.1. (Its `devDependencies` pin 0.86.1; dev-only, not runtime.) |

Note: there is also a newer nested copy at `C:/Users/ADMIN/.pi/agent/npm/node_modules/@earendil-works/...`; the repo resolves its own 0.87.1 via Bun's `.bun` store, which is the runtime host.

---

## 2. Resolvability from the repo (question 3)

- `pi-web-access` is **NOT** in `E:/FPT/Semester_8/WDP301/test-pi-agent-2/node_modules/`.
- `pi-web-access` is **NOT** in `apps/api/node_modules/`.
- It is **NOT** declared in root `package.json`, `apps/api/package.json`, or `bun.lock` (grep for `pi-web-access` returned nothing).
- It exists **only** in the global Pi agent npm dir that `pi install` uses: `C:/Users/ADMIN/.pi/agent/npm/node_modules/pi-web-access`, and all its runtime deps (`@modelcontextprotocol`, `turndown`, `undici`, `unpdf`, `linkedom`, `p-limit`, `promise.try`, `defuddle`, `@mozilla/readability`) are present alongside it (verified: 358 entries in that `node_modules`).

Consequence: to load it explicitly, either (a) add it as an `apps/api` dependency and reference the resolved package root, or (b) pass the absolute installed path (works today with no install). A bare package name will **not** resolve — see §5.

---

## 3. `DefaultResourceLoader` options (verified)

File: `.../pi-coding-agent/dist/core/resource-loader.d.ts`

```ts
// resource-loader.d.ts:60-83
export interface DefaultResourceLoaderOptions {
    cwd: string;                                          // :61
    agentDir: string;                                     // :62
    settingsManager?: SettingsManager;
    eventBus?: EventBus;
    additionalExtensionPaths?: string[];                  // :72  <-- explicit extension load
    additionalSkillPaths?: string[];
    additionalPromptTemplatePaths?: string[];
    additionalThemePaths?: string[];
    extensionFactories?: InlineExtension[];
    noExtensions?: boolean;                               // :77  <-- discovery off
    noSkills?: boolean;                                   // :78
    noPromptTemplates?: boolean;                          // :79
    noThemes?: boolean;                                   // :80
    noContextFiles?: boolean;                             // :81
    systemPrompt?: string;                                // :82
    appendSystemPrompt?: string[];
    // ... *Override callbacks ...
}
```

### 3a. Critical semantics: `noExtensions` does NOT suppress `additionalExtensionPaths`

File: `.../pi-coding-agent/dist/core/resource-loader.js:276-326`

```js
const cliExtensionPaths = await this.packageManager.resolveExtensionSources(this.additionalExtensionPaths, {
    temporary: true,
});
// ...
const extensionPaths = this.noExtensions
    ? cliEnabledExtensions                                   // resource-loader.js:317
    : this.mergePaths(cliEnabledExtensions, enabledExtensions);
const extensionsResult = await this.loadFinalExtensionSet(extensionPaths, preTrustExtensions);
for (const p of this.additionalExtensionPaths) {            // :320 path-existence diagnostics
    if (isLocalPath(p)) { /* pushes "Extension path does not exist" into errors */ }
}
```

So `noExtensions: true` (auto-discovery of project/user/global packages disabled) + `additionalExtensionPaths: [<path>]` = **only** the explicitly-listed extension is loaded. This is exactly the desired configuration.

---

## 4. `createAgentSession` + the `tools` / `noTools` contract (verified)

File: `.../pi-coding-agent/dist/core/sdk.d.ts:11-51`

```ts
export interface CreateAgentSessionOptions {
    cwd?: string;
    agentDir?: string;
    modelRuntime?: ModelRuntime;
    model?: Model<any>;
    thinkingLevel?: ThinkingLevel;
    scopedModels?: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>;
    noTools?: "all" | "builtin";          // sdk.d.ts:33
    tools?: string[];                     // sdk.d.ts:43
    excludeTools?: string[];              // sdk.d.ts:45
    customTools?: ToolDefinition[];       // sdk.d.ts:47
    resourceLoader?: ResourceLoader;      // sdk.d.ts:49
    sessionManager?: SessionManager;
    settingsManager?: SettingsManager;
    sessionStartEvent?: SessionStartEvent;
}
export declare function createAgentSession(options?: CreateAgentSessionOptions): Promise<CreateAgentSessionResult>; // sdk.d.ts:107
```

Doc comments (quoted):
- `noTools` (`sdk.d.ts:26-33`): `"all": start with no tools enabled`; `"builtin": disable the default built-in tools (read, bash, edit, write) but keep extension/custom tools enabled`.
- `tools` (`sdk.d.ts:36-43`): `"When provided, only the listed tool names are enabled."`

### 4a. How the allowlist is applied — decides "web tools only"

File: `.../pi-coding-agent/dist/core/sdk.js:140-145`

```js
const defaultActiveToolNames = ["read", "bash", "edit", "write"];
const configuredDefaultToolNames = settingsManager.getDefaultTools();
const allowedToolNames = options.tools ?? (options.noTools === "all" ? [] : undefined);   // :142
const excludedToolNames = options.excludeTools;
const excludedToolNameSet = excludedToolNames ? new Set(excludedToolNames) : undefined;
const initialActiveToolNames = (options.tools ?? (options.noTools ? [] : (configuredDefaultToolNames ?? defaultActiveToolNames)))
    .filter((name) => !excludedToolNameSet?.has(name));                                    // :145
```

File: `.../pi-coding-agent/dist/core/agent-session.js:2494-2566` (`_refreshToolRegistry`)

```js
const allowedToolNames = this._allowedToolNames;
const isAllowedTool = (name) => (!allowedToolNames || allowedToolNames.has(name)) && !excludedToolNames?.has(name); // :2496
// built-in definitions filtered by isAllowedTool  ( :2507 )
// ALL extension + custom tools filtered by isAllowedTool  ( :2505 )
// ...
if (allowedToolNames) {                                     // :2547
    for (const toolName of this._toolRegistry.keys()) {
        if (allowedToolNames.has(toolName)) {
            nextActiveToolNames.push(toolName);             // :2550 force-activate allowlisted tools
        }
    }
}
this.setActiveToolsByName([...new Set(nextActiveToolNames)]); // :2566
```

Conclusion (verified by code path, not just docs):
- Passing `tools: ["web_search", "fetch_content", "get_search_content", "source_check"]` makes `_allowedToolNames` a Set. It **filters out of the registry** every built-in tool AND every extension tool whose name is not listed. It then **force-activates** every registry tool in the set.
- Therefore `tools: [<web tool names>]` alone yields web-only tools. `noTools` is irrelevant once `tools` is provided (`options.tools ?? ...`). In the current runner, `tools: []` + `noTools: "all"` (`agent-runner.ts:144-145`) means zero tools — nothing web is exposed today.

---

## 5. `pi-web-access` extension details (verified)

### 5a. Entry point / manifest

`C:/Users/ADMIN/.pi/agent/npm/node_modules/pi-web-access/package.json`:

```json
"pi": { "extensions": ["./dist"] }
```

- Manifest read by `readPiManifest` (`.../pi-coding-agent/dist/core/pi-manifest.js`) which reads `pkg.pi.{extensions,skills,prompts,themes}` and returns `{ extensions: ["./dist"] }`.
- `collectPackageResources` (`.../pi-coding-agent/dist/core/package-manager.js:1801-1822`) then registers `<packageRoot>/dist`.
- Directory load resolves to `dist/index.js`; bundle ends with `export { index_default as default, ... }` (`dist/index.js:25432-25436`). Source module: `index.ts` `export default function (pi: ExtensionAPI) { ... }` at `index.ts:1080`.

### 5b. Registered tool names (defaults)

`index.ts:251-254`:

```ts
const DEFAULT_TOOL_NAMES: ToolNames = {
    webSearch: "web_search",
    sourceCheck: "source_check",
    fetchContent: "fetch_content",
    getSearchContent: "get_search_content",
};
```

Registration sites: `index.ts:1837` (`web_search`), `:2435` (`source_check`), `:2534` (`fetch_content`), `:2889` (`get_search_content`). Names are overridable via `web-search.json` `toolNames` (`resolveToolNames`, `index.ts:328-345`), and each is enabled by default unless `tools.<key>.enabled=false` (`isToolEnabled`, `index.ts:315`).

### 5c. `web_search` workflow option (search workflow question)

`index.ts:1854-1858`:

```ts
workflow: Type.Optional(
    StringEnum(["none", "summary-review", "auto-summary"], {
        description: "Search workflow mode: none = no curator (default), summary-review = open curator with auto summary draft, auto-summary = generate summary without opening curator",
    }),
),
```

Types: `type CuratorWorkflow = "summary-review"` (`index.ts:202`); `type SummaryWorkflow = "summary-review" | "auto-summary"` (`:204`). Default is `none` (no curator).

### 5d. Dynamic tool activation — important interplay

`index.ts:1083` defaults `toolActivation` to `"auto"`; only `"eager"` skips the loader (`index.ts:3267-3272`):

```ts
if (toolActivation !== "eager") registerWebToolActivation(pi, [
    ...webSearchEnabled ? [{ name: toolNames.webSearch, capability: "search" }] : [],
    ...sourceCheckEnabled ? [{ name: toolNames.sourceCheck, capability: "source-check" }] : [],
    ...fetchContentEnabled ? [{ name: toolNames.fetchContent, capability: "fetch" }] : [],
    ...getSearchContentEnabled ? [{ name: toolNames.getSearchContent, capability: "stored-content" }] : []
], toolActivation);
```

`registerWebToolActivation` (`tool-activation.ts`) registers an extra loader tool named **`web_enable`** and, on `session_start`, calls `pi.setActiveTools(...)` only if `loaderAvailable()` (i.e. `web_enable` is in `pi.getAllTools()`).

Interaction with `tools: [<web names>]`: `web_enable` is not in the allowlist, so `_refreshToolRegistry` filters it out of the registry. On `session_start`, `loaderAvailable()` returns false and `selectFromSession` returns early — it does **not** deactivate the allowlisted web tools. The allowlisted web tools remain active. (If `web_enable` were allowlisted, it would function as a lazy activation gate.) See UNVERIFIED §8.

### 5e. Config file location

`dist/index.js` `getWebSearchConfigDir()`: uses `process.env.PI_CODING_AGENT_DIR` if set, else `$XDG_CONFIG_HOME/pi` if `web-search.json` exists there, else `~/.pi/agent` (or legacy `~/.pi`) if `web-search.json` exists, else `~/.pi/agent`. Existing file found: `C:/Users/ADMIN/.pi/agent/web-search.json` containing `{"provider":"all"}`. The extension reads config itself — independent of `DefaultResourceLoader.agentDir`.

---

## 6. Path resolution rules for `additionalExtensionPaths` (verified)

- `ResourceLoader.reload()` calls `resolveExtensionSources(this.additionalExtensionPaths, { temporary: true })` (`resource-loader.js:277-279`). Scope = **temporary**.
- Sources are parsed by `parseSource` (`package-manager.js:1148-1170`): only `npm:`, `git:`, `github:`, `http:`, `https:`, `ssh:` prefixes are non-local; **everything else falls through to `{ type: "local", path: source }`**. `isLocalPath` (`dist/utils/paths.js:35-49`) returns `true` for any string not starting with those prefixes — including Windows drive paths like `C:/Users/...`.
- Local paths are handled by `resolveLocalExtensionSource` (`package-manager.js:1049-1072`): a directory -> `collectPackageResources` (reads `pi` manifest); a file -> registered directly.
- Because the scope is `temporary`, an npm-form source would resolve to a temp dir (`getManagedNpmInstallPath`, `package-manager.js:1725-1733`: `join(getTemporaryDir("npm"), "node_modules", source.name)`), **not** the existing `~/.pi/agent/npm/node_modules` install. A bare `"pi-web-access"` is parsed as a *local* path anyway and will fail relative-path resolution.
- => **Use an absolute directory path** to the package root: `C:/Users/ADMIN/.pi/agent/npm/node_modules/pi-web-access`. The manifest then adds its `./dist` automatically. (A file path `.../pi-web-access/dist/index.js` also works, but the root is cleaner.)
- Load errors surface via `resourceLoader.getExtensions().errors` (path-does-not-exist diagnostic at `resource-loader.js:320-326`) — worth asserting after `reload()`.

---

## 7. Minimal code snippet for `agent-runner.ts`

Replace the loader/session block at `apps/api/src/agents/agent-runner.ts:124-146`.

```ts
// Absolute path to the installed pi-web-access package root. Its package.json
// `pi.extensions: ["./dist"]` is read automatically.
const PI_WEB_ACCESS_DIR =
  process.env.PI_WEB_ACCESS_DIR ??
  "C:/Users/ADMIN/.pi/agent/npm/node_modules/pi-web-access";

// Allowlist = web tools only. The `tools` allowlist filters every non-listed
// built-in + extension tool out of the registry (sdk.js:142, agent-session.js:2494-2566),
// then force-activates the listed ones. No `noTools` needed.
const WEB_TOOL_NAMES = ["web_search", "fetch_content", "get_search_content", "source_check"];

const settingsManager = SettingsManager.inMemory();
settingsManager.setDefaultThinkingLevel(env.PI_THINKING_LEVEL);

const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: process.cwd(),
  settingsManager,
  noExtensions: true,                            // discovery OFF; keeps additionalExtensionPaths
  additionalExtensionPaths: [PI_WEB_ACCESS_DIR], // explicit: ONLY pi-web-access
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true,
  systemPrompt: fullSystemPrompt,
});
await resourceLoader.reload();
// Optional guard: if (resourceLoader.getExtensions().errors.length) throw new Error(...)

const { session } = await createAgentSession({
  model: liveModel,
  modelRuntime: piService.modelRuntime,
  sessionManager: SessionManager.inMemory(),
  settingsManager,
  resourceLoader,
  thinkingLevel: env.PI_THINKING_LEVEL,
  tools: WEB_TOOL_NAMES,   // web-only; web_enable + read/bash/edit/write filtered out
});
```

If you prefer belt-and-braces, add `noTools: "builtin"` (disables read/bash/edit/write; keeps extension/custom tools) — but note it is a no-op when `tools` is supplied, because `allowedToolNames = options.tools ?? ...` (sdk.js:142).

---

## 8. VERIFIED vs UNVERIFIED

### VERIFIED (read directly from installed dist + package files)
- Installed versions: pi-coding-agent **0.87.1**, pi-web-access **0.35.0** (§1).
- pi-web-access is not in repo `node_modules`, not declared in `package.json`/`bun.lock`; present only in the global Pi npm dir (§2, §5).
- `additionalExtensionPaths` exists and is `string[]`; `noExtensions` disables discovery but **preserves** `additionalExtensionPaths` — `resource-loader.js:316-318` (§3a).
- `createAgentSession` options `noTools`/`tools`/`excludeTools`/`resourceLoader` and their exact semantics — `sdk.d.ts:33,43,45,49` and `sdk.js:142-145` (§4).
- `tools: string[]` is a hard registry filter over built-in + extension tools and force-activates listed names — `agent-session.js:2494-2566` (§4a).
- pi-web-access entry `./dist` via `pi` manifest, default export at `dist/index.js:25432` (§5a).
- Default tool names `web_search`, `source_check`, `fetch_content`, `get_search_content` (`index.ts:251-254`), registration sites and `web-search.json` overrides (§5b).
- `web_search` `workflow` enum `["none","summary-review","auto-summary"]`, default `none` (`index.ts:1854-1858`) (§5c).
- `web_enable` loader registration under default `toolActivation: "auto"` (`index.ts:1083,3267-3272`; `tool-activation.ts`) (§5d).
- Config path logic (`PI_CODING_AGENT_DIR` -> XDG -> `~/.pi/agent`), `C:/Users/ADMIN/.pi/agent/web-search.json` = `{"provider":"all"}` (§5e).
- Path parsing: bare/absolute strings are treated as local (not npm), temporary scope, directory root + `pi` manifest resolution (§6).

### UNVERIFIED (stated but not exercised at runtime)
- That `pi-web-access` actually loads under host pi-coding-agent **0.87.1** at runtime. The peer range is `"*"`, but its devDeps target 0.86.1 and `tool-activation.ts` explicitly probes for 0.86.0-era host APIs. Loading may log a warning or behave differently on 0.87.1. Needs a real ephemeral-session smoke run.
- That at least one search provider is usable: `web-search.json` only sets `"provider":"all"`; provider API keys/credentials source was not inspected (likely env vars). `web_search` may return a "no providers configured" error.
- Exact timing of `supportsDynamicTools(pi)` vs `pi` binding during `resourceLoader.reload()` — whether the `web_enable` loader is registered or the extension falls back to eager mode with the `"[pi-web-access] Dynamic tool activation requires Pi 0.86.0 or newer"` warning. Either outcome still leaves the allowlisted web tools active (loader filtered), but the log line differs.
- Whether `agentDir: process.cwd()` (used today) affects anything the extension reads; pi-web-access config resolution is independent of it, but this was not runtime-confirmed.
- Whether jiti resolves pi-web-access's external deps correctly when the package is loaded from `C:/Users/ADMIN/.pi/agent/npm/node_modules/` while the host is in the repo's `.bun` store — deps are physically present (§2), but module resolution under jiti was not executed.

### Open questions
- Dependency strategy: add `pi-web-access` to `apps/api/package.json` (then resolve its absolute path in code or via `require.resolve`), or hardcode/env the global install path. The global path is user-machine-specific — an env var (`PI_WEB_ACCESS_DIR`) plus a fallback is safer for a demo repo.
- Confirm `web_enable` is intentionally excluded (web tools always active) or intentionally included (lazy activation to save context). The current allowlist approach makes them eager.
