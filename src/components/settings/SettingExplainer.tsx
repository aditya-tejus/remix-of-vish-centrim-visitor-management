/**
 * Stage 4 — every configurable decision explains itself before it is changed:
 * what it controls, where it applies, who may change it, the inherited value,
 * and what it does to the kiosk, the staff desktop and records already saved.
 */
import { ReactNode } from "react";
import { Info } from "lucide-react";

export interface SettingExplainerProps {
  title: string;
  controls: string;
  appliesTo: string;
  changeableBy: string;
  inherited: string;
  kioskEffect: string;
  deskEffect: string;
  existingRecords?: string;
  children?: ReactNode;
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[104px_1fr] gap-2">
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="text-[13px] text-foreground">{value}</dd>
  </div>
);

export function SettingExplainer({
  title,
  controls,
  appliesTo,
  changeableBy,
  inherited,
  kioskEffect,
  deskEffect,
  existingRecords = "Records already saved are not changed.",
  children,
}: SettingExplainerProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <dl className="space-y-1.5">
        <Row label="Controls" value={controls} />
        <Row label="Applies to" value={appliesTo} />
        <Row label="Changed by" value={changeableBy} />
        <Row label="Current" value={inherited} />
        <Row label="Kiosk" value={kioskEffect} />
        <Row label="Staff screens" value={deskEffect} />
        <Row label="Past records" value={existingRecords} />
      </dl>
      {children && <div className="pt-1">{children}</div>}
    </section>
  );
}
