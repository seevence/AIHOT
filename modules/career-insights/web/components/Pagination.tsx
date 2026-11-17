import { Link, useSearchParams } from "react-router";

const BASE_PATH = "/career-insights";
const ITEM_CLASS = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px]";

function pageNumbers(current: number, totalPages: number): Array<number | "gap"> {
  const numbers = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const sorted = [...numbers].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  for (const page of sorted) {
    const previous = out[out.length - 1];
    if (typeof previous === "number" && page - previous > 1) out.push("gap");
    out.push(page);
  }
  return out;
}

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const [searchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);

  const hrefFor = (target: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(target));
    next.set("page_size", String(pageSize));
    return `${BASE_PATH}?${next.toString()}`;
  };

  return (
    <nav aria-label="职位分页" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="num text-[12px] text-ink-4">第 {current} / {totalPages} 页 · 共 {total} 条</span>
      <div className="flex flex-wrap items-center gap-1">
        {current > 1 ? (
          <Link to={hrefFor(current - 1)} className={`${ITEM_CLASS} border border-line text-ink-2 hover:bg-bg-sunk`}>
            上一页
          </Link>
        ) : (
          <span aria-disabled="true" className={`${ITEM_CLASS} border border-line text-ink-4 opacity-60`}>上一页</span>
        )}

        {pageNumbers(current, totalPages).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-[12px] text-ink-4">…</span>
          ) : item === current ? (
            <span key={item} aria-current="page" className={`${ITEM_CLASS} bg-accent font-medium text-accent-contrast`}>
              {item}
            </span>
          ) : (
            <Link key={item} to={hrefFor(item)} className={`${ITEM_CLASS} border border-line text-ink-2 hover:bg-bg-sunk`}>
              {item}
            </Link>
          ),
        )}

        {current < totalPages ? (
          <Link to={hrefFor(current + 1)} className={`${ITEM_CLASS} border border-line text-ink-2 hover:bg-bg-sunk`}>
            下一页
          </Link>
        ) : (
          <span aria-disabled="true" className={`${ITEM_CLASS} border border-line text-ink-4 opacity-60`}>下一页</span>
        )}
      </div>
    </nav>
  );
}