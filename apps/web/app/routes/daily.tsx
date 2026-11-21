import { useLoaderData } from "react-router";
import type { CareerDailyCommentResponseV1 } from "@aihot/career-insights/contracts";
import type { Route } from "./+types/daily";
import { cachedPage } from "../lib/api.server";
import { logError } from "../lib/errors.server";
import { pageReuse } from "../lib/page-reuse";
import { pageMeta } from "../lib/seo";
import { CareerDailyReport } from "../../../../modules/career-insights/web/components/CareerDailyReport.ts";
import {
  careerDailyCommentPath,
  loadCareerDaily,
  loadCareerDailyComment,
} from "../../../../modules/career-insights/web/feeds.server.ts";
import type { Screen } from "../components/shell/screens";

export const handle: Screen = { tab: "daily", name: "就业日报" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

/**
 * 评论区块单独降级：无缓存(204) 返回 null，请求失败也返回 null 并记一条请求日志，
 * 页面仍是 200、其它区块照常渲染；读者访问只读缓存，不触发模型调用。
 */
async function settledDailyComment(signal: AbortSignal): Promise<CareerDailyCommentResponseV1 | null> {
  try {
    return await loadCareerDailyComment<CareerDailyCommentResponseV1>(signal);
  } catch (error) {
    if (!signal.aborted) logError(error, { msg: "daily comment block failed", method: "GET", path: careerDailyCommentPath() });
    return null;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const signal = request.signal;
  const [daily, comment] = await Promise.all([loadCareerDaily(signal), settledDailyComment(signal)]);
  return cachedPage(60, { daily, comment });
}

export function meta({ loaderData }: Route.MetaArgs) {
  const date = loaderData?.daily.date;
  return pageMeta({
    title: `就业日报${date ? `（${date}）` : ""}`,
    description: "今日新增岗位与政策、各来源采集结果，以及空技能岗位占比。",
    path: "/daily",
    image: "/og/pages/daily.png",
  });
}

export default function CareerDailyPage() {
  const { daily, comment } = useLoaderData<typeof loader>();
  return <CareerDailyReport daily={daily} comment={comment} />;
}