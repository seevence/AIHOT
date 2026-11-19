import { isRouteErrorResponse, useLoaderData, useRouteError } from "react-router";
import type { LoaderArgs } from "@aihot/web/lib/route-types";
import { loadPolicies } from "../api";
import {
  buildPoliciesHref,
  parsePolicyFilters,
  policyApiPath,
  type PolicyListResponse,
  type PolicyPageFilters,
} from "../policy";
import { Pagination } from "../components/Pagination";
import { PolicyList } from "../components/PolicyList";
import { CareerError, CareerLoading, FixtureNotice } from "../components/CareerStates";


export function PoliciesView({ policies, filters }: { policies: PolicyListResponse; filters: PolicyPageFilters }) {
  return (
    <div className="space-y-6 pb-10 pt-3">
      <header>
        <h1 data-page-title="" className="text-[24px] font-semibold text-ink">政策文件</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">政策数据来自政府公开来源，共 {policies.total} 条。</p>
      </header>

      {policies.data_origin === "synthetic_fixture" && <FixtureNotice />}

      <PolicyList policies={policies} filters={filters} />

      {policies.items.length > 0 && (
        <Pagination
          page={policies.page}
          pageSize={policies.page_size}
          total={policies.total}
          ariaLabel="政策分页"
          hrefFor={(target) => buildPoliciesHref({ ...filters, page: target, page_size: policies.page_size })}
        />
      )}
    </div>
  );
}

export async function loader({ request }: LoaderArgs) {
  const filters = parsePolicyFilters(new URL(request.url).searchParams);
  const policies = await loadPolicies(policyApiPath(filters), request.signal);
  return { policies, filters };
}

export function headers() {
  return { "Cache-Control": "no-store" };
}

export function meta() {
  return [{ title: "政策文件 · 职业洞察" }];
}

export const HydrateFallback = CareerLoading;

export function ErrorBoundary() {
  const error = useRouteError();
  return <CareerError status={isRouteErrorResponse(error) ? error.status : 500} />;
}

export default function CareerPoliciesRoute() {
  const data = useLoaderData<typeof loader>();
  return <PoliciesView policies={data.policies} filters={data.filters} />;
}