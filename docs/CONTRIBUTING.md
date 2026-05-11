# Contributing to Vibra

## Development Setup

### Prerequisites

- **Zig** 0.16.0+ (check with `zig version`)
- **Node.js** 20+ (check with `node --version`)
- **zero-native CLI** (`npm install -g zero-native`)
- **Git**

### Clone and Build

```sh
git clone https://github.com/dpshde/vibra.git
cd vibra
zig build dev     # Starts dev server + native shell
```

The first run installs frontend dependencies and compiles the Zig shell.

### Project Structure

| Path | Purpose |
|------|---------|
| `src/main.zig` | Native shell entry, bridge handlers |
| `src/runner.zig` | Platform runners (macOS/Linux/Windows) |
| `frontend/src/synth/` | Audio engine |
| `frontend/src/ui/` | Interface components |
| `frontend/src/plugin/` | SDK and loader |
| `frontend/src/builtins/` | First-party modules |
| `frontend/src/plugins/` | User/community plugins |
| `frontend/src/examples/` | Demo patches |

### Code Style

**Zig**
- Standard Zig formatting (`zig fmt`)
- Error handling: prefer `try` over `catch unreachable`
- Comments for non-obvious bridge handlers

**JavaScript (Frontend)**
- No semicolons (project convention)
- Single quotes for strings
- UPPERCASE for all UI labels and console messages (brutalist aesthetic)
- Ternary over `if/else` for simple assignments
- Early returns preferred

**CSS**
- CSS variables in `:root` only
- No `!important` except the global `border-radius: 0 !important`
- All measurements in `px` or `rem`, no `em`

### Adding a Built-in Module

1. Create `frontend/src/synth/builtins/my-module.js`
2. Export a manifest following the Plugin SDK schema
3. Import and register in `frontend/src/main.js`
4. Add to the default palette by registering in `BuiltinRegistry`

Example PR structure:
```
feat(builtins): add bitcrusher module

- Adds Bitcrusher with bit-depth and sample-rate reduction
- Registers in main.js under 'effect' category
- Includes hello-bitcrush example patch
```

### Testing Audio Changes

1. Run `zig build dev` for live reload
2. Click **[ START_AUDIO ]** to initialize the context
3. Add your module from the palette
4. Use the virtual keyboard or connect a MIDI controller
5. Check browser console for errors (F12 in CEF, or Safari Web Inspector for WKWebView)

### Native Bridge Development

To add a new bridge command:

1. Define the handler in `src/main.zig`
2. Add to `bridge_handlers` array
3. Add corresponding `BridgeCommandPolicy`
4. Invoke from frontend via `window.zero.invoke('commandName', payload)`

### Commit Messages

Format: `type(scope): subject`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(synth): add polyphonic voice allocator`
- `fix(ui): prevent cable overlap on module drag`
- `docs(plugins): add AudioWorklet upgrade guide`
