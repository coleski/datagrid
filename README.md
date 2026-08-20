

# @coleski/datagrid

[![npm version](https://img.shields.io/npm/v/@coleski/datagrid.svg)](https://www.npmjs.com/package/@coleski/datagrid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Ultra-fast canvas-based data grid for React.

> **Note**: Originally created by [Archer Hume](https://github.com/archerhume).

## Installation

```bash
npm install @coleski/datagrid
# or
bun add @coleski/datagrid
# or
yarn add @coleski/datagrid
```

## Quick Start

```tsx
import { CanvasDataGrid } from '@coleski/datagrid'

function App() {
  return <CanvasDataGrid rows={[['Hello']]} headers={['Name']} />
}
```

## Development

This is a monorepo managed with Bun workspaces.

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Node.js >= 18 (for some tooling compatibility)

### Setup

```bash
# Install dependencies
bun install

# Start development
bun run dev

# Run component preview (Preview.js)
bun run -w packages/grid preview

# Run type checking
bun run typecheck

# Run linting
bun run lint

# Format code
bun run format

# Build all packages
bun run build

# Create a changeset for versioning
bunx changeset

# Version packages
bunx changeset version

# Release to npm
bun run release
```

### Project Structure

```
@coleski/datagrid/
├── packages/
│   ├── grid/              # Main Grid component library
│   └── examples/
│       └── vite-app/       # Example Vite application
├── .changeset/             # Changeset configuration
├── .github/workflows/      # GitHub Actions CI/CD
└── biome.json              # Biome linter/formatter config
```

### Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development mode (builds Grid + runs Vite app) |
| `bun run build` | Build all packages |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run lint` | Run Biome linter |
| `bun run lint:fix` | Fix linting issues |
| `bun run format` | Format code with Biome |
| `bun run clean` | Clean all build artifacts |
| `bunx changeset` | Create a changeset entry |
| `bunx changeset version` | Update package versions |
| `bun run release` | Build and publish to npm |

### Package Development

#### Grid Component (`packages/grid`)

The main Grid component uses:
- **tsup** for building ESM/CJS bundles with TypeScript declarations
- **Preview.js** for component development and preview
- **React 18+** as peer dependency

```bash
# Navigate to Grid package
cd packages/grid

# Start Preview.js playground
bun run preview

# Build the package
bun run build

# Type check
bun run typecheck
```

#### Example App (`packages/examples/vite-app`)

A Vite-powered example application demonstrating Grid usage:

```bash
# Navigate to example app
cd packages/examples/vite-app

# Start development server
bun run dev

# Build for production
bun run build
```

### Testing Package Locally

```bash
# Build the Grid package
cd packages/grid
bun run build

# Verify package contents
bunx npm pack --dry-run

# Test in example app
cd ../examples/vite-app
bun run dev
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## Security

See [SECURITY.md](./SECURITY.md) for security policy and vulnerability reporting.

## License

MIT © Cole Benefield

## Links

- [Documentation](https://github.com/coleski/datagrid#readme)
- [NPM Package](https://www.npmjs.com/package/@coleski/datagrid)
- [Issue Tracker](https://github.com/coleski/datagrid/issues)
- [Changelog](https://github.com/coleski/datagrid/blob/main/CHANGELOG.md)
