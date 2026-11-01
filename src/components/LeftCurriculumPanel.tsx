import { useState } from 'react';
import { BookOpenCheck, ChevronRight, Filter } from 'lucide-react';
import { CURRICULUM_MODULES } from '../data/curriculum-modules';
import { useFhirStore } from '../store/use-fhir-store';
import type { ImplementationStatus } from '../types/fhir-global';
import { StatusBadge } from './StatusBadge';

const FILTERS: Array<{ value: 'ALL' | ImplementationStatus; label: string; activeClass: string }> = [
  { value: 'ALL', label: 'Semua (12)', activeClass: 'border-cyan-400 bg-cyan-400/20 text-cyan-200 font-bold' },
  { value: 'IMPLEMENTED_SATUSEHAT', label: '🟢 Satusehat (6)', activeClass: 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold' },
  { value: 'PARTIAL_NATIONAL', label: '🟡 Partial (2)', activeClass: 'border-amber-400 bg-amber-500/20 text-amber-300 font-bold' },
  { value: 'PIONEER_GLOBAL_FHIR', label: '🔵 Pioneer (4)', activeClass: 'border-sky-400 bg-sky-500/20 text-sky-300 font-bold' },
];

const MODULE_STATUS_PILL: Record<ImplementationStatus, { text: string; cls: string }> = {
  IMPLEMENTED_SATUSEHAT: {
    text: '🟢 IMPLEMENTED (SATUSEHAT & LAB)',
    cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  },
  PARTIAL_NATIONAL: {
    text: '🟡 PARTIAL (ID) · IMPLEMENTED (LAB)',
    cls: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  },
  PIONEER_GLOBAL_FHIR: {
    text: '🔵 NOT YET (ID) · PIONEER IMPLEMENTED',
    cls: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
  },
};
export function LeftCurriculumPanel() {
  const activeModuleNumber = useFhirStore((state) => state.activeModuleNumber);
  const statusFilter = useFhirStore((state) => state.statusFilter);
  const activeDataset = useFhirStore((state) => state.activeDataset);
  const setActiveModule = useFhirStore((state) => state.setActiveModule);
  const setStatusFilter = useFhirStore((state) => state.setStatusFilter);
  const [expandedModule, setExpandedModule] = useState<number | null>(null);
  const visibleModules = CURRICULUM_MODULES.filter((item) => statusFilter === 'ALL' || item.implementationStatus === statusFilter);
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-slate-800 bg-slate-950/95">
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100"><BookOpenCheck className="h-4 w-4 text-cyan-300" /> Kurikulum Lab</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <section>
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
              <Filter className="h-3 w-3 text-cyan-300" /> Filter Status Adopsi
            </span>
            <span className="text-[9px] text-slate-500">{visibleModules.length} modul tampil</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded px-2 py-1.5 text-center text-[9.5px] transition ${
                  statusFilter === filter.value
                    ? filter.activeClass
                    : 'border border-transparent bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>
        <nav className="mt-4 space-y-2" aria-label="Navigasi modul kurikulum">
          {visibleModules.map((item) => {
            const pill = MODULE_STATUS_PILL[item.implementationStatus];
            const isExpanded = expandedModule === item.moduleNumber;
            const isActive = activeModuleNumber === item.moduleNumber;
            return (
              <div
                key={item.id}
                className={`overflow-hidden rounded-lg border transition ${
                  isActive ? 'border-cyan-500/60 bg-slate-900/90 shadow-md shadow-cyan-950/30' : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveModule(item.moduleNumber);
                    setExpandedModule(isExpanded ? null : item.moduleNumber);
                  }}
                  className="flex w-full items-start gap-2.5 p-2.5 text-left transition hover:bg-slate-800/40"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                      isActive ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.moduleNumber}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-slate-200">{item.title}</span>
                    <span className="mt-0.5 block truncate text-[9px] text-slate-500">{item.level}</span>
                    <span className={`mt-1.5 inline-block rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wide ${pill.cls}`}>
                      {pill.text}
                    </span>
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
                      isExpanded ? 'rotate-90 text-cyan-300' : 'group-hover:text-slate-300'
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800/80 bg-slate-950/70 p-3 text-[10px] leading-relaxed">
                    <p className="mt-1.5 text-slate-300 leading-relaxed">{item.mentalModelSummary}</p>

                    <div className="mt-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Resource FHIR yang Dicakup:</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.resourcesCovered.map((res) => (
                          <span key={res} className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-cyan-300">
                            {res}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Tabel PostgreSQL (PGlite):</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.targetTables.map((tbl) => (
                          <span key={tbl} className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-emerald-300">
                            {tbl}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Tahapan Konsep Step-by-Step:</div>
                      <ol className="mt-1.5 space-y-1.5">
                        {item.stepByStepExplanation.map((step, idx) => (
                          <li key={step} className="flex gap-2 text-slate-300 leading-relaxed">
                            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[8px] font-bold text-cyan-300">
                              {idx + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2">
                      <span className="text-[9px] text-slate-500">Status Adopsi:</span>
                      <StatusBadge status={item.implementationStatus} compact />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
