import type {
  CareerObservationBatchV1,
  IngestResultV1,
  JobDetailResponseV1,
  JobFiltersV1,
  JobListResponseV1,
  SummaryResponseV1,
} from "../contracts/api.ts";
import type {
  CareerCatalogResponseV1,
  CareerDailyResponseV1,
  CareerHotResponseV1,
  CareerSignalsResponseV1,
} from "../contracts/insights.ts";
import type { HotCompanyOptions } from "./career-analytics.ts";
import type { CareerCatalogOptions } from "./career-catalog.ts";
import type { CareerSignalsOptions } from "./career-signals.ts";
import type { PolicyFiltersV1, PolicyListResponseV1 } from "./policy-read.ts";

export interface CareerRepository {
  summary(): Promise<SummaryResponseV1>;
  listJobs(filters: JobFiltersV1): Promise<JobListResponseV1>;
  jobDetail(id: string): Promise<JobDetailResponseV1 | null>;
  listPolicies(filters: PolicyFiltersV1): Promise<PolicyListResponseV1>;
  hotCompanies(options: HotCompanyOptions): Promise<CareerHotResponseV1>;
  dailySummary(): Promise<CareerDailyResponseV1>;
  careerSignals(options: CareerSignalsOptions): Promise<CareerSignalsResponseV1>;
  careerCatalog(options: CareerCatalogOptions): Promise<CareerCatalogResponseV1>;
  writeBatch(batch: CareerObservationBatchV1): Promise<IngestResultV1>;
}