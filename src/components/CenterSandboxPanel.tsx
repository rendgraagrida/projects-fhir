import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeftRight, ArrowRight, BadgeDollarSign, CheckCircle2, ChevronDown, ChevronsDown, ChevronsUp, Clock, Database, FileText, GitMerge, Info, Layers, Link2, Play, RefreshCcw, Scale, Search, ShieldCheck, SlidersHorizontal, Table2, Unlink, X } from 'lucide-react';
import { Background, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ALL_NORMALIZATION_LAWS, FHIR_ALL_MODULES_CATALOG, SQL_TO_FHIR_CHEAT_SHEET } from '../data/curriculum-modules';
import { SAMPLE_ANALYTICAL_SQL_QUERIES, SIMRS_HOSPITAL_SEEDS } from '../data/simrs-normalization-seeds';
import { useFhirStore } from '../store/use-fhir-store';
import type { FhirResourceType, NormalizedHospitalDataset, SandboxClinicalFinancialOverrides, SimrsHospitalSeed } from '../types/fhir-global';

const MODE_OPTIONS = [
  { value: 'sandbox' as const, label: 'SIMRS → FHIR', fullTitle: 'Normalisasi Data SIMRS ke Standar HL7 FHIR & Evidence Chain', icon: Database },
  { value: 'laws' as const, label: '12 Hukum', fullTitle: '12 Hukum Normalisasi HL7 FHIR (5 Fondasi + 7 Lanjutan)', icon: Scale },
  { value: 'rosetta' as const, label: 'SQL ⇄ FHIR', fullTitle: 'SQL ⇄ FHIR Rosetta Stone (Komparasi Kode & Konsep Nyata)', icon: ArrowLeftRight },
  { value: 'graph' as const, label: 'FHIR Graph', fullTitle: 'Visualisasi Graph Relasi Resource FHIR (@xyflow/react)', icon: GitMerge },
  { value: 'sql' as const, label: 'SQL Console', fullTitle: 'Interactive PostgreSQL PGlite SQL Console', icon: Table2 },
  { value: 'modules' as const, label: 'Matriks Modul', fullTitle: 'Matriks Lengkap Status 35 Modul & Komponen HL7 FHIR (Level 1-5)', icon: Layers },
];
const formatIdr = (value: unknown): string => typeof value === 'number' ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value) : '—';
const resourceDomain = (resourceType: FhirResourceType): { label: string; color: string } => {
  if (['Organization', 'Patient', 'Practitioner', 'Location', 'EpisodeOfCare', 'Encounter', 'Consent', 'Provenance'].includes(resourceType)) return { label: 'Administration', color: '#22d3ee' };
  if (['Condition', 'Procedure', 'Observation', 'DiagnosticReport', 'Medication', 'MedicationRequest', 'MedicationDispense', 'Composition'].includes(resourceType)) return { label: 'Clinical', color: '#34d399' };
  if (['ServiceRequest', 'Appointment'].includes(resourceType)) return { label: 'Workflow', color: '#a78bfa' };
  if (['Coverage', 'CoverageEligibilityResponse', 'Account', 'ChargeItem', 'Claim', 'ClaimResponse', 'ExplanationOfBenefit'].includes(resourceType)) return { label: 'Financial', color: '#fbbf24' };
  return { label: 'Quality / Delivery', color: '#fb7185' };
};

function FieldToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-[10px] text-slate-300"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-cyan-400" />{label}</label>;
}

export function CenterSandboxPanel() {
  const centerMode = useFhirStore((state) => state.centerMode);
  const setCenterMode = useFhirStore((state) => state.setCenterMode);
  return <main className="flex min-h-0 flex-1 flex-col bg-slate-900/70">
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-950/80 p-1.5">
      {MODE_OPTIONS.map(({ value, label, fullTitle, icon: Icon }) => (
        <button
          key={value}
          type="button"
          title={fullTitle}
          onClick={() => setCenterMode(value)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[9.5px] font-semibold whitespace-nowrap transition ${
            centerMode === value
              ? 'bg-cyan-400 text-slate-950 shadow-sm font-bold'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </button>
      ))}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {centerMode === 'sandbox' && <NormalizationSandbox />}
      {centerMode === 'laws' && <NormalizationLawsDeepDive />}
      {centerMode === 'rosetta' && <SqlFhirRosettaView />}
      {centerMode === 'evidence' && <NormalizationSandbox />}
      {centerMode === 'graph' && <ResourceGraph />}
      {centerMode === 'sql' && <SqlConsole />}
      {centerMode === 'modules' && <FhirModulesStatusMatrix />}
    </div>
  </main>;
}


function NormalizationSandbox() {
  const selectedHospitalId = useFhirStore((state) => state.selectedHospitalId);
  const datasetsByHospital = useFhirStore((state) => state.datasetsByHospital);
  const activeDataset = useFhirStore((state) => state.activeDataset);
  const selectHospital = useFhirStore((state) => state.selectHospital);
  const triggerPatientMerge = useFhirStore((state) => state.triggerPatientMerge);
  const selectResource = useFhirStore((state) => state.selectResource);
  const dbSyncing = useFhirStore((state) => state.dbSyncing);
  const selectedSeed = SIMRS_HOSPITAL_SEEDS.find((seed) => seed.id === selectedHospitalId) ?? SIMRS_HOSPITAL_SEEDS[0];
  const patient = activeDataset?.patient;
  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <Activity className="h-4 w-4 text-cyan-300" /> Multi-Hospital SIMRS Normalization Sandbox
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Pilih rumah sakit untuk membandingkan skema tabel SIMRS lokal mentah dengan dekomposisi identitas dan Resource HL7 FHIR standar.
        </p>
      </header>

      <div className="grid gap-3 xl:grid-cols-3">
        {SIMRS_HOSPITAL_SEEDS.map((seed) => {
          const dataset = datasetsByHospital[seed.id];
          return (
            <button
              key={seed.id}
              type="button"
              onClick={() => selectHospital(seed.id)}
              className={`rounded-lg border p-3 text-left transition ${seed.id === selectedHospitalId ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-100">{seed.hospitalName}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">{seed.city}</span>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">{seed.scenarioSummary}</p>
              <div className="mt-3 flex justify-between text-[10px] text-slate-500">
                <span>{Object.keys(seed.rawSimrsTables).length} raw SIMRS tables</span>
                <span>{dataset?.allResources.length ?? 0} FHIR resources</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-200">1. Tabel & Kolom Database SIMRS Mentah · {selectedSeed.hospitalCode}</h2>
          </div>
          <div className="space-y-2.5">
            {Object.entries(selectedSeed.rawSimrsTables).map(([tableName, rows]) => {
              const firstRow = rows[0] ?? {};
              return (
                <details key={tableName} className="rounded border border-slate-800 bg-slate-900/40">
                  <summary className="cursor-pointer px-2.5 py-2 text-[10px] font-semibold text-amber-200">
                    Tabel DB: <code className="font-mono text-amber-300">{tableName}</code>{' '}
                    <span className="ml-1 text-slate-500">({Object.keys(firstRow).length} kolom · {rows.length} baris)</span>
                  </summary>
                  <div className="border-t border-slate-800 p-2">
                    <table className="w-full text-left text-[9px]">
                      <thead className="border-b border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-1 pr-2">Kolom Tabel SIMRS</th>
                          <th className="py-1 pr-2">Nilai Data Mentah</th>
                          <th className="py-1">Tipe Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {Object.entries(firstRow).map(([colName, colVal]) => (
                          <tr key={colName}>
                            <td className="py-1 pr-2 font-semibold text-amber-300">{colName}</td>
                            <td className="py-1 pr-2 text-slate-200">{JSON.stringify(colVal)}</td>
                            <td className="py-1 text-slate-500">{typeof colVal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-200">2. Hasil Normalisasi Identifier & Resource HL7 FHIR</h2>
          </div>
          {patient && activeDataset ? (
            <div className="space-y-2.5">
              <div className="rounded border border-slate-800 bg-slate-900/80 p-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => selectResource('Patient', patient.id)}
                    className="text-xs font-bold text-cyan-300 hover:underline"
                  >
                    Patient/{patient.id} — Dekomposisi identifier[] & address.extension[]
                  </button>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-[9px]">
                    <thead className="border-b border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-1 pr-2">Index Path FHIR</th>
                        <th className="py-1 pr-2">Namespace URI (system / url)</th>
                        <th className="py-1">Nilai Terstandarisasi (value)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {(patient.identifier ?? []).map((idItem, idx) => (
                        <tr key={`${idItem.system}-${idx}`}>
                          <td className="py-1 pr-2 text-cyan-300">identifier[{idx}]</td>
                          <td className="py-1 pr-2 text-slate-400">{idItem.system}</td>
                          <td className="py-1 font-semibold text-emerald-300">"{idItem.value}"</td>
                        </tr>
                      ))}
                      {(patient.address?.[0]?.extension?.[0]?.extension ?? []).map((ext, idx) => (
                        <tr key={`${ext.url}-${idx}`}>
                          <td className="py-1 pr-2 text-violet-300">address[0].ext[{ext.url}]</td>
                          <td className="py-1 pr-2 text-slate-400">.../StructureDefinition/administrativeCode#{ext.url}</td>
                          <td className="py-1 font-semibold text-amber-200">valueCode: "{ext.valueCode}"</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => selectResource('Encounter', activeDataset.encounter.id)}
                  className="rounded border border-slate-800 bg-slate-900/60 p-2 text-left hover:border-cyan-500/50"
                >
                  <div className="text-[10px] font-bold text-cyan-200">Encounter/{activeDataset.encounter.id}</div>
                  <div className="mt-1 font-mono text-[9px] text-slate-400">
                    class.code: <b className="text-slate-200">{activeDataset.encounter.class.code}</b> · ruang: <b className="text-slate-200">{activeDataset.location.name}</b>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => selectResource('Condition', activeDataset.conditions[0].id)}
                  className="rounded border border-slate-800 bg-slate-900/60 p-2 text-left hover:border-cyan-500/50"
                >
                  <div className="text-[10px] font-bold text-emerald-200">Condition (ICD-10)</div>
                  <div className="mt-1 font-mono text-[9px] text-slate-400">
                    #1: <b className="text-slate-200">{activeDataset.conditions[0]?.code.coding?.[0]?.code}</b> · #2: <b className="text-slate-200">{activeDataset.conditions[1]?.code.coding?.[0]?.code}</b>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => selectResource('Observation', activeDataset.observations[0].id)}
                  className="rounded border border-slate-800 bg-slate-900/60 p-2 text-left hover:border-cyan-500/50"
                >
                  <div className="text-[10px] font-bold text-amber-200">Observation (LOINC 85354-9)</div>
                  <div className="mt-1 font-mono text-[9px] text-slate-400">
                    component[]: <b className="text-slate-200">{activeDataset.observations[0]?.component?.[0]?.valueQuantity?.value}/{activeDataset.observations[0]?.component?.[1]?.valueQuantity?.value} mm[Hg]</b>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => selectResource('Claim', activeDataset.claim.id)}
                  className="rounded border border-slate-800 bg-slate-900/60 p-2 text-left hover:border-cyan-500/50"
                >
                  <div className="text-[10px] font-bold text-violet-200">Claim/{activeDataset.claim.id}</div>
                  <div className="mt-1 font-mono text-[9px] text-slate-400">
                    DRG: <b className="text-slate-200">{activeDataset.claim.diagnosis[0]?.packageCode?.coding?.[0]?.code}</b> · Total: <b className="text-emerald-300">{formatIdr(activeDataset.claim.total?.value)}</b>
                  </div>
                </button>
              </div>

              {activeDataset.duplicateEmergencyPatient && (
                <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-200">
                        <GitMerge className="h-3.5 w-3.5" /> Resolusi Duplikat Pasien IGD (Patient.link[])
                      </div>
                      <p className="mt-0.5 text-[9px] text-slate-400">
                        <code className="text-amber-300">{activeDataset.duplicateEmergencyPatient.id}</code> ditautkan ke master{' '}
                        <code className="text-cyan-300">Patient/{patient.id}</code> dengan <code className="text-emerald-300">type: "replaced-by"</code>.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={dbSyncing}
                      onClick={() => void triggerPatientMerge()}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded bg-amber-400 px-2.5 py-1.5 text-[10px] font-bold text-slate-950 disabled:opacity-50"
                    >
                      <GitMerge className="h-3 w-3" /> Resolve Patient.link[]
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Dataset sedang diproses…</p>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-emerald-500/30 bg-slate-950/50 p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold text-emerald-300">3. Rantai Bukti Klinis ke Klaim & Komparasi Before vs After</h2>
        </div>
        <EvidenceEditor />
      </section>
    </div>
  );
}

function SqlFhirRosettaView() {
  const categories = useMemo(() => {
    return Array.from(new Set(SQL_TO_FHIR_CHEAT_SHEET.map((r) => r.category)));
  }, []);
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0] ?? '1. Struktur Dasar');

  const filtered = useMemo(() => {
    return SQL_TO_FHIR_CHEAT_SHEET.filter((r) => r.category === selectedCategory);
  }, [selectedCategory]);
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <ArrowLeftRight className="h-4 w-4 text-cyan-300" /> SQL ⇄ FHIR Rosetta Stone (Komparasi Kode & Konsep Nyata)
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Penerjemah paradigma database relasional SIMRS (Tabel/PK/FK/DDL) ke standar objek HL7 FHIR internasional secara berdampingan (side-by-side).
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded border px-2.5 py-1 text-[9.5px] font-semibold transition ${
                selectedCategory === cat
                  ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200 shadow-sm font-bold'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-3">
        {filtered.map((row) => (
          <article key={row.id} className="rounded-lg border border-slate-800 bg-slate-950/75 p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                  {row.category}
                </span>
                <h3 className="text-xs font-bold text-slate-100">{row.sqlConcept}</h3>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className="rounded bg-amber-500/15 px-2 py-0.5 font-bold text-amber-300">
                  SQL: {row.sqlConcept.split(' ')[0]}
                </span>
                <span className="text-slate-500 font-sans">→</span>
                <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-bold text-cyan-300">
                  FHIR: {row.fhirConcept}
                </span>
              </div>
            </div>

            <div className="mt-2.5 rounded border border-slate-800 bg-slate-900/60 p-2.5 text-[10px] text-slate-300 leading-relaxed">
              <span className="font-bold text-cyan-300">Prinsip Konformitas: </span>
              {row.conformancePrinciple}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="flex flex-col">
                <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-amber-300">
                  <span>🟦 Database SIMRS (SQL / RDBMS)</span>
                  <span className="font-normal text-[9px] text-slate-500">Relational DDL / Query</span>
                </div>
                <pre className="flex-1 overflow-x-auto rounded border border-amber-500/20 bg-slate-950 p-2.5 font-mono text-[9px] leading-relaxed text-amber-200">
                  <code>{row.sqlSnippet}</code>
                </pre>
              </div>

              <div className="flex flex-col">
                <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-cyan-300">
                  <span>🟩 Standar Global HL7 FHIR (JSON)</span>
                  <span className="font-normal text-[9px] text-slate-500">Document Object Model</span>
                </div>
                <pre className="flex-1 overflow-x-auto rounded border border-cyan-500/20 bg-slate-950 p-2.5 font-mono text-[9px] leading-relaxed text-cyan-200">
                  <code>{row.fhirSnippet}</code>
                </pre>
              </div>
            </div>

            <div className="mt-3 grid gap-2.5 md:grid-cols-2">
              <div className="rounded border border-violet-500/30 bg-violet-500/5 p-2.5 text-[10px]">
                <div className="font-bold text-violet-300">Mengapa Dikonversi Seperti Ini? (Alasan Arsitektural):</div>
                <p className="mt-1 text-slate-300 leading-relaxed">{row.whyItMatters}</p>
              </div>
              <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-[10px]">
                <div className="font-bold text-emerald-300">Contoh Konkret pada Data Rumah Sakit Kita:</div>
                <p className="mt-1 text-slate-300 leading-relaxed">{row.concreteHospitalExample}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function NormalizationLawsDeepDive() {
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CORE' | 'ADVANCED'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IMPLEMENTED' | 'PARTIAL' | 'NOT_YET'>('ALL');
  const [expandedLaws, setExpandedLaws] = useState<number[]>([]);
  const activeDataset = useFhirStore((state) => state.activeDataset);
  const selectResource = useFhirStore((state) => state.selectResource);

  const filteredLaws = useMemo(
    () =>
      ALL_NORMALIZATION_LAWS.filter((law) => {
        const matchCategory =
          categoryFilter === 'ALL' ||
          (categoryFilter === 'CORE' && law.lawNumber <= 5) ||
          (categoryFilter === 'ADVANCED' && law.lawNumber >= 6);
        const matchStatus = statusFilter === 'ALL' || law.indonesiaStatus === statusFilter;
        return matchCategory && matchStatus;
      }),
    [categoryFilter, statusFilter],
  );

  const toggleLaw = (lawNumber: number) => {
    setExpandedLaws((prev) =>
      prev.includes(lawNumber) ? prev.filter((n) => n !== lawNumber) : [...prev, lawNumber],
    );
  };

  const expandAll = () => setExpandedLaws(filteredLaws.map((l) => l.lawNumber));
  const collapseAll = () => setExpandedLaws([]);

  return (
    <section className="space-y-3 rounded-lg border border-cyan-500/25 bg-slate-950/75 p-3.5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <Scale className="h-4 w-4 text-cyan-300" /> 12 Hukum Normalisasi HL7 FHIR (5 Fondasi + 7 Lanjutan Enterprise)
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Klik kartu hukum mana pun untuk meng-expand penjelasan arsitektural lengkap, status implementasi di Kemenkes RI / SATUSEHAT, dan pemetaan kolom.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/80 p-0.5">
          <button
            type="button"
            title={`Buka Semua (${filteredLaws.length} Hukum)`}
            aria-label={`Buka Semua (${filteredLaws.length} Hukum)`}
            onClick={expandAll}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:border hover:border-cyan-400 hover:bg-cyan-400/15 hover:text-cyan-200"
          >
            <ChevronsDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Tutup Semua"
            aria-label="Tutup Semua"
            onClick={collapseAll}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:border hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200"
          >
            <ChevronsUp className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Kelompok:</span>
            <div className="flex rounded-md border border-slate-800 bg-slate-900/80 p-0.5">
              {(
                [
                  { id: 'ALL', label: 'Semua 12 Hukum' },
                  { id: 'CORE', label: '5 Fondasi (1–5)' },
                  { id: 'ADVANCED', label: '7 Lanjutan (6–12)' },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setCategoryFilter(btn.id)}
                  className={`rounded px-2.5 py-1 text-[9px] font-semibold transition ${
                    categoryFilter === btn.id
                      ? 'border border-cyan-400 bg-cyan-400/20 text-cyan-200 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
          <span className="text-[9px] font-medium text-slate-500">
            {filteredLaws.length} dari 12 hukum tampil
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Status di Indonesia:</span>
          <div className="flex flex-wrap gap-1 rounded-md border border-slate-800 bg-slate-900/80 p-0.5">
            {(
              [
                { id: 'ALL', label: 'Semua Status', activeClass: 'border-cyan-400 bg-cyan-400/20 text-cyan-200 font-bold' },
                { id: 'IMPLEMENTED', label: '🟢 IMPLEMENTED (6)', activeClass: 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold' },
                { id: 'PARTIAL', label: '🟡 PARTIAL (4)', activeClass: 'border-amber-400 bg-amber-500/20 text-amber-300 font-bold' },
                { id: 'NOT_YET', label: '🔴 NOT YET (2)', activeClass: 'border-rose-400 bg-rose-500/20 text-rose-300 font-bold' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setStatusFilter(btn.id)}
                className={`rounded px-2 py-1 text-[9px] transition ${
                  statusFilter === btn.id
                    ? `border ${btn.activeClass} shadow-sm`
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        {filteredLaws.map((law) => {
          const isExpanded = expandedLaws.includes(law.lawNumber);
          const badgeClass =
            law.indonesiaStatus === 'IMPLEMENTED'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : law.indonesiaStatus === 'PARTIAL'
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border-rose-500/40 bg-rose-500/15 text-rose-300';
          return (
            <article
              key={law.lawNumber}
              className={`overflow-hidden rounded-lg border transition ${
                isExpanded
                  ? 'border-cyan-500/60 bg-slate-900/95 shadow-md shadow-cyan-950/20'
                  : 'border-slate-800 bg-slate-900/45 hover:border-slate-700'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleLaw(law.lawNumber)}
                className="flex w-full items-start justify-between gap-2.5 p-3 text-left transition hover:bg-slate-800/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800 font-mono text-[10px] font-bold text-cyan-300">
                      {law.lawNumber}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-slate-300">
                      {law.category.split(' ')[0]}
                    </span>
                    <span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${badgeClass}`}>
                      {law.indonesiaStatusSummary.split(' ')[0]} {law.indonesiaStatusSummary.split(' ')[1]}
                    </span>
                  </div>

                  <h3 className="mt-1.5 text-xs font-bold text-slate-100">
                    {law.stage}
                  </h3>

                  {!isExpanded && (
                    <p className="mt-1 truncate text-[9.5px] text-slate-400">
                      <span className="font-semibold text-amber-300/90">Kondisi SIMRS: </span>
                      {law.rawSimrs}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[9px] font-semibold text-slate-400">
                  <span className="hidden sm:inline text-slate-500">
                    {isExpanded ? 'Tutup' : `${law.columnMappings.length} Kolom`}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-cyan-300 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-cyan-200' : 'text-slate-500'
                    }`}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="space-y-2.5 border-t border-slate-800/80 bg-slate-950/80 p-3 text-[10px] leading-relaxed">
                  <div className="rounded border border-slate-800 bg-slate-900/70 p-2.5">
                    <div className="font-bold text-slate-200">
                      🏛️ Status Implementasi di Indonesia (Kemenkes RI / SATUSEHAT):
                    </div>
                    <p className="mt-1 text-[9.5px] leading-relaxed text-slate-400">{law.indonesiaStatusDetail}</p>
                    <div className="mt-1.5 font-semibold text-emerald-300">{law.labStatusSummary}</div>
                  </div>

                  <div className="space-y-1.5 text-[9.5px]">
                    <p className="text-slate-300">
                      <b className="text-violet-300">💡 Penjelasan Detail: </b>
                      {law.detailedExplanation}
                    </p>
                    <p className="text-slate-400">
                      <b className="text-amber-300">⚠️ Kondisi SIMRS Konvensional: </b>
                      {law.rawSimrs}
                    </p>
                    <p className="text-cyan-200">
                      <b className="text-cyan-300">📜 Aturan Standar HL7 FHIR: </b>
                      {law.fhirRule}
                    </p>
                  </div>

                  <div className="border-t border-slate-800/80 pt-2">
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      🗺️ Pemetaan Kolom & Data Riil:
                    </div>
                    <div className="space-y-1.5">
                      {law.columnMappings.map((cm) => {
                        const targetRes = activeDataset?.allResources.find((r) => r.resourceType === cm.resourceType);
                        return (
                          <button
                            key={cm.fieldLabel}
                            type="button"
                            onClick={() => targetRes && selectResource(cm.resourceType, targetRes.id)}
                            className="w-full rounded border border-slate-800 bg-slate-900/90 p-2 text-left font-mono text-[9px] transition hover:border-cyan-500/60 hover:bg-slate-800/60"
                          >
                            <div className="flex items-center justify-between font-sans">
                              <span className="font-bold text-slate-200">{cm.fieldLabel}</span>
                              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[8px] font-bold text-cyan-300">
                                {cm.resourceType}
                              </span>
                            </div>
                            <div className="mt-1 text-amber-200">
                              <span className="font-sans text-slate-500">SIMRS: </span>
                              {cm.simrsColumns} ({cm.rawExample})
                            </div>
                            <div className="mt-0.5 text-cyan-200">
                              <span className="font-sans text-slate-500">FHIR: </span>
                              {cm.fhirPath} → {cm.fhirValuePreview}
                            </div>
                            <div className="mt-0.5 text-emerald-300">
                              <span className="font-sans text-slate-500">PostgreSQL: </span>
                              {cm.postgresColumn}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FhirModulesStatusMatrix() {
  const [indonesiaFilter, setIndonesiaFilter] = useState<'ALL' | 'IMPLEMENTED' | 'PARTIAL' | 'NOT_YET'>('ALL');
  const [labFilter, setLabFilter] = useState<'ALL' | 'IMPLEMENTED' | 'NOT_YET'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const activeDataset = useFhirStore((state) => state.activeDataset);
  const selectResource = useFhirStore((state) => state.selectResource);
  const tableRef = useRef<HTMLDivElement>(null);
  const stickyScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1200);

  const counts = useMemo(() => {
    const total = FHIR_ALL_MODULES_CATALOG.length;
    const idImplemented = FHIR_ALL_MODULES_CATALOG.filter((m) => m.indonesiaStatus === 'IMPLEMENTED').length;
    const idPartial = FHIR_ALL_MODULES_CATALOG.filter((m) => m.indonesiaStatus === 'PARTIAL').length;
    const idNotYet = FHIR_ALL_MODULES_CATALOG.filter((m) => m.indonesiaStatus === 'NOT_YET').length;
    const labImplemented = FHIR_ALL_MODULES_CATALOG.filter((m) => m.labStatus === 'IMPLEMENTED').length;
    const labNotYet = FHIR_ALL_MODULES_CATALOG.filter((m) => m.labStatus === 'NOT_YET').length;
    return { total, idImplemented, idPartial, idNotYet, labImplemented, labNotYet };
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FHIR_ALL_MODULES_CATALOG.filter((item) => {
      const matchId = indonesiaFilter === 'ALL' || item.indonesiaStatus === indonesiaFilter;
      const matchLab = labFilter === 'ALL' || item.labStatus === labFilter;
      const matchQ =
        !q ||
        item.componentName.toLowerCase().includes(q) ||
        item.moduleCategory.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.simrsSource && item.simrsSource.toLowerCase().includes(q)) ||
        (item.postgresTargetColumns && item.postgresTargetColumns.toLowerCase().includes(q));
      return matchId && matchLab && matchQ;
    });
  }, [indonesiaFilter, labFilter, searchQuery]);

  useEffect(() => {
    const updateWidth = () => {
      if (tableRef.current) {
        setTableScrollWidth(tableRef.current.scrollWidth);
      }
    };
    updateWidth();
    const timer = setTimeout(updateWidth, 100);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [filtered]);

  const handleTableScroll = () => {
    if (tableRef.current && stickyScrollRef.current) {
      if (Math.abs(stickyScrollRef.current.scrollLeft - tableRef.current.scrollLeft) > 1) {
        stickyScrollRef.current.scrollLeft = tableRef.current.scrollLeft;
      }
    }
  };

  const handleStickyScroll = () => {
    if (tableRef.current && stickyScrollRef.current) {
      if (Math.abs(tableRef.current.scrollLeft - stickyScrollRef.current.scrollLeft) > 1) {
        tableRef.current.scrollLeft = stickyScrollRef.current.scrollLeft;
      }
    }
  };
  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
            <Layers className="h-4 w-4 text-cyan-300" /> Matriks Lengkap Seluruh Modul & Komponen HL7 FHIR (Level 1 s/d Level 5 — IMPLEMENTED vs NOT YET)
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Identifikasi transparan mana komponen FHIR yang sudah <b className="text-emerald-300">IMPLEMENTED</b>, <b className="text-amber-300">PARTIAL</b>, atau <b className="text-rose-300">NOT YET</b> baik di tingkat Nasional (Kemenkes RI / SATUSEHAT) maupun di sistem Learning Lab kita.
          </p>
        </div>
      </header>

      <div className="grid gap-2.5 md:grid-cols-3">
        <div className="rounded border border-slate-800 bg-slate-900/70 p-2.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cakupan Standar HL7 FHIR (Level 1–5)</div>
          <div className="mt-1 text-sm font-bold text-slate-100">{counts.total} Modul & Komponen Utama</div>
          <div className="mt-1 text-[9px] text-slate-500">Foundation · Security · Admin · Clinical · Workflow · Financial · Quality</div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/70 p-2.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Status Nasional (Kemenkes RI / SATUSEHAT)</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">🟢 {counts.idImplemented} IMPLEMENTED</span>
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">🟡 {counts.idPartial} PARTIAL</span>
            <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-300">🔴 {counts.idNotYet} NOT YET</span>
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/70 p-2.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Status di Aplikasi Learning Lab Kita</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
            <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-cyan-300">✅ {counts.labImplemented} IMPLEMENTED (Live DB & JSON)</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">⏳ {counts.labNotYet} NOT YET (Roadmap)</span>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama komponen, kolom SIMRS, atau Resource FHIR..."
              className="w-full rounded-md border border-slate-800 bg-slate-900/90 py-1.5 pl-8 pr-8 text-[10px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <span className="text-[9px] font-medium text-slate-400">
            {filtered.length} dari {counts.total} komponen cocok
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Status SATUSEHAT:</span>
            <div className="flex flex-wrap gap-1 rounded-md border border-slate-800 bg-slate-900/80 p-0.5">
              {(
                [
                  { id: 'ALL', label: `Semua (${counts.total})`, activeClass: 'border-cyan-400 bg-cyan-400/20 text-cyan-200 font-bold' },
                  { id: 'IMPLEMENTED', label: `🟢 IMPLEMENTED (${counts.idImplemented})`, activeClass: 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold' },
                  { id: 'PARTIAL', label: `🟡 PARTIAL (${counts.idPartial})`, activeClass: 'border-amber-400 bg-amber-500/20 text-amber-300 font-bold' },
                  { id: 'NOT_YET', label: `🔴 NOT YET (${counts.idNotYet})`, activeClass: 'border-rose-400 bg-rose-500/20 text-rose-300 font-bold' },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setIndonesiaFilter(btn.id)}
                  className={`rounded px-2 py-1 text-[9px] transition ${
                    indonesiaFilter === btn.id
                      ? `border ${btn.activeClass} shadow-sm`
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Aplikasi Lab:</span>
            <div className="flex rounded-md border border-slate-800 bg-slate-900/80 p-0.5">
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'IMPLEMENTED', label: `✅ IMPLEMENTED (${counts.labImplemented})` },
                  { id: 'NOT_YET', label: `⏳ ROADMAP (${counts.labNotYet})` },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setLabFilter(btn.id)}
                  className={`rounded px-2 py-1 text-[9px] transition ${
                    labFilter === btn.id
                      ? 'border border-cyan-400 bg-cyan-400/20 text-cyan-200 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={tableRef}
        onScroll={handleTableScroll}
        className="overflow-x-auto rounded border border-slate-800"
      >
        <table className="min-w-[1080px] w-full text-left text-[10px]">
          <thead className="bg-slate-900 text-[9px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-2.5 py-2">Level & Modul FHIR</th>
              <th className="px-2.5 py-2">Komponen / Resource HL7 FHIR</th>
              <th className="px-2.5 py-2">Kolom Asal SIMRS & Path FHIR</th>
              <th className="px-2.5 py-2">Target PostgreSQL & Ekspresi FHIRPath</th>
              <th className="px-2.5 py-2">Status di Indonesia & Lab Kita</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.map((item) => {
              const targetResource = item.resourceType
                ? activeDataset?.allResources.find((r) => r.resourceType === item.resourceType)
                : undefined;
              return (
                <tr
                  key={item.id}
                  onClick={() => item.resourceType && targetResource && selectResource(item.resourceType, targetResource.id)}
                  className={`align-top transition ${targetResource ? 'cursor-pointer hover:bg-cyan-500/5' : ''}`}
                >
                  <td className="whitespace-nowrap px-2.5 py-2">
                    <div className="text-[10px] font-bold text-cyan-300">{item.level}</div>
                    <div className="text-[9px] text-slate-400">{item.moduleCategory}</div>
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      {item.resourceType && (
                        <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[8px] font-bold text-cyan-300">
                          {item.resourceType}
                        </span>
                      )}
                      <span className="font-mono text-[10px] font-bold text-slate-100">{item.componentName}</span>
                    </div>
                    <p className="mt-1 text-[9px] leading-relaxed text-slate-400">{item.description}</p>
                    {targetResource && (
                      <span className="mt-1 inline-block font-mono text-[8px] text-cyan-400/80">
                        {item.resourceType}/{targetResource.id}
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 font-mono text-[9px]">
                    {item.simrsSource && (
                      <div className="rounded bg-amber-500/10 p-1.5 text-amber-200">
                        <span className="font-sans text-[8px] font-bold uppercase text-amber-400/80">Kolom SIMRS: </span>
                        <div>{item.simrsSource}</div>
                      </div>
                    )}
                    {item.fhirMappingPath && (
                      <div className="mt-1 rounded bg-cyan-500/10 p-1.5 text-cyan-200">
                        <span className="font-sans text-[8px] font-bold uppercase text-cyan-400/80">Path FHIR: </span>
                        <div>{item.fhirMappingPath}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-2.5 py-2 font-mono text-[9px]">
                    {item.postgresTargetColumns && (
                      <div className="rounded bg-emerald-500/10 p-1.5 text-emerald-200">
                        <span className="font-sans text-[8px] font-bold uppercase text-emerald-400/80">Kolom SQL: </span>
                        <div>{item.postgresTargetColumns}</div>
                      </div>
                    )}
                    {item.fhirPathExpression && (
                      <div className="mt-1 text-[8.5px] text-violet-300">
                        <span className="font-sans text-[8px] text-slate-500">FHIRPath: </span>
                        {item.fhirPathExpression}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2">
                    <div className="space-y-1">
                      <div>
                        {item.indonesiaStatus === 'IMPLEMENTED' && (
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">
                            🟢 ID: IMPLEMENTED
                          </span>
                        )}
                        {item.indonesiaStatus === 'PARTIAL' && (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
                            🟡 ID: PARTIAL
                          </span>
                        )}
                        {item.indonesiaStatus === 'NOT_YET' && (
                          <span className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[8px] font-bold text-rose-300">
                            🔴 ID: NOT YET
                          </span>
                        )}
                      </div>
                      <div>
                        {item.labStatus === 'IMPLEMENTED' ? (
                          <span className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/15 px-1.5 py-0.5 text-[8px] font-bold text-cyan-200">
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-300" /> LAB: IMPLEMENTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[8px] font-bold text-slate-300">
                            <Clock className="h-2.5 w-2.5 text-amber-300" /> ROADMAP
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 z-20 overflow-hidden rounded-b-lg border border-cyan-500/25 bg-slate-950/60 p-1 opacity-70 backdrop-blur-sm shadow-lg transition-all hover:border-cyan-400/50 hover:bg-slate-950/90 hover:opacity-100">
        <div
          ref={stickyScrollRef}
          onScroll={handleStickyScroll}
          className="overflow-x-auto"
        >
          <div style={{ width: `${tableScrollWidth}px`, height: '6px' }} />
        </div>
      </div>
    </section>
  );
}
function EvidenceEditor() {
  const activeDataset = useFhirStore((state) => state.activeDataset);
  const selectedHospitalId = useFhirStore((state) => state.selectedHospitalId);
  const overrides = useFhirStore((state) => state.overridesByHospital[state.selectedHospitalId] ?? {});
  const updateOverrides = useFhirStore((state) => state.updateOverrides);
  const selectResource = useFhirStore((state) => state.selectResource);
  const validationReport = useFhirStore((state) => state.validationReport);
  const selectedSeed = SIMRS_HOSPITAL_SEEDS.find((seed) => seed.id === selectedHospitalId) ?? SIMRS_HOSPITAL_SEEDS[0];
  const effective = { ...selectedSeed.defaultOverrides, ...overrides };
  const claim = activeDataset?.claim;
  const response = activeDataset?.claimResponse;
  const eob = activeDataset?.explanationOfBenefit;
  const charges = activeDataset?.chargeItems ?? [];
  const [evidenceTab, setEvidenceTab] = useState<'after-fhir' | 'before-fhir'>('after-fhir');

  const setOverride = (key: keyof SandboxClinicalFinancialOverrides, value: boolean | number | string) =>
    void updateOverrides({ [key]: value } as Partial<SandboxClinicalFinancialOverrides>);
  const monetary = (key: 'roomUnitPriceIdr' | 'procedurePriceIdr' | 'medicationPriceIdr' | 'approvedRoomBenefitIdr' | 'approvedProcedureBenefitIdr' | 'approvedMedicationBenefitIdr') =>
    Number(effective[key] ?? 0);

  const stages: Array<{ label: string; value: string; type: FhirResourceType }> = [
    { label: 'Encounter', value: activeDataset?.encounter.id ?? '—', type: 'Encounter' },
    { label: 'Condition / Procedure / Observation', value: activeDataset?.conditions[0]?.id ?? activeDataset?.procedures[0]?.id ?? activeDataset?.observations[0]?.id ?? '—', type: activeDataset?.conditions[0] ? 'Condition' : activeDataset?.procedures[0] ? 'Procedure' : 'Observation' },
    { label: 'Composition', value: activeDataset?.composition.id ?? '—', type: 'Composition' },
    { label: 'ChargeItem', value: charges[0]?.id ?? '—', type: 'ChargeItem' },
    { label: 'Claim', value: claim?.id ?? '—', type: 'Claim' },
    { label: 'ClaimResponse', value: response?.id ?? '—', type: 'ClaimResponse' },
    { label: 'ExplanationOfBenefit', value: eob?.id ?? '—', type: 'ExplanationOfBenefit' },
  ];

  const beforeAfterComparisons = [
    {
      aspect: 'Hubungan Klinis ke Tagihan',
      before: 'Terputus (Decoupled). Bagian kasir/billing memasukkan kode klaim INA-CBG secara manual tanpa korelasi langsung ke resume medis dokter.',
      after: 'Terkunci Ketat (Hard-Linked). Claim.diagnosis dan Claim.procedure wajib merujuk langsung ke Condition dan Procedure terverifikasi dari Encounter yang sama.',
      risk: 'Tinggi: Rawan ghost billing, klaim fiktif, dan sengketa pending BPJS.',
      impact: 'Zero Fraud: Klaim ditolak otomatis oleh validator jika mata rantai bukti terputus.',
    },
    {
      aspect: 'Format Kode & Terminologi',
      before: 'Format string bebas lokal (misal: "ICU-01", "PAKET-A", singkatan lokal RS) yang berbeda-beda di tiap SIMRS.',
      after: 'Standar terminologi internasional bersistem URI resmi (ICD-10 untuk diagnosis, ICD-9-CM untuk prosedur, LOINC untuk lab/vital, KFA Kemenkes untuk obat).',
      risk: 'Tinggi: Data tidak dapat dipertukarkan (silo) dan tidak bisa diagregasi nasional.',
      impact: 'Interoperabel: Dapat dipahami otomatis oleh SATUSEHAT, payor asuransi, dan platform analitik.',
    },
    {
      aspect: 'Resume Medis Pulang (Discharge)',
      before: 'Sering berupa berkas fisik terpisah atau PDF scan yang terlambat diisi setelah tagihan dikirim ke verifikator BPJS.',
      after: 'Composition digital dengan invarian cmp-1 & cmp-2 yang wajib memiliki section lengkap dan terhubung ke Claim.supportingInfo.',
      risk: 'Sedang-Tinggi: Klaim tertolak karena dokter belum menyelesaikan berkas kepulangan.',
      impact: 'Audit Siap Saji: Status resume medis divalidasi sistem sebelum klaim diserahkan.',
    },
    {
      aspect: 'Rekonsiliasi Nominal Rupiah',
      before: 'Nominal total tagihan di kasir sering berselisih dengan rincian tindakan dan tarif obat karena pembulatan atau kalkulasi manual.',
      after: 'Total tagihan Claim.total diverifikasi otomatis terhadap agregasi ChargeItem.priceOverride dan Claim.item.net.',
      risk: 'Sedang: Selisih pembukuan kasir RS dan payor penjamin.',
      impact: 'Akurat 100%: Invariant finansial mendeteksi ketidakcocokan jumlah secara otomatis.',
    },
    {
      aspect: 'Identitas Pasien & Duplikasi Rekam Medis',
      before: 'Pasien IGD dibuatkan nomor rekam medis darurat baru tanpa histori dan tidak pernah disatukan ke rekam medis rawat jalan.',
      after: 'Patient.link dengan tipe replaced-by dan replaces secara atomik menulis ulang referensi klinis lama ke master ID pasien.',
      risk: 'Kritis: Bahaya keselamatan pasien (alergi obat dan riwayat penyakit tidak terbaca di IGD).',
      impact: 'Keselamatan Pasien: Riwayat rekam medis terpadu tanpa data yang hilang.',
    },
    {
      aspect: 'Pelaporan & Audit Lintas Rumah Sakit',
      before: 'Proses ETL manual berbulan-bulan karena struktur tabel SQL tiap RS berbeda total.',
      after: 'SQL-on-FHIR v2 meratakan JSON nested menjadi 27 tabel analitik dan 3 analytical views seragam yang siap di-query SQL PostgreSQL.',
      risk: 'Tinggi: Biaya integrasi data mahal dan pelaporan Kemenkes lambat.',
      impact: 'Analitik Cepat: Query SQL instan lintas rumah sakit menggunakan PGlite/PostgreSQL.',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header & Sub-Tabs Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <span>Clinical → Financial Evidence Chain & Komparasi Standar</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Evaluasi perbandingan arsitektur data medis-finansial antara sistem SIMRS lama dengan standar HL7 FHIR R4.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/90 p-1" role="tablist" aria-label="Evidence comparison tabs">
          <button
            type="button"
            role="tab"
            aria-selected={evidenceTab === 'before-fhir'}
            onClick={() => setEvidenceTab('before-fhir')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              evidenceTab === 'before-fhir'
                ? 'border border-rose-500/50 bg-rose-950/60 text-rose-300 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Unlink className="h-3.5 w-3.5 text-rose-400" />
            <span>1. Sebelum FHIR (SIMRS Konvensional)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={evidenceTab === 'after-fhir'}
            onClick={() => setEvidenceTab('after-fhir')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
              evidenceTab === 'after-fhir'
                ? 'border border-emerald-500/50 bg-emerald-950/60 text-emerald-300 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Link2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>2. Setelah FHIR (Rantai Bukti Terverifikasi)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SEBELUM FHIR (SIMRS KONVENSIONAL SILO) */}
      {evidenceTab === 'before-fhir' && (
        <div className="space-y-4">
          {/* Banner Problem Statement */}
          <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>Arsitektur SIMRS Silo: Masalah Rantai Bukti Terputus</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
              Pada SIMRS konvensional, modul pelayanan dokter (EMR) dan modul penagihan kasir (Billing/Klaim) berada pada tabel relasional yang terpisah tanpa referensi keterlacakan (*unlinked rows*).
              Klaim diajukan berdasarkan input teks kasir, membuka celah <b>klaim fiktif</b>, <b>upcoding</b>, dan <b>penolakan klaim BPJS</b> karena tidak adanya bukti tindakan dokter yang terikat langsung.
            </p>
          </div>

          {/* 4 Kartu Titik Kerapuhan Utama */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                <Unlink className="h-3.5 w-3.5" /> Ghost Billing & Klaim Fiktif
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                Tindakan/obat dimasukkan ke tagihan kasir tanpa keterikatan ID ke rekam medis tindakan yang dilakukan dokter.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" /> Discrepancy Total Tagihan
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                Total klaim tidak diaudit secara otomatis terhadap penjumlahan rincian per-item layanan, menyebabkan selisih buku.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                <Database className="h-3.5 w-3.5" /> Kode Lokal Tanpa Standar
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                Menggunakan nama ruang atau kode paket lokal ("ICU-01", "PAKET-A") yang tidak dimengerti oleh sistem penjamin eksternal.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-300">
                <FileText className="h-3.5 w-3.5" /> Resume Medis Tercecer
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                Dokumen kepulangan berupa kertas/PDF manual di luar database klaim, memicu dispute verifikator berkas BPJS.
              </p>
            </div>
          </div>

          {/* Tabel Matriks Perbandingan Detail Before vs After */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Scale className="h-4 w-4 text-cyan-400" />
              <span>Matriks Perbedaan Komparatif: Sebelum vs Setelah Mengadopsi HL7 FHIR</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                    <th className="py-2 pr-3">Aspek Pengelolaan</th>
                    <th className="py-2 px-3 text-rose-300">Sebelum FHIR (SIMRS Konvensional)</th>
                    <th className="py-2 px-3 text-emerald-300">Setelah FHIR (HL7 FHIR R4)</th>
                    <th className="py-2 pl-3">Dampak Risiko / Keuntungan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {beforeAfterComparisons.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      <td className="py-2.5 pr-3 font-semibold text-slate-200">{row.aspect}</td>
                      <td className="py-2.5 px-3 text-rose-200/90 leading-relaxed bg-rose-950/10 rounded">{row.before}</td>
                      <td className="py-2.5 px-3 text-emerald-200/90 leading-relaxed bg-emerald-950/10 rounded">{row.after}</td>
                      <td className="py-2.5 pl-3 leading-relaxed">
                        <span className="text-[10px] text-amber-300 block">{row.risk}</span>
                        <span className="text-[10px] text-teal-300 block mt-0.5">{row.impact}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contoh Data SIMRS Mentah Rumah Sakit Terpilih */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200">
                <span>Contoh Data SIMRS Terfragmentasi: {selectedSeed.hospitalName} ({selectedSeed.hospitalCode})</span>
              </div>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[9px] text-slate-400">Arsitektur: {selectedSeed.simrsArchitectureStyle}</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Berikut adalah baris data mentah di database SIMRS sebelum normalisasi. Perhatikan bagaimana kolom klaim/billing terpisah dari rekam medis dokter:
            </p>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(selectedSeed.rawSimrsTables).map(([tblName, rows]) => (
                <div key={tblName} className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                  <div className="text-[10px] font-bold text-amber-300 font-mono">Tabel: {tblName}</div>
                  <pre className="mt-1.5 max-h-36 overflow-y-auto rounded bg-slate-950 p-2 font-mono text-[9.5px] leading-relaxed text-slate-300">
                    {JSON.stringify(rows[0], null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SETELAH FHIR (RANTAI BUKTI HL7 FHIR) */}
      {evidenceTab === 'after-fhir' && (
        <div className="space-y-4">
          {/* Banner Active Evidence Chain */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <Link2 className="h-4 w-4 text-emerald-400" />
              <span>Rantai Bukti Terkunci: Keterlacakan 100% dari Tindakan Medis ke Rupiah</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
              Setiap rupiah di dalam <b>Claim.total</b> wajib memiliki referensi terverifikasi ke <b>ChargeItem</b>, <b>Procedure</b>, <b>Condition</b>, dan <b>Composition</b> pada <b>Encounter</b> yang sama.
              Jika referensi bukti diputuskan, sistem otomatis memblokir klaim melalui <b>Rule 4 (FHIR_STD_04_CLINICAL_TO_CLAIM_EVIDENCE_CHAIN)</b>.
            </p>
          </div>

          {/* Interactive 7 Stages Alur */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            {stages.map((stage, index) => (
              <div key={stage.label} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => activeDataset && selectResource(stage.type, stage.value)}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-2 text-left hover:border-cyan-400 transition"
                  title="Klik untuk membuka resource di Inspector JSON"
                >
                  <span className="block text-[9px] text-slate-500">{stage.label}</span>
                  <span className="mt-1 block max-w-[130px] truncate text-[10px] font-semibold text-cyan-200">{stage.value}</span>
                </button>
                {index < stages.length - 1 && <ArrowRight className="h-3 w-3 text-slate-600" />}
              </div>
            ))}
          </div>

          {/* Interactive Controls & Simulator */}
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Monetary Controls */}
            <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <BadgeDollarSign className="h-3.5 w-3.5 text-emerald-300" /> Monetary controls · IDR
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  Outcome
                  <select
                    value={effective.adjudicationOutcome}
                    onChange={(e) => setOverride('adjudicationOutcome', e.target.value)}
                    className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-cyan-200 outline-none"
                  >
                    <option value="complete">complete</option>
                    <option value="partial">partial</option>
                    <option value="queued">queued</option>
                    <option value="error">error</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['roomUnitPriceIdr', 'procedurePriceIdr', 'medicationPriceIdr', 'approvedRoomBenefitIdr', 'approvedProcedureBenefitIdr', 'approvedMedicationBenefitIdr'] as const).map((key) => (
                  <label key={key} className="text-[10px] text-slate-500">
                    {key}
                    <div className="mt-1 flex items-center rounded border border-slate-800 bg-slate-900">
                      <span className="px-2 text-[10px] text-slate-600">Rp</span>
                      <input
                        type="number"
                        min="0"
                        value={monetary(key)}
                        onChange={(event) => setOverride(key, Math.max(0, Number(event.target.value) || 0))}
                        className="w-full bg-transparent px-2 py-1.5 text-[11px] text-slate-200 outline-none"
                      />
                    </div>
                  </label>
                ))}
              </div>
              <div className="mt-3 rounded border border-slate-800 p-2 text-[10px] text-slate-400">
                Submitted: <b className="text-slate-200">{formatIdr(claim?.total?.value)}</b> · Approved: <b className="text-emerald-300">{formatIdr(response?.total?.find((total) => total.category?.coding?.some((coding) => coding.code === 'benefit'))?.amount?.value)}</b>
              </div>
            </section>

            {/* Invariant Conformance Simulator */}
            <section className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-200">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Invariant conformance simulator
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Sengaja injeksikan pelanggaran rantai bukti untuk menguji deteksi validator secara live.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <FieldToggle
                  label="Broken evidence reference"
                  checked={Boolean(effective.injectBrokenEvidenceChain)}
                  onChange={(value) => setOverride('injectBrokenEvidenceChain', value)}
                />
                <FieldToggle
                  label="Financial total mismatch"
                  checked={Boolean(effective.injectFinancialMismatch)}
                  onChange={(value) => setOverride('injectFinancialMismatch', value)}
                />
                <FieldToggle
                  label="Inject obs-7 violation"
                  checked={Boolean(effective.injectObs7Violation)}
                  onChange={(value) => setOverride('injectObs7Violation', value)}
                />
                <FieldToggle
                  label="Inject cmp-1 violation"
                  checked={Boolean(effective.injectCmp1Violation)}
                  onChange={(value) => setOverride('injectCmp1Violation', value)}
                />
                <FieldToggle
                  label="bdl-3 bundle order"
                  checked={Boolean(effective.injectBundleOrderViolation)}
                  onChange={(value) => setOverride('injectBundleOrderViolation', value)}
                />
              </div>
            </section>
          </div>

          {/* Rincian ChargeItems dengan Link Bukti */}
          <div className="grid gap-3 md:grid-cols-3">
            {charges.map((charge) => (
              <div key={charge.id} className="rounded border border-slate-800 bg-slate-950/50 p-3">
                <div className="text-[10px] font-semibold text-slate-300">
                  {charge.code?.coding?.[0]?.display ?? charge.code?.coding?.[0]?.code}
                </div>
                <div className="mt-2 text-sm font-bold text-emerald-300">
                  {formatIdr(charge.priceOverride?.value)}
                </div>
                <div className="mt-1 text-[9px] text-slate-500">
                  supportingInformation: <span className="font-mono text-cyan-300">{charge.supportingInformation?.[0]?.reference ?? '—'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Live Validation Snapshot */}
          {validationReport && (
            <div className="rounded border border-slate-800 bg-slate-950/50 p-3 text-[10px] text-slate-400">
              Validator snapshot: <b className={validationReport.valid ? 'text-emerald-300' : 'text-rose-300'}>{validationReport.valid ? 'CONFORMANT' : `${validationReport.errorCount} error(s)`}</b> · {validationReport.totalResourcesChecked} resources checked
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResourceGraph() {
  const activeDataset = useFhirStore((state) => state.activeDataset);
  const selectResource = useFhirStore((state) => state.selectResource);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [manuallyClickedEdgeIds, setManuallyClickedEdgeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedNodeId(null);
    setActiveStep(-1);
    setManuallyClickedEdgeIds(new Set());
  }, [activeDataset?.hospitalId]);

  const { allNodes, allEdges, adjacency } = useMemo(() => {
    const resources = activeDataset?.allResources ?? [];
    const allNodes: Node<{ resourceType: FhirResourceType; resourceId: string }>[] = resources.map((resource, index) => {
      const domain = resourceDomain(resource.resourceType);
      return {
        id: `${resource.resourceType}/${resource.id}`,
        position: { x: (index % 4) * 230, y: Math.floor(index / 4) * 110 },
        data: {
          label: `${domain.label} · ${resource.resourceType}\n${resource.id}`,
          resourceType: resource.resourceType,
          resourceId: resource.id,
        },
        style: {
          width: 195,
          border: `1px solid ${domain.color}`,
          borderRadius: 8,
          background: '#0f172a',
          color: '#e2e8f0',
          fontSize: 10,
          padding: 8,
          whiteSpace: 'pre-line',
          cursor: 'pointer',
        },
      };
    });

    const allEdges: Edge[] = [];
    const known = new Set(resources.map((resource) => `${resource.resourceType}/${resource.id}`));
    const adjacency = new Map<string, Set<string>>();

    const addNeighbor = (from: string, to: string) => {
      if (!adjacency.has(from)) adjacency.set(from, new Set());
      if (!adjacency.has(to)) adjacency.set(to, new Set());
      adjacency.get(from)!.add(to);
      adjacency.get(to)!.add(from);
    };

    const visit = (value: unknown, source: string) => {
      if (Array.isArray(value)) {
        value.forEach((item) => visit(item, source));
        return;
      }
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      if (typeof record.reference === 'string' && known.has(record.reference)) {
        const edgeId = `${source}->${record.reference}-${allEdges.length}`;
        allEdges.push({
          id: edgeId,
          source,
          target: record.reference,
          animated: false,
          style: { stroke: '#334155', strokeWidth: 1.2 },
        });
        addNeighbor(source, record.reference);
      }
      Object.entries(record).forEach(([key, item]) => {
        if (key !== 'reference') visit(item, source);
      });
    };

    resources.forEach((resource) => visit(resource, `${resource.resourceType}/${resource.id}`));
    return { allNodes, allEdges, adjacency };
  }, [activeDataset]);

  // Urutan relasi yang terhubung dengan node terpilih (outgoing lebih dulu, lalu incoming)
  const connectedEdgesList = useMemo(() => {
    if (!selectedNodeId) return [];
    const outgoing = allEdges.filter((e) => e.source === selectedNodeId);
    const incoming = allEdges.filter((e) => e.target === selectedNodeId && e.source !== selectedNodeId);
    return [...outgoing, ...incoming];
  }, [allEdges, selectedNodeId]);

  // Timer untuk menjalankan animasi satu per satu garis, lalu berubah merah setelah terlewati
  useEffect(() => {
    if (!selectedNodeId || connectedEdgesList.length === 0) {
      setActiveStep(-1);
      return;
    }

    // Mulai dari garis pertama (step 0)
    setActiveStep(0);
    const timer = setInterval(() => {
      setActiveStep((prev) => {
        if (prev < connectedEdgesList.length) {
          return prev + 1;
        }
        clearInterval(timer);
        return prev;
      });
    }, 850);

    return () => clearInterval(timer);
  }, [selectedNodeId, connectedEdgesList]);

  const { visibleNodes, visibleEdges, connectedCount } = useMemo(() => {
    if (!selectedNodeId) {
      // Keadaan awal: tidak ada garis yang berjalan otomatis
      const defaultEdges = allEdges.map((edge) => {
        const isManualRed = manuallyClickedEdgeIds.has(edge.id);
        return {
          ...edge,
          animated: false,
          style: {
            stroke: isManualRed ? '#ef4444' : '#334155',
            strokeWidth: isManualRed ? 2.5 : 1.2,
          },
        };
      });
      return { visibleNodes: allNodes, visibleEdges: defaultEdges, connectedCount: allNodes.length };
    }

    const connected = new Set<string>();
    connected.add(selectedNodeId);
    const neighbors = adjacency.get(selectedNodeId);
    if (neighbors) {
      neighbors.forEach((n) => connected.add(n));
    }

    const filteredNodes = allNodes
      .filter((node) => connected.has(node.id))
      .map((node, index) => {
        const isSelf = node.id === selectedNodeId;
        const domain = resourceDomain(node.data.resourceType);
        return {
          ...node,
          position: { x: (index % 3) * 250, y: Math.floor(index / 3) * 125 },
          style: {
            ...node.style,
            border: isSelf ? '2px solid #22d3ee' : `1.5px solid ${domain.color}`,
            background: isSelf ? '#083344' : '#0f172a',
            boxShadow: isSelf ? '0 0 16px rgba(34, 211, 238, 0.45)' : undefined,
          },
        };
      });

    // Garis berjalan satu per satu, dan garis yang sudah terlewati berubah menjadi merah (#ef4444)
    const filteredEdges = allEdges
      .filter((edge) => connected.has(edge.source) && connected.has(edge.target))
      .map((edge) => {
        const edgeIndex = connectedEdgesList.findIndex((e) => e.id === edge.id);
        const isManual = manuallyClickedEdgeIds.has(edge.id);
        const isTraversed = isManual || (edgeIndex !== -1 && edgeIndex < activeStep);
        const isCurrentlyWalking = edgeIndex !== -1 && edgeIndex === activeStep;

        if (isCurrentlyWalking) {
          // Garis yang sedang berjalan aktif
          return {
            ...edge,
            animated: true,
            style: {
              stroke: '#22d3ee',
              strokeWidth: 3,
            },
          };
        }

        if (isTraversed) {
          // Garis yang sudah terlewati -> BERUBAH MENJADI WARNA MERAH
          return {
            ...edge,
            animated: false,
            style: {
              stroke: '#ef4444',
              strokeWidth: 2.5,
            },
          };
        }

        // Garis yang belum dilewati (menunggu giliran)
        return {
          ...edge,
          animated: false,
          style: {
            stroke: '#475569',
            strokeWidth: 1.5,
          },
        };
      });

    return {
      visibleNodes: filteredNodes,
      visibleEdges: filteredEdges,
      connectedCount: filteredNodes.length,
    };
  }, [allNodes, allEdges, adjacency, selectedNodeId, connectedEdgesList, activeStep, manuallyClickedEdgeIds]);

  const isWalkingActive = selectedNodeId && activeStep >= 0 && activeStep < connectedEdgesList.length;
  const isAllTraversed = selectedNodeId && activeStep >= connectedEdgesList.length && connectedEdgesList.length > 0;

  return (
    <div className="flex h-full min-h-[620px] flex-col">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <GitMerge className="h-4 w-4 text-violet-300" /> Visualisasi Graph Relasi Resource FHIR
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Klik node mana pun untuk memulai penelusuran relasi sekuensial satu per satu garis (garis yang terlewati akan berubah merah).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Legend Indikator Status Garis */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[10px]">
            <span className="flex items-center gap-1 text-slate-300">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-pulse" /> Sedang Berjalan
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> Sudah Terlewati (Merah)
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-slate-600" /> Belum
            </span>
          </div>

          {selectedNodeId && (
            <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1">
              <span className="text-[10px] text-cyan-200">
                Node: <b className="font-mono text-cyan-300">{selectedNodeId}</b>
                {isWalkingActive && (
                  <span className="ml-1.5 text-emerald-300">
                    (Garis {activeStep + 1} dari {connectedEdgesList.length})
                  </span>
                )}
                {isAllTraversed && (
                  <span className="ml-1.5 text-rose-300 font-bold">
                    (Selesai — {connectedEdgesList.length} garis merah)
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setActiveStep(0)}
                title="Putar ulang animasi penelusuran garis"
                className="rounded bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-cyan-200 transition hover:bg-slate-700"
              >
                <RefreshCcw className="inline h-2.5 w-2.5 mr-1" /> Ulangi
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedNodeId(null);
                  setActiveStep(-1);
                  setManuallyClickedEdgeIds(new Set());
                }}
                className="rounded bg-cyan-400 px-2 py-0.5 text-[9px] font-bold text-slate-950 transition hover:bg-cyan-300"
              >
                Tampilkan Semua ({allNodes.length})
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
        <ReactFlow
          key={selectedNodeId ?? 'all-nodes'}
          nodes={visibleNodes}
          edges={visibleEdges}
          fitView
          onNodeClick={(_, node) => {
            selectResource(node.data.resourceType, node.data.resourceId);
            setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
          }}
          onEdgeClick={(_, edge) => {
            // Klik langsung pada garis juga dapat menandai garis menjadi merah
            setManuallyClickedEdgeIds((prev) => {
              const next = new Set(prev);
              if (next.has(edge.id)) next.delete(edge.id);
              else next.add(edge.id);
              return next;
            });
          }}
        >
          <Background color="#1e293b" gap={24} />
        </ReactFlow>
      </div>
    </div>
  );
}

function SqlConsole() {
  const sqlQueryText = useFhirStore((state) => state.sqlQueryText);
  const sqlQueryResult = useFhirStore((state) => state.sqlQueryResult);
  const isExecutingSql = useFhirStore((state) => state.isExecutingSql);
  const setSql = useFhirStore((state) => state.setSqlQueryText);
  const runSqlQuery = useFhirStore((state) => state.runSqlQuery);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('');

  const handlePickSample = (sample: (typeof SAMPLE_ANALYTICAL_SQL_QUERIES)[number]) => {
    setSelectedSampleId(sample.id);
    setSql(sample.sql);
  };

  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <Table2 className="h-4 w-4 text-amber-300" /> Interactive SQL Console
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Query PostgreSQL PGlite atas 27 tabel FHIR dan 3 analytical views secara live di browser.
        </p>
      </header>

      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span className="uppercase tracking-wider">Pilihan Template Query Analitik:</span>
          <span className="text-[9px] text-slate-500">Klik kartu untuk memuat SQL</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SAMPLE_ANALYTICAL_SQL_QUERIES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handlePickSample(sample)}
              className={`flex flex-col justify-between rounded-md border p-2 text-left transition ${
                selectedSampleId === sample.id || (sqlQueryText && sqlQueryText.includes(sample.sql.slice(0, 30)))
                  ? 'border-amber-400 bg-amber-500/15 shadow-sm'
                  : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800/50'
              }`}
            >
              <div>
                <span className="block text-[10px] font-bold text-slate-200">{sample.title}</span>
                <span className="mt-1 block text-[8.5px] leading-relaxed text-slate-400 line-clamp-2">
                  {sample.description}
                </span>
              </div>
              <span className="mt-2 inline-block self-start rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-amber-300">
                {sample.badge === 'IMPLEMENTED_SATUSEHAT' ? '🟢 SATUSEHAT' : '🔵 PIONEER'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <textarea
          value={sqlQueryText}
          onChange={(event) => setSql(event.target.value)}
          placeholder="SELECT * FROM vw_fhir_clinical_to_claim_audit;"
          rows={9}
          className="w-full resize-y rounded border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-cyan-100 outline-none focus:border-cyan-500"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Parameterized execution via PGlite</span>
          <button
            type="button"
            disabled={isExecutingSql || !sqlQueryText.trim()}
            onClick={() => void runSqlQuery()}
            className="inline-flex items-center gap-2 rounded bg-cyan-400 px-3 py-2 text-[10px] font-bold text-slate-950 disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            {isExecutingSql ? 'Executing…' : 'Run query'}
          </button>
        </div>
      </div>

      {sqlQueryResult && (
        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              {sqlQueryResult.rowCount} rows · {sqlQueryResult.executionTimeMs.toFixed(1)} ms
            </span>
            {sqlQueryResult.error && <span className="text-rose-300">{sqlQueryResult.error}</span>}
            <RefreshCcw className="h-3 w-3 text-slate-600" />
          </div>
          {sqlQueryResult.rows.length > 0 && (
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-left text-[10px]">
                <thead className="sticky top-0 bg-slate-900 text-slate-500">
                  <tr>
                    {sqlQueryResult.columns.map((column) => (
                      <th key={column} className="whitespace-nowrap px-2 py-2">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sqlQueryResult.rows.map((row, index) => (
                    <tr key={index} className="border-t border-slate-800 align-top">
                      {sqlQueryResult.columns.map((column) => (
                        <td key={column} className="max-w-[220px] whitespace-pre-wrap px-2 py-2 text-slate-300">
                          {String(row[column] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
