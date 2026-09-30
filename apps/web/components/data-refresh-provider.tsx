'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface DataRefreshContextValue {
  versionFor: (key: string) => number;
  invalidate: (keys: string[]) => void;
}

const DataRefreshContext = createContext<DataRefreshContextValue | null>(null);

export function DataRefreshProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [versions, setVersions] = useState<Record<string, number>>({});

  const invalidate = useCallback((keys: string[]) => {
    setVersions((current) => {
      const next = { ...current };
      for (const key of keys) next[key] = (next[key] ?? 0) + 1;
      return next;
    });
  }, []);

  const value = useMemo<DataRefreshContextValue>(() => ({
    versionFor: (key) => versions[key] ?? 0,
    invalidate,
  }), [invalidate, versions]);

  return <DataRefreshContext.Provider value={value}>{children}</DataRefreshContext.Provider>;
}

export function useDataRefresh(): DataRefreshContextValue {
  const context = useContext(DataRefreshContext);
  if (!context) throw new Error('DataRefreshProvider is required.');
  return context;
}

export function useDataVersion(key: string): number {
  return useDataRefresh().versionFor(key);
}
