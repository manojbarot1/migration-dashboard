import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_health_check():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

def test_overview_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/overview")
        assert response.status_code == 200
        data = response.json()
        assert "total_sources" in data
        assert "total_targets" in data
        assert "total_vms" in data

def test_sources_crud():
    with TestClient(app) as client:
        # Create a source
        source_data = {
            "name": "Test KVM Host",
            "environment": "Lab",
            "platform": "QEMU/KVM",
            "host": "127.0.0.1",
            "port": 22,
            "username": "manojb",
            "auth_type": "key",
            "description": "Test Host"
        }
        create_res = client.post("/api/sources", json=source_data)
        assert create_res.status_code == 200
        source_id = create_res.json()["id"]

        # List sources
        res = client.get("/api/sources")
        assert res.status_code == 200
        sources = res.json()
        assert len(sources) >= 1

        # Get single source
        res_single = client.get(f"/api/sources/{source_id}")
        assert res_single.status_code == 200
        assert res_single.json()["name"] == "Test KVM Host"

def test_targets_crud():
    with TestClient(app) as client:
        # Create target
        target_data = {
            "name": "Test AWS Target",
            "account_alias": "Test Lab",
            "access_key_id": "AKIAIOSFODNN7EXAMPLE",
            "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "default_region": "us-east-1"
        }
        create_res = client.post("/api/targets", json=target_data)
        assert create_res.status_code == 200
        target = create_res.json()
        assert target["masked_access_key"] == "AKIA************MPLE"
        assert target["has_secret_key"] is True

def test_vms_listing():
    with TestClient(app) as client:
        res = client.get("/api/vms")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
