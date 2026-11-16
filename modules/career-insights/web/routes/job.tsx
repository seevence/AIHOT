import { data, isRouteErrorResponse, useLoaderData, useRouteError } from "react-router";
import type { LoaderArgs } from "@aihot/web/lib/route-types";
import type { JobDetailResponseV1 } from "@aihot/career-insights/contracts";
import { careerApiPath, loadCareerApi } from "../api";
import { CareerError, CareerLoading } from "../components/CareerStates";
import { JobDetail } from "../components/JobDetail";

export async function loader({ params, request }: LoaderArgs) {
  if (!params.id) throw data({ message: "not_found" }, { status: 404 });
  return loadCareerApi<JobDetailResponseV1>(careerApiPath(`/jobs/${encodeURIComponent(params.id)}`), request.signal);
}

export function headers() {
  return { "Cache-Control": "no-store" };
}

export function meta() {
  return [{ title: "职位详情 · 职业洞察" }];
}

export const HydrateFallback = CareerLoading;

export function ErrorBoundary() {
  const error = useRouteError();
  return <CareerError status={isRouteErrorResponse(error) ? error.status : 500} />;
}

export default function CareerJobRoute() {
  const detail = useLoaderData<typeof loader>();
  return <JobDetail data={detail} />;
}