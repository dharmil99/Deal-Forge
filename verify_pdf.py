import pypdf
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def verify_pdf(filename="ic_report_memorandum.pdf"):
    reader = pypdf.PdfReader(filename)
    num_pages = len(reader.pages)
    print(f"TOTAL PAGES: {num_pages}")
    
    full_text = ""
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        full_text += f"\n=== PAGE {i+1} ===\n" + text
        print(f"Page {i+1}: length={len(text)} chars")
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        if lines:
            print(f"   Top line: {lines[0]}")
            print(f"   Bottom line: {lines[-1]}")

    print("\n--- CHECKING SECTION PRESENCE (SECTIONS A TO K) ---")
    sections = [
        "INVESTMENT COMMITTEE REPORT",
        "SECTION B",  # EXECUTIVE SUMMARY
        "SECTION C",  # STRATEGIC RATIONALE
        "SECTION D",  # VALUATION BENCHMARKING
        "SECTION E",  # DEAL STRUCTURE
        "SECTION F",  # SOURCES & USES
        "SECTION G",  # PRO FORMA ACCRETION / DILUTION
        "SECTION H",  # SCENARIO & SENSITIVITY
        "SECTION I",  # KEY RISKS & COMMITTEE CONSIDERATIONS
        "SECTION J",  # DATA QUALITY & METHODOLOGY DISCLOSURES
        "SECTION K"   # IC SYNTHESIS & RECOMMENDATION
    ]
    all_passed = True
    for sec in sections:
        found = sec in full_text
        status = "PASS" if found else "FAIL"
        if not found:
            all_passed = False
        print(f"[{status}] Section Marker '{sec}'")

    print("\n--- CHECKING KEY SENSITIVITY & FINANCIAL VALUES ---")
    # Verified backend outputs:
    # 10% premium: -0.43%
    # 15% premium: -2.71%
    # 20% premium: -4.95%
    # 25% premium: -7.15%
    # 30% premium: -9.31%
    keywords = [
        "-4.95%",
        "-2.71%",
        "-7.15%",
        "-9.31%",
        "PRIMARY SENSITIVITY DRIVER: ACQUISITION PREMIUM",
        "Tata Consultancy Services",
        "Infosys Limited",
        "CONFIDENTIALITY",
        "Break-Even Gross Synergy",
        "EXECUTABLE"
    ]
    for kw in keywords:
        found = kw in full_text
        status = "PASS" if found else "FAIL"
        if not found:
            all_passed = False
        print(f"[{status}] Keyword '{kw}'")

    # App Chrome exclusion checks
    banned = [
        "RELIANCE2,945",
        "Market Ticker",
        "Overview Research",
        "Precedent Transactions",
        "Deal Workspace",
        "Profile Switcher",
        "http://localhost:5173"
    ]
    print("\n--- CHECKING APP CHROME & BROWSER ARTIFACT EXCLUSION ---")
    for b in banned:
        found = b in full_text
        status = "PASS (Excluded)" if not found else "FAIL (Found Chrome)"
        if found:
            all_passed = False
        print(f"[{status}] Banned element '{b}'")

    return all_passed

if __name__ == "__main__":
    success = verify_pdf()
    print(f"\nOVERALL RESULT: {'ALL TESTS PASSED' if success else 'FAILURES DETECTED'}")
    sys.exit(0 if success else 1)
