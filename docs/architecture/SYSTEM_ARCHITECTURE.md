# Complete Architecture & System Design Document

## 1. Executive Summary

The **Simple VM Migration Dashboard** is a cloud migration platform engineered to automate discovery, assessment, planning, and cold migration execution of Linux virtual machines from local on-prem hypervisors (QEMU/KVM + libvirt) to Amazon Web Services (AWS EC2).

The application bridges on-prem infrastructure realities (single flat bridge subnets, lack of internal firewalls, legacy static IPs) with AWS Well-Architected multi-tier cloud standards (isolated public/private VPC subnets, least-privilege security groups, resilient DNS resolution).

---

## 2. End-to-End Architectural Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   ON-PREMISES SOURCE (UBUNTU)               │
│                                                             │
│   Hypervisor: QEMU/KVM + libvirt (Managed over SSH)         │
│                                                             │
│   virbr1 (192.168.100.0/24)        virbr0 (192.168.122.0/24)│
│   ┌──────────────┐                 ┌──────────────┐         │
│   │ web1 (Web)   │ 192.168.100.10  │ aether1      │         │
│   └──────┬───────┘                 │ (Standalone) │         │
│          │ HTTP:8080               └──────────────┘         │
│   ┌──────▼───────┐                                          │
│   │ app1 (App)   │ 192.168.100.20                           │
│   └──────┬───────┘                                          │
│          │ PostgreSQL:5432                                  │
│   ┌──────▼───────┐                                          │
│   │ db1 (DB)     │ 192.168.100.30                           │
│   └──────────────┘                                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
            SSH Discovery & Read-Only XML Inspection
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              MIGRATION DASHBOARD CONTROL PLANE              │
│                                                             │
│   Frontend: React 19 + TypeScript + Vite + Tailwind (3333)  │
│   Backend: FastAPI + SQLAlchemy + SQLite + Boto3 (8888)     │
│                                                             │
│   • Hypervisor Discovery Engine (SSH + virsh)               │
│   • Multi-Tier Dependency Discovery & Clustering Engine     │
│   • Pre-Migration Compatibility & Validation Engine         │
│   • Granular Per-Server Subnet & Sizing Planner             │
│   • Multi-Phase Migration Orchestration Engine              │
└──────────────────────────────┬──────────────────────────────┘
                               │
            AWS APIs (boto3) & Migration Orchestration
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 AWS DESTINATION ENVIRONMENT                 │
│                                                             │
│   Target Region: eu-central-1 (or configured region)        │
│   VPC: Multi-Tier Subnet Topology                           │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Public Subnet (Web Tier)                             │  │
│   │ - EC2 Instance: migrated-web1 (t3.small)             │  │
│   │ - Public IPv4 Assigned & Security Group: 80 / 443     │  │
│   └──────────────────────────┬───────────────────────────┘  │
│                              │ Inbound 8080 from Web-SG     │
│   ┌──────────────────────────▼───────────────────────────┐  │
│   │ Private Subnet (App Tier)                            │  │
│   │ - EC2 Instance: migrated-app1 (t3.small)             │  │
│   │ - Internal Only & Security Group: 8080 from Web-SG   │  │
│   └──────────────────────────┬───────────────────────────┘  │
│                              │ Inbound 5432 from App-SG     │
│   ┌──────────────────────────▼───────────────────────────┐  │
│   │ Isolated Private Subnet (Database Tier)              │  │
│   │ - EC2 Instance: migrated-db1 (t3.small)              │  │
│   │ - No Internet Access & Security Group: 5432 from App │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Core Software Components

### 3.1 Backend Architecture (FastAPI + Python)

Located in `/backend`:
- **`app/services/ssh_client.py`**:
  - Paramiko-based SSH executor with support for private key authentication, passphrase protection, and password auth.
  - Read-only execution with safety guardrails (no automatic destructive modifications to host).
- **`app/services/libvirt_discovery.py`**:
  - Connects to `virsh` and parses libvirt domain XMLs.
  - Discovers: UUIDs, power states, vCPUs, memory, disk formats (qcow2/raw), virtual buses (virtio/ide/scsi), MAC addresses, and attached virtual bridges.
- **`app/services/dependency_service.py`**:
  - Classifies application tiers by inspecting naming heuristics, port bindings, and static DHCP leases (`/var/lib/libvirt/dnsmasq/*.hostsfile`).
  - Discovers directional service coupling (e.g. `web1` $\rightarrow$ `app1:8080` $\rightarrow$ `db1:5432`).
  - Clusters coupled systems into **Move Groups / Migration Waves** to prevent cross-cloud network latency and split-brain failures.
- **`app/services/assessment_service.py`**:
  - Evaluates VMs against AWS EC2 migration constraints before launch.
  - Flags findings as **Pass**, **Warning**, or **Blocked**:
    - Power state check (cold migration requires stopped guest for disk consistency).
    - Virtio driver compatibility.
    - BIOS vs UEFI boot mode alignment.
    - EBS disk size and instance sizing suitability.
- **`app/services/aws_service.py`**:
  - Boto3 SDK wrapper for AWS STS, EC2, and S3.
  - Encrypts credentials with Fernet symmetric cryptography (`.secret_key`).
  - Discovers real VPCs, subnets, Availability Zones, and Security Groups live from AWS APIs.
  - Discovers official compatible AMI machine images across AWS regions.
- **`app/services/migration_engine.py`**:
  - Background asynchronous task worker executing multi-phase migration pipelines:
    1. Validation
    2. Preparing source
    3. Exporting disks
    4. Uploading disks
    5. Registering machine images
    6. Launching EC2 instances
    7. Post-migration validation
  - Streaming log collector persisting real-time timestamps, phases, and status badges.

---

### 3.2 Frontend Architecture (React + TypeScript)

Located in `/frontend`:
- **Overview Page (`OverviewPage.tsx`)**: High-level KPI metric cards, source hypervisor status, AWS target connectivity, and recent activity logs.
- **Source Infrastructure Page (`SourceInfraPage.tsx`)**: Form to add and test SSH connection, verify `virsh`, and trigger live VM discovery.
- **Target Infrastructure Page (`TargetInfraPage.tsx`)**: Form to add AWS IAM credentials, test authentication against STS, and inspect discovered regions, VPCs, subnets, and security groups.
- **VM Inventory Page (`VmInventoryPage.tsx`)**: Searchable, filterable table of discovered VMs with interactive XML inspection, disk inspection, and instant pre-migration assessment.
- **Application Discovery Page (`ApplicationDiscoveryPage.tsx`)**: Dedicated visual topology diagram of multi-tier stacks (`web1` $\rightarrow$ `app1` $\rightarrow$ `db1`) with move group clustering cards and recommended execution sequencing.
- **Migration Plan & Architecture Page (`MigrationPlanPage.tsx`)**: Comprehensive planning hub with:
  - 3-tier AWS subnet best practice reference.
  - Granular server-wise subnet, instance type, disk size, and security group selectors.
  - Post-migration IP resolution strategy selector (Route 53, IP preservation, `/etc/hosts`).
  - Post-migration automated health validation checklist.
- **Migration Execution Wizard (`MigrationWizardPage.tsx`)**: 4-step wizard with Move Group quick-selectors, dependency advisory warning banners, real-time VPC/subnet refresh buttons, plan confirmation, and real-time streaming execution logs.
- **Migration History Page (`MigrationHistoryPage.tsx`)**: Audit log of historical and active jobs with retry, cancel, and log export features.

---

## 4. Network Security & Cloud Isolation Model

### 4.1 On-Premises to Cloud Transition
On the local KVM hypervisor:
- `web1`, `app1`, and `db1` reside on a single broadcast domain (`192.168.100.0/24`).
- Any host can talk directly to any port on any other host.

In AWS:
- Workloads are segmented across distinct subnets within an Amazon VPC:
  - **Public Subnet**: `web1` (Internet-facing reverse proxy).
  - **Private App Subnet**: `app1` (No public route table or internet gateway).
  - **Isolated DB Subnet**: `db1` (No internet route, strictly restricted ingress).

### 4.2 Security Group Firewall Rules

| Tier | EC2 Instance | Allowed Inbound Ports | Allowed Source |
| :--- | :--- | :--- | :--- |
| **Web** | `migrated-web1` | TCP 80, TCP 443 | `0.0.0.0/0` (Internet) |
| **App** | `migrated-app1` | TCP 8080 | Security Group of Web Tier (`sg-web`) |
| **Database** | `migrated-db1` | TCP 5432 | Security Group of App Tier (`sg-app`) |

*Result:* Direct external access to the database or internal API is physically prevented at the AWS hypervisor layer.

---

## 5. Security & Credential Storage

1. **AES / Fernet Symmetric Encryption**:
   - Master encryption key stored on disk with `0600` permissions (`.secret_key`).
   - SSH passwords, SSH private keys, and AWS secret access keys are encrypted before saving to the SQLite database.
2. **Credential Masking**:
   - Passwords and secret keys are never returned across API responses in plaintext.
   - Access keys are masked: `AKIA****************ONY5`.
3. **IAM Least Privilege**:
   - The application does not require root/admin credentials.
   - Compatible with temporary session tokens and IAM Instance Profiles.
