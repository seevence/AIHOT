import type { RawCollectedJobV1 } from "../contracts";

export interface CareerSourceDefinition {
  source_key: string;
  label: string;
  kind: "company_careers" | "government_policy";
  entry_url: string;
  access: "http" | "playwright" | "aihot_source";
  enabled: false;
  notes: string;
}

export interface CareerSourceAdapter {
  readonly definition: CareerSourceDefinition;
  collect(signal?: AbortSignal): Promise<RawCollectedJobV1[]>;
}

export {
  CAREER_SOURCE_ADAPTERS,
  CAREER_SOURCE_DEFINITIONS,
} from "./sources";