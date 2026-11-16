import type {
  CareerObservationBatchV1,
  IngestResultV1,
  JobDetailResponseV1,
  JobFiltersV1,
  JobListResponseV1,
  SummaryResponseV1,
} from "../contracts/api.ts";
import { DataUnavailableError } from "./errors.ts";

export interface CareerRepository {
  summary(): Promise<SummaryResponseV1>;
  listJobs(filters: JobFiltersV1): Promise<JobListResponseV1>;
  jobDetail(id: string): Promise<JobDetailResponseV1 | null>;
  writeBatch(batch: CareerObservationBatchV1): Promise<IngestResultV1>;
}

export class UnavailableCareerRepository implements CareerRepository {
  async summary(): Promise<SummaryResponseV1> {
    throw new DataUnavailableError();
  }

  async listJobs(_filters: JobFiltersV1): Promise<JobListResponseV1> {
    throw new DataUnavailableError();
  }

  async jobDetail(_id: string): Promise<JobDetailResponseV1 | null> {
    throw new DataUnavailableError();
  }

  async writeBatch(_batch: CareerObservationBatchV1): Promise<IngestResultV1> {
    throw new DataUnavailableError();
  }
}