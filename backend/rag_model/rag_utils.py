import os
from langchain_aws import ChatBedrock
from langchain_community.document_loaders import PyPDFLoader, CSVLoader, TextLoader, Docx2txtLoader, UnstructuredMarkdownLoader, JSONLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.prompts import ChatPromptTemplate
# from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.prompts import HumanMessagePromptTemplate, ChatPromptTemplate, MessagesPlaceholder
from langchain_core.documents import Document
from langchain.memory import ConversationBufferMemory
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from langchain_core.documents import Document
import glob
import requests
from urllib.parse import urlparse, urljoin
import scrapy
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings
import tempfile
import json
import boto3
from bs4 import BeautifulSoup
import re
import time
from collections import deque
import tldextract


# Configuration
CHROMA_DIR = "../chroma_db"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
LLM_MODEL = "meta.llama3-8b-instruct-v1:0"
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "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")
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
CRAWL_DEPTH = 3  # Maximum depth for recursive crawling
ALLOWED_DOMAINS = []  # Optional: Restrict crawling to specific domains
HISTORY_DIR = "./uploads/conversation_history"

os.makedirs(CHROMA_DIR, exist_ok=True)
os.makedirs(HISTORY_DIR, exist_ok=True)

embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
vectorstore = Chroma(
    persist_directory=CHROMA_DIR,
    embedding_function=embeddings,
    collection_name="knowledge_base"
)

CONVERSATIONAL_QA_PROMPT = ChatPromptTemplate.from_messages([
    SystemMessage(content="""You are an AI assistant designed to be helpful, friendly, and knowledgeable. Your primary role is to answer questions based on the provided context, but you are also capable of engaging in general conversation.
When a user asks a question, please follow these rules:
1. If the user's input is a simple greeting** (e.g., "Hello," "Hi," "Hey," "How are you?"), respond with a friendly, human-like greeting. Do not use the provided context for these types of questions. Your response should be short, friendly, and under 100 characters. For example: "Hello! It's great to chat with you. How can I help today?"
2. If the user's input is a question that requires information, you MUST provide an answer that is less than 1000 characters long.**
   This is a strict and non-negotiable character limit. You must prioritize this rule above all else.
   To meet this limit, you should provide a concise, single-paragraph summary of the key information.
   Do not include every detail from the context. Instead, extract the most important points to form a focused and informative response.
    The answer should be at least 100 characters long to avoid being too brief.
3. If the question is about a topic not covered in the context, you may use your general knowledge, but you may start your response with "Per my knowledge..." and then phrase it as a general understanding or a common fact or do not use any of this just give best possible information.
4. Use the conversation history, if available, to provide context-aware responses when relevant.
5. Maintain a polite and engaging tone throughout the conversation.
6. Keep your answers comprehensive and detailed, avoiding unnecessary brevity."""),
    MessagesPlaceholder(variable_name="chat_history", optional=True),
    HumanMessagePromptTemplate.from_template(
        """Context:\n{context}\n\nQuestion: {input}\n\nAnswer:"""
    )
])

class WebsiteCrawler(scrapy.Spider):
    name = "website_crawler"
    custom_settings = {
        "DOWNLOAD_HANDLERS": {
            "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
            "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
        },
        "TWISTED_REACTOR": "twisted.internet.asyncioreactor.AsyncioSelectorReactor",
        "PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT": 60000,
        "PLAYWRIGHT_BROWSER_TYPE": "chromium",
        "PLAYWRIGHT_LAUNCH_OPTIONS": {"headless": True},
        "ROBOTSTXT_OBEY": False,  # Disable for testing
        "USER_AGENT": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        "LOG_LEVEL": "DEBUG",
        "CONCURRENT_REQUESTS": 1,
        "DOWNLOAD_DELAY": 2,
        "DEPTH_LIMIT": CRAWL_DEPTH,
    }

    def __init__(self, start_urls, allowed_domains=None, tenant_id=None, output_file=None):
        super().__init__()
        self.start_urls = start_urls
        self.allowed_domains = allowed_domains or []
        self.tenant_id = tenant_id
        self.output_file = output_file
        self.documents = []

    def parse(self, response):
        print(f"Crawled {response.url}, status: {response.status}")
        yield {
            "playwright": True,
            "playwright_page_methods": [
                {"method": "wait_for_timeout", "args": [3000]},
                {"method": "evaluate", "args": ["document.body.innerText"]},
            ],
        }
        text = response.text
        text = " ".join([t.strip() for t in text.split() if t.strip()])
        print(f"Text length: {len(text)}")
        if text:
            doc = Document(
                page_content=text,
                metadata={"tenant_id": self.tenant_id, "source": response.url}
            )
            self.documents.append(doc)
        for href in response.css("a::attr(href)").getall():
            if href:
                yield response.follow(href, callback=self.parse)

    def closed(self, reason):
        try:
            with open(self.output_file, "w", encoding="utf-8") as f:
                json.dump([{"page_content": doc.page_content, "metadata": doc.metadata} for doc in self.documents], f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error writing JSON file: {e}")

def load_urls_from_file(file_path: str) -> list:
    try:
        with open(file_path, 'r') as f:
            urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        return urls
    except Exception as e:
        print(f"Error reading URLs from {file_path}: {e}")
        return []


def crawl_url_with_selenium(url: str, tenant_id: int) -> Document:
    """Crawls a single URL using Selenium and returns a LangChain Document."""
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')  # Run in headless mode
    options.add_argument('--log-level=3') # Suppress logs
    
    # Use a longer timeout for page load
    options.page_load_strategy = 'eager'
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    try:
        print(f"Crawling {url} with Selenium...")
        driver.get(url)
        # Wait until the body element is present, indicating the page has loaded
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
        
        # Get the page source and clean it up
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')
        
        # Extract text from the body, and exclude script/style tags
        for script_or_style in soup(['script', 'style', 'header', 'nav', 'footer']):
            script_or_style.decompose()
        
        text = soup.body.get_text(separator=' ', strip=True)
        
        return Document(page_content=text, metadata={"tenant_id": tenant_id, "source": url})
    except Exception as e:
        print(f"Error crawling {url}: {e}")
        return None
    finally:
        driver.quit()

def crawl_urls_with_selenium(urls: list, tenant_id: int) -> list[Document]:
    """Crawl a list of URLs using Selenium and return a list of LangChain Documents."""
    documents = []
    
    for url in urls:
        doc = crawl_url_with_selenium(url, tenant_id)
        if doc:
            documents.append(doc)
    
    return documents


def recursive_crawl_with_selenium(start_urls: list, tenant_id: int, max_depth: int = 2) -> list[Document]:
    """
    Recursively crawls a website starting from a list of URLs using Selenium.
    
    Args:
        start_urls: A list of starting URLs.
        tenant_id: The tenant ID for metadata.
        max_depth: The maximum crawl depth (0 for start pages only, 1 for start + one level of links, etc.).
    
    Returns:
        A list of LangChain Document objects.
    """
    if not start_urls:
        return []

    visited_urls = set()
    documents = []
    
    # Queue stores tuples of (url, depth)
    queue = deque([(url, 0) for url in start_urls])

    base_domain = urlparse(start_urls[0]).netloc
    
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--log-level=3')
    options.page_load_strategy = 'eager'
    
    try:
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    except Exception as e:
        print(f"Failed to initialize WebDriver: {e}")
        return []

    try:
        while queue:
            current_url, current_depth = queue.popleft()
            
            if current_url in visited_urls or current_depth > max_depth:
                continue

            print(f"Crawling URL: {current_url} at depth {current_depth}")
            visited_urls.add(current_url)

            try:
                driver.get(current_url)
                WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
                
                # Get the page source and process with BeautifulSoup
                page_source = driver.page_source
                soup = BeautifulSoup(page_source, 'html.parser')
                
                # Clean up and extract text
                for script_or_style in soup(['script', 'style', 'header', 'nav', 'footer']):
                    script_or_style.decompose()
                
                text = soup.body.get_text(separator=' ', strip=True)
                
                documents.append(Document(page_content=text, metadata={"tenant_id": tenant_id, "source": current_url}))

                # Find all links and add to the queue for next depth level
                if current_depth < max_depth:
                    for link in soup.find_all('a', href=True):
                        href = link['href']
                        absolute_url = urljoin(current_url, href).split('#')[0]
                        parsed_url = urlparse(absolute_url)

                        if parsed_url.netloc == base_domain and absolute_url not in visited_urls and is_valid_url(absolute_url):
                            queue.append((absolute_url, current_depth + 1))
                            visited_urls.add(absolute_url) # Add to visited to prevent duplicates in queue
            
            except Exception as e:
                print(f"Error crawling {current_url}: {e}")

    finally:
        driver.quit()
        
    return documents

def is_valid_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False
        return parsed.scheme in ["http", "https"]
    except:
        return False

def clean_text(text: str) -> str:
    """Clean and normalize text content"""
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove non-printable characters
    text = re.sub(r'[^\x00-\x7F]+', ' ', text)
    return text.strip()


def load_conversation_history(tenant_id: int, user_id: str) -> list:
    """Load conversation history for a user from a JSON file."""
    history_file = os.path.join(HISTORY_DIR, str(tenant_id), f"{user_id}.json")
    if os.path.exists(history_file):
        try:
            with open(history_file, "r", encoding="utf-8") as f:
                history = json.load(f)
                # Convert JSON messages to LangChain message objects
                return [
                    HumanMessage(content=msg["human"]) if msg["type"] == "human" else AIMessage(content=msg["ai"])
                    for msg in history
                ]
        except Exception as e:
            print(f"Error loading conversation history for tenant {tenant_id}, user {user_id}: {e}")
    return []

def save_conversation_history(tenant_id: int, user_id: str, history: list):
    """Save conversation history for a user to a JSON file."""
    history_dir = os.path.join(HISTORY_DIR, str(tenant_id))
    os.makedirs(history_dir, exist_ok=True)
    history_file = os.path.join(history_dir, f"{user_id}.json")
    try:
        # Convert LangChain messages to JSON-serializable format
        history_data = [
            {"type": "human", "human": msg.content} if isinstance(msg, HumanMessage) else {"type": "ai", "ai": msg.content}
            for msg in history
        ]
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump(history_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving conversation history for tenant {tenant_id}, user {user_id}: {e}")


def index_tenant_files(tenant_id: int, urls: list = None):
    """Index all supported files (PDF, CSV, DOCX, TXT, MD, JSON) and URLs for a given tenant."""
    tenant_dir = f"./uploads/knowledge_base/{tenant_id}"
    total_chunks = 0
    supported_extensions = {".pdf", ".csv", ".docx", ".txt", ".md", ".json"}

    # Process local files if directory exists
    if os.path.exists(tenant_dir):
        print(f"Processing files in directory: {tenant_dir}")
        for file_path in glob.glob(os.path.join(tenant_dir, "*")):
            _, ext = os.path.splitext(file_path)
            if ext.lower() not in supported_extensions:
                print(f"Skipping unsupported file: {file_path}")
                continue

            print(f"Processing: {file_path} for tenant {tenant_id}")
            try:
                if ext.lower() == ".pdf":
                    loader = PyPDFLoader(file_path)
                elif ext.lower() == ".csv":
                    loader = CSVLoader(file_path)
                elif ext.lower() == ".docx":
                    loader = Docx2txtLoader(file_path)
                elif ext.lower() == ".txt":
                    loader = TextLoader(file_path)
                elif ext.lower() == ".md":
                    loader = UnstructuredMarkdownLoader(file_path)
                elif ext.lower() == ".json":
                    loader = JSONLoader(file_path, jq_schema='.', text_content=False)
                else:
                    continue

                documents = loader.load()
                if not documents:
                    print(f"No documents loaded from {file_path}")
                    continue

                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=CHUNK_SIZE,
                    chunk_overlap=CHUNK_OVERLAP
                )
                chunks = text_splitter.split_documents(documents)
                for chunk in chunks:
                    chunk.metadata["tenant_id"] = tenant_id
                    chunk.metadata["source"] = file_path
                vectorstore.add_documents(chunks)
                total_chunks += len(chunks)
                print(f"Added {len(chunks)} chunks from {file_path}")
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
    else:
        print(f"Directory for tenant {tenant_id} does not exist. Skipping file processing.")

    # Process URLs (from file or provided list)
    all_urls = []
    if os.path.exists(tenant_dir):
        url_file = os.path.join(tenant_dir, "urls.txt")
        if os.path.exists(url_file):
            all_urls.extend(load_urls_from_file(url_file))
    if urls:
        all_urls.extend(urls)

    # Filter valid URLs
    valid_urls = [url for url in all_urls if is_valid_url(url)]
    if not valid_urls:
        print(f"No valid URLs provided or found for tenant {tenant_id}")
    else:
        print(f"Crawling URLs for tenant {tenant_id}: {valid_urls}")
        try:
            documents = recursive_crawl_with_selenium(valid_urls, tenant_id, max_depth=CRAWL_DEPTH)
            if documents:
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=CHUNK_SIZE,
                    chunk_overlap=CHUNK_OVERLAP
                )
                chunks = text_splitter.split_documents(documents)
                for chunk in chunks:
                    chunk.metadata["tenant_id"] = tenant_id
                    chunk.metadata["source"] = chunk.metadata.get("source", "unknown_url")
                vectorstore.add_documents(chunks)
                total_chunks += len(chunks)
                print(f"Added {len(chunks)} chunks from URLs")
            else:
                print("No content loaded from URLs")
        except Exception as e:
            print(f"Error crawling URLs: {e}")

    print(f"Total chunks added for tenant {tenant_id}: {total_chunks}")
    return total_chunks

def get_rag_chain_modern(tenant_id: int, user_id: str):
    """Create modern RAG chain for a specific tenant and user with conversation memory."""
    print(f"Creating modern RAG chain for tenant {tenant_id}, user {user_id}")
    retriever = vectorstore.as_retriever(
        search_kwargs={"filter": {"tenant_id": tenant_id}, "k": 3}
    )
    bedrock_llm = ChatBedrock(
        model_id=LLM_MODEL,
        region_name="ap-south-1",
        model_kwargs={
            "temperature": 0.5,
            "max_tokens": 400
        }
    )

    # Initialize conversation memory for the user
    memory = ConversationBufferMemory(
        memory_key="chat_history",
        return_messages=True,
        input_key="input",
        output_key="answer"
    )
    # Load previous conversation history
    memory.chat_memory.messages = load_conversation_history(tenant_id, user_id)

    # Create the RAG chain with memory
    question_answer_chain = create_stuff_documents_chain(bedrock_llm, CONVERSATIONAL_QA_PROMPT)
    retrieval_chain = create_retrieval_chain(retriever, question_answer_chain)
    
    # Wrap the chain to save memory after each invocation
    def chain_with_memory(input_dict):
        result = retrieval_chain.invoke(input_dict)
        # Save the new question and answer to memory
        memory.save_context(
            inputs={"input": input_dict["input"]},
            outputs={"answer": result["answer"]}
        )
        save_conversation_history(tenant_id, user_id, memory.chat_memory.messages)
        return result

    return chain_with_memory


def answer_question_modern(question: str, tenant_id: int, user_id: str):
    """Answer question using modern RAG for specific tenant and user."""
    print(f"Answering for tenant {tenant_id}, user {user_id}: {question}")
    chain = get_rag_chain_modern(tenant_id, user_id)
    result = chain({"input": question})
    print("Retrieved context:", [doc.page_content for doc in result["context"]])
    print("Answer generated")
    return {
        "answer": result["answer"],
        "sources": [doc.metadata["source"] for doc in result["context"]]
    }

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage:")
        print("To index tenant files/URLs: python rag_utils_modern.py index <tenant_id> [url1 url2 ...]")
        print("To answer a question: python rag_utils_modern.py query <tenant_id> <question>")
        sys.exit(1)

    mode = sys.argv[1]
    if mode == "index":
        if len(sys.argv) < 3:
            print("Usage: python rag_utils_modern.py index <tenant_id> [url1 url2 ...]")
            sys.exit(1)
        tenant_id = int(sys.argv[2])
        urls = sys.argv[3:] if len(sys.argv) > 3 else None
        index_tenant_files(tenant_id, urls)
    elif mode == "query":
        if len(sys.argv) < 4:
            print("Usage: python rag_utils_modern.py query <tenant_id> <question>")
            sys.exit(1)
        tenant_id = int(sys.argv[2])
        question = " ".join(sys.argv[3:])
        response = answer_question_modern(question, tenant_id)
        print("\nFINAL ANSWER (Modern Chain):")
        print(response["answer"])
        print("\nSOURCES (Modern Chain):")
        for source in response["sources"]:
            print(f"- {source}")
    else:
        print("Invalid mode. Use 'index' or 'query'.")