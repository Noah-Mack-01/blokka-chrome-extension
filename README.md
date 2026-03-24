# Network Traffic Interceptor

A Chrome extension built with TypeScript and Bun for intercepting and monitoring network traffic with customizable rules.

## Features

- HTTP/HTTPS request interception using chrome.webRequest API
- Rule-based blocking/allowing/modification of network requests
- Real-time request/response monitoring in popup UI
- Persistent storage of rules and request history (last 100 requests)
- Clean, responsive UI with color-coded status indicators
- TypeScript for type safety
- Fast builds with Bun (<100ms incremental rebuilds)

## Development

### Prerequisites

- [Bun](https://bun.sh/) installed (`curl -fsSL https://bun.sh/install | bash`)
- Chrome browser

### Setup

```bash
# Install dependencies
bun install
```

### Build

```bash
# Production build (minified)
bun run build

# Development build with watch mode (faster rebuilds)
bun run dev

# Type check
bun run type-check
```

### Project Structure

```
├── src/
│   ├── background/
│   │   └── index.ts          # Background service worker
│   ├── popup/
│   │   └── index.ts          # Popup UI logic
│   ├── content/
│   │   └── index.ts          # Content script
│   ├── shared/
│   │   ├── types.ts          # Shared TypeScript types
│   │   ├── storage.ts        # Chrome storage wrapper
│   │   └── constants.ts      # Shared constants
│   └── assets/
│       ├── popup.html        # Popup HTML
│       └── popup.css         # Popup styles
├── dist/                      # Build output (load this in Chrome)
├── manifest.json             # Extension manifest (source)
├── build.ts                  # Bun build script
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

### Load Extension in Chrome

1. Build the extension:
   ```bash
   bun run build
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top right)

4. Click "Load unpacked"

5. Select the `dist/` folder

6. The extension icon should appear in your toolbar

### Development Workflow

1. **Start watch mode:**
   ```bash
   bun run dev
   ```

2. **Make changes** to files in `src/`

3. **Bun will automatically rebuild** (typically in <100ms)

4. **Reload the extension** in Chrome:
   - Go to `chrome://extensions/`
   - Click the refresh icon on your extension
   - Or use an extension like "Extensions Reloader" for auto-reload

### Testing

#### Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Background service worker starts
- [ ] Popup opens and displays correctly
- [ ] Add new rule
- [ ] Edit existing rule
- [ ] Delete rule
- [ ] Toggle rule on/off
- [ ] Rules persist after popup close/reopen
- [ ] Network requests are intercepted
- [ ] Requests appear in popup list
- [ ] Clear requests button works
- [ ] Tab switching works
- [ ] No console errors

## Architecture

### Manifest V3

This extension uses Chrome's Manifest V3 architecture:
- **Service Worker** (`background.js`) instead of background page
- **declarativeNetRequest** and **webRequest** APIs for network interception
- **chrome.storage** for persistent data
- **Message passing** for communication between components

### TypeScript + Bun

- **Fast builds**: Bun compiles TypeScript to JavaScript in ~100ms
- **Type safety**: Full Chrome API types via `@types/chrome`
- **Modern JS**: Targets ES2022 for modern Chrome versions
- **No bundler complexity**: Bun handles everything

### Storage

- **Keys**: `rules` and `requests` (unified across codebase)
- **Limits**: Last 100 requests kept in memory and storage
- **Format**: JSON objects matching TypeScript interfaces

## Technologies

- **TypeScript 5.4+** - Type-safe development
- **Bun** - Fast JavaScript runtime and bundler
- **Chrome Extension APIs** - Manifest V3
- **Vanilla JavaScript** - No frameworks, minimal dependencies

## Build Performance

- **Full build**: ~300-500ms
- **Incremental rebuild**: <100ms
- **Type check**: ~1-2s

## Bundle Sizes

- `background.js`: ~4KB (minified)
- `popup.js`: ~5KB (minified)
- `content.js`: ~2KB (minified)
- **Total**: ~11KB JavaScript

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun run type-check` to verify types
5. Run `bun run build` to verify build
6. Test the extension in Chrome
7. Submit a pull request
