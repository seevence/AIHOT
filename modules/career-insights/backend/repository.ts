import type {
  CareerObservationBatchV1,
  IngestResultV1,
  JobDetailResponseV1,
  JobFiltersV1,
  JobListResponseV1,
  SummaryResponseV1,
} from "../contracts/api.ts";

export interface CareerRepository {
  summary(): Promise<SummaryResponseV1>;
  listJobs(filters: JobFiltersV1): Promise<JobListResponseV1>;
  jobDetail(id: string): Promise<JobDetailResponseV1 | null>;
  writeBatch(batch: CareerObservationBatchV1): Promise<IngestResultV1>;
}