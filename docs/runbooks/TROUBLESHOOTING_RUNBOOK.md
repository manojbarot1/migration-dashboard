# Troubleshooting, Failure Runbook & Operational FAQ

This runbook covers common migration failure scenarios, error messages, root cause analyses, and verified resolutions.

---

## 1. Error: `VPCIdNotSpecified` (RunInstances Failure)

### Error Message in Logs:
```text
An error occurred (VPCIdNotSpecified) when calling the RunInstances operation: 
No default VPC for this user. GroupName is only supported for EC2-Classic and default VPC.
```

### Root Cause:
1. The target AWS region selected has **no default VPC** (e.g., `eu-west-1` or `eu-north-1` where the default VPC was deleted or never provisioned).
2. The user submitted an empty string `""` for `target_subnet_id`.
3. When `RunInstances` receives no explicit `SubnetId`, it attempts to fall back to the account's Default VPC, which fails if no default VPC exists in that region.

### Resolution:
1. **Choose a Region with an Active VPC**:
   - In your account (`384635610316`), active VPCs and subnets exist in:
     - `eu-central-1` (Frankfurt): `vpc-066128dfebafd8bfa` (3 subnets)
     - `us-east-1` (N. Virginia): `vpc-07b9a41451b5ee4e2`
     - `us-east-2` (Ohio): `vpc-0ccfcbd9523fccbee`
2. **Use the Dashboard Refresh Button**:
   - On the **Migration Plan** or **Step 2 Wizard** page, click the **"Refresh VPCs & Subnets"** button to automatically fetch and select available subnets.
3. **Dashboard Guard**:
   - The dashboard now blocks advancing to the plan review step if no subnet is selected, preventing empty submissions.

---

## 2. Error: `PermissionDenied` or `UnauthorizedOperation`

### Common AWS Permission Errors:
- `ec2:CreateDefaultVpc`: `User is not authorized to perform: ec2:CreateDefaultVpc`
- `ec2:ImportImage`: `User is not authorized to perform: ec2:ImportImage`
- `s3:CreateBucket`: `User is not authorized to perform: s3:CreateBucket`

### Root Cause:
Your IAM User (`amaa`) has strict scoped permissions that allow `ec2:RunInstances`, `ec2:Describe*`, and tagging, but disallow broad administrative actions like creating new VPCs or S3 buckets.

### Resolution:
- Use existing pre-created VPCs and Subnets in `eu-central-1` rather than trying to create new networking.
- The dashboard utilizes standard AMI launching and EBS mapping which works fully within `ec2:RunInstances` without requiring `vmimport` administrative rights.

---

## 3. Error: SSH Connection Refused / Auth Failure on Source Host

### Error Message in Logs:
```text
Source host unreachable via SSH: Authentication failed (publickey).
```

### Root Cause:
1. Incorrect SSH private key path or key without proper permissions.
2. The SSH user does not have read access to libvirt.

### Resolution:
1. Verify key file permissions on the Ubuntu host:
   ```bash
   chmod 600 ~/.ssh/amaa_discovery
   ```
2. Verify you can connect via command-line:
   ```bash
   ssh -i ~/.ssh/amaa_discovery manojb@127.0.0.1
   ```
3. Verify libvirt group membership:
   ```bash
   groups manojb
   # Must output: libvirt kvm
   ```
   If missing:
   ```bash
   sudo usermod -aG libvirt,kvm manojb
   ```

---

## 4. Pre-Migration Assessment Warnings: "VM is Running"

### Warning in Assessment Table:
```text
State: running — Graceful shutdown is required before image export to guarantee data consistency.
```

### Why This Is Important:
Executing cold disk image export while a VM is actively writing to disk (e.g. PostgreSQL database) risks filesystem corruption or uncommitted transactions.

### Recommended Cold Migration Procedure:
1. In the source Ubuntu terminal, gracefully shut down the guest:
   ```bash
   virsh shutdown db1
   virsh shutdown app1
   virsh shutdown web1
   ```
2. Wait until `virsh list --all` reports state as `shut off`.
3. In the dashboard, click **Refresh** on the VM Inventory page.
4. The compatibility status will turn green (**Pass**), allowing safe image export with 100% data integrity.

---

## 5. Handling IP Address Changes & Cross-Server Connectivity

### Question:
*"In KVM, web1, app1, and db1 are on 192.168.100.x. When they get new AWS IPs, how do they communicate?"*

### Solution 1: Route 53 Private Hosted Zone (Recommended)
1. In AWS Route 53, create a Private Hosted Zone: `helpdesk.internal` associated with your VPC.
2. Create `A` records:
   - `db.helpdesk.internal` &rarr; Private IP of `migrated-db1`
   - `app.helpdesk.internal` &rarr; Private IP of `migrated-app1`
3. Configure your application connection strings to use `db.helpdesk.internal:5432`.

### Solution 2: Automated `/etc/hosts` Injection
When migrating, the dashboard's post-migration script updates `/etc/hosts` inside the launched instances:
```text
10.0.1.20   app1.internal app1
10.0.2.30   db1.internal db1
```
This requires zero code modifications to your application.
