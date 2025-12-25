import os
import time
import sys
import importlib.metadata
import tempfile
import json
from packaging import version
from growwapi import GrowwAPI
from .errors import GrowwError, ErrorType
from .logging_config import setup_logging

logger = setup_logging()

TOKEN_CACHE_FILE = os.path.join(tempfile.gettempdir(), 'groww_token_cache.json')
TOKEN_TTL = 3600 # 1 hour

MIN_SDK_VERSION = "1.0.0" # Example constraint, adjust as needed based on actual safe version

class AuthManager:
    _client_instance = None
    _permission_model = None

    @staticmethod
    def check_sdk_version():
        try:
            installed_version = importlib.metadata.version('growwapi')
            min_ver = os.getenv("GROWW_MIN_SDK_VERSION", MIN_SDK_VERSION)
            
            if version.parse(installed_version) < version.parse(min_ver):
                raise GrowwError(
                    ErrorType.VALIDATION_ERROR,
                    f"Outdated SDK version {installed_version}. Minimum required: {min_ver}",
                    retryable=False,
                    debug_hints=[f"Run: pip install --upgrade growwapi"]
                )
            return installed_version
        except importlib.metadata.PackageNotFoundError:
             raise GrowwError(
                    ErrorType.VALIDATION_ERROR,
                    "growwapi SDK not installed",
                    retryable=False
                )

    @staticmethod
    def check_totp_drift(secret):
        try:
            import pyotp
            totp = pyotp.TOTP(secret)
            now = time.time()
            
            # Check current and adjacent windows
            valid_now = totp.verify(totp.now(), valid_window=0)
            valid_window = totp.verify(totp.now(), valid_window=1)
            
            if not valid_now and valid_window:
                 logger.warning("TOTP clock drift detected")
                 # We don't fail here, but we warn. In strict mode we could fail.
                 return False # Drift detected
            return True # No significant drift or perfectly synced
        except ImportError:
            return True # Skip check if pyotp missing

    @staticmethod
    def get_client(force_refresh=False):
        if AuthManager._client_instance and not force_refresh:
            return AuthManager._client_instance
            
        AuthManager.check_sdk_version()
        auth_mode = os.getenv("GROWW_AUTH_MODE", "API_KEY_SECRET")

        # Try to load from cache
        if not force_refresh:
            try:
                if os.path.exists(TOKEN_CACHE_FILE):
                    mtime = os.path.getmtime(TOKEN_CACHE_FILE)
                    if (time.time() - mtime) < TOKEN_TTL:
                        with open(TOKEN_CACHE_FILE, 'r') as f:
                            cache = json.load(f)
                            access_token = cache.get("access_token")
                            if access_token:
                                logger.info("Using cached Groww access token.")
                                AuthManager._client_instance = GrowwAPI(access_token)
                                return AuthManager._client_instance
            except Exception as cache_err:
                logger.warning(f"Failed to read token cache: {cache_err}")

        try:
            if auth_mode == "TOTP":
                 token = os.getenv("GROWW_API_KEY") 
                 secret = os.getenv("GROWW_TOTP_SECRET")
                 
                 if not token or not secret:
                     raise GrowwError(ErrorType.AUTHENTICATION_FAILED, "Missing TOTP credentials")
                     
                 AuthManager.check_totp_drift(secret)
                 
                 import pyotp
                 totp_val = pyotp.TOTP(secret).now()
                 
                 access_token = GrowwAPI.get_access_token(api_key=token, totp=totp_val)
                 
            else: # API_KEY_SECRET
                 api_key = os.getenv("GROWW_API_KEY")
                 api_secret = os.getenv("GROWW_API_SECRET")
                 
                 if not api_key or not api_secret:
                      raise GrowwError(ErrorType.AUTHENTICATION_FAILED, "Missing API Key/Secret credentials.")
                 
                 access_token = GrowwAPI.get_access_token(api_key=api_key, secret=api_secret)
            
            if not access_token:
                 raise GrowwError(ErrorType.AUTHENTICATION_FAILED, "Failed to acquire access token")
                 
            # Save to cache
            try:
                with open(TOKEN_CACHE_FILE, 'w') as f:
                    json.dump({"access_token": access_token, "ts": time.time()}, f)
                logger.info("Saved fresh Groww access token to cache.")
            except Exception as save_err:
                logger.warning(f"Failed to save token cache: {save_err}")

            AuthManager._client_instance = GrowwAPI(access_token)
            
            # Preflight profile check
            if os.getenv("GROWW_PROFILE_PREFLIGHT", "true").lower() == "true":
                AuthManager._hydrate_permissions(AuthManager._client_instance)
                
            return AuthManager._client_instance
            
        except Exception as e:
            if isinstance(e, GrowwError): raise e
            # Map upstream errors
            msg = str(e)
            if "Access forbidden" in msg or "403" in msg:
                 raise GrowwError(
                     ErrorType.AUTHORIZATION_FAILED,
                     "Upstream denied access. Check permissions or approval status.",
                     retryable=False,
                     debug_hints=["Check Groww Cloud Dashboard", "Approve API Key for today"]
                 )
            raise GrowwError(ErrorType.AUTHENTICATION_FAILED, f"Auth failed: {msg}")

    @staticmethod
    def _hydrate_permissions(client):
        try:
            # This is a hypothetical call - we need to see what `get_user_profile` returns or fails with
            # If this fails with 403, it means we don't even have profile permissions
            profile = client.get_user_profile()
            
            # Build permission model
            AuthManager._permission_model = {
                "exchanges": ["NSE", "BSE"], # Default assumption or derive from profile
                "segments": ["CASH"], # Default assumption
                "ddpi": False 
            }
            
            # Simple heuristic: if we can fetch profile, we assume basic read permissions exist
            # Real implementation would parse 'products' or similar field from profile if available
            
        except Exception as e:
             logger.warning(f"Preflight profile check failed: {e}")
             # We don't block here, but we note it.
             AuthManager._permission_model = {"error": str(e)}

    @staticmethod
    def get_permission_model():
        return AuthManager._permission_model

def get_groww_client():
    return AuthManager.get_client()
