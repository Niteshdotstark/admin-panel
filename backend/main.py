from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db, engine, Base
from models import User, Tenant, KnowledgeBaseFile
from schemas import (
    UserCreate, UserResponse, TenantCreate, TenantBase,TenantUpdate,
    KnowledgeBaseFileResponse, DatabaseCreate, DatabaseResponse, TokenResponse
)
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Optional
import os
import shutil
import uuid

app = FastAPI()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security configurations
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "your_secret_key"  # Replace with a secure key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Directory to store uploaded files
UPLOAD_DIR = "./uploads/knowledge_base"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Create tables on startup
@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)

# Dependency to get current user from JWT token
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# Create JWT token
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Endpoint to create a user (No auth)
# Endpoint to create a user (No auth) - MODIFIED
@app.post("/users/", response_model=UserResponse, status_code=status.HTTP_201_CREATED) # Added status_code
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if email already registered
    db_user_email = db.query(User).filter(User.email == user.email).first()
    if db_user_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check if username already taken (if you want it unique)
    db_user_username = db.query(User).filter(User.username == user.username).first()
    if db_user_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    hashed_password = pwd_context.hash(user.password)
    new_user = User(
        email=user.email,
        hashed_password=hashed_password,
        username=user.username, # Assign new field
        phone_number=user.phone_number, # Assign new field
        address=user.address, # Assign new field
        is_active=user.is_active # Assign is_active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# Endpoint for user login (No auth) - MODIFIED to return UserResponse
@app.post("/login/", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first() # form_data.username is the email
    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    # Include user details in the response
    # Ensure UserResponse can handle all fields from the User model
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        phone_number=user.phone_number,
        address=user.address,
        is_active=user.is_active
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }

# Endpoint to create a tenant (Auth required)
@app.post("/tenants/", response_model=TenantBase)
async def create_tenant(tenant: TenantCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
      print(f"Creating tenant with name: {tenant.name}")
      print(f"Current user ID: {current_user.id}")
      existing_tenant = db.query(Tenant).filter(Tenant.name == tenant.name).first()
      if existing_tenant:
          print("Tenant name already exists")
          raise HTTPException(status_code=400, detail="Tenant name already exists")
      new_tenant = Tenant(
          name=tenant.name,
          fb_url=tenant.fb_url or None,
          insta_url=tenant.insta_url or None,
          creator_id=current_user.id
      )
      db.add(new_tenant)
      db.commit()
      db.refresh(new_tenant)
      print(f"Tenant created with ID: {new_tenant.id}")
      return new_tenant

@app.put("/tenants/{tenant_id}/", response_model=TenantBase)
async def update_tenant(
      tenant_id: int,
      tenant_update: TenantUpdate,
      db: Session = Depends(get_db),
      current_user: User = Depends(get_current_user)
  ):
      print(f"Updating tenant ID: {tenant_id}")
      tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
      if not tenant:
          print("Tenant not found")
          raise HTTPException(status_code=404, detail="Tenant not found")
      if tenant.creator_id != current_user.id:
          print("User not authorized to update tenant")
          raise HTTPException(status_code=403, detail="Not authorized to update this tenant")
      if tenant_update.name:
          existing_tenant = db.query(Tenant).filter(Tenant.name == tenant_update.name, Tenant.id != tenant_id).first()
          if existing_tenant:
              print("Tenant name already exists")
              raise HTTPException(status_code=400, detail="Tenant name already exists")
          tenant.name = tenant_update.name
      if tenant_update.fb_url is not None:
          tenant.fb_url = tenant_update.fb_url
      if tenant_update.insta_url is not None:
          tenant.insta_url = tenant_update.insta_url
      db.commit()
      db.refresh(tenant)
      print(f"Tenant updated: {tenant.name}")
      return tenant

# Endpoint to list tenants for the current user (Auth required)
@app.get("/tenants/", response_model=list[TenantBase])
async def read_tenants(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenants = db.query(Tenant).filter(Tenant.creator_id == current_user.id).all()
    return tenants

# Endpoint to add a knowledge base item (file or URL) to a tenant (Auth required)
@app.post("/tenants/{tenant_id}/knowledge_base_items/", response_model=KnowledgeBaseFileResponse)
async def create_knowledge_base_item(
    tenant_id: int,
    category: str = Form(...),  # "file", "url", "database"
    file: UploadFile = File(None),
    url: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if category == "url":
        if not url:
            raise HTTPException(status_code=400, detail="URL must be provided for URL category")
        kb_file = KnowledgeBaseFile(
            filename=None,
            stored_filename=None,
            file_path=None,
            file_type="url",
            category="url",
            url=url,
            tenant_id=tenant_id,
            uploaded_by=current_user.id
        )
    elif category in ["file", "database"]:
        if not file:
         raise HTTPException(status_code=400, detail="File must be provided for File or Database category")
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        user_dir = f"{UPLOAD_DIR}/{current_user.email}"
        tenant_dir = f"{user_dir}/{tenant.name}"
        os.makedirs(tenant_dir, exist_ok=True)
        file_location = f"{tenant_dir}/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        kb_file = KnowledgeBaseFile(
            filename=file.filename,
            stored_filename=file.filename,
            file_path=file_location,
            file_type=file.content_type,
            category=category,
            url=None,
            tenant_id=tenant_id,
            uploaded_by=current_user.id
    )
    else:
        raise HTTPException(status_code=400, detail="Invalid category")

    db.add(kb_file)
    db.commit()
    db.refresh(kb_file)
    return kb_file

# Endpoint to list knowledge base items for a tenant (Auth required)
@app.get("/tenants/{tenant_id}/knowledge_base_items/", response_model=list[KnowledgeBaseFileResponse])
async def list_knowledge_base_items(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    items = db.query(KnowledgeBaseFile).filter(KnowledgeBaseFile.tenant_id == tenant_id).all()
    return items
