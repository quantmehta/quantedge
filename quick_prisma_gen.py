import subprocess
import os

project_dir = r"c:\Users\divit\OneDrive\Documents\DTH\decision-maker"
os.chdir(project_dir)

node_exe = r"C:\Program Files\nodejs\node.exe"
prisma_cli = os.path.join(project_dir, "node_modules", "prisma", "build", "index.js")

cmd = [node_exe, prisma_cli, 'generate']

print("Running: " + " ".join(cmd))

env = os.environ.copy()
env['NODE_PATH'] = os.path.join(project_dir, "node_modules")

result = subprocess.run(cmd, capture_output=True, text=True, env=env, errors='replace')
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr)

exit(result.returncode)
