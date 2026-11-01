import { useEffect, type ReactNode } from 'react';
import { Activity, AlertTriangle, CheckCircle2, GitBranch, LoaderCircle, ShieldCheck, Table2 } from 'lucide-react';
import { LeftCurriculumPanel } from './components/LeftCurriculumPanel';
import { CenterSandboxPanel } from './components/CenterSandboxPanel';
import { RightInspectorPanel } from './components/RightInspectorPanel';
import { useFhirStore } from './store/use-fhir-store';

function TelemetryItem({ icon, label, value, tone = 'text-slate-300' }: { icon: ReactNode; label: string; value: string; tone?: string }) {
  return <div className="flex items-center gap-1.5 whitespace-nowrap"><span className="text-slate-600">{icon}</span><span className="text-[9px] uppercase tracking-wide text-slate-600">{label}</span><span className={`text-[10px] font-semibold ${tone}`}>{value}</span></div>;
}

export default function App() {
  const initializeLab = useFhirStore((state) => state.initializeLab);
  const dbInitialized = useFhirStore((state) => state.dbInitialized);
  const dbSyncing = useFhirStore((state) => state.dbSyncing);
  const dbError = useFhirStore((state) => state.dbError);
  const validationReport = useFhirStore((state) => state.validationReport);
  const activeDataset = useFhirStore((state) => state.activeDataset);
  useEffect(() => { void initializeLab(); }, [initializeLab]);
  const dbStatus = dbError ? 'error' : dbSyncing ? 'syncing' : dbInitialized ? 'ready' : 'booting';
  return <div className="flex h-screen min-h-[680px] flex-col overflow-hidden bg-slate-950 text-slate-200"><header className="shrink-0 border-b border-slate-800 bg-slate-950 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400 text-slate-950"><Activity className="h-5 w-5" /></div><div className="min-w-0"><h1 className="truncate text-sm font-bold tracking-tight text-slate-100">Global HL7 FHIR · SQL-on-FHIR v2 Learning Lab</h1><p className="truncate text-[10px] text-slate-500">Global-first blueprint untuk normalisasi data kesehatan Indonesia</p></div></div><div className="flex max-w-full flex-wrap items-center gap-x-4 gap-y-2"><TelemetryItem icon={<Table2 className="h-3 w-3" />} label="FHIR tables" value="27" tone="text-cyan-300" /><TelemetryItem icon={<GitBranch className="h-3 w-3" />} label="Analytical views" value="3" tone="text-violet-300" /><TelemetryItem icon={<ShieldCheck className="h-3 w-3" />} label="Validator rules" value="6" tone="text-amber-300" /><TelemetryItem icon={dbStatus === 'ready' ? <CheckCircle2 className="h-3 w-3" /> : dbStatus === 'error' ? <AlertTriangle className="h-3 w-3" /> : <LoaderCircle className="h-3 w-3 animate-spin" />} label="PGlite" value={dbStatus} tone={dbStatus === 'ready' ? 'text-emerald-300' : dbStatus === 'error' ? 'text-rose-300' : 'text-amber-300'} /></div></div>{dbError && <div className="mt-2 flex items-center gap-2 rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-200"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{dbError}</div>}</header><div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_minmax(440px,1fr)_360px] xl:grid-cols-[290px_minmax(520px,1fr)_420px]"><LeftCurriculumPanel /><CenterSandboxPanel /><RightInspectorPanel /></div><footer className="flex shrink-0 items-center justify-between border-t border-slate-800 bg-slate-950 px-4 py-1.5 text-[9px] text-slate-600"><span>Data sintetis untuk pembelajaran interoperabilitas · HL7 FHIR global</span><span>{activeDataset ? `${activeDataset.hospitalName} · ${validationReport?.valid ? 'conformant' : 'review issues'}` : 'Preparing dataset…'}</span></footer></div>;
}
