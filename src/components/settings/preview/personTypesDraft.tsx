/**
 * Phase 7E hardening — lets the Visitor types editor hand its unsaved rows to
 * the preview panel, so the preview shows what you are about to save.
 *
 * Only Visitor types publishes a draft. Every other preview reads saved
 * settings and says so.
 */
import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import type { PersonTypeConfigRow, PersonTypeExtras } from "@/hooks/usePersonTypes";

export interface PersonTypesDraft {
  rows: PersonTypeConfigRow[];
  extras: PersonTypeExtras;
  dirty: boolean;
}

interface Store {
  draft: PersonTypesDraft | null;
  setDraft: (draft: PersonTypesDraft | null) => void;
}

const Ctx = createContext<Store>({ draft: null, setDraft: () => {} });

export function PersonTypesDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<PersonTypesDraft | null>(null);
  const setDraft = useCallback((next: PersonTypesDraft | null) => setDraftState(next), []);
  return <Ctx.Provider value={{ draft, setDraft }}>{children}</Ctx.Provider>;
}

export function usePersonTypesDraft() {
  return useContext(Ctx);
}
