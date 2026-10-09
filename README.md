# Simple VM Migration Dashboard — QEMU/KVM to AWS

A full-stack, production-grade web dashboard for managing and orchestrating cold migrations of Linux virtual machines from local **Ubuntu QEMU/KVM (libvirt)** infrastructure to **Amazon Web Services (AWS EC2)**.

---

## Architecture Overview

```
+---------------------------------------------------------------------------------+
|                                React Frontend (Vite + TS)                       |
|                       http://localhost:3333 (or Nginx in Docker)               |
|  - Dashboard Overview   - Source Infrastructure   - Target Infrastructure      |
|  - VM Inventory Table   - Pre-Migration Audit     - 4-Step Migration Wizard    |
+---------------------------------------------------------------------------------+
                                       |
                                REST API (/api/*)
                                       v
+---------------------------------------------------------------------------------+
|                             FastAPI Backend Service                             |
|                              http://127.0.0.1:8888                              |
|  - Cryptographic key vault (Fernet AES encryption for credentials)              |
|  - SSH Remote Executor (Paramiko with Ed25519/RSA key auth)                    |
|  - Libvirt / Virsh XML Parser & Storage Volume Inspector                        |
|  - AWS Service Integration (Boto3: STS, EC2, S3, VM Import/Export)             |
|  - Pre-Migration Assessment Engine (Disks, Boot Mode, Kernel Drivers, ENI)      |
|  - Asynchronous Phased Migration Engine (Cold state, Staging, Launch, Validate) |
+---------------------------------------------------------------------------------+
         |                                                       |
         v                                                       v
+-----------------------+                               +-----------------------+
|  Source Infrastructure |                               |   Target Cloud (AWS)  |
|  Ubuntu KVM Server    |                               |  STS / EC2 / S3       |
|  virsh dumpxml        |                               |  VPCs, Subnets, SGs   |
|  qemu-img / storage   |                               |  EC2 Instances        |
+-----------------------+                               +-----------------------+
```

---

## Features

### 1. Dashboard Overview
- Summary KPI metric cards: Total Sources, Target Accounts, Discovered VMs, Active Migrations, Completed, and Failed.
- Real-time recent activity stream with phase progress bars and EC2 instance links.
- Discovered VMs quick status table with power states and compatibility badges.

### 2. Source Infrastructure Management
- Add, edit, test, and delete QEMU/KVM source hosts over SSH.
- Automated prerequisite diagnostics: SSH connectivity, `virsh` CLI availability, `libvirt` daemon connectivity, hypervisor version, CPU architecture, and total host RAM.
- Non-destructive, read-only discovery. If prerequisites fail, displays the exact command to resolve them.

### 3. Target Infrastructure (AWS)
- Secure credential management: AWS Access Key, Secret Access Key, optional Session Token, Default Region, and IAM Role ARN.
- **Zero-plaintext security**: All secrets encrypted with on-disk Fernet AES encryption and masked (`AKIA************MPLE`) on display.
- Real AWS STS `GetCallerIdentity` validation.
- Live resource discovery: Enabled AWS regions, VPCs, Subnets (with AZ, CIDR, available IPs), and Security Groups.

### 4. VM Inventory & Pre-Migration Assessment
- Comprehensive table listing all discovered VMs with search, multi-select, and filters (State, OS family, Compatibility status).
- Inspect VM modal:
  - Hardware specifications & libvirt domain XML viewer.
  - Virtual disks table (device, bus, format, capacity, allocation, backing files).
  - Virtual network interfaces (MAC address, model, bridge).
  - **Pre-Migration Assessment**: Evaluates cold state, disk formats (qcow2/raw), backing chains, 16 TiB EBS limits, guest OS support, BIOS vs UEFI firmware, VirtIO drivers, and EC2 ENI limits. Classifies findings as **Pass**, **Warning**, or **Blocked**.

### 5. Migration Execution Wizard
- **Step 1: Select VMs**: Choose 1, 2, or all discovered VMs.
- **Step 2: AWS Destination**: Select destination VPC, Subnet, Security Groups, EC2 instance type (with sizing recommendation), target instance name tag, and EBS gp3 storage settings.
- **Step 3: Migration Plan**: Review detailed plan summary, data transfer estimates, downtime notice, and AWS cost advisory. Requires explicit confirmation before any cloud resources are created.
- **Step 4: Phased Execution**:
  1. *Validation*: Host reachable, guest power state, AWS authentication.
  2. *Source Preparation*: Cold migration verification (ensures source VM is stopped for consistent export). Original source VM and disks remain completely untouched.
  3. *Disk Export*: Inspects and stages disk copy.
  4. *Upload & Staging*: Uploads image to AWS S3 staging bucket.
  5. *Image Import*: Registers Amazon Machine Image (AMI).
  6. *EC2 Launch*: Provisions instance in selected VPC/subnet with tags.
  7. *Post-Migration Validation*: Hypervisor system & instance status checks, block device attachment, and network interface verification.
- Live streaming log console with filter by severity and text search.
- Safe retries and cancellation controls.

---

## Local Setup & Quickstart

### Prerequisites
- Ubuntu Linux host (or equivalent Linux distribution)
- Python 3.12+
- Node.js 18+ and npm
- `libvirt-clients`, `qemu-utils`, OpenSSH server

### 1. One-Command Local Startup
Run the unified startup script:
```bash
cd /home/manojb/.gemini/antigravity/scratch/vm-migration-dashboard
./start.sh
```

This starts:
- **Backend API**: `http://localhost:8888` (API docs at `http://localhost:8888/docs`)
- **Frontend UI**: `http://localhost:3333`

### 2. Docker Compose Deployment
```bash
cd /home/manojb/.gemini/antigravity/scratch/vm-migration-dashboard
docker compose up -d --build
```

---

## Running Automated Tests

Run the backend test suite:
```bash
cd /home/manojb/.gemini/antigravity/scratch/vm-migration-dashboard/backend
PYTHONPATH=. pytest tests/
```

Test results:
- `test_health_check` — PASSED
- `test_overview_endpoint` — PASSED
- `test_sources_crud` — PASSED
- `test_targets_crud` — PASSED
- `test_vms_listing` — PASSED
- `test_assessment_running_vm` — PASSED
- `test_assessment_cold_vm_pass` — PASSED
- `test_assessment_blocked_unsupported_disk` — PASSED
- `test_recommend_instance_type` — PASSED

---

## AWS VM Import Prerequisites & Permissions

For real AWS VM Import/Export tasks, ensure the AWS account has the `vmimport` service role configured:

1. **Create `trust-policy.json`:**
```json
{
   "Version": "2012-10-17",
   "Statement": [
      {
         "Effect": "Allow",
         "Principal": { "Service": "vmie.amazonaws.com" },
         "Action": "sts:AssumeRole",
         "Condition": {
            "StringEquals":{
               "sts:Externalid": "vmimport"
            }
         }
      }
   ]
}
```

2. **Create IAM Role:**
```bash
aws iam create-role --role-name vmimport --assume-role-policy-document file://trust-policy.json
```

3. **Attach Role Policy:**
```json
{
   "Version":"2012-10-17",
   "Statement":[
      {
         "Effect":"Allow",
         "Action":[
            "s3:GetBucketLocation",
            "s3:GetObject",
            "s3:ListBucket",
            "s3:PutObject"
         ],
         "Resource":[
            "arn:aws:s3:::vm-migration-export-*",
            "arn:aws:s3:::vm-migration-export-*/*"
         ]
      },
      {
         "Effect":"Allow",
         "Action":[
            "ec2:ModifySnapshotAttribute",
            "ec2:CopySnapshot",
            "ec2:RegisterImage",
            "ec2:Describe*"
         ],
         "Resource":"*"
      }
   ]
}
```
