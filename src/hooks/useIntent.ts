import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type IntentType = 'kuda' | 'classes' | 'birthday' | 'routes';

const STORAGE_KEY = 'mamago:last_intent';

export function useIntent(defaultIntent: IntentType = 'kuda') {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state with defaultIntent to match server render
  const [intent, setIntent] = useState<IntentType>(defaultIntent);

  // Initialize from URL/Storage on mount (client-side only)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      // 1. Check URL first
      const urlIntent = searchParams.get('intent');
      if (urlIntent && ['kuda', 'classes', 'birthday', 'routes'].includes(urlIntent)) {
        setIntent(urlIntent as IntentType);
        return;
      }
      
      // 2. Check localStorage if no URL param
      const storedIntent = localStorage.getItem(STORAGE_KEY);
      if (storedIntent && ['kuda', 'classes', 'birthday', 'routes'].includes(storedIntent)) {
        setIntent(storedIntent as IntentType);
      }
    });
    
    return () => cancelAnimationFrame(id);
  }, []); // Run once on mount

  // Sync with URL when intent changes
  useEffect(() => {
    const currentUrlIntent = searchParams.get('intent');
    
    // Only update URL if it's different from current state
    // This prevents infinite loop: state change -> url update -> searchParams change -> state change ...
    const shouldBeInUrl = intent !== defaultIntent;
    const isCurrentlyInUrl = currentUrlIntent === intent;
    const isDefaultInUrl = !currentUrlIntent && intent === defaultIntent;

    if ((shouldBeInUrl && !isCurrentlyInUrl) || (!shouldBeInUrl && currentUrlIntent)) {
      const params = new URLSearchParams(searchParams.toString());
      
      if (intent === defaultIntent) {
        params.delete('intent');
      } else {
        params.set('intent', intent);
      }
      
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, intent);
    }
  }, [intent, router, searchParams, defaultIntent]);

  // Listen to URL changes (e.g. back button)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const urlIntent = searchParams.get('intent');
      if (urlIntent && ['kuda', 'classes', 'birthday', 'routes'].includes(urlIntent)) {
        setIntent(urlIntent as IntentType);
      } else if (!urlIntent && intent !== defaultIntent) {
        // If URL has no intent but state has non-default, it might mean we navigated back to default
        // However, we usually want to keep state in sync. 
        // Let's rely on setIntent being called by UI for direct changes.
        // This effect handles external navigation changes.
        setIntent(defaultIntent);
      }
    });
    
    return () => cancelAnimationFrame(id);
  }, [searchParams, defaultIntent]);

  return { intent, setIntent };
}
