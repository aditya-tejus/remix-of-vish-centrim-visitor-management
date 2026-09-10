import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";

/**
 * Practice records look like ordinary records on purpose, so the only honest
 * place to say so is a standing notice on the site that carries them.
 */
export function PracticeDataNotice() {
  const { currentSiteId, currentSite } = useSite();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!currentSiteId) {
      setLoaded(false);
      return;
    }
    (supabase.from("demo_seed_runs" as any) as any)
      .select("id")
      .eq("branch_id", currentSiteId)
      .eq("status", "active")
      .limit(1)
      .then(({ data }: any) => {
        if (active) setLoaded(Boolean(data?.length));
      });
    return () => {
      active = false;
    };
  }, [currentSiteId]);

  if (!loaded) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
      <FlaskConical className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">Practice data is loaded at {currentSite?.name ?? "this site"}</p>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Some residents, visitors, contractors and register entries here are practice records for training,
          not real people.{" "}
          <Link to="/settings" className="underline underline-offset-2">
            Remove them in Settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
