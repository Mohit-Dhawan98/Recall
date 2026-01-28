from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import articles, auth, search, graph, tags, read_later
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Recall API",
    description="Your second brain for everything you read",
    version="1.0.0"
)

# CORS middleware - allow all origins for self-hosted setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(articles.router)
app.include_router(search.router)
app.include_router(graph.router)
app.include_router(tags.router)
app.include_router(read_later.router)


@app.get("/")
async def root():
    return {
        "name": "Recall API",
        "version": "1.0.0",
        "description": "Your second brain for everything you read"
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
