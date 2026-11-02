import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, ClipboardList, Code2, Database, FileJson, Info, Search, TableProperties, X, XCircle } from 'lucide-react';
import { FHIR_ATTRIBUTE_ANNOTATIONS } from '../data/simrs-normalization-seeds';
import { SQL_ON_FHIR_VIEW_DEFINITIONS, evaluateFhirPath } from '../lib/sql-on-fhir-flattener';
import { TABLE_METADATA } from '../lib/pglite-db';
import { getResourceFromDataset, useFhirStore } from '../store/use-fhir-store';
import type { FhirResourceType } from '../types/fhir-global';
import { StatusBadge } from './StatusBadge';

const TABS = [
  { value: 'fhir-json' as const, label: 'FHIR JSON', icon: FileJson },
  { value: 'view-definition' as const, label: 'ViewDefinition', icon: Code2 },
  { value: 'pglite-tables' as const, label: 'PGlite tables', icon: Database },
  { value: 'validator' as const, label: 'Validator', icon: ClipboardList },
];

export function RightInspectorPanel() {
  const rightTab = useFhirStore((state) => state.rightTab);
  const setRightTab = useFhirStore((state) => state.setRightTab);
  return <aside className="flex h-full min-h-0 flex-col border-l border-slate-800 bg-slate-950/95"><div className="flex shrink-0 overflow-x-auto border-b border-slate-800 p-2">{TABS.map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => setRightTab(value)} className={`flex min-w-max items-center gap-1.5 rounded px-2 py-2 text-[10px] font-semibold ${rightTab === value ? 'bg-cyan-400 text-slate-950' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div><div className="min-h-0 flex-1 overflow-y-auto p-3">{rightTab === 'fhir-json' && <FhirJsonTab />}{rightTab === 'view-definition' && <ViewDefinitionTab />}{rightTab === 'pglite-tables' && <PgliteTab />}{rightTab === 'validator' && <ValidatorTab />}</div></aside>;
}

function FhirJsonTab() {
  const dataset = useFhirStore((state) => state.activeDataset);
  const selectedResourceType = useFhirStore((state) => state.selectedResourceType);
  const selectedResourceId = useFhirStore((state) => state.selectedResourceId);
  const selectResource = useFhirStore((state) => state.selectResource);
  const resource = getResourceFromDataset(dataset, selectedResourceType, selectedResourceId);
  const resourcesByType = useMemo(() => { const map = new Map<FhirResourceType, NonNullable<typeof dataset>['allResources']>(); for (const item of dataset?.allResources ?? []) { const list = map.get(item.resourceType) ?? []; list.push(item); map.set(item.resourceType, list); } return map; }, [dataset]);
  const annotations = FHIR_ATTRIBUTE_ANNOTATIONS[selectedResourceType] ?? {};
  return <div className="space-y-3"><SectionHeading icon={<FileJson className="h-4 w-4 text-cyan-300" />} title="Live HL7 FHIR JSON" subtitle="Resource terpilih dan penjelasan atribut Bahasa Indonesia." /><label className="block text-[10px] text-slate-500">Resource selector<select value={`${selectedResourceType}/${selectedResourceId}`} onChange={(event) => { const [type, ...idParts] = event.target.value.split('/'); selectResource(type as FhirResourceType, idParts.join('/')); }} className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2 py-2 text-[10px] text-slate-200 outline-none">{Array.from(resourcesByType.entries()).flatMap(([type, resources]) => resources.map((item) => <option key={`${type}/${item.id}`} value={`${type}/${item.id}`}>{type}/{item.id}</option>))}</select></label>{resource ? <><pre className="max-h-[440px] overflow-auto rounded border border-slate-800 bg-slate-900 p-3 text-[9px] leading-relaxed text-cyan-100">{JSON.stringify(resource, null, 2)}</pre><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-[10px] font-bold text-slate-200"><Info className="h-3 w-3 text-amber-300" /> Indonesian attribute annotations</div><div className="mt-2 space-y-2">{Object.entries(annotations).map(([path, explanation]) => <div key={path} className="border-l-2 border-cyan-500/40 pl-2"><code className="text-[9px] text-cyan-300">{path}</code><p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{explanation}</p></div>)}{Object.keys(annotations).length === 0 && <p className="text-[10px] text-slate-500">Belum ada anotasi untuk resource ini.</p>}</div></div></> : <EmptyState label="Resource belum tersedia pada dataset aktif." />}</div>;
}

function ViewDefinitionTab() {
  const dataset = useFhirStore((state) => state.activeDataset);
  const flattenedResult = useFhirStore((state) => state.flattenedResult);
  const selectedViewDefName = useFhirStore((state) => state.selectedViewDefName);
  const setSelected = useFhirStore((state) => state.selectViewDef);
  const view = SQL_ON_FHIR_VIEW_DEFINITIONS.find((item) => item.name === selectedViewDefName) ?? SQL_ON_FHIR_VIEW_DEFINITIONS[0];
  const rows = useMemo(() => {
    if (!view) return [];
    const flattenedRows = view?.targetTable ? flattenedResult?.tables[view.targetTable] : undefined;
    if (flattenedRows?.length) return flattenedRows.slice(0, 3).map((row, index) => ({ id: String(row.id ?? index + 1), values: Object.entries(row).map(([name, output]) => ({ name, expression: name, output })) }));
    if (!dataset) return [];
    const resourceRows = dataset.allResources.filter((resource) => resource.resourceType === view.resource);
    return resourceRows.slice(0, 3).map((resource) => ({ id: resource.id, values: view.select.flatMap((select) => (select.column ?? []).map((column) => ({ name: column.name, expression: column.path, output: evaluateFhirPath(resource, column.path, resource) }))) }));
  }, [dataset, flattenedResult, view]);
  return <div className="space-y-3"><SectionHeading icon={<Code2 className="h-4 w-4 text-violet-300" />} title="SQL-on-FHIR v2 ViewDefinition" subtitle="FHIRPath declarative flattening dan preview output." /><select value={view?.name ?? ''} onChange={(event) => setSelected(event.target.value)} className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-2 text-[10px] text-slate-200 outline-none">{SQL_ON_FHIR_VIEW_DEFINITIONS.map((item) => <option key={item.name} value={item.name}>{item.name} → {item.targetTable}</option>)}</select>{view && <><div className={`rounded border p-2 ${view.name === 'fhir_claim_item_view' ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-800 bg-slate-900/60'}`}><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-200">{view.targetTable}</span>{view.name === 'fhir_claim_item_view' && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-slate-950">forEach: item</span>}</div><p className="mt-1 text-[10px] text-slate-500">Resource: {view.resource} · {view.description}</p></div><pre className="max-h-[330px] overflow-auto rounded border border-slate-800 bg-slate-900 p-3 text-[9px] leading-relaxed text-violet-100">{JSON.stringify(view, null, 2)}</pre><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="mb-2 text-[10px] font-bold text-slate-200">FHIRPath expression breakdown</div><div className="space-y-2">{view.select.flatMap((select) => select.column ?? []).map((column) => <div key={column.name} className="rounded bg-slate-950/60 p-2"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-300">{column.name}</span><span className="text-[9px] text-slate-600">{column.type ?? 'auto'}</span></div><code className="mt-1 block break-all text-[9px] text-violet-300">{column.path}</code></div>)}</div></div><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-slate-200"><Search className="h-3 w-3 text-cyan-300" /> Live flattened row output</div>{rows.length ? rows.map((row) => <div key={row.id} className="mb-2 rounded border border-slate-800 p-2"><div className="mb-1 text-[9px] font-semibold text-cyan-300">{view.resource}/{row.id}</div>{row.values.map((value) => <div key={value.name} className="grid grid-cols-[100px_1fr] gap-2 text-[9px]"><span className="text-slate-500">{value.name}</span><span className="truncate text-slate-300">{JSON.stringify(value.output)}</span></div>)}</div>) : <p className="text-[10px] text-slate-500">Tidak ada resource untuk view ini.</p>}</div></>}</div>;
}

function PgliteTab() {
  const selectedTableName = useFhirStore((state) => state.selectedTableName);
  const tableRowsPreview = useFhirStore((state) => state.tableRowsPreview);
  const selectTable = useFhirStore((state) => state.selectTable);
  const dbInitialized = useFhirStore((state) => state.dbInitialized);
  const dbSyncing = useFhirStore((state) => state.dbSyncing);
  const [tableSearch, setTableSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'ALL' | 'table' | 'view'>('ALL');

  const visibleTables = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return TABLE_METADATA.filter((item) => {
      const matchKind = kindFilter === 'ALL' || item.kind === kindFilter;
      const matchQ =
        !q ||
        item.tableName.toLowerCase().includes(q) ||
        item.resourceType.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return matchKind && matchQ;
    });
  }, [tableSearch, kindFilter]);

  return (
    <div className="space-y-3">
      <SectionHeading
        icon={<Database className="h-4 w-4 text-emerald-300" />}
        title="PostgreSQL Global FHIR Tables"
        subtitle="27 tabel Resource + 3 analytical views dari PGlite live."
      />
      <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[10px]">
        <span className="text-slate-400">PGlite status</span>
        <span className={dbInitialized ? 'font-bold text-emerald-300' : 'text-amber-300'}>
          {dbSyncing ? 'syncing…' : dbInitialized ? 'ready (27 tables + 3 views)' : 'starting'}
        </span>
      </div>

      <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/40 p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Cari nama tabel, resource, atau view..."
            className="w-full rounded border border-slate-800 bg-slate-900/90 py-1.5 pl-8 pr-7 text-[9.5px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500"
          />
          {tableSearch && (
            <button
              type="button"
              onClick={() => setTableSearch('')}
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'ALL', label: `Semua (${TABLE_METADATA.length})` },
                { id: 'table', label: 'Tabel (27)' },
                { id: 'view', label: 'Views (3)' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setKindFilter(btn.id)}
                className={`rounded px-2 py-0.5 text-[8.5px] font-semibold transition ${
                  kindFilter === btn.id
                    ? 'border border-cyan-400 bg-cyan-400/20 text-cyan-200 font-bold'
                    : 'border border-transparent bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <span className="text-[8.5px] text-slate-500">{visibleTables.length} cocok</span>
        </div>
      </div>

      <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
        {visibleTables.map((item) => (
          <button
            key={item.tableName}
            type="button"
            onClick={() => void selectTable(item.tableName)}
            className={`w-full rounded border p-2 text-left transition ${
              selectedTableName === item.tableName
                ? 'border-cyan-500/60 bg-cyan-500/15 shadow-sm'
                : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[10px] font-semibold text-slate-200">{item.tableName}</span>
              <span
                className={`rounded px-1.5 py-0.2 font-mono text-[8px] font-bold ${
                  item.kind === 'view' ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {item.kind}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate text-[9px] text-slate-500">{item.resourceType} · {item.level}</span>
              <StatusBadge status={item.implementationStatus} compact />
            </div>
          </button>
        ))}
        {visibleTables.length === 0 && (
          <p className="p-3 text-center text-[10px] text-slate-500">Tidak ada tabel yang cocok.</p>
        )}
      </div>

      {selectedTableName && (
        <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-slate-200">
            <TableProperties className="h-3 w-3 text-cyan-300" /> {selectedTableName} · data live
          </div>
          {tableRowsPreview.length ? (
            <pre className="max-h-60 overflow-auto text-[9px] leading-relaxed text-emerald-100">
              {JSON.stringify(tableRowsPreview, null, 2)}
            </pre>
          ) : (
            <p className="text-[10px] text-slate-500">Pilih tabel saat PGlite sudah ready untuk memuat preview.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ValidatorTab() {
  const report = useFhirStore((state) => state.validationReport);
  const [ruleFilter, setRuleFilter] = useState<'ALL' | 'FAIL' | 'PASS'>('ALL');

  const visibleRules = useMemo(() => {
    if (!report) return [];
    return report.rules.filter((rule) => {
      if (ruleFilter === 'FAIL') return !rule.passed;
      if (ruleFilter === 'PASS') return rule.passed;
      return true;
    });
  }, [report, ruleFilter]);

  return (
    <div className="space-y-3">
      <SectionHeading
        icon={<ClipboardList className="h-4 w-4 text-rose-300" />}
        title="FHIR Conformance & Evidence Validator"
        subtitle="Enam rule standar dengan issue path dan remediation."
      />
      {report ? (
        <>
          <div
            className={`rounded border p-3 ${
              report.valid
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-rose-500/40 bg-rose-500/10'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              {report.valid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-300" />
              )}
              {report.valid ? 'DATASET CONFORMANT' : 'CONFORMANCE ISSUES DETECTED'}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
              <span className="text-slate-400">Resources <b className="text-slate-200">{report.totalResourcesChecked}</b></span>
              <span className="text-slate-400">Errors <b className="text-rose-300">{report.errorCount}</b></span>
              <span className="text-slate-400">Warnings <b className="text-amber-300">{report.warningCount}</b></span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
            {(
              [
                { id: 'ALL', label: `Semua (6)` },
                { id: 'FAIL', label: `❌ Gagal (${report.errorCount})`, textClass: 'text-rose-300' },
                { id: 'PASS', label: `✅ Lulus (${6 - report.errorCount})`, textClass: 'text-emerald-300' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setRuleFilter(btn.id)}
                className={`flex-1 rounded py-1 text-center text-[9px] font-semibold transition ${
                  ruleFilter === btn.id
                    ? 'border border-cyan-400 bg-cyan-400/20 text-cyan-200 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {visibleRules.map((rule) => (
              <details
                key={rule.ruleId}
                open={!rule.passed}
                className={`rounded border bg-slate-900/60 transition ${
                  !rule.passed ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-800'
                }`}
              >
                <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-[10px] font-semibold">
                  <span className={rule.passed ? 'font-bold text-emerald-300' : 'font-bold text-rose-300'}>
                    {rule.passed ? 'PASS' : 'FAIL'}
                  </span>
                  <span className="truncate text-slate-200">{rule.ruleId}</span>
                  <span className="ml-auto shrink-0 font-mono text-[9px] text-slate-500">{rule.checkedCount} checked</span>
                </summary>
                <div className="border-t border-slate-800 px-2.5 py-2 text-[10px]">
                  <p className="text-slate-400">{rule.description}</p>
                  {rule.issues.length ? (
                    rule.issues.map((issue) => (
                      <div
                        key={`${issue.ruleId}-${issue.path}-${issue.resourceId}`}
                        className="mt-2 rounded border border-rose-500/20 bg-rose-500/10 p-2 text-[9.5px]"
                      >
                        <div className="font-mono font-bold text-rose-200">
                          {issue.resourceType}/{issue.resourceId} · {issue.path}
                        </div>
                        <p className="mt-1 text-slate-300">{issue.message}</p>
                        <p className="mt-1 font-semibold text-cyan-200">Remediasi: {issue.remediation}</p>
                      </div>
                    ))
                  ) : (
                    <p className="mt-2 text-emerald-300">Tidak ada issue; rule ini lulus sempurna.</p>
                  )}
                </div>
              </details>
            ))}
            {visibleRules.length === 0 && (
              <p className="p-3 text-center text-[10px] text-slate-500">Tidak ada rule yang cocok dengan filter.</p>
            )}
          </div>
        </>
      ) : (
        <EmptyState label="Validator menunggu dataset aktif." />
      )}
    </div>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) { return <header><div className="flex items-center gap-2 text-sm font-bold text-slate-100">{icon}{title}</div><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{subtitle}</p></header>; }
function EmptyState({ label }: { label: string }) { return <div className="rounded border border-dashed border-slate-700 p-5 text-center text-[10px] text-slate-500">{label}</div>; }
