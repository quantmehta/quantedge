import subprocess
import os
from pathlib import Path

print("=" * 80)
print("APPLYING PRISMA MIGRATION FOR RunOverride TABLE")
print("=" * 80)

project_dir = r"c:\Users\divit\OneDrive\Documents\DTH\decision-maker"
os.chdir(project_dir)

node_exe = r"C:\Program Files\nodejs\node.exe"
prisma_cli = Path(project_dir) / "node_modules" / "prisma" / "build" / "index.js"

print(f"\nNode: {node_exe}")
print(f"Prisma CLI: {prisma_cli}")
print(f"Working directory: {os.getcwd()}\n")

# Run prisma migrate dev
cmd = [node_exe, str(prisma_cli), 'migrate', 'dev', '--name', 'add_run_override']

print(f"Command: {' '.join(cmd)}")
print("-" * 80)

try:
    env = os.environ.copy()
    env['NODE_PATH'] = str(Path(project_dir) / "node_modules")
    
    # Run migration
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
        cwd=project_dir,
        errors='replace',
        input='\n'  # Auto-confirm any prompts
    )
    
    print(result.stdout)
    if result.stderr and result.returncode != 0:
        print("STDERR:", result.stderr)
    
    print("-" * 80)
    
    if result.returncode == 0:
        print("SUCCESS: Migration applied!")
        
        # Verify table creation
        import sqlite3
        db_path = Path(project_dir) / "prisma" / "dev.db"
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='RunOverride'")
        if cursor.fetchone():
            print("\n[VERIFIED] RunOverride table now exists in database!")
            
            # Show schema
            cursor.execute("PRAGMA table_info(RunOverride)")
            columns = cursor.fetchall()
            print("\nTable schema:")
            for col in columns:
                print(f"  - {col[1]} ({col[2]})")
        else:
            print("\n[WARNING] RunOverride table still not found after migration")
        
        conn.close()
    else:
        print(f"FAILED with exit code {result.returncode}")
        
        # Try to see what migrations exist
        migrations_dir = Path(project_dir) / "prisma" / "migrations"
        if migrations_dir.exists():
            print(f"\nExisting migrations in {migrations_dir}:")
            for m in sorted(migrations_dir.iterdir()):
                if m.is_dir():
                    print(f"  - {m.name}")
        
        import sys
        sys.exit(result.returncode)
        
except subprocess.TimeoutExpired:
    print("ERROR: Migration timed out")
    import sys
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
    import sys
    sys.exit(1)
