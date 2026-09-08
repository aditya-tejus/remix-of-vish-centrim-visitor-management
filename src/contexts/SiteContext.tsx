import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { services } from "@/services/registry";
import type { SiteRef } from "@/services/contracts";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "centrim.currentSiteId";

interface SiteState {
  sites: SiteRef[];
  currentSite: SiteRef | null;
  currentSiteId: string | null;
  loading: boolean;
  setCurrentSiteId: (id: string) => void;
  /** True while the only available site is the placeholder created for pre-existing data. */
  isLegacySite: boolean;
}

const SiteContext = createContext<SiteState>({
  sites: [],
  currentSite: null,
  currentSiteId: null,
  loading: true,
  setCurrentSiteId: () => {},
  isLegacySite: false,
});

export function SiteProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [sites, setSites] = useState<SiteRef[]>([]);
  const [currentSiteId, setCurrentSiteIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setSites([]);
      setLoading(false);
      return;
    }
    (async () => {
      const list = await services.sites.listSites();
      if (cancelled) return;
      setSites(list);
      setCurrentSiteIdState((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const setCurrentSiteId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setCurrentSiteIdState(id);
  }, []);

  const value = useMemo<SiteState>(() => {
    const currentSite = sites.find((s) => s.id === currentSiteId) ?? null;
    return {
      sites,
      currentSite,
      currentSiteId,
      loading,
      setCurrentSiteId,
      isLegacySite: !!currentSite?.isLegacyPlaceholder,
    };
  }, [sites, currentSiteId, loading, setCurrentSiteId]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

/** Current site for every staff-side read and write. Kiosk screens do not use this. */
export const useSite = () => useContext(SiteContext);
