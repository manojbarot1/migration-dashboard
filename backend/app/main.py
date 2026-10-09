import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import engine, Base, SessionLocal
from .models import SourceInfrastructure, TargetInfrastructure
from .utils.crypto import encrypt_value
from .routes import overview, source, target, vms, migration

# Create tables immediately on load
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-seed initial source connection for local lab host if not configured
    db = SessionLocal()
    try:
        count = db.query(SourceInfrastructure).count()
        if count == 0:
            key_path = os.path.expanduser("~/.ssh/amaa_discovery")
            key_content = ""
            if os.path.exists(key_path):
                key_content = Path(key_path).read_text().strip()

            initial_source = SourceInfrastructure(
                name="Ubuntu Lab Hypervisor",
                environment="Lab",
                platform="QEMU/KVM",
                host="127.0.0.1",
                port=22,
                username="manojb",
                auth_type="key",
                private_key_enc=encrypt_value(key_content or key_path),
                use_sudo=False,
                description="Local Ubuntu laptop running libvirt and QEMU/KVM",
                status="Not Tested"
            )
            db.add(initial_source)
            db.commit()

        # Seed initial AWS target placeholder if none exist
        target_count = db.query(TargetInfrastructure).count()
        if target_count == 0:
            initial_target = TargetInfrastructure(
                name="AWS Migration Target (Lab)",
                account_alias="Lab Account",
                access_key_id="",
                default_region="us-east-1",
                description="Target AWS VPC and EC2 environment for cloud migration",
                status="Not Tested"
            )
            db.add(initial_target)
            db.commit()
    except Exception as e:
        print(f"Notice during startup init: {e}")
    finally:
        db.close()

    yield

app = FastAPI(
    title="Simple VM Migration Dashboard API",
    description="Orchestrator for QEMU/KVM to AWS EC2 VM Migrations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(overview.router)
app.include_router(source.router)
app.include_router(target.router)
app.include_router(vms.router)
app.include_router(migration.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "VM Migration Dashboard API",
        "version": "1.0.0"
    }
