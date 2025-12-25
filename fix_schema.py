import subprocess
import os
import sqlite3

project_dir = r"c:\Users\divit\OneDrive\Documents\DTH\decision-maker"
os.chdir(project_dir)

# First check what's actually in the database
print("Checking database schema...")
conn = sqlite3.connect("prisma/dev.db")
cur = conn.cursor()

cur.execute("PRAGMA table_info(Run)")
run_cols = [col[1] for col in cur.fetchall()]
print(f"Run columns: {run_cols}")

cur.execute("PRAGMA table_info(Report)")  
report_cols = [col[1] for col in cur.fetchall()]
print(f"Report columns: {report_cols}")

conn.close()

# Check if we need to add columns manually
if 'sessionId' not in run_cols:
    print("\nAdding sessionId column to Run table...")
    conn = sqlite3.connect("prisma/dev.db")
    cur = conn.cursor()
    try:
        cur.execute("ALTER TABLE Run ADD COLUMN sessionId TEXT")
        conn.commit()
        print("  SUCCESS: Added sessionId column")
    except Exception as e:
        print(f"  ERROR: {e}")
    conn.close()

if 'reportInputsJson' not in report_cols:
    print("\nAdding reportInputsJson column to Report table...")
    conn = sqlite3.connect("prisma/dev.db")
    cur = conn.cursor()
    try:
        cur.execute("ALTER TABLE Report ADD COLUMN reportInputsJson TEXT")
        conn.commit()
        print("  SUCCESS: Added reportInputsJson column")
    except Exception as e:
        print(f"  ERROR: {e}")
    conn.close()

# Regenerate Prisma client
print("\nRegenerating Prisma client...")
node_exe = r"C:\Program Files\nodejs\node.exe"
prisma_cli = os.path.join(project_dir, "node_modules", "prisma", "build", "index.js")

gen_cmd = [node_exe, prisma_cli, 'generate']
env = os.environ.copy()
env['NODE_PATH'] = os.path.join(project_dir, "node_modules")

result = subprocess.run(gen_cmd, capture_output=True, env=env)

if result.returncode == 0:
    print("SUCCESS: Prisma client regenerated")
else:
    print(f"FAILED: Prisma generate failed with exit code {result.returncode}")

# Verify changes
print("\nVerifying changes...")
conn = sqlite3.connect("prisma/dev.db")
cur = conn.cursor()

cur.execute("PRAGMA table_info(Run)")
run_cols = [col[1] for col in cur.fetchall()]

cur.execute("PRAGMA table_info(Report)")
report_cols = [col[1] for col in cur.fetchall()]

conn.close()

if 'sessionId' in run_cols and 'reportInputsJson' in report_cols:
    print("\n✓ SUCCESS: All schema fields present")
    exit(0)
else:
    print("\n✗ FAILED: Some fields still missing")
    exit(1)
