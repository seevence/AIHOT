import type {
  CareerObservationBatchV1,
  IngestResultV1,
  JobDetailResponseV1,
  JobFiltersV1,
  JobListResponseV1,
  SummaryResponseV1,
} from "../contracts/api.ts";
import type { PolicyFiltersV1, PolicyListResponseV1 } from "./policy-read.ts";

export interface CareerRepository {
  summary(): Promise<SummaryResponseV1>;
  listJobs(filters: JobFiltersV1): Promise<JobListResponseV1>;
  jobDetail(id: string): Promise<JobDetailResponseV1 | null>;
  listPolicies(filters: PolicyFiltersV1): Promise<PolicyListResponseV1>;
  writeBatch(batch: CareerObservationBatchV1): Promise<IngestResultV1>;
}