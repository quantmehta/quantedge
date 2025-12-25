import subprocess
import os

project_dir = r"c:\Users\divit\OneDrive\Documents\DTH\decision-maker"
os.chdir(project_dir)

node_exe = r"C:\Program Files\nodejs\node.exe"
prisma_cli = os.path.join(project_dir, "node_modules", "prisma", "build", "index.js")

# Run migration
cmd = [node_exe, prisma_cli, 'migrate', 'dev', '--name', 'phase10_audit_session']

env = os.environ.copy()
env['NODE_PATH'] = os.path.join(project_dir, "node_modules")

print("Running Prisma migration for Phase 10...")
result = subprocess.run(cmd, capture_output=True, env=env, input=b'\n')

if result.returncode == 0:
    print("SUCCESS: Migration complete")
    print("Running Prisma generate...")
    
    # Generate Prisma client
    gen_cmd = [node_exe, prisma_cli, 'generate']
    gen_result = subprocess.run(gen_cmd, capture_output=True, env=env)
    
    if gen_result.returncode == 0:
        print("SUCCESS: Prisma client generated")
    else:
        print(f"FAILED: Prisma generate failed with exit code {gen_result.returncode}")
else:
    print(f"FAILED with exit code {result.returncode}")
    
exit(result.returncode)
