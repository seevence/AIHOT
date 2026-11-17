import { data, isRouteErrorResponse, useLoaderData, useRouteError } from "react-router";
import type { LoaderArgs } from "@aihot/web/lib/route-types";
import type { JobDetailResponseV1 } from "@aihot/career-insights/contracts";
import { careerApiPath, loadCareerApi } from "../api";
import { safeBackHref } from "../filters";
import { CareerError, CareerLoading, FixtureNotice, SingleSnapshotNotice } from "../components/CareerStates";
import { JobDetail } from "../components/JobDetail";

export async function loader({ params, request }: LoaderArgs) {
  if (!params.id) throw data({ message: "not_found" }, { status: 404 });
  const back = new URL(request.url).searchParams.get("back");
  const detail = await loadCareerApi<JobDetailResponseV1>(careerApiPath(`/jobs/${encodeURIComponent(params.id)}`), request.signal);
  return { detail, backHref: safeBackHref(back) };
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
  const { detail, backHref } = useLoaderData<typeof loader>();
  const { job, observations } = detail;

  return (
    <article className="space-y-6 pb-10 pt-3">
      <JobDetail job={job} backHref={backHref} />
      {detail.data_origin === "synthetic_fixture" && <FixtureNotice />}

      <p className="rounded-card border border-line bg-bg-sunk px-4 py-3 text-[13px] leading-relaxed text-ink-3">{detail.notice}</p>

      <section aria-labelledby="job-observations">
        <h2 id="job-observations" className="text-[17px] font-semibold text-ink">观测记录</h2>
        {observations.length === 1 && <div className="mt-3"><SingleSnapshotNotice /></div>}
        {observations.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-3">暂无观测记录。</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {observations.map((observation) => (
              <li key={observation.id} className="rounded-card border border-line bg-surface p-4">
                <time dateTime={observation.observed_at} className="text-[12px] text-ink-4">{observation.observed_at}</time>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{observation.evidence_excerpt}</p>
                <a href={observation.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-[12px] text-accent">查看观测来源</a>
                <div className="mono mt-2 break-all text-[11px] text-ink-4">{observation.content_hash} · {observation.collector_version}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}