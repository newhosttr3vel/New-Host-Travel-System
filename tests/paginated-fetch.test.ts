import test from "node:test";
import assert from "node:assert/strict";
import { fetchAllPages } from "../src/lib/paginated-fetch";

test("fetches every page of a directory instead of silently stopping at 100 records", async () => {
  const requestedPages: number[] = [];
  const fetcher = async (input: string) => {
    const url = new URL(input, "http://localhost");
    const page = Number(url.searchParams.get("page"));
    requestedPages.push(page);
    return new Response(JSON.stringify({
      items: page === 1 ? ["customer-1", "customer-2"] : page === 2 ? ["customer-3"] : ["customer-4"],
      pagination: { page, pageSize: 100, total: 4, pages: 3 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const items = await fetchAllPages<string>("/api/customers", fetcher);

  assert.deepEqual(items, ["customer-1", "customer-2", "customer-3", "customer-4"]);
  assert.deepEqual(requestedPages.sort((a, b) => a - b), [1, 2, 3]);
});

test("returns an empty list when the first directory page is unavailable", async () => {
  const items = await fetchAllPages<string>(
    "/api/customers",
    async () => new Response("{}", { status: 503 }),
  );

  assert.deepEqual(items, []);
});

test("fails visibly when a later directory page cannot be loaded", async () => {
  await assert.rejects(
    fetchAllPages<string>("/api/customers", async (input) => {
      const page = Number(new URL(input, "http://localhost").searchParams.get("page"));
      return page === 1
        ? new Response(JSON.stringify({ items: ["one"], pagination: { pages: 2 } }), { status: 200 })
        : new Response("unavailable", { status: 503 });
    }),
    /DIRECTORY_PAGE_LOAD_FAILED/,
  );
});

test("rejects an unreasonable page count instead of issuing unbounded requests", async () => {
  await assert.rejects(
    fetchAllPages<string>("/api/customers", async () => new Response(
      JSON.stringify({ items: [], pagination: { pages: 1001 } }),
      { status: 200 },
    )),
    /DIRECTORY_TOO_LARGE/,
  );
});
