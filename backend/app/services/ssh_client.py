import io
import os
import paramiko
from typing import Tuple, Optional, Dict, Any

class SSHExecutor:
    def __init__(
        self,
        host: str,
        port: int = 22,
        username: str = "root",
        auth_type: str = "key",
        private_key: Optional[str] = None,
        password: Optional[str] = None,
        timeout: int = 15,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.auth_type = auth_type
        self.private_key = private_key
        self.password = password
        self.timeout = timeout

    def _get_client(self) -> paramiko.SSHClient:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Check if connecting to localhost or remote
        connect_kwargs: Dict[str, Any] = {
            "hostname": self.host,
            "port": self.port,
            "username": self.username,
            "timeout": self.timeout,
            "banner_timeout": self.timeout,
        }

        if self.auth_type == "key" and self.private_key:
            # Check if private_key is a file path or raw key content
            key_content = self.private_key.strip()
            if os.path.exists(key_content):
                connect_kwargs["key_filename"] = key_content
            else:
                key_obj = None
                key_stream = io.StringIO(key_content)
                for key_cls in (paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey):
                    try:
                        key_stream.seek(0)
                        key_obj = key_cls.from_private_key(key_stream)
                        break
                    except Exception:
                        continue
                if not key_obj:
                    # Also try reading default user key if present
                    default_key = os.path.expanduser("~/.ssh/amaa_discovery")
                    if os.path.exists(default_key):
                        connect_kwargs["key_filename"] = default_key
                    else:
                        raise ValueError("Could not parse private key format (RSA/Ed25519/ECDSA required)")
                else:
                    connect_kwargs["pkey"] = key_obj
        elif self.auth_type == "password" and self.password:
            connect_kwargs["password"] = self.password
        else:
            # Fallback to local default SSH keys
            default_key = os.path.expanduser("~/.ssh/amaa_discovery")
            if os.path.exists(default_key):
                connect_kwargs["key_filename"] = default_key

        client.connect(**connect_kwargs)
        return client

    def execute(self, command: str, timeout: int = 30) -> Tuple[int, str, str]:
        """Executes a command over SSH and returns (exit_code, stdout, stderr)."""
        client = None
        try:
            client = self._get_client()
            stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
            out = stdout.read().decode("utf-8", errors="replace")
            err = stderr.read().decode("utf-8", errors="replace")
            exit_code = stdout.channel.recv_exit_status()
            return exit_code, out, err
        finally:
            if client:
                try:
                    client.close()
                except Exception:
                    pass

    def test_connection(self) -> Tuple[bool, str]:
        """Tests if the SSH connection can be established."""
        try:
            code, out, err = self.execute("echo 'SSH_OK'", timeout=10)
            if code == 0 and "SSH_OK" in out:
                return True, "SSH connection successful"
            return False, f"SSH command failed with code {code}: {err or out}"
        except Exception as e:
            return False, f"Failed to connect via SSH: {str(e)}"
