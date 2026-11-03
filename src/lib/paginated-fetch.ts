export type PageFetcher = (input: string, init?: RequestInit) => Promise<Response>;

type PagePayload<T> = {
  items?: T[];
  pagination?: {
    pages?: number;
  };
};

const DIRECTORY_PAGE_SIZE = 100;
const MAX_DIRECTORY_PAGES = 1_000;
const PAGE_BATCH_SIZE = 8;

/**
 * Loads every server-paginated directory page for dropdowns that need the
 * complete option set. Requests are bounded and made in small batches.
 */
export async function fetchAllPages<T>(
  path: string,
  fetcher: PageFetcher = (input, init) => fetch(input, init),
): Promise<T[]> {
  const pageUrl = (page: number) => {
    const url = new URL(path, "http://localhost");
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(DIRECTORY_PAGE_SIZE));
    return url.pathname + url.search;
  };

  const firstResponse = await fetcher(pageUrl(1), { cache: "no-store" });
  if (!firstResponse.ok) return [];

  const firstPayload = (await firstResponse.json()) as PagePayload<T>;
  if (!Array.isArray(firstPayload.items)) return [];

  const rawPageCount = Number(firstPayload.pagination?.pages ?? 1);
  const pageCount = Number.isSafeInteger(rawPageCount) && rawPageCount > 0
    ? rawPageCount
    : 1;

  if (pageCount > MAX_DIRECTORY_PAGES) {
    throw new Error("DIRECTORY_TOO_LARGE");
  }

  const items = [...firstPayload.items];
  for (let start = 2; start <= pageCount; start += PAGE_BATCH_SIZE) {
    const end = Math.min(pageCount, start + PAGE_BATCH_SIZE - 1);
    const pageNumbers = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    const responses = await Promise.all(
      pageNumbers.map((page) => fetcher(pageUrl(page), { cache: "no-store" })),
    );

    for (let index = 0; index < responses.length; index += 1) {
      const response = responses[index];
      if (!response.ok) {
        throw new Error("DIRECTORY_PAGE_LOAD_FAILED");
      }
      const payload = (await response.json()) as PagePayload<T>;
      if (!Array.isArray(payload.items)) {
        throw new Error("INVALID_DIRECTORY_RESPONSE");
      }
      items.push(...payload.items);
    }
  }

  return items;
}
