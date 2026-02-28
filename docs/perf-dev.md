# Performance & Development Guidelines

## Infinite Loops & Compiling Issues

1.  **NO `router.replace` / `router.push` in `useEffect` without guards**
    *   **Bad:**
        ```typescript
        useEffect(() => {
          router.replace(`?param=${value}`);
        }, [value]);
        ```
    *   **Good:**
        ```typescript
        useEffect(() => {
          const current = searchParams.get('param');
          if (current !== value) {
            router.replace(`?param=${value}`);
          }
        }, [value, searchParams]);
        ```

2.  **Avoid Unstable Props**
    *   Do not pass inline functions `() => ...` or new objects `{}` to heavy components (like Grid or Feed) if possible. Use `useCallback` or `useMemo`.

3.  **Server Components First**
    *   Keep page roots (e.g., `page.tsx`) as Server Components.
    *   Fetch data on the server with `revalidate` or `cache`.
    *   Only use `"use client"` for leaf components that need interactivity (buttons, tabs).

4.  **Hydration Mismatch**
    *   Ensure initial client state matches server state.
    *   If initializing from `localStorage` or `URL`, do it in `useEffect` (client-only), not in `useState` initializer.

5.  **State Management**
    *   Do not call `setState` during render.
    *   Use `useEffect` sparingly for syncing state; prefer derived state or event handlers.
