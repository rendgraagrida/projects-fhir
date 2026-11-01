import type { ImplementationStatus } from '../types/fhir-global';

interface StatusBadgeProps {
  status: ImplementationStatus;
  compact?: boolean;
}

const STATUS_COPY: Record<ImplementationStatus, { icon: string; label: string; shortLabel: string; className: string }> = {
  IMPLEMENTED_SATUSEHAT: {
    icon: '🟢',
    label: '[IMPLEMENTED — SUDAH DIIMPLEMENTASIKAN DI SATUSEHAT & LAB]',
    shortLabel: 'IMPLEMENTED (SATUSEHAT & LAB)',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  },
  PARTIAL_NATIONAL: {
    icon: '🟡',
    label: '[PARTIAL — SEBAGIAN DI INDONESIA · IMPLEMENTED FULL DI LAB]',
    shortLabel: 'PARTIAL (ID) · IMPLEMENTED (LAB)',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  PIONEER_GLOBAL_FHIR: {
    icon: '🔵',
    label: '[NOT YET IN SATUSEHAT — PIONEER GLOBAL FHIR IMPLEMENTED DI LAB]',
    shortLabel: 'NOT YET (ID) · PIONEER IMPLEMENTED',
    className: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  },
};

export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const copy = STATUS_COPY[status];
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${copy.className}`} title={copy.label}>
      <span aria-hidden="true">{copy.icon}</span>
      <span className={compact ? 'truncate' : 'whitespace-normal'}>{compact ? copy.shortLabel : copy.label}</span>
    </span>
  );
}

export function statusAccent(status: ImplementationStatus): string {
  if (status === 'IMPLEMENTED_SATUSEHAT') return 'text-emerald-300';
  if (status === 'PARTIAL_NATIONAL') return 'text-amber-300';
  return 'text-sky-300';
}
