// 就业热点三个只读接口的取数入口。服务端专用：由路由 loader 与 standalone 断言调用，
// 不进入客户端 bundle（文件名后缀 .server 由框架剥离）。
import type {
  CareerDailyResponseV1,
  CareerHotResponseV1,
  CareerSignalsResponseV1,
} from "../contracts/index.ts";
import { careerApiPath, loadCareerApi } from "./api.ts";

export const SIGNALS_LIMIT = 5;
export const HOT_LIMIT = 10;

export function careerSignalsPath(): string {
  return `${careerApiPath("/signals")}?limit=${SIGNALS_LIMIT}`;
}

export function careerHotPath(): string {
  return `${careerApiPath("/hot")}?limit=${HOT_LIMIT}`;
}

export function careerDailyPath(): string {
  return careerApiPath("/daily");
}

export function loadCareerSignals(signal?: AbortSignal): Promise<CareerSignalsResponseV1> {
  return loadCareerApi<CareerSignalsResponseV1>(careerSignalsPath(), signal);
}

export function loadCareerHot(signal?: AbortSignal): Promise<CareerHotResponseV1> {
  return loadCareerApi<CareerHotResponseV1>(careerHotPath(), signal);
}

export function loadCareerDaily(signal?: AbortSignal): Promise<CareerDailyResponseV1> {
  return loadCareerApi<CareerDailyResponseV1>(careerDailyPath(), signal);
}