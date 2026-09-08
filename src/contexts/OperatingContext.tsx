import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import {
  DEFAULT_PACK_ID,
  packById,
  resolvePack,
  SegmentPack,
  SegmentPackId,
} from "@/lib/segmentPacks";

/**
 * Stage 4 — resolved operating context.
 *
 * Inheritance, most specific first:
 *   area/wing/stage > person type > role > site > organisation > jurisdiction > default
 *
 * The pack itself is decided at site level (the site record carries the country
 * and the kind of place it is). Everything below the site can still override an
 * individual setting through the scoped-settings helpers.
 */

interface OperatingContextState {
  loading: boolean;
  /** Site the wording and modules were resolved from, when known. */
  siteId: string | null;
  siteName: string | null;
  organisationId: string | null;
  pack: SegmentPack;
  packId: SegmentPackId;
  terms: SegmentPack["terms"];
  modules: SegmentPack["modules"];
  jurisdiction: "AU" | "UK";
  /** Where the resolved value came from, shown to administrators. */
  source: "site" | "account default";
  refresh: () => void;
}

const fallbackPack = packById(DEFAULT_PACK_ID);

const Ctx = createContext<OperatingContextState>({
  loading: true,
  siteId: null,
  siteName: null,
  organisationId: null,
  pack: fallbackPack,
  packId: fallbackPack.id,
  terms: fallbackPack.terms,
  modules: fallbackPack.modules,
  jurisdiction: fallbackPack.jurisdiction,
  source: "account default",
  refresh: () => {},
});

/** Kiosks are pinned to a site with `?site=<id>`; the choice is remembered. */
export function kioskSiteId(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("site");
  if (fromUrl) {
    localStorage.setItem("centrim.kioskSiteId", fromUrl);
    return fromUrl;
  }
  return localStorage.getItem("centrim.kioskSiteId");
}

export function OperatingContextProvider({ children }: { children: ReactNode }) {
  const { currentSite } = useSite();
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{
    loading: boolean;
    pack: SegmentPack;
    siteId: string | null;
    siteName: string | null;
    organisationId: string | null;
    source: "site" | "account default";
  }>({
    loading: true,
    pack: fallbackPack,
    siteId: null,
    siteName: null,
    organisationId: null,
    source: "account default",
  });

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const siteId = currentSite?.id ?? kioskSiteId();

      if (siteId) {
        // Site records are readable without a login so the kiosk shows the right wording.
        const { data } = await supabase
          .from("branches")
          .select("id, name, jurisdiction, site_structure, organisation_id")
          .eq("id", siteId)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          setState({
            loading: false,
            pack: resolvePack(data.jurisdiction, data.site_structure),
            siteId: data.id,
            siteName: data.name,
            organisationId: data.organisation_id,
            source: "site",
          });
          return;
        }
      }

      // No site yet (or an unknown one): fall back to the account-wide defaults
      // that the prototype has always used, so existing data keeps loading.
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["jurisdiction", "site_structure"]);
      if (cancelled) return;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value; });
      setState({
        loading: false,
        pack: resolvePack(map.jurisdiction, map.site_structure),
        siteId: null,
        siteName: null,
        organisationId: null,
        source: "account default",
      });
    })();

    return () => { cancelled = true; };
  }, [currentSite?.id, tick]);

  const value = useMemo<OperatingContextState>(
    () => ({
      loading: state.loading,
      siteId: state.siteId,
      siteName: state.siteName,
      organisationId: state.organisationId,
      pack: state.pack,
      packId: state.pack.id,
      terms: state.pack.terms,
      modules: state.pack.modules,
      jurisdiction: state.pack.jurisdiction,
      source: state.source,
      refresh,
    }),
    [state, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useOperatingContext = () => useContext(Ctx);

/** Settings written for one site are stored under a site-suffixed key. */
export const siteScopedKey = (key: string, siteId?: string | null) =>
  siteId ? `${key}@${siteId}` : key;
