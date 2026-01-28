import httpx
from bs4 import BeautifulSoup
from readability import Document
import trafilatura
from urllib.parse import urlparse
import hashlib
import re
from typing import Optional, Tuple
from dataclasses import dataclass


@dataclass
class ExtractedContent:
    url: str
    url_hash: str
    title: str
    content: str
    author: Optional[str]
    source_domain: str
    published_at: Optional[str]
    word_count: int
    content_type: str
    language: str


def normalize_url(url: str) -> str:
    """Normalize URL for deduplication."""
    parsed = urlparse(url)

    # Remove tracking parameters
    tracking_params = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                       'ref', 'fbclid', 'gclid', 'source', 'mc_cid', 'mc_eid']

    if parsed.query:
        params = parsed.query.split('&')
        filtered_params = [p for p in params if p.split('=')[0] not in tracking_params]
        query = '&'.join(filtered_params)
    else:
        query = ''

    # Reconstruct URL without fragment
    normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    if query:
        normalized += f"?{query}"

    # Remove trailing slash
    normalized = normalized.rstrip('/')

    return normalized


def hash_url(url: str) -> str:
    """Create hash of normalized URL."""
    normalized = normalize_url(url)
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


def detect_content_type(url: str, content: str) -> str:
    """Detect content type from URL and content."""
    url_lower = url.lower()

    if 'twitter.com' in url_lower or 'x.com' in url_lower:
        return 'tweet'
    elif 'youtube.com' in url_lower or 'youtu.be' in url_lower:
        return 'video'
    elif url_lower.endswith('.pdf'):
        return 'pdf'
    elif 'arxiv.org' in url_lower:
        return 'research-paper'
    elif 'github.com' in url_lower:
        return 'repository'
    else:
        return 'article'


def estimate_read_time(word_count: int) -> int:
    """Estimate read time in seconds (assuming 200 wpm)."""
    return int((word_count / 200) * 60)


async def fetch_url(url: str) -> Tuple[str, str]:
    """Fetch URL content and return HTML and final URL."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.text, str(response.url)


def extract_with_trafilatura(html: str) -> dict:
    """Extract content using trafilatura."""
    result = trafilatura.extract(
        html,
        include_comments=False,
        include_tables=False,
        output_format='txt',
        with_metadata=True
    )

    if result:
        metadata = trafilatura.extract_metadata(html)
        return {
            'content': result,
            'title': metadata.title if metadata else None,
            'author': metadata.author if metadata else None,
            'date': metadata.date if metadata else None,
        }

    return {}


def extract_with_readability(html: str) -> dict:
    """Extract content using readability-lxml."""
    doc = Document(html)
    content = doc.summary()

    # Clean HTML to text
    soup = BeautifulSoup(content, 'lxml')
    text = soup.get_text(separator=' ', strip=True)

    return {
        'content': text,
        'title': doc.title(),
    }


async def extract_content(url: str, provided_content: Optional[str] = None) -> ExtractedContent:
    """Extract article content from URL."""
    parsed_url = urlparse(url)
    source_domain = parsed_url.netloc.replace('www.', '')

    if provided_content:
        # Content was provided (e.g., from extension)
        html = provided_content
        final_url = url
    else:
        # Fetch the URL
        html, final_url = await fetch_url(url)

    # Try trafilatura first, fallback to readability
    extracted = extract_with_trafilatura(html)
    if not extracted.get('content'):
        extracted = extract_with_readability(html)

    content = extracted.get('content', '')
    title = extracted.get('title') or 'Untitled'

    # Clean up title
    title = re.sub(r'\s+', ' ', title).strip()
    if len(title) > 500:
        title = title[:500] + '...'

    # Calculate word count
    word_count = len(content.split()) if content else 0

    # Detect content type
    content_type = detect_content_type(final_url, content)

    # Detect language (simplified - could use langdetect)
    language = 'en'

    return ExtractedContent(
        url=normalize_url(final_url),
        url_hash=hash_url(final_url),
        title=title,
        content=content,
        author=extracted.get('author'),
        source_domain=source_domain,
        published_at=extracted.get('date'),
        word_count=word_count,
        content_type=content_type,
        language=language
    )
