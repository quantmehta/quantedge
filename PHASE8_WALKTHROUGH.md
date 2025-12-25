# Phase 8 Manual Walkthrough Guide

## Prerequisites
Start the development server. Open a terminal with Node.js in PATH and run:
```bash
npm run dev
```
Wait for the message: `✓ Ready on http://localhost:3000`

---

## Walkthrough Checklist

### Part 1: Rules Management Page (`/rules`)

1. **Navigate** to http://localhost:3000/rules

2. **Expected Elements:**
   - [ ] Page header: "Rules Engine"
   - [ ] "New Ruleset" button (top right)
   - [ ] Template selector with 3 buttons:  CONSERVATIVE, BALANCED, GROWTH
   - [ ] Hard Constraints section (Shield icon, red)
   - [ ] Soft Goals section (TrendingUp icon, green)
   - [ ] "Save New Version" button
   - [ ] Version History table (empty if first time)

3. **Test Template Selection:**
   - [ ] Click "CONSERVATIVE" - values update to conservative defaults
   - [ ] Click "BALANCED" - values update to balanced defaults  
   - [ ] Click "GROWTH" - values update to growth defaults

4. **Create a Ruleset:**
   - [ ] Click "+ New Ruleset"
   - [ ] Enter name: "Test Portfolio Rules"
   - [ ] Ruleset appears in left sidebar

5. **Create a Version:**
   - [ ] Select "BALANCED" template
   - [ ] Modify Max Drawdown to 18%
   - [ ] Click "Save New Version"
   - [ ] Success alert appears
   - [ ] Version 1 appears in Version History table

6. **Version Management:**
   - [ ] Create another version with GROWTH template
   - [ ] Version 2 appears in table
   - [ ] Click "Set Active" on Version 1
   - [ ] Green "Active" badge appears next to Version 1

---

### Part 2: Recommendations with Override (`/recommendations`)

1. **Navigate** to http://localhost:3000/recommendations

2. **Expected Elements:**
   - [ ] "Top Actions" metric cards (Buy, Reduce/Exit, Hold)
   - [ ] Filter bar (All, Buys, Sells, Holds)
   - [ ] Recommendations table with columns:
     - Action
     - Instrument
     - Reasoning
     - Confidence
     - Details

3. **View Recommendation Details:**
   - [ ] Click on any row to expand
   - [ ] "Analysis Drivers" section appears
   - [ ] "Proposed Action" section appears
   - [ ] Signal scores JSON visible

4. **Test Override Modal:**
   - [ ] Look for a recommendation with "Violation Detected" badge
   - [ ] Click the "Override" button
   - [ ] Modal appears with:
     - Rule Code (read-only)
     - Actor field
     - Reason field (min 10 chars)
     - Submit/Cancel buttons
   - [ ] Enter actor: "Portfolio Manager"
   - [ ] Enter reason: "Market conditions warrant exception to volatility cap"
   - [ ] Click "Submit Override"
   - [ ] Success alert appears
   - [ ] Badge changes to "Overridden" (green)

---

### Part 3: Error Checks

**During the Walkthrough, Verify:**

- [ ] **No Console Errors** (F12 → Console tab should be clean)
- [ ] **No Missing Assets** (404s in Network tab)
- [ ] **No TypeScript Errors** (Red squiggles in VSCode should be resolved)
- [ ] **Smooth Navigation** (No crashes or blank pages)
- [ ] **API Responses** (Network tab shows 200 OK for /api/rulesets and /api/overrides)

**Common Issues to Watch For:**
1. **"prisma.runOverride is not a function"** → Prisma client not regenerated
2. **"Table not found"** → Migration not applied
3. **Modal doesn't open** → JavaScript error in console
4. **Form validation fails** → Check reason field has 10+ characters

---

## Success Criteria

✅ All checkboxes above are checked
✅ No errors in browser console
✅ No errors in terminal running `npm run dev`
✅ Override logged successfully and visible in database

---

## Verification Commands

**Check Database (Optional):**
```bash
py -c "import sqlite3; conn = sqlite3.connect('prisma/dev.db'); cur = conn.cursor(); cur.execute('SELECT * FROM RunOverride'); print(cur.fetchall()); conn.close()"
```

**Verify API Endpoints (Optional):**
```bash
# Get rulesets
curl http://localhost:3000/api/rulesets

# Get overrides (replace RUN_ID)
curl "http://localhost:3000/api/overrides?runId=RUN_ID"
```
