import { isRouteErrorResponse, useLoaderData, useNavigation, useRouteError } from "react-router";
import type { LoaderArgs } from "@aihot/web/lib/route-types";
import type { JobListResponseV1, SummaryResponseV1 } from "@aihot/career-insights/contracts";
import { careerApiPath, loadCareerApi, parseDashboardFilters, parseDirectionView, serializeJobFilters } from "../api";
import { CareerDashboard } from "../components/CareerDashboard";
import { CareerError, CareerLoading } from "../components/CareerStates";

export async function loader({ request }: LoaderArgs) {
  const search = new URL(request.url).searchParams;
  const filters = parseDashboardFilters(search);
  const { view, roleFamily } = parseDirectionView(search);
  const query = serializeJobFilters(filters);
  const directionRoleFamily = view === "direction" ? roleFamily : undefined;
  const [summary, jobs, studentFriendlyJobs] = await Promise.all([
    loadCareerApi<SummaryResponseV1>(careerApiPath("/summary"), request.signal),
    loadCareerApi<JobListResponseV1>(`${careerApiPath("/jobs")}?${query}`, request.signal),
    directionRoleFamily
      ? loadCareerApi<JobListResponseV1>(
          `${careerApiPath("/jobs")}?${serializeJobFilters({
            ...filters,
            role_family: directionRoleFamily,
            student_friendly: "yes",
            page: 1,
          })}`,
          request.signal,
        )
      : Promise.resolve(null),
  ]);
  const direction = directionRoleFamily
    ? { roleFamily: directionRoleFamily, studentFriendlyTotal: studentFriendlyJobs?.total ?? 0 }
    : undefined;
  return { summary, jobs, filters, direction };
}

export function headers() {
  return { "Cache-Control": "no-store" };
}

export function meta() {
  return [{ title: "职业洞察" }];
}

export const HydrateFallback = CareerLoading;

export function ErrorBoundary() {
  const error = useRouteError();
  return <CareerError status={isRouteErrorResponse(error) ? error.status : 500} />;
}

export default function CareerDashboardRoute() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  if (navigation.state === "loading") return <CareerLoading />;
  return <CareerDashboard summary={data.summary} jobs={data.jobs} filters={data.filters} direction={data.direction} />;
}
