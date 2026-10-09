from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from ..database import get_db
from ..models import TargetInfrastructure
from ..schemas import (
    TargetInfraCreate, TargetInfraUpdate, TargetInfraResponse, TestTargetResponse
)
from ..utils.crypto import encrypt_value
from ..services.aws_service import AWSService

router = APIRouter(prefix="/api/targets", tags=["Target Infrastructure"])

def _to_response(t: TargetInfrastructure) -> TargetInfraResponse:
    return TargetInfraResponse(
        id=t.id,
        name=t.name,
        account_alias=t.account_alias,
        access_key_id=t.access_key_id,
        masked_access_key=t.masked_access_key,
        has_secret_key=t.has_secret_key,
        default_region=t.default_region,
        role_arn=t.role_arn,
        description=t.description,
        status=t.status,
        account_id=t.account_id,
        caller_arn=t.caller_arn,
        last_checked=t.last_checked,
        error_message=t.error_message,
        cached_regions=t.cached_regions,
        cached_vpcs=t.cached_vpcs,
        cached_subnets=t.cached_subnets,
        cached_security_groups=t.cached_security_groups,
    )

@router.get("", response_model=List[TargetInfraResponse])
def list_targets(db: Session = Depends(get_db)):
    targets = db.query(TargetInfrastructure).all()
    return [_to_response(t) for t in targets]

@router.post("", response_model=TargetInfraResponse)
def create_target(payload: TargetInfraCreate, db: Session = Depends(get_db)):
    target = TargetInfrastructure(
        name=payload.name,
        account_alias=payload.account_alias,
        access_key_id=payload.access_key_id,
        secret_access_key_enc=encrypt_value(payload.secret_access_key),
        session_token_enc=encrypt_value(payload.session_token),
        default_region=payload.default_region or "us-east-1",
        role_arn=payload.role_arn,
        description=payload.description,
        status="Not Tested"
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return _to_response(target)

@router.get("/{id}", response_model=TargetInfraResponse)
def get_target(id: str, db: Session = Depends(get_db)):
    target = db.query(TargetInfrastructure).filter(TargetInfrastructure.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target infrastructure not found")
    return _to_response(target)

@router.put("/{id}", response_model=TargetInfraResponse)
def update_target(id: str, payload: TargetInfraUpdate, db: Session = Depends(get_db)):
    target = db.query(TargetInfrastructure).filter(TargetInfrastructure.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target infrastructure not found")

    if payload.name is not None: target.name = payload.name
    if payload.account_alias is not None: target.account_alias = payload.account_alias
    if payload.access_key_id is not None: target.access_key_id = payload.access_key_id
    if payload.secret_access_key is not None: target.secret_access_key_enc = encrypt_value(payload.secret_access_key)
    if payload.session_token is not None: target.session_token_enc = encrypt_value(payload.session_token)
    if payload.default_region is not None: target.default_region = payload.default_region
    if payload.role_arn is not None: target.role_arn = payload.role_arn
    if payload.description is not None: target.description = payload.description

    db.commit()
    db.refresh(target)
    return _to_response(target)

@router.delete("/{id}")
def delete_target(id: str, db: Session = Depends(get_db)):
    target = db.query(TargetInfrastructure).filter(TargetInfrastructure.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target infrastructure not found")
    db.delete(target)
    db.commit()
    return {"message": "Target infrastructure deleted successfully"}

@router.post("/{id}/test", response_model=TestTargetResponse)
def test_target(id: str, db: Session = Depends(get_db)):
    target = db.query(TargetInfrastructure).filter(TargetInfrastructure.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target infrastructure not found")

    aws = AWSService(
        access_key_id=target.access_key_id,
        secret_access_key=target.get_decrypted_secret_key(),
        session_token=target.get_decrypted_session_token(),
        region_name=target.default_region,
        role_arn=target.role_arn
    )
    res = aws.test_authentication()
    
    target.last_checked = datetime.utcnow()
    if res["success"]:
        target.status = "Connected"
        target.account_id = res.get("account_id")
        target.caller_arn = res.get("arn")
        target.error_message = None
        # Auto-discover regions
        try:
            target.cached_regions = aws.get_regions()
        except Exception:
            pass
    else:
        target.status = "Failed"
        target.error_message = res.get("message")

    db.commit()
    return res

@router.get("/{id}/regions")
def get_target_regions(id: str, db: Session = Depends(get_db)):
    target = db.query(TargetInfrastructure).filter(TargetInfrastructure.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target infrastructure not found")

    aws = AWSService(
        access_key_id=target.access_key_id,
        secret_access_key=target.get_decrypted_secret_key(),
        session_token=target.get_decrypted_session_token(),
        region_name=target.default_region,
        role_arn=target.role_arn
    )
    regions = aws.get_regions()
    target.cached_regions = regions
    db.commit()
    return {"regions": regions}

@router.get("/{id}/vpcs")
def get_target_vpcs(id: str, region: Optional[str] = None, db: Session = Depends(get_db)):
    target = db.query(TargetInfrastructure).filter(TargetInfrastructure.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target infrastructure not found")

    selected_region = region or target.default_region
    aws = AWSService(
        access_key_id=target.access_key_id,
        secret_access_key=target.get_decrypted_secret_key(),
        session_token=target.get_decrypted_session_token(),
        region_name=selected_region,
        role_arn=target.role_arn
    )
    try:
        vpcs = aws.get_vpcs(selected_region)
        target.cached_vpcs = vpcs
        db.commit()
        return {"vpcs": vpcs}
    except Exception as e:
        # If real AWS call fails because of missing/demo credentials, return empty list or cached list
        if target.cached_vpcs:
            return {"vpcs": target.cached_vpcs, "cached": True, "warning": str(e)}
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{id}/subnets")
def get_target_subnets(id: str, vpc_id: str, region: Optional[str] = None, db: Session = Depends(get_db)):
    target = db.query(TargetInfrastructure).filter(TargetInfrastructure.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target infrastructure not found")

    selected_region = region or target.default_region
    aws = AWSService(
        access_key_id=target.access_key_id,
        secret_access_key=target.get_decrypted_secret_key(),
        session_token=target.get_decrypted_session_token(),
        region_name=selected_region,
        role_arn=target.role_arn
    )
    try:
        subnets = aws.get_subnets(vpc_id, selected_region)
        target.cached_subnets = subnets
        db.commit()
        return {"subnets": subnets}
    except Exception as e:
        if target.cached_subnets:
            return {"subnets": target.cached_subnets, "cached": True, "warning": str(e)}
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{id}/security-groups")
def get_target_sgs(id: str, vpc_id: str, region: Optional[str] = None, db: Session = Depends(get_db)):
    target = db.query(TargetInfrastructure).filter(TargetInfrastructure.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target infrastructure not found")

    selected_region = region or target.default_region
    aws = AWSService(
        access_key_id=target.access_key_id,
        secret_access_key=target.get_decrypted_secret_key(),
        session_token=target.get_decrypted_session_token(),
        region_name=selected_region,
        role_arn=target.role_arn
    )
    try:
        sgs = aws.get_security_groups(vpc_id, selected_region)
        target.cached_security_groups = sgs
        db.commit()
        return {"security_groups": sgs}
    except Exception as e:
        if target.cached_security_groups:
            return {"security_groups": target.cached_security_groups, "cached": True, "warning": str(e)}
        raise HTTPException(status_code=400, detail=str(e))
