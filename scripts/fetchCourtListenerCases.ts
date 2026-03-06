/**
 * Fetches real federal fair-use opinions from CourtListener (free, public API).
 *
 * Usage:
 *   npx tsx scripts/fetchCourtListenerCases.ts
 *
 * Optional env var:
 *   COURTLISTENER_API_TOKEN — your CourtListener auth token (recommended)
 *
 * Output:
 *   data/courtlistener_raw.json — raw fetched cases for ingestion
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

const CL_SEARCH_URL = "https://www.courtlistener.com/api/rest/v3/search/";
const CL_OPINION_URL = "https://www.courtlistener.com/api/rest/v3/opinions/";
const CL_CLUSTER_URL = "https://www.courtlistener.com/api/rest/v3/clusters/";

const TOKEN = process.env.COURTLISTENER_API_TOKEN ?? "";

const QUERIES = [
  '"17 U.S.C. § 107" "fair use"',
  '"fair use" "transformative"',
  '"fair use" "four factors"',
  '"fair use" "first factor" "fourth factor"',
  '"fair use defense" "copyright"',
  '"fair use" "purpose and character"',
  '"fair use" "market harm" "amount and substantiality"',
  '"Warhol" "fair use" "transformative"',
  '"Google" "fair use" "API"',
  '"Campbell" "fair use" "parody"',
];

const FEDERAL_COURTS = [
  "scotus",
  "ca1", "ca2", "ca3", "ca4", "ca5", "ca6", "ca7", "ca8", "ca9", "ca10", "ca11", "cadc", "cafc",
];

const RATE_LIMIT_MS = 1500;
const MAX_RESULTS_PER_QUERY = 100;
const MAX_TOTAL_CASES = 800;

interface RawCase {
  courtlistener_id: string;
  case_name: string;
  citation: string;
  court: string;
  date_filed: string;
  opinion_text: string;
  absolute_url: string;
  docket_number: string;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
  };
  if (TOKEN) {
    h["Authorization"] = `Token ${TOKEN}`;
  }
  return h;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function searchCases(query: string, maxResults: number): Promise<RawCase[]> {
  const results: RawCase[] = [];
  const courtParam = FEDERAL_COURTS.join(",");

  let url =
    `${CL_SEARCH_URL}?q=${encodeURIComponent(query)}` +
    `&type=o` +
    `&court=${courtParam}` +
    `&order_by=score desc` +
    `&stat_Precedential=on`;

  let page = 0;

  while (url && results.length < maxResults) {
    page++;
    console.log(`  Page ${page} — ${url.slice(0, 120)}...`);

    try {
      const data = (await fetchJSON(url)) as {
        count: number;
        next: string | null;
        results: Array<{
          id: number;
          caseName: string;
          citation: string[];
          court_citation_string: string;
          court: string;
          dateFiled: string;
          absolute_url: string;
          docketNumber: string;
          cluster_id: number;
          snippet: string;
        }>;
      };

      if (!data.results || data.results.length === 0) break;

      for (const r of data.results) {
        if (results.length >= maxResults) break;

        const citation = r.citation?.length > 0
          ? r.citation[0]
          : r.court_citation_string ?? "";

        results.push({
          courtlistener_id: String(r.cluster_id || r.id),
          case_name: r.caseName ?? "Unknown",
          citation,
          court: r.court ?? "",
          date_filed: r.dateFiled ?? "",
          opinion_text: "",
          absolute_url: r.absolute_url ?? "",
          docket_number: r.docketNumber ?? "",
        });
      }

      url = data.next ?? "";
      if (url) await sleep(RATE_LIMIT_MS);
    } catch (err) {
      console.warn(`  [warn] Search page failed:`, (err as Error).message);
      break;
    }
  }

  return results;
}

async function fetchOpinionText(absoluteUrl: string): Promise<string> {
  try {
    const clusterUrl = `https://www.courtlistener.com${absoluteUrl}`;

    const clusterPage = await fetch(clusterUrl, {
      headers: { ...headers(), Accept: "text/html" },
    });

    if (!clusterPage.ok) return "";

    const html = await clusterPage.text();

    // Try to extract the opinion text from the HTML
    // CourtListener wraps opinion text in <div id="opinion-content"> or similar
    const opinionMatch = html.match(
      /<pre[^>]*class="[^"]*inline[^"]*"[^>]*>([\s\S]*?)<\/pre>/i
    );
    if (opinionMatch) {
      return stripHtml(opinionMatch[1]).trim();
    }

    // Try tab-content approach
    const tabMatch = html.match(
      /<div[^>]*id="[^"]*opinion[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i
    );
    if (tabMatch) {
      return stripHtml(tabMatch[1]).trim();
    }

    return "";
  } catch {
    return "";
  }
}

async function fetchOpinionViaAPI(clusterId: string): Promise<string> {
  try {
    const url = `${CL_CLUSTER_URL}${clusterId}/`;
    const cluster = (await fetchJSON(url)) as {
      sub_opinions: Array<{
        id: number;
        plain_text: string;
        html_with_citations: string;
        html: string;
        html_columbia: string;
        html_lawbox: string;
      }>;
    };

    if (!cluster.sub_opinions || cluster.sub_opinions.length === 0) return "";

    for (const op of cluster.sub_opinions) {
      if (op.plain_text && op.plain_text.length > 500) {
        return op.plain_text;
      }
    }

    // Try fetching individual opinion
    for (const op of cluster.sub_opinions) {
      await sleep(RATE_LIMIT_MS);
      try {
        const opData = (await fetchJSON(`${CL_OPINION_URL}${op.id}/`)) as {
          plain_text: string;
          html_with_citations: string;
          html: string;
        };
        if (opData.plain_text && opData.plain_text.length > 500) {
          return opData.plain_text;
        }
        const htmlText =
          opData.html_with_citations || opData.html || "";
        if (htmlText.length > 500) {
          return stripHtml(htmlText);
        }
      } catch {
        continue;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&sect;/g, "§")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("=== CourtListener Fair Use Case Fetcher ===\n");

  if (!TOKEN) {
    console.log(
      "Note: No COURTLISTENER_API_TOKEN set. Some endpoints may require auth.\n" +
      "Create a free account at courtlistener.com and add the token to .env.\n"
    );
  }

  const allCases = new Map<string, RawCase>();

  for (const query of QUERIES) {
    console.log(`\nSearching: ${query}`);
    const results = await searchCases(query, MAX_RESULTS_PER_QUERY);
    console.log(`  Found ${results.length} results`);

    for (const r of results) {
      if (!allCases.has(r.courtlistener_id)) {
        allCases.set(r.courtlistener_id, r);
      }
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nTotal unique cases found: ${allCases.size}`);

  // Fetch opinion text for each case
  const cases = [...allCases.values()].slice(0, MAX_TOTAL_CASES);
  let fetched = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    console.log(
      `\n[${i + 1}/${cases.length}] Fetching opinion: ${c.case_name.slice(0, 60)}...`
    );

    // Try API first (gets plain text)
    let text = await fetchOpinionViaAPI(c.courtlistener_id);
    await sleep(RATE_LIMIT_MS);

    // If API didn't return text, try scraping
    if (!text && c.absolute_url) {
      text = await fetchOpinionText(c.absolute_url);
      await sleep(RATE_LIMIT_MS);
    }

    if (text && text.length > 500) {
      c.opinion_text = text;
      fetched++;
      console.log(`  [ok] ${text.length} chars`);
    } else {
      console.log(`  [skip] No usable opinion text found`);
    }
  }

  console.log(`\nFetched opinion text for ${fetched}/${cases.length} cases`);

  // Filter to only cases with opinion text
  const usable = cases.filter((c) => c.opinion_text.length > 500);
  console.log(`Usable cases with opinion text: ${usable.length}`);

  // Save raw data
  const dataDir = path.resolve(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const outPath = path.join(dataDir, "courtlistener_raw.json");
  fs.writeFileSync(outPath, JSON.stringify(usable, null, 2));
  console.log(`\nSaved to ${outPath}`);
  console.log("Run 'npm run ingest' next to process and embed these cases.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
