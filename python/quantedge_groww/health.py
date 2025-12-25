from .auth import AuthManager
from .errors import ErrorType

def diagnose_auth():
    """
    Runs a full diagnostic suite for Auth & Permissions.
    Returns a dict with safe diagnostic info.
    """
    result = {
        "sdkVersion": None,
        "authMode": None,
        "tokenAcquired": False,
        "profileFetched": False,
        "permissionModel": None,
        "hints": []
    }
    
    # 1. SDK Version
    try:
        ver = AuthManager.check_sdk_version()
        result["sdkVersion"] = ver
    except Exception as e:
        result["hints"].append(f"SDK Check Failed: {str(e)}")
        return result
        
    # 2. Auth Mode
    import os
    mode = os.getenv("GROWW_AUTH_MODE", "API_KEY_SECRET")
    result["authMode"] = mode
    
    # 3. Token Acquisition
    try:
        client = AuthManager.get_client(force_refresh=True)
        result["tokenAcquired"] = True
    except Exception as e:
        result["hints"].append(f"Token Acquisition Failed: {str(e)}")
        if "Approve API Key" in str(e):
             result["hints"].append("Action: Go to Groww Cloud -> Apps -> Select App -> Approve Key")
        return result

    # 4. Profile & Permissions
    try:
        profile = client.get_user_profile()
        result["profileFetched"] = True
        
        # In a real scenario, we'd inspect profile 'products' or 'segments'
        # For now we just dump a sanitized version of what the auth manager inferred
        result["permissionModel"] = AuthManager.get_permission_model()
        
    except Exception as e:
        result["hints"].append(f"Profile Fetch Failed: {str(e)}")
        result["hints"].append("Likely missing 'Profile' or 'Read' scope permissions on the API Key.")
        
    return result
