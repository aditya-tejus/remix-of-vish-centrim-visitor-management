import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCheck2, Clock3, Search, ShieldAlert, Plus } from "lucide-react";
import { useSite } from "@/contexts/SiteContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCredentialTypes } from "@/hooks/useContractorEnforcement";
import { useDocumentQueue, fetchDocumentDetail, type DocumentDetail } from "@/hooks/useContractorDocuments";
import { DocumentReviewSheet } from "@/components/contractor/DocumentReviewSheet";
import { ageInDays, filterQueue, STATUS_TEXT, type DocumentStatus } from "@/lib/contractorDocuments";

const STATUS_FILTERS = [
  { value: "pending", label: "Awaiting review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "superseded", label: "Superseded" },
  { value: "not_required", label: "Not required" },
  { value: "all", label: "All" },
];

const AGE_FILTERS = [
  { value: "0", label: "Any age" },
  { value: "3", label: "Waiting 3 days or more" },
  { value: "7", label: "Waiting a week or more" },
];

/** The reviewer's single list. One decision at a time — no bulk approve. */
export default function ContractorDocumentReviews() {
  const { currentSiteId } = useSite();
  const { can } = usePermissions();
  const { activeTypes } = useCredentialTypes();
  const { rows, loading, refetch } = useDocumentQueue(currentSiteId);
  const [status, setStatus] = useState("pending");
  const [typeId, setTypeId] = useState("all");
  const [age, setAge] = useState("0");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DocumentDetail | null>(null);

  const filtered = useMemo(
    () => filterQueue(rows, { status, credentialTypeId: typeId, minAgeDays: Number(age), search }),
    [rows, status, typeId, age, search]
  );

  if (!can("contractor.credentials.view")) {
    return (
      <AppShell title="Contractor documents" subtitle="Review submitted compliance evidence.">
        <Card className="p-6 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            You do not have permission to see contractor compliance documents.
          </p>
        </Card>
      </AppShell>
    );
  }

  const openRow = async (id: string) => setSelected(await fetchDocumentDetail(id));
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <AppShell
      title="Contractor documents"
      subtitle="Evidence waiting for a decision at this site."
      mainClassName="p-4 sm:p-6"
    >
      <div className="space-y-4 max-w-5xl">
        <Card className="p-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock3 className="h-4 w-4 text-warning" aria-hidden="true" />
            {pendingCount} awaiting review
          </span>
          <div className="flex-1 min-w-[180px] relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              className="pl-9"
              placeholder="Search contractor, company or document"
              aria-label="Search contractor documents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeId} onValueChange={setTypeId}>
            <SelectTrigger className="w-[180px]" aria-label="Filter by document type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All document types</SelectItem>
              {activeTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={age} onValueChange={setAge}>
            <SelectTrigger className="w-[190px]" aria-label="Filter by how long it has waited"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AGE_FILTERS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>

        <Card className="divide-y divide-border">
          {loading && <p className="p-6 text-sm text-muted-foreground">Loading…</p>}
          {!loading && filtered.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nothing here. Documents appear as soon as they are submitted.</p>
          )}
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => openRow(r.id)}
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 hover:bg-muted/50"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground truncate">
                  {r.holder_name}
                  {r.holder_scope === "company" ? " (company)" : ""}
                </span>
                <span className="block text-[12px] text-muted-foreground truncate">
                  {r.type_label} · version {r.version} · submitted by {r.submitted_by}
                  {` · waiting ${ageInDays(r.submitted_at)} day${ageInDays(r.submitted_at) === 1 ? "" : "s"}`}
                </span>
              </span>
              <Badge variant="outline" className="shrink-0 text-[11px]">
                {STATUS_TEXT[r.status as DocumentStatus] ?? r.status}
              </Badge>
            </button>
          ))}
        </Card>

        <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
          <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
          Each document is decided on its own. Approving records who decided and when.
        </p>
      </div>

      <DocumentReviewSheet
        document={selected}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
        onDecided={() => { setSelected(null); void refetch(); }}
      />
    </AppShell>
  );
}
