import subprocess
import os

project_dir = r"c:\Users\divit\OneDrive\Documents\DTH\decision-maker"
os.chdir(project_dir)

node_exe = r"C:\Program Files\nodejs\node.exe"
prisma_cli = os.path.join(project_dir, "node_modules", "prisma", "build", "index.js")

# Run migration
cmd = [node_exe, prisma_cli, 'migrate', 'dev', '--name', 'add_report_fields']

env = os.environ.copy()
env['NODE_PATH'] = os.path.join(project_dir, "node_modules")

print("Running Prisma migration...")
result = subprocess.run(cmd, capture_output=True, env=env, input=b'\n')

if result.returncode == 0:
    print("SUCCESS: Migration complete")
else:
    print(f"FAILED with exit code {result.returncode}")
    # Try to print error (might fail on Unicode)
    try:
        if result.stderr:
            print("Error:", result.stderr.decode('utf-8', errors='replace')[:500])
    except:
        pass
    
exit(result.returncode)
