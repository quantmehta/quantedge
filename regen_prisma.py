import subprocess
import os

project_dir = r"c:\Users\divit\OneDrive\Documents\DTH\decision-maker"
os.chdir(project_dir)

node_exe = r"C:\Program Files\nodejs\node.exe"
prisma_cli = os.path.join(project_dir, "node_modules", "prisma", "build", "index.js")

cmd = [node_exe, prisma_cli, 'generate']

env = os.environ.copy()
env['NODE_PATH'] = os.path.join(project_dir, "node_modules")

print("Regenerating Prisma client...")
result = subprocess.run(cmd, capture_output=True, env=env)

# Just check return code, don't print (Unicode issues)
if result.returncode == 0:
    print("SUCCESS: Prisma client regenerated")
else:
    print(f"FAILED with exit code {result.returncode}")
    
exit(result.returncode)
