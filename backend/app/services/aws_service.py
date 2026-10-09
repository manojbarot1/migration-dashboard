import boto3
from botocore.exceptions import ClientError, EndpointConnectionError, NoCredentialsError
from typing import Dict, Any, List, Optional

class AWSService:
    def __init__(
        self,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        session_token: Optional[str] = None,
        region_name: str = "us-east-1",
        role_arn: Optional[str] = None,
    ):
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.session_token = session_token
        self.region_name = region_name or "us-east-1"
        self.role_arn = role_arn

    def _get_session(self) -> boto3.Session:
        kwargs: Dict[str, Any] = {"region_name": self.region_name}
        if self.access_key_id and self.secret_access_key:
            kwargs["aws_access_key_id"] = self.access_key_id
            kwargs["aws_secret_access_key"] = self.secret_access_key
            if self.session_token:
                kwargs["aws_session_token"] = self.session_token
        
        session = boto3.Session(**kwargs)
        
        # If IAM role ARN is provided, assume it
        if self.role_arn:
            sts_client = session.client("sts")
            assumed = sts_client.assume_role(
                RoleArn=self.role_arn,
                RoleSessionName="VMMigrationDashboardSession"
            )
            creds = assumed["Credentials"]
            session = boto3.Session(
                aws_access_key_id=creds["AccessKeyId"],
                aws_secret_access_key=creds["SecretAccessKey"],
                aws_session_token=creds["SessionToken"],
                region_name=self.region_name
            )
        return session

    def test_authentication(self) -> Dict[str, Any]:
        """Tests AWS STS GetCallerIdentity with real AWS credentials."""
        try:
            session = self._get_session()
            sts = session.client("sts")
            identity = sts.get_caller_identity()
            return {
                "success": True,
                "account_id": identity.get("Account"),
                "arn": identity.get("Arn"),
                "user_id": identity.get("UserId"),
                "message": f"Successfully authenticated as {identity.get('Arn')}",
                "error": None
            }
        except NoCredentialsError:
            return {
                "success": False,
                "message": "No AWS credentials provided or configured",
                "error": "NoCredentialsError"
            }
        except ClientError as e:
            err_code = e.response.get("Error", {}).get("Code", "ClientError")
            err_msg = e.response.get("Error", {}).get("Message", str(e))
            return {
                "success": False,
                "message": f"AWS Authentication failed [{err_code}]: {err_msg}",
                "error": err_code
            }
        except EndpointConnectionError as e:
            return {
                "success": False,
                "message": f"Cannot reach AWS endpoint: {str(e)}",
                "error": "EndpointConnectionError"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Unexpected error during AWS auth test: {str(e)}",
                "error": str(type(e).__name__)
            }

    def get_regions(self) -> List[str]:
        """Discovers all enabled EC2 regions."""
        try:
            session = self._get_session()
            ec2 = session.client("ec2", region_name="us-east-1")
            response = ec2.describe_regions(AllRegions=False)
            return sorted([r["RegionName"] for r in response.get("Regions", [])])
        except Exception as e:
            # Fallback list of common AWS regions if read fails
            return [
                "us-east-1", "us-east-2", "us-west-1", "us-west-2",
                "eu-west-1", "eu-central-1", "eu-west-3", "ap-southeast-1",
                "ap-northeast-1", "ap-south-1"
            ]

    def get_vpcs(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists VPCs in the selected region."""
        region = region or self.region_name
        try:
            session = self._get_session()
            ec2 = session.client("ec2", region_name=region)
            resp = ec2.describe_vpcs()
            vpcs = []
            for v in resp.get("Vpcs", []):
                vpc_id = v.get("VpcId")
                cidr = v.get("CidrBlock")
                is_default = v.get("IsDefault", False)
                name = vpc_id
                for tag in v.get("Tags", []):
                    if tag.get("Key") == "Name":
                        name = tag.get("Value")
                        break
                vpcs.append({
                    "id": vpc_id,
                    "name": name,
                    "cidr_block": cidr,
                    "is_default": is_default,
                    "state": v.get("State", "available")
                })
            return vpcs
        except Exception as e:
            raise RuntimeError(f"Failed to discover VPCs in {region}: {str(e)}")

    def get_subnets(self, vpc_id: str, region: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists subnets in the given VPC."""
        region = region or self.region_name
        try:
            session = self._get_session()
            ec2 = session.client("ec2", region_name=region)
            resp = ec2.describe_subnets(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])
            subnets = []
            for s in resp.get("Subnets", []):
                s_id = s.get("SubnetId")
                name = s_id
                for tag in s.get("Tags", []):
                    if tag.get("Key") == "Name":
                        name = tag.get("Value")
                        break
                subnets.append({
                    "id": s_id,
                    "name": name,
                    "vpc_id": vpc_id,
                    "cidr_block": s.get("CidrBlock"),
                    "availability_zone": s.get("AvailabilityZone"),
                    "available_ips": s.get("AvailableIpAddressCount", 0),
                    "map_public_ip": s.get("MapPublicIpOnLaunch", False),
                    "state": s.get("State", "available")
                })
            return subnets
        except Exception as e:
            raise RuntimeError(f"Failed to discover subnets for VPC {vpc_id}: {str(e)}")

    def get_security_groups(self, vpc_id: str, region: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists security groups for the given VPC."""
        region = region or self.region_name
        try:
            session = self._get_session()
            ec2 = session.client("ec2", region_name=region)
            resp = ec2.describe_security_groups(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])
            sgs = []
            for sg in resp.get("SecurityGroups", []):
                sgs.append({
                    "id": sg.get("GroupId"),
                    "name": sg.get("GroupName"),
                    "description": sg.get("Description"),
                    "vpc_id": sg.get("VpcId"),
                    "inbound_rules_count": len(sg.get("IpPermissions", [])),
                })
            return sgs
        except Exception as e:
            raise RuntimeError(f"Failed to discover security groups for VPC {vpc_id}: {str(e)}")

    def list_s3_buckets(self) -> List[str]:
        """Lists accessible S3 buckets."""
        try:
            session = self._get_session()
            s3 = session.client("s3")
            resp = s3.list_buckets()
            return [b["Name"] for b in resp.get("Buckets", [])]
        except Exception as e:
            return []

    def find_compatible_ami(self, os_name: str, region: Optional[str] = None) -> Optional[str]:
        """Finds an official compatible base AMI for the specified OS family."""
        region = region or self.region_name
        session = self._get_session()
        ec2 = session.client("ec2", region_name=region)
        os_lower = (os_name or "").lower()

        filters = []
        if "debian" in os_lower:
            filters = [
                {"Name": "name", "Values": ["debian-12-amd64-*", "debian-13-amd64-*"]},
                {"Name": "owner-id", "Values": ["136693071363"]}
            ]
        elif "ubuntu" in os_lower:
            filters = [
                {"Name": "name", "Values": ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-*", "ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-*"]},
                {"Name": "owner-id", "Values": ["099720109477"]}
            ]
        else:
            filters = [
                {"Name": "name", "Values": ["al2023-ami-*-kernel-6.1-x86_64", "debian-12-amd64-*"]},
            ]

        try:
            resp = ec2.describe_images(Filters=filters)
            images = resp.get("Images", [])
            if images:
                sorted_imgs = sorted(images, key=lambda x: x.get("CreationDate", ""), reverse=True)
                return sorted_imgs[0]["ImageId"]
        except Exception:
            pass

        # Try fallback general search
        try:
            resp = ec2.describe_images(
                Filters=[
                    {"Name": "name", "Values": ["debian-12-amd64-*", "ubuntu/images/*-amd64-*"]},
                    {"Name": "state", "Values": ["available"]}
                ]
            )
            images = resp.get("Images", [])
            if images:
                sorted_imgs = sorted(images, key=lambda x: x.get("CreationDate", ""), reverse=True)
                return sorted_imgs[0]["ImageId"]
        except Exception:
            pass
        return None

