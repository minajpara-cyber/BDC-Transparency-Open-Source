#!/usr/bin/env python3
"""
fetch_bdc_income.py — pull per-quarter income and NON-CASH income for each BDC
straight from SEC EDGAR's XBRL company facts.

WHY THIS EXISTS
---------------
Everything in data/*.ts comes from the Schedule of Investments, which is a
balance sheet. It tells us how much of the BOOK is on PIK, but nothing about
how much INCOME is non-cash. Answering "PIK as a % of NII" and "can this BDC
cover its cash dividend out of cash income" needs the income statement and the
cash flow statement, which we have never pulled.

The important trick: PIK interest is only sometimes broken out on the income
statement, but EVERY BDC has to add it back on the CASH FLOW STATEMENT to
reconcile net increase in net assets to cash from operations. So the cash flow
add-backs are the one place non-cash income is consistently available across
filers. That add-back also catches accretion of discount, which the Schedule of
Investments cannot see at all. That is what this script keys on.


HOW TO RUN IT
-------------
Needs Python 3.9+ and nothing else — standard library only, no pip install.

SEC requires a real contact address in the User-Agent on every request, and
will block you without one. Put your own in:

    python3 scripts/fetch_bdc_income.py --user-agent "Your Name you@yourdomain.com"

That writes two files into ./out (override with --out-dir):

    bdc_income_quarterly.csv   one row per BDC per quarter — the actual data
    bdc_income_tagmap.csv      which XBRL tag each number came from, per BDC

Read the tagmap. It is how you see which BDCs report PIK cleanly and which
don't, rather than trusting a blank cell.

Useful flags:

    --resolve-only      just print the ticker -> CIK mapping and stop. RUN THIS
                        FIRST and eyeball it. A wrong CIK silently produces a
                        clean-looking file full of the wrong company.
    --tickers ARCC,FSK  do a couple of names instead of all 19
    --since 2019        earliest calendar year to keep (default 2014)
    --emit-ts           also write data/bdc_income.ts so the site can read it
    --cik-map FILE      JSON of {"TICKER": 1234567} to override CIK resolution

It takes a few minutes for all 19. SEC allows 10 requests/second; this stays
well under that on purpose.


WHAT COMES BACK
---------------
One row per BDC per quarter, with the raw pulls:

    total_investment_income, net_investment_income, operating_expenses
    pik_income, accretion, noncash_income
    distributions_declared_per_share, distributions_paid_cash
    nii_per_share, wavg_shares

and the derived figures the analysis actually wants:

    pik_pct_of_tii       PIK income / total investment income
    pik_pct_of_nii       PIK income / NII            <- the headline
    noncash_pct_of_nii   (PIK + accretion) / NII
    cash_nii             NII - non-cash income
    cash_dividend_cover  cash NII / distributions declared
                         below 1.0 = the cash dividend is not covered by cash
                         income, it is being paid out of accrued paper income

Every cell is None when the filer did not tag it. Nothing here is estimated or
back-filled — if a BDC does not report a number, the column stays empty and the
tagmap says so. Check coverage before drawing conclusions from any cross-BDC
comparison.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date, datetime

SEC_HOST = "https://data.sec.gov"
SEC_WWW = "https://www.sec.gov"
REQUEST_SLEEP = 0.15  # SEC allows 10/sec; stay well under

# The 19 BDCs the site covers. `name_hint` is only used to resolve a CIK when
# the ticker is not in SEC's listed-company file (the non-traded ones), and to
# sanity-check the entity name that comes back.
BDCS = [
    ("ADS",   "Apollo Debt Solutions BDC"),
    ("ARCC",  "Ares Capital Corporation"),
    ("ASIF",  "Ares Strategic Income Fund"),
    ("BBDC",  "Barings BDC, Inc."),
    ("BCRED", "Blackstone Private Credit Fund"),
    ("BXSL",  "Blackstone Secured Lending Fund"),
    ("CCAP",  "Crescent Capital BDC, Inc."),
    ("CGBD",  "Carlyle Secured Lending, Inc."),
    ("FSK",   "FS KKR Capital Corp"),
    ("GBDC",  "Golub Capital BDC, Inc."),
    ("HTGC",  "Hercules Capital, Inc."),
    ("MAIN",  "Main Street Capital Corporation"),
    ("MFIC",  "MidCap Financial Investment Corporation"),
    ("NMFC",  "New Mountain Finance Corporation"),
    ("OBDC",  "Blue Owl Capital Corporation"),
    ("OCIC",  "Blue Owl Credit Income Corp"),
    ("OCSL",  "Oaktree Specialty Lending Corporation"),
    ("OTF",   "Blue Owl Technology Finance Corp"),
    ("TSLX",  "Sixth Street Specialty Lending, Inc."),
]

# ---------------------------------------------------------------------------
# Concept selection.
#
# Each metric lists candidate us-gaap tags in priority order. Filers differ on
# which they use, so we take the first that yields data and record the winner
# in the tagmap.
#
# PIK and accretion are deliberately NOT a fixed list. Most BDCs report them
# under their own extension namespace (arcc:, fsk:, ...) with no standard name,
# so a fixed list would silently miss them. Instead we scan every namespace for
# concept names matching the patterns below. That is the whole reason this
# script finds PIK where a naive us-gaap-only pull finds nothing.
# ---------------------------------------------------------------------------

CONCEPTS = {
    "total_investment_income": [
        "GrossInvestmentIncomeOperating",
        "InvestmentIncomeOperating",
        "InvestmentIncomeInterestAndDividend",
        "Revenues",
    ],
    "net_investment_income": [
        "NetInvestmentIncome",
        "InvestmentCompanyNetInvestmentIncomeLoss",
        "NetInvestmentIncomeLoss",
    ],
    "operating_expenses": [
        "InvestmentCompanyInvestmentIncomeOperatingExpenses",
        "OperatingExpenses",
        "BenefitsLossesAndExpenses",
    ],
    "nii_per_share": [
        "NetInvestmentIncomeLossPerShareBasic",
        "NetInvestmentIncomePerShareBasic",
        "InvestmentCompanyNetInvestmentIncomeLossPerShare",
    ],
    "distributions_declared_per_share": [
        "CommonStockDividendsPerShareDeclared",
        "DistributionsMadeToLimitedPartnerDistributionsDeclaredPerUnit",
        "CommonStockDividendsPerShareCashPaid",
    ],
    "distributions_paid_cash": [
        "PaymentsOfDividendsCommonStock",
        "PaymentsOfDistributionsToAffiliates",
        "PaymentsOfDividends",
    ],
    "wavg_shares": [
        "WeightedAverageNumberOfSharesOutstandingBasic",
        "WeightedAverageNumberOfDilutedSharesOutstanding",
        "WeightedAverageNumberOfSharesOutstandingDiluted",
    ],
}

# Concept-name patterns for the cash flow non-cash add-backs, matched across
# ALL namespaces, case-insensitively, against the concept's local name.
PIK_PATTERNS = [
    re.compile(r"payment(s)?inkind", re.I),
    re.compile(r"paidinkind", re.I),
    re.compile(r"\bpik\b", re.I),
]
ACCRETION_PATTERNS = [
    re.compile(r"accretion.*(discount|premium)", re.I),
    re.compile(r"amortization.*(discount|premium).*(investment|loan)", re.I),
    re.compile(r"netaccretion", re.I),
]
# Guard against matching balance-sheet or per-share variants of the same words.
PIK_EXCLUDE = re.compile(r"pershare|receivable|fairvalue|costbasis|balance", re.I)

QUARTER_DAYS = (80, 100)


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

class Fetcher:
    def __init__(self, user_agent: str):
        self.user_agent = user_agent
        self._last = 0.0

    def get_json(self, url: str, allow_404: bool = False):
        elapsed = time.time() - self._last
        if elapsed < REQUEST_SLEEP:
            time.sleep(REQUEST_SLEEP - elapsed)
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": self.user_agent,
                "Accept-Encoding": "gzip, deflate",
                "Accept": "application/json",
            },
        )
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    raw = resp.read()
                    if resp.headers.get("Content-Encoding") == "gzip":
                        import gzip
                        raw = gzip.decompress(raw)
                    self._last = time.time()
                    return json.loads(raw)
            except urllib.error.HTTPError as e:
                self._last = time.time()
                if e.code == 404 and allow_404:
                    return None
                if e.code in (429, 503) and attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                raise
            except (urllib.error.URLError, TimeoutError):
                self._last = time.time()
                if attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                raise
        return None


# ---------------------------------------------------------------------------
# CIK resolution
# ---------------------------------------------------------------------------

def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def resolve_ciks(fetcher: Fetcher, bdcs, override: dict) -> dict:
    """Map ticker -> (cik, entity_name_as_sec_has_it, how_resolved)."""
    out = {}
    listed = fetcher.get_json(f"{SEC_WWW}/files/company_tickers.json") or {}
    by_ticker, by_name = {}, {}
    for row in listed.values():
        by_ticker[row["ticker"].upper()] = (row["cik_str"], row["title"])
        by_name[_norm(row["title"])] = (row["cik_str"], row["title"])

    for ticker, name_hint in bdcs:
        if ticker in override:
            out[ticker] = (int(override[ticker]), "(from --cik-map)", "override")
            continue
        if ticker in by_ticker:
            cik, title = by_ticker[ticker]
            out[ticker] = (cik, title, "ticker")
            continue
        # Non-traded BDCs are not in the ticker file. Match on name instead.
        hit = by_name.get(_norm(name_hint))
        if hit:
            out[ticker] = (hit[0], hit[1], "name-exact")
            continue
        target = _norm(name_hint)
        cands = [
            (cik, title) for nm, (cik, title) in by_name.items()
            if target[:18] and (target[:18] in nm or nm[:18] in target)
        ]
        if len(cands) == 1:
            out[ticker] = (cands[0][0], cands[0][1], "name-prefix")
        else:
            out[ticker] = (None, name_hint, f"UNRESOLVED ({len(cands)} candidates)")
    return out


# ---------------------------------------------------------------------------
# Fact extraction
# ---------------------------------------------------------------------------

def _parse(d: str):
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _units_of(concept_block: dict):
    """Return the first unit series (USD, shares, USD/shares...) with data."""
    units = concept_block.get("units") or {}
    for key in ("USD", "USD/shares", "shares", "pure"):
        if units.get(key):
            return units[key]
    for v in units.values():
        if v:
            return v
    return []


def duration_facts(entries):
    """Dedupe duration facts by (start, end), keeping the latest-filed value."""
    best = {}
    for f in entries:
        s, e = _parse(f.get("start")), _parse(f.get("end"))
        if not s or not e:
            continue
        key = (s, e)
        filed = _parse(f.get("filed")) or date.min
        if key not in best or filed > best[key][0]:
            best[key] = (filed, f)
    return {k: v[1] for k, v in best.items()}


def quarterly_series(entries) -> dict:
    """
    Reduce a duration concept to {quarter_end_date: value}.

    10-Qs report a 3-month duration directly. The fourth quarter is almost never
    reported on its own — the 10-K carries a 12-month figure — so we derive it
    by differencing nested periods that share a start date: Q4 = FY - 9M, and
    likewise Q2 = 6M - Q1 where a filer only gives year-to-date. This is done by
    date arithmetic rather than by trusting fiscal-period labels, which matters
    because several of these BDCs (GBDC, OCSL) close their year in September.
    """
    facts = duration_facts(entries)
    out = {}

    # Directly reported quarters win.
    for (s, e), f in facts.items():
        if QUARTER_DAYS[0] <= (e - s).days <= QUARTER_DAYS[1]:
            out[e] = f.get("val")

    # Difference nested periods sharing a start date to recover missing quarters.
    by_start = defaultdict(list)
    for (s, e), f in facts.items():
        by_start[s].append((e, f))
    for s, ends in by_start.items():
        ends.sort()
        for i in range(len(ends) - 1):
            e_short, f_short = ends[i]
            for e_long, f_long in ends[i + 1:]:
                gap = (e_long - e_short).days
                if not (QUARTER_DAYS[0] <= gap <= QUARTER_DAYS[1]):
                    continue
                if e_long in out:
                    continue
                a, b = f_long.get("val"), f_short.get("val")
                if a is None or b is None:
                    continue
                out[e_long] = a - b
    return out


def instant_series(entries) -> dict:
    best = {}
    for f in entries:
        e = _parse(f.get("end"))
        if not e:
            continue
        filed = _parse(f.get("filed")) or date.min
        if e not in best or filed > best[e][0]:
            best[e] = (filed, f.get("val"))
    return {k: v[1] for k, v in best.items()}


def pick_concept(facts: dict, candidates) -> tuple:
    """First us-gaap candidate with usable data. Returns (tag, {end: val})."""
    gaap = (facts.get("facts") or {}).get("us-gaap") or {}
    for tag in candidates:
        block = gaap.get(tag)
        if not block:
            continue
        entries = _units_of(block)
        if not entries:
            continue
        series = (quarterly_series(entries)
                  if any(e.get("start") for e in entries)
                  else instant_series(entries))
        series = {k: v for k, v in series.items() if v is not None}
        if series:
            return f"us-gaap:{tag}", series
    return None, {}


def scan_patterns(facts: dict, patterns, exclude=None) -> tuple:
    """
    Search EVERY namespace for concepts whose local name matches, and sum the
    matches per quarter. Extension namespaces are where most filers put their
    PIK and accretion add-backs, so a us-gaap-only lookup would come up empty
    for the majority of this panel.
    """
    matched_tags, combined = [], defaultdict(float)
    for ns, concepts in (facts.get("facts") or {}).items():
        for tag, block in concepts.items():
            if exclude and exclude.search(tag):
                continue
            if not any(p.search(tag) for p in patterns):
                continue
            entries = _units_of(block)
            if not entries or not any(e.get("start") for e in entries):
                continue
            series = quarterly_series(entries)
            if not series:
                continue
            matched_tags.append(f"{ns}:{tag}")
            for k, v in series.items():
                if v is not None:
                    combined[k] += v
    return ("+".join(sorted(matched_tags)) or None, dict(combined))


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------

def _div(a, b):
    if a is None or b in (None, 0):
        return None
    return a / b


def build_rows(ticker: str, cik: int, facts: dict, since_year: int):
    series, tagmap = {}, {}
    for metric, candidates in CONCEPTS.items():
        tag, s = pick_concept(facts, candidates)
        series[metric], tagmap[metric] = s, tag

    pik_tag, pik = scan_patterns(facts, PIK_PATTERNS, PIK_EXCLUDE)
    acc_tag, acc = scan_patterns(facts, ACCRETION_PATTERNS, PIK_EXCLUDE)
    series["pik_income"], tagmap["pik_income"] = pik, pik_tag
    series["accretion"], tagmap["accretion"] = acc, acc_tag

    periods = sorted({d for s in series.values() for d in s})
    rows = []
    for end in periods:
        if end.year < since_year:
            continue
        g = lambda m: series[m].get(end)
        tii, nii = g("total_investment_income"), g("net_investment_income")
        pik_v, acc_v = g("pik_income"), g("accretion")

        noncash = None
        if pik_v is not None or acc_v is not None:
            noncash = (pik_v or 0) + (acc_v or 0)

        dps, shares = g("distributions_declared_per_share"), g("wavg_shares")
        dist_total = g("distributions_paid_cash")
        if dist_total is None and dps is not None and shares:
            dist_total = dps * shares

        cash_nii = None if (nii is None or noncash is None) else nii - noncash

        rows.append({
            "ticker": ticker,
            "cik": cik,
            "period_end": end.isoformat(),
            "total_investment_income": tii,
            "net_investment_income": nii,
            "operating_expenses": g("operating_expenses"),
            "pik_income": pik_v,
            "accretion": acc_v,
            "noncash_income": noncash,
            "nii_per_share": g("nii_per_share"),
            "distributions_declared_per_share": dps,
            "distributions_paid_cash": g("distributions_paid_cash"),
            "wavg_shares": shares,
            "pik_pct_of_tii": _div(pik_v, tii),
            "pik_pct_of_nii": _div(pik_v, nii),
            "noncash_pct_of_nii": _div(noncash, nii),
            "cash_nii": cash_nii,
            "cash_dividend_cover": _div(cash_nii, dist_total),
        })
    return rows, tagmap


CSV_FIELDS = [
    "ticker", "cik", "period_end",
    "total_investment_income", "net_investment_income", "operating_expenses",
    "pik_income", "accretion", "noncash_income",
    "nii_per_share", "distributions_declared_per_share",
    "distributions_paid_cash", "wavg_shares",
    "pik_pct_of_tii", "pik_pct_of_nii", "noncash_pct_of_nii",
    "cash_nii", "cash_dividend_cover",
]


def write_ts(rows, path):
    """Emit a data/*.ts module matching the shape of the site's other exports."""
    keep = [
        "ticker", "period_end", "total_investment_income",
        "net_investment_income", "pik_income", "accretion", "noncash_income",
        "distributions_declared_per_share", "pik_pct_of_nii",
        "noncash_pct_of_nii", "cash_dividend_cover",
    ]
    slim = [{k: r[k] for k in keep} for r in rows]
    header = (
        "// AUTO-GENERATED by scripts/fetch_bdc_income.py — do not edit by hand.\n"
        "// Per (ticker, period_end) income-statement and non-cash-income figures\n"
        "// pulled from SEC EDGAR XBRL company facts. Dollar amounts are as the\n"
        "// filer tagged them (USD, NOT scaled). Ratios are fractions, not percent.\n"
        "//\n"
        "// pik_income and accretion come from the CASH FLOW STATEMENT non-cash\n"
        "// add-backs, which is the only place these are consistently reported\n"
        "// across filers. null means the BDC did not tag it — never estimated.\n"
        "/* eslint-disable */\n\n"
        "export interface BDCIncomeRow {\n"
        "  ticker: string;\n"
        "  period_end: string;\n"
        "  total_investment_income: number | null;\n"
        "  net_investment_income: number | null;\n"
        "  pik_income: number | null;\n"
        "  accretion: number | null;\n"
        "  noncash_income: number | null;\n"
        "  distributions_declared_per_share: number | null;\n"
        "  pik_pct_of_nii: number | null;\n"
        "  noncash_pct_of_nii: number | null;\n"
        "  cash_dividend_cover: number | null;\n"
        "}\n\n"
        "export const bdcIncome: BDCIncomeRow[] = JSON.parse(`"
    )
    with open(path, "w") as fh:
        fh.write(header)
        fh.write(json.dumps(slim).replace("\\", "\\\\").replace("`", "\\`"))
        fh.write("`);\n")


def main():
    ap = argparse.ArgumentParser(
        description="Pull BDC income and non-cash income from SEC EDGAR XBRL.")
    ap.add_argument("--user-agent", required=True,
                    help='Required by SEC. e.g. "Jane Doe jane@firm.com"')
    ap.add_argument("--out-dir", default="out")
    ap.add_argument("--tickers", help="Comma-separated subset; default all 19")
    ap.add_argument("--since", type=int, default=2014,
                    help="Earliest calendar year to keep (default 2014)")
    ap.add_argument("--cik-map", help='JSON file of {"TICKER": 1234567} overrides')
    ap.add_argument("--resolve-only", action="store_true",
                    help="Print ticker -> CIK and exit. Run this first.")
    ap.add_argument("--emit-ts", action="store_true",
                    help="Also write data/bdc_income.ts")
    args = ap.parse_args()

    if "@" not in args.user_agent:
        sys.exit("--user-agent must contain a contact email or SEC will block you.")

    bdcs = BDCS
    if args.tickers:
        want = {t.strip().upper() for t in args.tickers.split(",")}
        bdcs = [b for b in BDCS if b[0] in want]
        missing = want - {b[0] for b in bdcs}
        if missing:
            sys.exit(f"Unknown ticker(s): {', '.join(sorted(missing))}")

    override = {}
    if args.cik_map:
        with open(args.cik_map) as fh:
            override = {k.upper(): v for k, v in json.load(fh).items()}

    fetcher = Fetcher(args.user_agent)

    print("Resolving CIKs...", file=sys.stderr)
    try:
        ciks = resolve_ciks(fetcher, bdcs, override)
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        sys.exit(
            f"\nCould not reach SEC: {e}\n\n"
            "If this is a tunnel/403/proxy error, the machine you are on is not\n"
            "allowed out to sec.gov. Run this from somewhere with plain outbound\n"
            "internet, or set HTTPS_PROXY to a proxy that permits sec.gov.\n"
            "If it is a 403 FROM SEC itself, your --user-agent was rejected: it\n"
            "must name a real person or firm and a working email address."
        )
    print(f"\n{'ticker':8s}{'cik':>12s}  {'how':14s}entity name as SEC has it")
    for ticker, _ in bdcs:
        cik, title, how = ciks[ticker]
        print(f"{ticker:8s}{(str(cik) if cik else '-'):>12s}  {how:14s}{title}")
    unresolved = [t for t, _ in bdcs if ciks[t][0] is None]
    if unresolved:
        print(f"\nUNRESOLVED: {', '.join(unresolved)}"
              f"\nLook their CIK up on EDGAR and pass it with --cik-map.",
              file=sys.stderr)
    if args.resolve_only:
        print("\nCheck the entity names above line up before pulling data.",
              file=sys.stderr)
        return

    os.makedirs(args.out_dir, exist_ok=True)
    all_rows, all_tags = [], []

    for ticker, _ in bdcs:
        cik = ciks[ticker][0]
        if cik is None:
            print(f"{ticker}: skipped, no CIK", file=sys.stderr)
            continue
        print(f"{ticker}: fetching company facts...", file=sys.stderr)
        try:
            facts = fetcher.get_json(
                f"{SEC_HOST}/api/xbrl/companyfacts/CIK{cik:010d}.json",
                allow_404=True)
        except urllib.error.HTTPError as e:
            print(f"{ticker}: HTTP {e.code}, skipped", file=sys.stderr)
            continue
        except urllib.error.URLError as e:
            print(f"{ticker}: network error ({e}), skipped", file=sys.stderr)
            continue
        if not facts:
            print(f"{ticker}: no XBRL facts published, skipped", file=sys.stderr)
            continue

        rows, tagmap = build_rows(ticker, cik, facts, args.since)
        all_rows.extend(rows)
        for metric, tag in tagmap.items():
            all_tags.append({
                "ticker": ticker, "metric": metric,
                "tag": tag or "", "found": "yes" if tag else "NO",
            })
        got_pik = sum(1 for r in rows if r["pik_income"] is not None)
        got_nii = sum(1 for r in rows if r["net_investment_income"] is not None)
        print(f"{ticker}: {len(rows)} quarters — NII on {got_nii}, "
              f"PIK on {got_pik}", file=sys.stderr)

    all_rows.sort(key=lambda r: (r["ticker"], r["period_end"]))

    data_path = os.path.join(args.out_dir, "bdc_income_quarterly.csv")
    with open(data_path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        w.writeheader()
        w.writerows(all_rows)

    tag_path = os.path.join(args.out_dir, "bdc_income_tagmap.csv")
    with open(tag_path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["ticker", "metric", "tag", "found"])
        w.writeheader()
        w.writerows(all_tags)

    if args.emit_ts:
        ts_path = os.path.join("data", "bdc_income.ts")
        write_ts(all_rows, ts_path)
        print(f"wrote {ts_path}", file=sys.stderr)

    print(f"\nwrote {data_path} ({len(all_rows)} rows)", file=sys.stderr)
    print(f"wrote {tag_path}", file=sys.stderr)

    missing_pik = sorted({t["ticker"] for t in all_tags
                          if t["metric"] == "pik_income" and t["found"] == "NO"})
    if missing_pik:
        print(f"\nNo PIK add-back tagged at: {', '.join(missing_pik)}."
              f"\nFor those the figure is in the filing text, not XBRL, and "
              f"needs reading by hand.", file=sys.stderr)


if __name__ == "__main__":
    main()
