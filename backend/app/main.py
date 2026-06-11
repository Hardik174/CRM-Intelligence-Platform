import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.endpoints import router as api_router
from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.services.rag import seed_knowledge_base_if_empty

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered CRM Intelligence Platform & Real-Time Email Operations System",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router)

# Custom Global Exception Handler for consistent error envelopes
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # If detail is already a dict with error_code, return it
    if isinstance(exc.detail, dict) and "error_code" in exc.detail:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": f"HTTP_{exc.status_code}",
            "message": exc.detail,
            "details": {}
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected server error occurred.",
            "details": str(exc)
        }
    )

@app.on_event("startup")
async def on_startup():
    logger.info("Starting up CRM Intelligence Platform...")
    # Initialize DB (create vector extension and tables)
    try:
        init_db()
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}. Worker might be booting.")
        
    # Seed Knowledge Base
    async with AsyncSessionLocal() as db:
        try:
            await seed_knowledge_base_if_empty(db)
        except Exception as e:
            logger.error(f"Failed to seed knowledge base: {e}")

@app.get("/")
def read_root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs"
    }
