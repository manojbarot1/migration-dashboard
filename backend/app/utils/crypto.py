import os
import base64
from pathlib import Path
from cryptography.fernet import Fernet

KEY_FILE = Path(os.environ.get("SECRET_KEY_PATH", "/home/manojb/.gemini/antigravity/scratch/vm-migration-dashboard/.secret_key"))

def _get_or_create_key() -> bytes:
    if KEY_FILE.exists():
        try:
            return KEY_FILE.read_bytes().strip()
        except Exception:
            pass
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    key = Fernet.generate_key()
    KEY_FILE.write_bytes(key)
    KEY_FILE.chmod(0o600)
    return key

_fernet = Fernet(_get_or_create_key())

def encrypt_value(val: str | None) -> str | None:
    if not val:
        return None
    return _fernet.encrypt(val.encode("utf-8")).decode("utf-8")

def decrypt_value(val: str | None) -> str | None:
    if not val:
        return None
    try:
        return _fernet.decrypt(val.encode("utf-8")).decode("utf-8")
    except Exception:
        return val

def mask_credential(val: str | None, visible_start: int = 4, visible_end: int = 4) -> str:
    if not val:
        return ""
    if len(val) <= (visible_start + visible_end):
        return "********"
    return f"{val[:visible_start]}{'*' * (len(val) - visible_start - visible_end)}{val[-visible_end:]}"
