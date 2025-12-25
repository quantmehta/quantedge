import sqlite3
from pathlib import Path

db_path = Path("prisma/dev.db")

print("=" * 80)
print("MANUALLY CREATING RunOverride TABLE")
print("=" * 80)

if not db_path.exists():
    print(f"ERROR: Database not found at {db_path}")
    exit(1)

print(f"\nDatabase: {db_path}")

conn = sqlite3.connect(str(db_path))
cur = conn.cursor()

# Check if table already exists
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='RunOverride'")
if cur.fetchone():
    print("INFO: RunOverride table already exists, dropping it first...")
    cur.execute("DROP TABLE RunOverride")
    conn.commit()

# Create the table (from migration.sql)
create_sql = """
CREATE TABLE "RunOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleSeverity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunOverride_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
"""

print("\nExecuting CREATE TABLE statement...")
print("-" * 80)

try:
    cur.execute(create_sql)
    conn.commit()
    print("SUCCESS: Table created!")
    
    # Verify
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='RunOverride'")
    if cur.fetchone():
        print("\n[VERIFIED] RunOverride table now exists!")
        
        # Show schema
        cur.execute("PRAGMA table_info(RunOverride)")
        columns = cur.fetchall()
        print(f"\nTable schema ({len(columns)} columns):")
        for col in columns:
            nullable = '' if col[3] else 'NULL'
            default = f"DEFAULT {col[4]}" if col[4] else ''
            print(f"  {col[1]:20} {col[2]:10} {nullable:8} {default}")
        
        print("\n" + "=" * 80)
        print("MANUAL TABLE CREATION SUCCESSFUL")
        print("=" * 80)
    else:
        print("\n[ERROR] Verification failed - table still not found!")
        exit(1)
        
except Exception as e:
    print(f"\n[ERROR] Failed to create table: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
finally:
    conn.close()
