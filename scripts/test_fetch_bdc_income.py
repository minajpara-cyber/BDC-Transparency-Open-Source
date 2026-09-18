"""
Offline tests for fetch_bdc_income.py. Touches no network, so you can run this
anywhere to check the extraction logic before pointing the real script at SEC:

    python3 scripts/test_fetch_bdc_income.py

The fixtures mimic the shape SEC's XBRL company-facts API returns, including
the awkward cases: a fourth quarter that is only reported as part of a full
year, a September fiscal year end, a restated figure, and PIK reported under a
filer's own namespace instead of us-gaap.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_bdc_income as M

fails = []
def ok(cond, msg):
    print(("PASS  " if cond else "FAIL  ") + msg)
    if not cond: fails.append(msg)

def dur(start, end, val, filed, **kw):
    d = {"start": start, "end": end, "val": val, "filed": filed}
    d.update(kw); return d

# ---- 1. directly reported quarters ----
e = [dur("2025-01-01","2025-03-31",100,"2025-05-01"),
     dur("2025-04-01","2025-06-30",110,"2025-08-01")]
s = M.quarterly_series(e)
ok(s.get(M._parse("2025-03-31"))==100 and s.get(M._parse("2025-06-30"))==110,
   "direct quarters picked up")

# ---- 2. Q4 derived as FY minus 9M (calendar year end) ----
e = [dur("2025-01-01","2025-03-31",100,"2025-05-01"),
     dur("2025-01-01","2025-06-30",210,"2025-08-01"),
     dur("2025-01-01","2025-09-30",330,"2025-11-01"),
     dur("2025-01-01","2025-12-31",460,"2026-02-01")]
s = M.quarterly_series(e)
ok(s.get(M._parse("2025-12-31"))==130, "Q4 derived = FY - 9M (460-330=130)")
ok(s.get(M._parse("2025-06-30"))==110, "Q2 derived = 6M - Q1 (210-100=110)")
ok(s.get(M._parse("2025-09-30"))==120, "Q3 derived = 9M - 6M (330-210=120)")

# ---- 3. September fiscal year end (GBDC / OCSL shape) ----
e = [dur("2024-10-01","2024-12-31",50,"2025-02-01"),
     dur("2024-10-01","2025-03-31",105,"2025-05-01"),
     dur("2024-10-01","2025-06-30",160,"2025-08-01"),
     dur("2024-10-01","2025-09-30",220,"2025-11-20")]
s = M.quarterly_series(e)
ok(s.get(M._parse("2025-09-30"))==60, "Sept-FYE fiscal Q4 derived (220-160=60)")
ok(s.get(M._parse("2025-06-30"))==55, "Sept-FYE fiscal Q3 derived (160-105=55)")
ok(sorted(x.isoformat() for x in s)== ["2024-12-31","2025-03-31","2025-06-30","2025-09-30"],
   "Sept-FYE quarters land on calendar quarter ends")

# ---- 4. restatement: later filing wins ----
e = [dur("2025-01-01","2025-03-31",100,"2025-05-01"),
     dur("2025-01-01","2025-03-31",999,"2025-11-01")]
s = M.quarterly_series(e)
ok(s.get(M._parse("2025-03-31"))==999, "latest-filed value wins on restatement")

# ---- 5. annual-only filer yields no spurious quarters ----
e = [dur("2024-01-01","2024-12-31",400,"2025-02-01"),
     dur("2025-01-01","2025-12-31",460,"2026-02-01")]
ok(M.quarterly_series(e)=={}, "annual-only data produces no fake quarters")

# ---- 6. pattern scan finds PIK in an EXTENSION namespace ----
facts = {"facts": {
  "us-gaap": {"NetInvestmentIncome": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",1000,"2025-05-01")]}}},
  "arcc": {"PaymentInKindInterestIncome": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",250,"2025-05-01")]}}},
}}
tag, series = M.scan_patterns(facts, M.PIK_PATTERNS, M.PIK_EXCLUDE)
ok(tag=="arcc:PaymentInKindInterestIncome" and series[M._parse("2025-03-31")]==250,
   "PIK found in a filer's own extension namespace")

# ---- 7. exclusion guard keeps out per-share / receivable lookalikes ----
facts_x = {"facts": {"x": {
  "PaymentInKindInterestPerShare": {"units": {"USD/shares": [
      dur("2025-01-01","2025-03-31",0.25,"2025-05-01")]}},
  "PaymentInKindInterestReceivable": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",900,"2025-05-01")]}}}}}
tag, series = M.scan_patterns(facts_x, M.PIK_PATTERNS, M.PIK_EXCLUDE)
ok(tag is None and series=={}, "per-share and receivable PIK lookalikes excluded")

# ---- 8. multiple PIK tags are summed ----
facts_m = {"facts": {
  "a": {"PaymentInKindInterest": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",100,"2025-05-01")]}}},
  "b": {"PaidInKindDividends": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",40,"2025-05-01")]}}}}}
tag, series = M.scan_patterns(facts_m, M.PIK_PATTERNS, M.PIK_EXCLUDE)
ok(series[M._parse("2025-03-31")]==140 and "+" in tag, "multiple PIK tags summed")

# ---- 9. end to end row build + derived ratios ----
facts_full = {"facts": {
  "us-gaap": {
    "GrossInvestmentIncomeOperating": {"units":{"USD":[dur("2025-01-01","2025-03-31",2000,"2025-05-01")]}},
    "NetInvestmentIncome": {"units":{"USD":[dur("2025-01-01","2025-03-31",1000,"2025-05-01")]}},
    "CommonStockDividendsPerShareDeclared": {"units":{"USD/shares":[dur("2025-01-01","2025-03-31",0.48,"2025-05-01")]}},
    "WeightedAverageNumberOfSharesOutstandingBasic": {"units":{"shares":[dur("2025-01-01","2025-03-31",2000,"2025-05-01")]}},
  },
  "zz": {
    "PaymentInKindInterest": {"units":{"USD":[dur("2025-01-01","2025-03-31",250,"2025-05-01")]}},
    "AccretionOfDiscountOnInvestments": {"units":{"USD":[dur("2025-01-01","2025-03-31",50,"2025-05-01")]}},
  }}}
rows, tagmap = M.build_rows("TEST", 123, facts_full, 2014)
r = rows[0]
ok(len(rows)==1 and r["period_end"]=="2025-03-31", "one row for the one quarter")
ok(r["pik_pct_of_nii"]==0.25, "pik_pct_of_nii = 250/1000")
ok(r["pik_pct_of_tii"]==0.125, "pik_pct_of_tii = 250/2000")
ok(r["noncash_income"]==300 and r["noncash_pct_of_nii"]==0.3, "noncash = PIK + accretion")
ok(r["cash_nii"]==700, "cash_nii = NII - noncash")
# distributions declared = 0.48 * 2000 shares = 960; cover = 700/960
ok(abs(r["cash_dividend_cover"] - 700/960) < 1e-12,
   "cash_dividend_cover = cash NII / declared distributions")

# ---- 10. untagged metrics stay None, never zero ----
facts_bare = {"facts": {"us-gaap": {"NetInvestmentIncome": {"units":{"USD":[
    dur("2025-01-01","2025-03-31",1000,"2025-05-01")]}}}}}
rows, tagmap = M.build_rows("BARE", 1, facts_bare, 2014)
r = rows[0]
ok(r["pik_income"] is None and r["noncash_income"] is None, "missing PIK stays None")
ok(r["pik_pct_of_nii"] is None and r["cash_dividend_cover"] is None,
   "ratios None when an input is missing, not 0")
ok(tagmap["pik_income"] is None, "tagmap records PIK as not found")

# ---- 11. since-year filter ----
facts_old = {"facts": {"us-gaap": {"NetInvestmentIncome": {"units":{"USD":[
    dur("2013-01-01","2013-03-31",1,"2013-05-01"),
    dur("2025-01-01","2025-03-31",2,"2025-05-01")]}}}}}
rows, _ = M.build_rows("OLD", 1, facts_old, 2014)
ok(len(rows)==1 and rows[0]["period_end"]=="2025-03-31", "--since filters old quarters")

# ---- 12. emitted TS parses as the site would read it ----
import re, subprocess, tempfile
rows, _ = M.build_rows("TEST", 123, facts_full, 2014)
with tempfile.NamedTemporaryFile("r+", suffix=".ts", delete=False) as fh:
    path = fh.name
M.write_ts(rows, path)
src = open(path).read()
m = re.search(r"JSON\.parse\(`(.*)`\);", src, re.S)
parsed = json.loads(m.group(1))
ok(parsed[0]["ticker"]=="TEST" and parsed[0]["pik_pct_of_nii"]==0.25,
   "emitted .ts contains a parseable payload")
ok("export const bdcIncome" in src and "BDCIncomeRow" in src,
   "emitted .ts exports the expected symbols")
os.unlink(path)

print()

# ---- PIK family precedence: income statement and cash flow are never added ----
# Regression for a real double-count: ARCC tags BOTH the income-statement PIK
# lines and the cash flow add-back. Summing them inflated its PIK income ~48%.
facts_fam = {"facts": {"us-gaap": {
  "InterestIncomeOperatingPaidInKind": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",50,"2025-05-01")]}},
  "DividendIncomeOperatingPaidInKind": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",67,"2025-05-01")]}},
  "PaidInKindInterest": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",38,"2025-05-01")]}},
}}}
tag, series, src = M.pik_series(facts_fam)
q = M._parse("2025-03-31")
ok(series[q]==117, "income-statement PIK used, cash flow add-back not added on top")
ok(src[q]=="is_components", "source recorded as income-statement components")

# The combined tag wins over its own components, never sums with them.
facts_comb = {"facts": {"us-gaap": {
  "InterestAndDividendIncomeOperatingPaidInKind": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",7.5,"2025-05-01")]}},
  "InterestIncomeOperatingPaidInKind": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",4.3,"2025-05-01")]}},
  "DividendIncomeOperatingPaidInKind": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",3.1,"2025-05-01")]}},
}}}
tag, series, src = M.pik_series(facts_comb)
ok(series[q]==7.5, "combined PIK tag wins over its components, not summed with them")
ok(src[q]=="is_combined", "source recorded as combined")

# Precedence is per period: combined for one quarter, components for the next.
facts_mix = {"facts": {"us-gaap": {
  "InterestAndDividendIncomeOperatingPaidInKind": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",37.3,"2025-05-01")]}},
  "InterestIncomeOperatingPaidInKind": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",22.3,"2025-05-01"),
      dur("2025-04-01","2025-06-30",15.0,"2025-08-01")]}},
}}}
tag, series, src = M.pik_series(facts_mix)
ok(series[M._parse("2025-03-31")]==37.3 and series[M._parse("2025-06-30")]==15.0,
   "PIK source resolved per quarter, not once per filer")

# A filer that tags ONLY the cash flow add-back still gets a figure.
facts_cf = {"facts": {"x": {"PaymentInKindInterest": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",12,"2025-05-01")]}}}}}
tag, series, src = M.pik_series(facts_cf)
ok(series[q]==12 and src[q]=="cashflow_addback", "cash flow add-back used as fallback")

# ---- NII falls back to the after-tax tag, on one basis, and says so ----
facts_nii = {"facts": {"us-gaap": {
  "GrossInvestmentIncomeOperating": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",400,"2025-05-01")]}},
  "InvestmentIncomeOperatingAfterExpenseAndTax": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",160,"2025-05-01")]}},
  "InvestmentIncomeOperatingTaxExpenseBenefit": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",6,"2025-05-01")]}},
}}}
rows, tm = M.build_rows("FSK", 1, facts_nii, 2014)
r = [r for r in rows if r["period_end"]=="2025-03-31"][0]
ok(r["net_investment_income"]==166, "NII reconstructed pre-tax from the after-tax tag")
ok(r["nii_basis"]=="after_tax_plus_tax", "nii_basis flags the reconstructed basis")


# ---- coverage denominator prefers TOTAL DECLARED over cash paid ----
# Cash paid is net of distributions taken as shares, so using it would flatter
# the non-traded funds (OCIC reinvests 44% of its distribution).
facts_d = {"facts": {"us-gaap": {
  "NetInvestmentIncome": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",1000,"2025-05-01")]}},
  "InvestmentCompanyDividendDistribution": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",900,"2025-05-01")]}},
  "PaymentsOfDividends": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",500,"2025-05-01")]}},
  "InterestIncomeOperatingPaidInKind": {"units": {"USD": [
      dur("2025-01-01","2025-03-31",100,"2025-05-01")]}},
}}}
rows, tm = M.build_rows("OCIC", 1, facts_d, 2014)
r = [r for r in rows if r["period_end"]=="2025-03-31"][0]
ok(r["distributions_basis"]=="declared", "declared distributions preferred over cash paid")
ok(abs(r["cash_dividend_cover"] - 900/900) < 1e-9,
   "coverage uses declared distributions, not the smaller cash figure")

print(f"{'ALL PASS' if not fails else str(len(fails))+' FAILED'}")
sys.exit(1 if fails else 0)
