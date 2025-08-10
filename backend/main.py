from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Request, Response, BackgroundTasks
from urllib.parse import unquote
import httpx
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db, engine, Base
from models import User, Tenant, KnowledgeBaseFile
from rag_model.rag_utils import index_tenant_files
from schemas import (
    UserCreate, UserResponse, TenantCreate, TenantBase,TenantUpdate,
    KnowledgeBaseFileResponse, DatabaseCreate, DatabaseResponse, TokenResponse, ChatRequest, ChatResponse
)
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from rag_model.rag_utils import answer_question_modern
from typing import Optional
import os
import shutil
import uuid
import asyncio
import re


app = FastAPI(root_path="/api")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000","http://ec2-65-2-142-83.ap-south-1.compute.amazonaws.com//","https://65.2.142.83/","http://65.2.142.83/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "your_secret_key"  # Replace with a secure key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
VERIFY_TOKEN = "chatbottoken@3420"
FACEBOOK_ACCESS_TOKEN = "EAAKgyth24vEBPCOP16Fw4cnnGW0t9N6qoeSCtp5VlWMzSXlnsZCEUM5YWtFzQqCq2BZChkF3FKD6tszoybJ21KbpDecvga0Xr0WGlXMChSICVB9KDfHFmnT0rrUVs3DkOJlKtk5OZCq55zkls1FfSpJ0vRnnHGVAln5Y1bRqnNX3u5ZCqISAeil3X4Yc6N2XnmuJAwZDZD"  # Replace with your actual access token
TENANT_ID = 1
INSTAGRAM_ACCESS_TOKEN = "IGAAbUoqM5z9pBZAE14ejFwTHkwQ2Vjb3JzSkZAuRG5BUkVZAdTkyTENnQ3RiSVFwTFZArNjhpNjNwNDhZAT1JlVjJ5VlE0UXlZAbFZAZAYkMyMDYxdmM0RGdHYTkxZATVqZADJPOXp4d2U2VU4ydHpydTdScm1ONDZA6eUxselItMWV1MjdLNAZDZD"

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

@app.post("/tenants/", response_model=TenantBase, status_code=status.HTTP_201_CREATED)
async def create_tenant(tenant: TenantCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if the user already has a tenant
    if current_user.created_tenants:
        raise HTTPException(status_code=400, detail="User can only create one tenant.")
    
    existing_tenant = db.query(Tenant).filter(Tenant.name == tenant.name).first()
    if existing_tenant:
        raise HTTPException(status_code=400, detail="Tenant name already exists")
        
    new_tenant = Tenant(
        name=tenant.name,
        fb_url=tenant.fb_url,
        insta_url=tenant.insta_url,
        creator_id=current_user.id
    )
    db.add(new_tenant)
    db.commit()
    db.refresh(new_tenant)
    return new_tenant
# Endpoint to create a tenant (Auth required)
# @app.post("/tenants/", response_model=TenantBase)
# async def create_tenant(tenant: TenantCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
#       print(f"Creating tenant with name: {tenant.name}")
#       print(f"Current user ID: {current_user.id}")
#       existing_tenant = db.query(Tenant).filter(Tenant.name == tenant.name).first()
#       if existing_tenant:
#           print("Tenant name already exists")
#           raise HTTPException(status_code=400, detail="Tenant name already exists")
#       new_tenant = Tenant(
#           name=tenant.name,
#           fb_url=tenant.fb_url or None,
#           insta_url=tenant.insta_url or None,
#           creator_id=current_user.id
#       )
#       db.add(new_tenant)
#       db.commit()
#       db.refresh(new_tenant)
#       print(f"Tenant created with ID: {new_tenant.id}")
#       return new_tenant

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
@app.post("/tenants/{tenant_id}/knowledge_base_items/", response_model=KnowledgeBaseFileResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base_item(
    background_tasks: BackgroundTasks,
    tenant_id: int,
    category: str = Form(...),
    file: UploadFile = File(None),
    url: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if the tenant belongs to the current user
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant or tenant.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to add items to this tenant's knowledge base")

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
        
        # New file path structure: ./uploads/knowledge_base/{tenant_id}/{filename}
        tenant_dir = os.path.join(UPLOAD_DIR, str(tenant.id))
        os.makedirs(tenant_dir, exist_ok=True)
        
        # Generate a unique filename to avoid collisions
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        file_location = os.path.join(tenant_dir, unique_filename)
        
        with open(file_location, "wb") as file_object:
            shutil.copyfileobj(file.file, file_object)
            
        kb_file = KnowledgeBaseFile(
            filename=file.filename,
            stored_filename=unique_filename,
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

    background_tasks.add_task(index_tenant_files, tenant_id)
    return kb_file


@app.post("/tenants/{tenant_id}/knowledge_base_items/add_url/", status_code=status.HTTP_201_CREATED)
async def add_url_to_file_and_db(
    background_tasks: BackgroundTasks,
    tenant_id: int,
    url: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if the tenant belongs to the current user
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant or tenant.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to add items to this tenant's knowledge base")

    # Save to database
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
    db.add(kb_file)
    db.commit()
    db.refresh(kb_file)

    # Save to url.txt
    tenant_dir = os.path.join(UPLOAD_DIR, str(tenant_id))
    os.makedirs(tenant_dir, exist_ok=True)
    file_location = os.path.join(tenant_dir, "urls.txt")
    try:
        with open(file_location, "a") as url_file:
            url_file.write(url + "\n")
    except IOError as e:
        # Log error but don't fail since it's saved to db
        print(f"Failed to write to url.txt: {e}")

    background_tasks.add_task(index_tenant_files, tenant_id)

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


# Dependency to get API key from headers
# async def get_api_key(api_key: str = Header(...)):
#     if not api_key:
#         raise HTTPException(status_code=400, detail="API key is missing")
#     return api_key


# Placeholder for the RAG endpoint
# Replace this entire function in your FastAPI app with the corrected version below

@app.post("/tenants/{tenant_id}/chat", response_model=ChatResponse)
async def chat_with_tenant_kb(
    tenant_id: int,
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant or tenant.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this tenant's knowledge base")

    # Call your RAG model with the provided message and tenant_id
    try:
        response_data = answer_question_modern(chat_request.message, tenant_id,1)
        # Ensure the response_data has 'answer' and 'sources' keys
        return ChatResponse(
            response=response_data.get("answer", "No answer found."),
            sources=response_data.get("sources", [])
        )
    except Exception as e:
        # Handle potential errors from the RAG model
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred while processing the request: {str(e)}")


@app.post("/chatbot/ask", response_model=ChatResponse)
async def ask_chatbot(
    tenant_id: int,
    request: ChatRequest,
    # api_key: str = Depends(get_api_key),
    db: Session = Depends(get_db)
):
    # Process the chatbot request
    response = answer_question_modern(request.message, tenant_id,1)
    return {"response": response["answer"], "sources": response["sources"]}


@app.get("/webhook")
async def verify_webhook(request: Request):
    query_params = dict(request.query_params)
    raw_query = request.url.query  # Capture raw query string
    mode = query_params.get("hub.mode")
    token = unquote(query_params.get("hub.verify_token", ""))
    challenge = query_params.get("hub.challenge")
    headers = dict(request.headers)
    
    print(f"Received: raw_query={raw_query}, query_params={query_params}, headers={headers}")
    
    if mode == "subscribe" and token == VERIFY_TOKEN:
        print(f"✅ Webhook verified for challenge={challenge}")
        return Response(
            content=challenge.encode("utf-8"),  # Ensure UTF-8 encoding
            media_type="text/plain; charset=utf-8",
            status_code=200
        )
    else:
        print(f"❌ Verification failed: mode={mode}, token={token}, expected={VERIFY_TOKEN}")
        return Response(
            content="Invalid verification".encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            status_code=403
        )

# Webhook handler for Facebook and Instagram messages
@app.post("/webhook")
async def handle_webhook(request: Request):
    try:
        data = await request.json()
        print(f"Received payload: {data}")
        
        for entry in data.get("entry", []):
            if data.get("object") == "instagram":
                # Handle Instagram direct messages
                for messaging in entry.get("messaging", []):
                    if messaging.get("message") and messaging.get("message").get("text"):
                        # Skip echo messages (bot's own messages)
                        if messaging.get("message").get("is_self", False) or messaging.get("message").get("is_echo", False):
                            print(f"Skipping echo message from Instagram {messaging.get('sender').get('id')}")
                            continue
                            
                        sender_id = messaging.get("sender").get("id")
                        text = messaging.get("message").get("text")
                        print(f"📩 Instagram {sender_id}: {text}")
                        
                        try:
                            response_data = answer_question_modern(text, TENANT_ID, sender_id)
                            response_text = response_data.get("answer", "No answer found.")
                            # Format the response for structure and clarity
                            response_text = format_response(response_text)
                        except HTTPException as e:
                            if e.status_code == 402:
                                print(f"⚠️ Inference provider credit limit exceeded for Instagram {sender_id}")
                                response_text = "Sorry, I've reached my query limit for now. Please try again later."
                            else:
                                print(f"Error in RAG call: {e}")
                                response_text = "An error occurred. Please try again."
                        
                        # Send the response (split if necessary)
                        await send_reply(sender_id, response_text, INSTAGRAM_ACCESS_TOKEN, "instagram")
            else:
                # Handle Facebook Messenger messages
                for messaging in entry.get("messaging", []):
                    if messaging.get("message") and messaging.get("message").get("text"):
                        # Skip echo messages (bot's own messages)
                        if messaging.get("message").get("is_self", False) or messaging.get("message").get("is_echo", False):
                            print(f"Skipping echo message from Facebook {messaging.get('sender').get('id')}")
                            continue
                            
                        sender_id = messaging.get("sender").get("id")
                        text = messaging.get("message").get("text")
                        print(f"📩 Facebook {sender_id}: {text}")
                        
                        try:
                            response_data = answer_question_modern(text, TENANT_ID, sender_id)
                            response_text = response_data.get("answer", "No answer found.")
                            # Format the response for structure and clarity
                            response_text = format_response(response_text)
                        except HTTPException as e:
                            if e.status_code == 402:
                                print(f"⚠️ Inference provider credit limit exceeded for Facebook {sender_id}")
                                response_text = "Sorry, I've reached my query limit for now. Please try again later."
                            else:
                                print(f"Error in RAG call: {e}")
                                response_text = "An error occurred. Please try again."
                        
                        # Send the response (split if necessary)
                        await send_reply(sender_id, response_text, FACEBOOK_ACCESS_TOKEN, "facebook")
        
        return {"status": "success"}
    except Exception as e:
        print(f"Error: {e}")
        return {"status": "error", "message": str(e)}

def format_response(text: str) -> str:
    """Format the response with structured bullet points, spacing, and breaks."""
    # Split the text into lines for processing
    lines = text.strip().split('\n')
    formatted_lines = []
    current_course = None
    intro = True

    for line in lines:
        line = line.strip()
        # Handle introductory text (before the course list)
        if intro and not re.match(r'^\d+\.\s*\*\*', line):
            formatted_lines.append(line)
            continue
        intro = False

        # Detect course entries (e.g., "1. **Engineering Mathematics-I & II**:")
        course_match = re.match(r'^\d+\.\s*\*\*(.*?)\*\*:(.*)', line)
        if course_match:
            course_name = course_match.group(1).strip()
            description = course_match.group(2).strip()
            if current_course:
                formatted_lines.append("")  # Add spacing between courses
            formatted_lines.append(f"• {course_name}")
            if description:
                formatted_lines.append(f"  - {description}")
            current_course = course_name
        else:
            # Handle continuation of description or notes
            if line and current_course:
                formatted_lines.append(f"  - {line}")
            elif line:
                formatted_lines.append("")  # Add spacing for notes
                formatted_lines.append(line)

    # Join with newlines for proper spacing
    return "\n".join(formatted_lines)

def split_message(text: str, max_length: int) -> list:
    """Split a message into chunks while preserving formatting."""
    lines = text.split('\n')
    chunks = []
    current_chunk = []
    current_length = 0

    for line in lines:
        line_length = len(line) + 1  # +1 for newline
        if current_length + line_length <= max_length:
            current_chunk.append(line)
            current_length += line_length
        else:
            if current_chunk:
                chunks.append("\n".join(current_chunk))
            current_chunk = [line]
            current_length = line_length

    if current_chunk:
        chunks.append("\n".join(current_chunk))

    return chunks

async def send_reply(recipient_id: str, reply_text: str, access_token: str, platform: str):
    # Determine platform-specific settings
    if platform == "instagram":
        base_url = "https://graph.instagram.com/v23.0"
        max_length = 1000  # Instagram DM character limit
    else:  # Assume Facebook
        base_url = "https://graph.facebook.com/v19.0"
        max_length = 2000  # Facebook Messenger character limit

    # Adjust max_length to account for numbering and "..."
    max_length -= 15  # Reserve space for "X/Y: " and "..."
    
    # Split the reply_text into chunks
    messages = split_message(reply_text, max_length)
    print(f"Sending {len(messages)} message(s) to {platform} user {recipient_id}")

    async with httpx.AsyncClient() as client:
        for i, message in enumerate(messages, 1):
            # Add "..." to non-final messages
            if len(messages) > 1:
                suffix = "..." if i < len(messages) else ""
                message_text = f"{i}/{len(messages)}: {message}{suffix}"
            else:
                message_text = message  # No numbering for single message
            
            payload = {
                "recipient": {"id": recipient_id},
                "message": {"text": message_text}
            }
            
            response = await client.post(
                f"{base_url}/me/messages?access_token={access_token}",
                json=payload
            )

            print(f"Send reply {i}/{len(messages)} response: {response.status_code}, {response.text}")

            if not response.is_success:
                print(f"❌ {platform.capitalize()} send failed for message {i}: {response.status_code}, {response.text}")
            else:
                print(f"✅ {platform.capitalize()} reply {i}/{len(messages)} sent")
            # Add a small delay to avoid rate limits
            await asyncio.sleep(1)