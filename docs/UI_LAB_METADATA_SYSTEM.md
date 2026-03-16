# UI Lab Component Metadata System

## Overview

The UI Lab Metadata System provides a unified approach for documenting and tracking component usage across both `/ui-lab` and `/ui-lab-admin`. Each component demo now displays:

- Component title and description
- Source file path (with copy button)
- Status badge (Rendered/Draft/Deprecated)
- Usage count
- List of files where the component is used (with copy buttons)

## Architecture

### Core Files

1. **`src/components/ui-lab/types.ts`** - Shared TypeScript types
2. **`src/components/ui-lab/ComponentMetaCard.tsx`** - Reusable metadata display component
3. **`src/components/ui-lab/registry.ts`** - Manual component metadata registry

### Component Structure

```typescript
interface ComponentUsageMeta {
  title: string;              // Display name
  sourcePath: string;         // Path to source file
  status: ComponentStatus;    // "rendered" | "draft" | "deprecated"
  usedIn: string[];          // List of files using this component
  description?: string;       // Optional description
}
```

## Usage

### 1. Add Component to Registry

Edit `src/components/ui-lab/registry.ts`:

```typescript
// For public UI Lab components
export const UI_LAB_REGISTRY: Record<string, ComponentUsageMeta> = {
  "my-component": {
    title: "MyComponent",
    sourcePath: "src/components/MyComponent.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(public)/page.tsx",
      "src/components/SomeOtherComponent.tsx",
    ],
    description: "Brief description of what this component does",
  },
};

// For admin UI Lab components
export const ADMIN_LAB_REGISTRY: Record<string, ComponentUsageMeta> = {
  "admin-component": {
    title: "AdminComponent",
    sourcePath: "src/components/admin/AdminComponent.tsx",
    status: "rendered",
    usedIn: [
      "src/app/admin/page.tsx",
    ],
    description: "Admin-specific component description",
  },
};
```

### 2. Update Section Component

Wrap your demo content with `ComponentMetaCard`:

```typescript
import { ComponentMetaCard } from "@/components/ui-lab/ComponentMetaCard";
import { getComponentMeta } from "@/components/ui-lab/registry";

export function MyComponentSection() {
  const componentMeta = getComponentMeta("my-component", "ui-lab");
  // or for admin: getComponentMeta("admin-component", "admin")

  return (
    <section id="my-component" className="space-y-8">
      {componentMeta && (
        <ComponentMetaCard {...componentMeta}>
          {/* Your demo content here */}
          <div className="space-y-8">
            <h3>Demo State 1</h3>
            <MyComponent />
            
            <h3>Demo State 2</h3>
            <MyComponent variant="alt" />
          </div>
        </ComponentMetaCard>
      )}
    </section>
  );
}
```

## Status Badges

- **Rendered** (green) - Component is actively used in production
- **Draft** (gray) - Component is in development, not yet in production
- **Deprecated** (red) - Component is being phased out

## Features

### Copy to Clipboard

- Click the copy icon next to any path to copy it to clipboard
- Useful for quickly navigating to source files or usage locations

### Collapsible Usage List

- If a component is used in more than 3 places, the list is collapsed by default
- Click "Show all (N)" to expand the full list
- Click "Show less" to collapse again

### Empty State

- Components with no production usage show "Not used in production yet (lab-only component)"

## Current Implementation Status

### Completed

- ✅ Core infrastructure (types, ComponentMetaCard, registry)
- ✅ EventScheduleSection (ui-lab-admin)
- ✅ PlanCardSection (ui-lab)
- ✅ OpeningHoursSection (ui-lab)
- ✅ DateTimePickerSection (ui-lab)

### Remaining Work

#### ui-lab Sections
- HeaderSection
- ActivitySection
- PlaceCardSection
- FiltersSection
- DiscoverySection
- NavigationSection
- CitySection
- NewsSection
- ShellSection
- UiPrimitivesSection

#### ui-lab-admin Sections
- AdminUIRulesSection
- LayoutContractSection
- TypographySection
- HeaderSection
- PageStructureSection
- ToolbarsSection
- KpiCardsSection
- ContentShellsSection
- TablesSection
- ListsQueuesSection
- StatesSection
- FormsSection
- OverlaysSection

## Future Enhancements

### Potential Automation

The current system uses manual registry entries. Future improvements could include:

1. **AST-based usage detection** - Automatically scan codebase for component imports
2. **Build-time generation** - Generate registry during build process
3. **Git integration** - Track component creation/modification dates
4. **Usage analytics** - Track which components are most/least used

### Additional Metadata

Could be extended to include:

- Last modified date
- Component author
- Related components
- Props documentation link
- Storybook link
- Test coverage percentage

## Best Practices

1. **Keep registry up to date** - When adding new components or moving files, update the registry
2. **Use descriptive titles** - Make it clear what the component does
3. **List all usages** - Include all production files that import the component
4. **Set correct status** - Use "draft" for WIP components, "rendered" for production
5. **Add descriptions** - Brief but informative descriptions help developers understand purpose

## Maintenance

### Adding a New Component

1. Create the component
2. Add entry to appropriate registry (UI_LAB_REGISTRY or ADMIN_LAB_REGISTRY)
3. Create or update section component to use ComponentMetaCard
4. Test in browser to verify metadata displays correctly

### Updating Component Location

1. Move/rename the component file
2. Update `sourcePath` in registry
3. Update any imports in `usedIn` files if paths changed

### Deprecating a Component

1. Change `status` to "deprecated" in registry
2. Add note in description about replacement component
3. Plan migration timeline
4. Remove from registry once fully removed from codebase

## Questions?

For questions or suggestions about the metadata system, check:
- This documentation
- `src/components/ui-lab/ComponentMetaCard.tsx` for implementation details
- `src/components/ui-lab/registry.ts` for examples
