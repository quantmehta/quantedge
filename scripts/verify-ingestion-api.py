import requests
import os
import hashlib

BASE_URL = "http://localhost:3000/api/portfolio/upload"
FIXTURE_DIR = r"c:\Users\divit\OneDrive\Documents\DTH\decision-maker\test-fixtures\ingestion"

def test_upload(filename):
    print(f"\n--- Testing Upload: {filename} ---")
    filepath = os.path.join(FIXTURE_DIR, filename)
    with open(filepath, "rb") as f:
        files = {"file": (filename, f)}
        response = requests.post(BASE_URL, files=files)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Success! Upload ID: {data['upload_id']}")
        for sheet in data['sheets']:
            print(f"Sheet: {sheet['sheet_name']}")
            print(f"  Headers Found: {sheet['header_rows_used']}")
            print(f"  Confidence: {sheet['header_confidence']}")
            print(f"  Symbol Key: {sheet['identified_columns']['symbol_key']}")
            print(f"  Name Key: {sheet['identified_columns']['company_name_key']}")
            if sheet['preview']['rows']:
                print(f"  First Row Preview: {sheet['preview']['rows'][0]}")
        return data
    else:
        print(f"Failed! Status: {response.status_code}")
        print(f"Response: {response.text}")
        return None

if __name__ == "__main__":
    # Test Clean CSV
    res1 = test_upload("clean.csv")
    id1 = res1['upload_id'] if res1 else None
    
    # Test Idempotency
    print("\n--- Testing Idempotency ---")
    res2 = test_upload("clean.csv")
    id2 = res2['upload_id'] if res2 else None
    if id1 and id2 and id1 == id2:
        print("PASS: Idempotency check (same hash -> same upload_id)")
    else:
        print("FAIL: Idempotency check failed")

    # Test Messy XLSX
    test_upload("messy.xlsx")

    # Test Two-row Header
    test_upload("two_row.xlsx")

    # Test Merged Headers (XLSX)
    test_upload("merged_headers.xlsx")

    # Test Semicolon CSV
    test_upload("semicolon.csv")

    # Test Three-row Header
    test_upload("three_row_header.xlsx")

    # Test No Symbol (Enrichment)
    test_upload("no_symbol.csv")

    # Test No Name (Enrichment)
    res = test_upload("no_name.csv")
    import json
    print("\n--- FULL JSON FOR no_name.csv ---")
    print(json.dumps(res, indent=2))
