"""
Permanent Fix for Node.js PATH Issue
This script adds Node.js to the system PATH permanently
"""
import winreg
import os
import subprocess

print("=" * 80)
print("PERMANENT NODE.JS PATH FIX")
print("=" * 80)

# Target directory
nodejs_path = r"C:\Program Files\nodejs"

print(f"\n[1] Checking if Node.js exists at: {nodejs_path}")
if not os.path.exists(nodejs_path):
    print("  ERROR: Node.js directory not found!")
    print("  Please ensure Node.js is installed at the expected location.")
    exit(1)
print("  OK: Directory exists")

# Check current system PATH
print("\n[2] Reading current System PATH...")
try:
    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, 
                        r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
                        0, winreg.KEY_READ) as key:
        current_path, _ = winreg.QueryValueEx(key, "Path")
        print(f"  Current PATH length: {len(current_path)} characters")
        
        # Check if already in PATH
        if nodejs_path in current_path:
            print(f"\n  INFO: '{nodejs_path}' is already in System PATH!")
            print("  No changes needed.")
        else:
            print(f"\n  WARNING: '{nodejs_path}' is NOT in System PATH")
            print("\n" + "=" * 80)
            print("REQUIRES ADMINISTRATOR PRIVILEGES")
            print("=" * 80)
            print("\nThis script needs to modify the System PATH, which requires")
            print("administrator privileges. Please run this script as Administrator:")
            print("\n  1. Right-click on PowerShell/Command Prompt")
            print("  2. Select 'Run as Administrator'")
            print(f"  3. Navigate to: {os.getcwd()}")
            print("  4. Run: py fix_nodejs_path_permanent.py")
            print("\nAlternatively, you can manually add Node.js to PATH:")
            print("  1. Search for 'Environment Variables' in Windows")
            print("  2. Click 'Environment Variables' button")
            print("  3. Under 'System variables', select 'Path'")
            print("  4. Click 'Edit'")
            print("  5. Click 'New'")
            print(f"  6. Add: {nodejs_path}")
            print("  7. Click OK on all dialogs")
            print("  8. Restart your terminal/IDE")
            
except PermissionError:
    print("\n  ERROR: Permission denied - Administrator privileges required")
    print("  Please run this script as Administrator")
    exit(1)
except Exception as e:
    print(f"\n  ERROR: {e}")
    exit(1)

# Check User PATH as alternative
print("\n[3] Checking User PATH...")
try:
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 
                        r"Environment",
                        0, winreg.KEY_READ | winreg.KEY_WRITE) as key:
        try:
            user_path, _ = winreg.QueryValueEx(key, "Path")
        except FileNotFoundError:
            user_path = ""
        
        if nodejs_path in user_path:
            print(f"  OK: '{nodejs_path}' is in User PATH")
        else:
            print(f"  Adding '{nodejs_path}' to User PATH (no admin needed)...")
            
            new_user_path = user_path
            if not new_user_path.endswith(';'):
                new_user_path += ';'
            new_user_path += nodejs_path
            
            winreg.SetValueEx(key, "Path", 0, winreg.REG_EXPAND_SZ, new_user_path)
            print("  SUCCESS: Node.js added to User PATH!")
            print("\n" + "=" * 80)
            print("RESTART REQUIRED")
            print("=" * 80)
            print("\nFor the changes to take effect:")
            print("  1. Close all terminals and VS Code")
            print("  2. Reopen VS Code/Terminal")
            print("  3. Verify with: node --version")
            
except Exception as e:
    print(f"  ERROR modifying User PATH: {e}")

print("\n[4] Creating helper batch files...")

# Create helper batch files with full paths
batch_content = f"""@echo off
REM Auto-generated helper script with full Node.js paths
set "PATH={nodejs_path};%PATH%"
%*
"""

helper_path = "run_with_node.bat"
with open(helper_path, 'w') as f:
    f.write(batch_content)
print(f"  Created: {helper_path}")
print(f"  Usage: .\\{helper_path} npm run dev")

# Create npm wrapper
npm_wrapper = f"""@echo off
"{nodejs_path}\\node.exe" "{nodejs_path}\\node_modules\\npm\\bin\\npm-cli.js" %*
"""
with open("npm.bat", 'w') as f:
    f.write(npm_wrapper)
print("  Created: npm.bat")
print("  Usage: .\\npm.bat run dev")

# Create npx wrapper
npx_wrapper = f"""@echo off
"{nodejs_path}\\node.exe" "{nodejs_path}\\node_modules\\npm\\bin\\npx-cli.js" %*
"""
with open("npx.bat", 'w') as f:
    f.write(npx_wrapper)
print("  Created: npx.bat")
print("  Usage: .\\npx.bat prisma generate")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print("\nImmediate workaround (no restart needed):")
print("  Use the generated batch files:")
print("    .\\npm.bat run dev")
print("    .\\npx.bat prisma generate")
print("\nPermanent fix:")
print("  1. Node.js has been added to User PATH")
print("  2. Restart your terminal/VS Code")
print("  3. Then 'npm' and 'npx' will work globally")
