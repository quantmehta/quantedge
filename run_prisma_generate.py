import subprocess
from pathlib import Path
import os

print("=== Forcing Complete Prisma Regeneration ===\n")

project_dir = r"c:\Users\divit\OneDrive\Documents\DTH\decision-maker"
os.chdir(project_dir)

node_exe = r"C:\Program Files\nodejs\node.exe"
prisma_cli = Path(project_dir) / "node_modules" / "prisma" / "build" / "index.js"

# Step 1: Completely remove the generated client
print("Step 1: Removing old generated client...")
gen_dirs = [
    Path(project_dir) / "node_modules" / ".prisma",
    Path(project_dir) / "node_modules" / "@prisma" / "client"
]

for d in gen_dirs:
    if d.exists():
        try:
            import shutil
            shutil.rmtree(d, ignore_errors=True)
            print(f"  Removed: {d}")
        except Exception as e:
            print(f"  Warning: {e}")

# Step 2: Run generation with explicit output
print("\nStep 2: Running Prisma generate...")
cmd = [node_exe, str(prisma_cli), 'generate']

env = os.environ.copy()
env['NODE_PATH'] = str(Path(project_dir) / "node_modules")

print(f"Command: {' '.join(cmd)}\n")
print("-" * 70)

try:
    # Use errors='replace' to handle Unicode issues
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
        cwd=project_dir,
        errors='replace'  # Handle Unicode gracefully
    )
    
    print(result.stdout)
    if result.stderr and result.returncode != 0:
        print("STDERR:", result.stderr)
    
    print("-" * 70)
    
    # Step 3: Verify generation
    print("\nStep 3: Verifying generation...")
    
    # Check for the actual generated file (not the stub)
    possible_files = [
        Path(project_dir) / "node_modules" / "@prisma" / "client" / "index.d.ts",
        Path(project_dir) / "node_modules" / ".prisma" / "client" / "index.d.ts",
    ]
    
    found_types = None
    for f in possible_files:
        if f.exists() and f.stat().st_size > 1000:  # Real file should be much larger
            found_types = f
            break
    
    if found_types:
        print(f"  [OK] Found generated types: {found_types}")
        print(f"  [OK] File size: {found_types.stat().st_size} bytes")
        
        # Search for RunOverride
        try:
            with open(found_types, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
                
            if 'RunOverride' in content:
                print("  [SUCCESS] RunOverride model found in types!")
                
                # Count occurrences
                count = content.count('RunOverride')
                print(f"  [INFO] 'RunOverride' appears {count} times in types file")
                
                print("\n" + "=" * 70)
                print("VERIFICATION PASSED!")
                print("The Prisma client has been successfully generated.")
                print("TypeScript errors should now be resolved.")
                print("=" * 70)
            else:
                print("  [ERROR] RunOverride NOT found in generated types!")
                print("  This suggests schema.prisma was not read correctly.")
                print("\n  Checking schema.prisma...")
                schema = Path(project_dir) / "prisma" / "schema.prisma"
                with open(schema, 'r', encoding='utf-8') as f:
                    schema_content = f.read()
                    if 'RunOverride' in schema_content:
                        print("  [OK] RunOverride IS in schema.prisma")
                        print("  [ACTION NEEDED] Try running: npx prisma generate --schema=./prisma/schema.prisma")
                    else:
                        print("  [ERROR] RunOverride NOT in schema.prisma!")
    else:
        print("  [ERROR] Generated types file not found or too small")
        print("\n  Searched locations:")
        for f in possible_files:
            if f.exists():
                print(f"    - {f} (size: {f.stat().st_size})")
            else:
                print(f"    - {f} (NOT FOUND)")
        
        if result.returncode != 0:
            print(f"\n  [ERROR] Generation failed with code {result.returncode}")
        
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
