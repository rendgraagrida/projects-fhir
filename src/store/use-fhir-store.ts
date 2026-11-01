import { create } from 'zustand';
import type { PGlite } from '@electric-sql/pglite';
import {
  SIMRS_HOSPITAL_SEEDS,
} from '../data/simrs-normalization-seeds';
import {
  flattenDatasetWithSqlOnFhir,
  SQL_ON_FHIR_VIEW_DEFINITIONS,
} from '../lib/sql-on-fhir-flattener';
import {
  executeSqlQuery,
  initPgliteDatabase,
  resolveAndMergeDuplicatePatient,
  syncDatasetsToPglite,
  TABLE_METADATA,
} from '../lib/pglite-db';
import { normalizeSimrsToFhir } from '../lib/fhir-normalizer';
import { validateFhirDataset } from '../lib/fhir-validator';
import type {
  FhirResourceType,
  FlattenedDatasetResult,
  ImplementationStatus,
  NormalizedHospitalDataset,
  Patient,
  SandboxClinicalFinancialOverrides,
  SimrsHospitalSeed,
  SqlQueryExecutionResult,
  ValidationReport,
} from '../types/fhir-global';

export type CenterMode = 'sandbox' | 'laws' | 'rosetta' | 'evidence' | 'graph' | 'sql' | 'modules';
export type RightTab = 'fhir-json' | 'view-definition' | 'pglite-tables' | 'validator';
export type StatusFilter = 'ALL' | ImplementationStatus;

export interface FhirStoreState {
  selectedHospitalId: string;
  overridesByHospital: Record<string, Partial<SandboxClinicalFinancialOverrides>>;
  datasetsByHospital: Record<string, NormalizedHospitalDataset>;
  activeDataset: NormalizedHospitalDataset | null;
  validationReport: ValidationReport | null;
  flattenedResult: FlattenedDatasetResult | null;
  activeModuleNumber: number;
  statusFilter: StatusFilter;
  completedMissionIds: string[];
  selectedResourceType: FhirResourceType;
  selectedResourceId: string;
  selectedViewDefName: string;
  selectedTableName: string;
  centerMode: CenterMode;
  rightTab: RightTab;
  db: PGlite | null;
  dbInitialized: boolean;
  dbSyncing: boolean;
  dbError: string | null;
  tableRowsPreview: Record<string, unknown>[];
  sqlQueryText: string;
  sqlQueryResult: SqlQueryExecutionResult | null;
  isExecutingSql: boolean;
  initializeLab: () => Promise<void>;
  selectHospital: (id: string) => void;
  updateOverrides: (partial: Partial<SandboxClinicalFinancialOverrides>) => Promise<void>;
  resetHospitalOverrides: () => Promise<void>;
  triggerPatientMerge: () => Promise<void>;
  setActiveModule: (moduleNumber: number) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  toggleMissionCompleted: (id: string) => void;
  setCenterMode: (mode: CenterMode) => void;
  setRightTab: (tab: RightTab) => void;
  selectResource: (resourceType: FhirResourceType, resourceId: string) => void;
  selectViewDef: (viewDefName: string) => void;
  setSqlQueryText: (sql: string) => void;
  selectTable: (tableName: string) => Promise<void>;
  runSqlQuery: (sql?: string) => Promise<void>;
}

const firstSeed = SIMRS_HOSPITAL_SEEDS[0];
const firstView = SQL_ON_FHIR_VIEW_DEFINITIONS[0];
const firstTable = TABLE_METADATA[0];
let datasetSyncQueue: Promise<void> = Promise.resolve();
let initializationPromise: Promise<void> | null = null;

const clampModule = (value: number): number => Math.min(12, Math.max(1, Math.round(value)));
const isKnownHospital = (id: string): boolean => SIMRS_HOSPITAL_SEEDS.some((seed) => seed.id === id);

const normalizeDataset = (
  seed: SimrsHospitalSeed,
  overrides: Partial<SandboxClinicalFinancialOverrides> = {},
): NormalizedHospitalDataset => normalizeSimrsToFhir(seed, { ...seed.defaultOverrides, ...overrides });

const deriveDatasetState = (dataset: NormalizedHospitalDataset) => ({
  activeDataset: dataset,
  validationReport: validateFhirDataset(dataset),
  flattenedResult: flattenDatasetWithSqlOnFhir(dataset),
  selectedResourceType: dataset.patient.resourceType,
  selectedResourceId: dataset.patient.id,
});

const syncIfReady = async (db: PGlite | null, datasets: NormalizedHospitalDataset[]): Promise<void> => {
  if (db) await syncDatasetsToPglite(db, datasets);
};

const enqueueDbTask = <T>(task: () => Promise<T>): Promise<T> => {
  const next = datasetSyncQueue.then(task);
  datasetSyncQueue = next.then(() => undefined, () => undefined);
  return next;
};

const enqueueDatasetSync = (db: PGlite | null, datasets: NormalizedHospitalDataset[]): Promise<void> =>
  enqueueDbTask(() => syncIfReady(db, datasets));

export const useFhirStore = create<FhirStoreState>((set, get) => ({
  selectedHospitalId: firstSeed?.id ?? '',
  overridesByHospital: {},
  datasetsByHospital: {},
  activeDataset: null,
  validationReport: null,
  flattenedResult: null,
  activeModuleNumber: 1,
  statusFilter: 'ALL',
  completedMissionIds: [],
  selectedResourceType: 'Patient',
  selectedResourceId: '',
  selectedViewDefName: firstView?.name ?? '',
  selectedTableName: firstTable?.tableName ?? '',
  centerMode: 'sandbox',
  rightTab: 'fhir-json',
  db: null,
  dbInitialized: false,
  dbSyncing: false,
  dbError: null,
  tableRowsPreview: [],
  sqlQueryText: '',
  sqlQueryResult: null,
  isExecutingSql: false,

  initializeLab: async () => {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      set({ dbError: null, dbSyncing: true });
      try {
        const overridesByHospital: Record<string, Partial<SandboxClinicalFinancialOverrides>> = {};
        const datasetsByHospital: Record<string, NormalizedHospitalDataset> = {};
        for (const seed of SIMRS_HOSPITAL_SEEDS) {
          overridesByHospital[seed.id] = {};
          datasetsByHospital[seed.id] = normalizeDataset(seed);
        }
        const selected = datasetsByHospital[get().selectedHospitalId] ?? datasetsByHospital[firstSeed.id];
        if (!selected) throw new Error('Tidak ada seed rumah sakit untuk memulai lab.');
        const db = await initPgliteDatabase();
        await syncDatasetsToPglite(db, Object.values(datasetsByHospital));
        set({
          db,
          dbInitialized: true,
          dbSyncing: false,
          overridesByHospital,
          datasetsByHospital,
          ...deriveDatasetState(selected),
        });
      } catch (error) {
        set({ dbSyncing: false, dbError: error instanceof Error ? error.message : String(error) });
      } finally {
        initializationPromise = null;
      }
    })();
    return initializationPromise;
  },

  selectHospital: (id) => {
    if (!isKnownHospital(id)) return;
    const state = get();
    const dataset = state.datasetsByHospital[id];
    set({ selectedHospitalId: id, ...(dataset ? deriveDatasetState(dataset) : {}) });
  },

  updateOverrides: async (partial) => {
    const state = get();
    const seed = SIMRS_HOSPITAL_SEEDS.find((candidate) => candidate.id === state.selectedHospitalId);
    if (!seed) return;
    const overrides = { ...(state.overridesByHospital[seed.id] ?? {}), ...partial };
    const dataset = normalizeDataset(seed, overrides);
    const datasetsByHospital = { ...state.datasetsByHospital, [seed.id]: dataset };
    set({
      overridesByHospital: { ...state.overridesByHospital, [seed.id]: overrides },
      datasetsByHospital,
      dbSyncing: Boolean(state.db),
      ...deriveDatasetState(dataset),
    });
    try {
      await enqueueDatasetSync(state.db, Object.values(datasetsByHospital));
      set({ dbSyncing: false, dbError: null });
    } catch (error) {
      set({ dbSyncing: false, dbError: error instanceof Error ? error.message : String(error) });
    }
  },

  resetHospitalOverrides: async () => {
    const state = get();
    const seed = SIMRS_HOSPITAL_SEEDS.find((candidate) => candidate.id === state.selectedHospitalId);
    if (!seed) return;
    const dataset = normalizeDataset(seed);
    const datasetsByHospital = { ...state.datasetsByHospital, [seed.id]: dataset };
    set({
      overridesByHospital: { ...state.overridesByHospital, [seed.id]: {} },
      datasetsByHospital,
      dbSyncing: Boolean(state.db),
      ...deriveDatasetState(dataset),
    });
    try {
      await enqueueDatasetSync(state.db, Object.values(datasetsByHospital));
      set({ dbSyncing: false, dbError: null });
    } catch (error) {
      set({ dbSyncing: false, dbError: error instanceof Error ? error.message : String(error) });
    }
  },

  triggerPatientMerge: async () => {
    const initialState = get();
    const dataset = initialState.activeDataset;
    if (!dataset?.duplicateEmergencyPatient) return;
    if (!initialState.db) {
      set({ dbError: 'PGlite belum diinisialisasi.' });
      return;
    }
    const db = initialState.db;
    const hospitalId = dataset.hospitalId;
    const duplicateId = dataset.duplicateEmergencyPatient.id;
    const targetId = dataset.patient.id;
    set({ dbSyncing: true, dbError: null });
    try {
      const result = await enqueueDbTask(() =>
        resolveAndMergeDuplicatePatient(db, dataset, duplicateId, targetId),
      );
      const latestState = get();
      const datasetsByHospital = { ...latestState.datasetsByHospital, [hospitalId]: result.updatedDataset };
      const overridesByHospital = {
        ...latestState.overridesByHospital,
        [hospitalId]: { ...(latestState.overridesByHospital[hospitalId] ?? {}), mergedDuplicatePatient: true },
      };
      await enqueueDatasetSync(db, Object.values(datasetsByHospital));
      const activeAfterSync = get().selectedHospitalId === hospitalId ? deriveDatasetState(result.updatedDataset) : {};
      set({
        overridesByHospital,
        datasetsByHospital,
        dbSyncing: false,
        dbError: null,
        ...activeAfterSync,
      });
    } catch (error) {
      set({ dbSyncing: false, dbError: error instanceof Error ? error.message : String(error) });
    }
  },

  setActiveModule: (moduleNumber) => set({ activeModuleNumber: clampModule(moduleNumber) }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  toggleMissionCompleted: (id) => set((state) => ({ completedMissionIds: state.completedMissionIds.includes(id) ? state.completedMissionIds.filter((missionId) => missionId !== id) : [...state.completedMissionIds, id] })),
  setCenterMode: (mode) => set({ centerMode: mode }),
  setRightTab: (tab) => set({ rightTab: tab }),
  selectResource: (resourceType, resourceId) => set({ selectedResourceType: resourceType, selectedResourceId: resourceId, rightTab: 'fhir-json' }),
  selectViewDef: (viewDefName) => set({ selectedViewDefName: viewDefName }),
  setSqlQueryText: (sql) => set({ sqlQueryText: sql }),
  selectTable: async (tableName) => {
    const state = get();
    const metadata = TABLE_METADATA.find((item) => item.tableName === tableName);
    if (!metadata) return;
    set({ selectedTableName: tableName, rightTab: 'pglite-tables' });
    if (!state.db) return;
    try {
      const result = await executeSqlQuery(state.db, `SELECT * FROM "${tableName.replaceAll('"', '""')}" LIMIT 25`);
      set({ tableRowsPreview: result.rows, dbError: result.error ?? null });
    } catch (error) {
      set({ tableRowsPreview: [], dbError: error instanceof Error ? error.message : String(error) });
    }
  },
  runSqlQuery: async (sql) => {
    const state = get();
    const query = (sql ?? state.sqlQueryText).trim();
    if (!query) return;
    set({ sqlQueryText: query, isExecutingSql: true, sqlQueryResult: null });
    if (!state.db) {
      set({ isExecutingSql: false, sqlQueryResult: { columns: [], rows: [], rowCount: 0, executionTimeMs: 0, error: 'PGlite belum terinisialisasi.' } });
      return;
    }
    try {
      const result = await executeSqlQuery(state.db, query);
      set({ isExecutingSql: false, sqlQueryResult: result, dbError: result.error ?? null });
    } catch (error) {
      set({ isExecutingSql: false, sqlQueryResult: { columns: [], rows: [], rowCount: 0, executionTimeMs: 0, error: error instanceof Error ? error.message : String(error) } });
    }
  },
}));

export const getResourceFromDataset = (dataset: NormalizedHospitalDataset | null, type: FhirResourceType, id: string) => {
  if (!dataset) return null;
  return dataset.allResources.find((resource) => resource.resourceType === type && resource.id === id) ?? null;
};

export const getPatientLinkTarget = (patient: Patient): string | null => patient.link?.[0]?.other?.reference ?? null;
