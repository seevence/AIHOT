import { Link, redirect, useLoaderData } from "react-router";
import { SITE } from "@aihot/site";
import type { Route } from "./+types/home";
import type { TimelineResponse } from "@aihot/contracts/site";
import { cachedPage, loadOr404 } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { filterParams, hasFeedFilters, itemListLd, listPath, pageMeta, readFilters, siteLd } from "../lib/seo";
import { inNav } from "../components/shell/nav";
import type { Screen } from "../components/shell/screens";
import { Timeline } from "../features/feed/Timeline";
import { HotTopics } from "../features/feed/HotTopics";
import { ActiveFilters, CategoryTabs, FeedBar, SearchField } from "../features/feed/Filters";

export const handle: Screen = { tab: "featured", name: "精选" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  // Search lives on /all; keep the parameters so old links still land on results.
  if (q && q.trim()) throw redirect(`/all${url.search}`);
  const filters = readFilters(url.searchParams);
  const upstream = new Headers();
  const data = await loadOr404<TimelineResponse>(listPath("/api/site/timeline", filterParams(filters)), { responseHeaders: upstream, signal: request.signal });
  // A minute at most, here and on /all: new selections must not wait longer at the edge or in a browser.
  return cachedPage(60, { data, filters }, upstream);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const path = listPath("/", loaderData ? filterParams(loaderData.filters) : {});
  const titles = loaderData?.data.cards.map((c) => c.item.title) ?? [];
  const tags = pageMeta({ path, noindex: hasFeedFilters(loaderData?.filters), jsonLd: path === "/" ? [...siteLd(), itemListLd("/", "精选", titles)] : undefined });
  // Webmaster platforms look for their verification tag on the home page only.
  if (path !== "/") return tags;
  return [...tags, ...Object.entries(SITE.siteVerification).map(([name, content]) => ({ name, content }))];
}

export default function Home() {
  const { data, filters } = useLoaderData<typeof loader>();
  const title = filters.tag ? `#${filters.tag}` : "精选";
  return (
    <div className="pb-6">
      <section aria-labelledby="career-insights-entry" className="mb-4 rounded-card border border-line bg-surface p-4">
        <h2 id="career-insights-entry" className="text-[16px] font-semibold text-ink">就业趋势洞察</h2>
        <p className="mt-1 text-[12px] text-ink-3 break-words">基于真实招聘岗位与政府公开政策数据，查看 AI 相关岗位的职族分布、经验门槛与政策动向。</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            to="/career-insights"
            className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-[13px] font-medium text-ink-2"
          >
            查看就业趋势
          </Link>
          <Link
            to="/career-insights/policies"
            className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-[13px] font-medium text-ink-2"
          >
            政策文件
          </Link>
        </div>
        {data.cards.length === 0 && <p className="mt-3 text-[12px] text-ink-3">本站动态内容暂未接入，可先查看就业趋势洞察。</p>}
      </section>
      {/* Phones: the bar (精选 | 全部, filter, search), the filter in use, today's hot topics, the feed. */}
      <FeedBar base="/" category={filters.category} channel={filters.channel} />
      <ActiveFilters base="/" category={filters.category} channel={filters.channel} tag={filters.tag} />
      <div className="hidden lg:block">
        <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">{title}</h1>
        <div className="mb-5 mt-4 flex items-center justify-between gap-4">
          <CategoryTabs base="/" category={filters.category} channel={filters.channel} layoutId="home-cat-desk" className="min-w-0" />
          <SearchField keep={{ category: filters.category }} />
        </div>
      </div>

      {data.hot && inNav("/hot") && <HotTopics entries={data.hot} />}

      <Timeline initial={data} filters={data.filters} />
    </div>
  );
}
