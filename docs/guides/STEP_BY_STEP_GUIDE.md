# Step-by-Step Operator Guide: VM Migration from QEMU/KVM to AWS

This guide walks administrators through discovering virtual machines, configuring AWS target environments, reviewing dependencies, customizing server-wise subnet placement, and executing live cold migrations.

---

## Prerequisites Checklist

### Source Infrastructure (Ubuntu Host)
- [x] Ubuntu laptop running QEMU/KVM and `libvirtd` (`systemctl status libvirtd`).
- [x] SSH service running on port 22 (`systemctl status ssh`).
- [x] SSH user account with membership in `libvirt` and `kvm` groups:
  ```bash
  sudo usermod -aG libvirt,kvm $USER
  ```
- [x] Verified `virsh list --all` shows source VMs (`web1`, `app1`, `db1`, `aether1`).

### Target Infrastructure (AWS Account)
- [x] AWS IAM User with programmatic Access Key ID and Secret Access Key.
- [x] Permissions: `ec2:Describe*`, `ec2:RunInstances`, `ec2:CreateTags`.
- [x] Existing VPC and Subnets in target region (e.g. `eu-central-1`, `us-east-1`, or `us-east-2`).

---

## Step 1: Launch the Dashboard

```bash
cd /home/manojb/.gemini/antigravity/scratch/vm-migration-dashboard
./start.sh
```

- Open your browser to **`http://localhost:3333`**.
- The API swagger docs are available at **`http://localhost:8888/docs`**.

---

## Step 2: Configure & Discover Source Hypervisor

1. Navigate to **Source Infrastructure** in the left sidebar.
2. Click **Add Source Connection**:
   - **Infrastructure Name**: `Ubuntu Lab Laptop`
   - **Environment**: `Lab`
   - **Platform**: `QEMU/KVM`
   - **Host**: `127.0.0.1` (or local IP)
   - **Port**: `22`
   - **Username**: `manojb`
   - **Authentication**: `SSH Private Key` (enter path `~/.ssh/amaa_discovery` or paste key text)
3. Click **Test Connectivity**. You should receive a green status showing hypervisor hostname and libvirt version.
4. Click **Discover VMs**:
   - The dashboard inspects libvirt XML files over SSH.
   - Discovers CPU cores, memory, disk files (`/var/lib/libvirt/images/*.qcow2`), bus types, and network bridges.
5. Click **Save Connection**.

---

## Step 3: Configure AWS Target Environment

1. Navigate to **Target Infrastructure** in the left sidebar.
2. Click **Add Target Connection**:
   - **Infrastructure Name**: `AWS Lab Account`
   - **Account Alias**: `AWS Prod/Lab`
   - **AWS Access Key ID**: `AKIA...`
   - **AWS Secret Access Key**: `...`
   - **Default Region**: `eu-central-1` (or `us-east-1`)
3. Click **Test AWS Connection**:
   - The dashboard calls AWS STS `GetCallerIdentity`.
   - Confirms Account ID and authenticated IAM ARN.
4. Click **Refresh Target Inventory**:
   - Discovers available VPCs, Subnets (with CIDRs and Availability Zones), and Security Groups.
5. Click **Save Connection**.

---

## Step 4: Inspect Application Dependencies & Topology

1. Navigate to **Application Discovery** in the left sidebar.
2. Observe the **Multi-Tier Architecture Diagram**:
   - `web1` (192.168.100.10) $\xrightarrow{\text{HTTP:8080}}$ `app1` (192.168.100.20) $\xrightarrow{\text{PostgreSQL:5432}}$ `db1` (192.168.100.30).
   - Standalone workload: `aether1` (192.168.122.50) on `virbr0`.
3. Review **Move Groups**:
   - **HelpDesk 3-Tier Stack**: Classified as **High Coupling Risk** if separated across cloud boundaries.
   - **Recommended Execution Sequence**:
     1. `db1` (Database Tier)
     2. `app1` (Application Tier)
     3. `web1` (Web Tier)
4. Click **Migrate Wave** on the move group card to carry all 3 servers directly into planning.

---

## Step 5: Customize Server-Wise Subnet & Sizing in Migration Plan

1. Navigate to **Migration Plan & Architecture** in the left sidebar.
2. Under **AWS Target Environment**:
   - Confirm **Region**: `eu-central-1` (Frankfurt).
   - Click the **Refresh VPCs & Subnets** button if you have created any new cloud resources.
3. Switch to **Tab 2 (Per-Server Subnet Mapping)**:
   - **`web1`**: Set to Public Subnet (e.g. `subnet-0...` in `eu-central-1a`). Check **Auto-assign Public IP**.
   - **`app1`**: Set to Private App Subnet (e.g. `subnet-1...` in `eu-central-1b`). Uncheck Public IP.
   - **`db1`**: Set to Isolated DB Subnet (e.g. `subnet-2...` in `eu-central-1c`). Uncheck Public IP.
4. Review **Tab 3 (Post-Migration IP Resolution & Health)**:
   - Select between Route 53 Private DNS, Private IP Preservation, or automated `/etc/hosts` injection.
5. Review **Tab 4 (Execution Review)** and click **Proceed to Migration Execution**.

---

## Step 6: Execute & Monitor the Live Cold Migration

1. In the **Migration Wizard**:
   - **Step 1 (Source VMs)**: Confirm `db1`, `app1`, and `web1` are selected. Note the green **"Move Group Complete: Zero cross-cloud dependency risk"** badge.
   - **Step 2 (AWS Destination)**: Verify target VPC and subnets. Click the **Refresh** button if needed.
   - **Step 3 (Plan Review)**: Review transfer sizes, compute costs, and disk storage. Check **"I have reviewed the plan and authorize execution"**.
   - **Step 4 (Execution)**: Click **Confirm Plan & Execute Migration**.
2. **Monitor Live Execution**:
   - Watch the progress bars advance through each phase:
     1. `Validating` (SSH & AWS credentials)
     2. `Preparing source` (Cold shutdown check)
     3. `Exporting disks` (QCOW2 inspection)
     4. `Importing image` (Base AMI resolution)
     5. `Launching EC2` (Real AWS RunInstances call)
     6. `Target Validation` (Instance status check)
   - Click any server tab (`db1`, `app1`, `web1`) to inspect real-time log messages and created AWS resource IDs (e.g. `i-07e8a1d26aca0ae44`).

---

## Step 7: Post-Migration Verification

1. Log in to the AWS Console in your selected region.
2. Under **EC2 &rarr; Instances**, confirm your migrated instances are running with their assigned tags:
   - `Name`: `migrated-web1`, `migrated-app1`, `migrated-db1`
   - `MigratedBy`: `Antigravity-VMMigrationDashboard`
   - `SourceVM`: `web1`, `app1`, `db1`
3. Verify public connectivity to `migrated-web1` on HTTP port 80.
4. Verify application backend socket connectivity between `migrated-app1` and `migrated-db1`.
