from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from fastapi import UploadFile

class UserBase(BaseModel):
    email: str # Use EmailStr for email validation
    username: Optional[str] # Username is now a required field for UserBase
    phone_number: Optional[str] = None # Optional phone number
    address: Optional[str] = None # Optional address
    is_active: Optional[bool] = True # Include is_active for consistency, default to True

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    class Config:
        orm_mode = True

class TenantBase(BaseModel):
    id: int
    name: str
    created_at: datetime
    fb_url: Optional[str]
    insta_url: Optional[str]
    class Config:
        orm_mode = True

class TenantUpdate(BaseModel):
    name: Optional[str] = None  # Make name optional for updates
    fb_url: Optional[str] = None
    insta_url: Optional[str] = None

class TenantCreate(BaseModel):
    name: str
    fb_url: Optional[str]
    insta_url: Optional[str]

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class KnowledgeBaseFileCreate(BaseModel):
    pass

class KnowledgeBaseFileResponse(BaseModel):
    id: str
    filename: Optional[str]
    stored_filename: Optional[str]
    file_path: Optional[str]
    file_type: str
    url: Optional[str]
    tenant_id: int
    uploaded_by: Optional[int]
    created_at: datetime
    class Config:
        orm_mode = True

class DatabaseBase(BaseModel):
    name: str
    description: Optional[str] = None

class DatabaseCreate(DatabaseBase):
    pass

class DatabaseResponse(DatabaseBase):
    id: int
    tenant_id: int
    created_at: datetime
    class Config:
        orm_mode = True


class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str