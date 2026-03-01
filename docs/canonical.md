# Canonical Sources of Truth

To maintain codebase health and avoid duplication, please adhere to these canonical component sources.

### Core Components

| Component | Canonical Path | Description |
|-----------|---------------|-------------|
| **IntentTabs** | `src/components/city/IntentTabs.tsx` | Main navigation tabs for city/activity intents. Handles routing and active state. |
| **DiscoveryFilters** | `src/features/filters/discovery/DiscoveryFilters.tsx` | Main filter interface for discovery pages. |
| **FilterPill** | `src/features/filters/ui/FilterPill.tsx` | Standard pill UI for filters. |

### Guidelines

1. **Do Not Create Duplicates**
   - Never create `IntentTabs` in `src/components/navigation` or `src/components/discovery`.
   - Always import from the canonical path or the feature barrel file.

2. **Feature-Based Architecture**
   - Filters logic resides in `src/features/filters`.
   - UI components should be imported from their feature folder or a shared UI library.

3. **UI Lab**
   - The UI Lab (`/ui-lab`) should only demonstrate canonical components.
   - Do not create "demo versions" of core components unless absolutely necessary for isolation.
