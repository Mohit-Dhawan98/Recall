import httpx
import json
import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# DeepSeek pricing (per 1M tokens) - as of 2024
DEEPSEEK_PRICING = {
    "input": 0.14,   # $0.14 per 1M input tokens
    "output": 0.28,  # $0.28 per 1M output tokens
}

# In-memory usage tracking (persisted via API calls)
_usage_stats = {
    "total_input_tokens": 0,
    "total_output_tokens": 0,
    "total_cost_usd": 0.0,
    "api_calls": 0,
    "last_reset": datetime.utcnow().isoformat(),
}


def get_usage_stats() -> Dict[str, Any]:
    """Get current usage statistics."""
    return _usage_stats.copy()


def reset_usage_stats():
    """Reset usage statistics."""
    global _usage_stats
    _usage_stats = {
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_cost_usd": 0.0,
        "api_calls": 0,
        "last_reset": datetime.utcnow().isoformat(),
    }


def _track_usage(input_tokens: int, output_tokens: int):
    """Track token usage and calculate cost."""
    cost = (input_tokens / 1_000_000 * DEEPSEEK_PRICING["input"] +
            output_tokens / 1_000_000 * DEEPSEEK_PRICING["output"])

    _usage_stats["total_input_tokens"] += input_tokens
    _usage_stats["total_output_tokens"] += output_tokens
    _usage_stats["total_cost_usd"] += cost
    _usage_stats["api_calls"] += 1

    logger.info(f"DeepSeek API call: {input_tokens} in, {output_tokens} out, ${cost:.6f}")


@dataclass
class AnalysisResult:
    summary: str
    key_quotes: List[str]
    tags: List[Dict[str, str]]  # [{domain, topic, entity}]
    entities: List[Dict[str, str]]  # [{entity, entity_type}]


# Grounded taxonomy for tags
TAXONOMY = {
    "technology": ["ai-ml", "programming", "startups", "crypto-web3", "security", "devtools", "data-science", "hardware"],
    "business": ["strategy", "marketing", "leadership", "finance", "operations", "economics"],
    "science": ["research", "climate", "biology", "physics", "space", "medicine"],
    "culture": ["media", "society", "politics", "philosophy", "arts"],
    "career": ["productivity", "learning", "job-market", "skills"],
}

SPECIAL_TAGS = ["tutorial", "opinion", "news", "research-paper", "case-study", "announcement"]


def get_taxonomy_prompt() -> str:
    """Generate taxonomy description for the prompt."""
    lines = ["Available domains and topics:"]
    for domain, topics in TAXONOMY.items():
        lines.append(f"  {domain}: {', '.join(topics)}")
    lines.append(f"\nSpecial tags (content type): {', '.join(SPECIAL_TAGS)}")
    return "\n".join(lines)


ANALYSIS_PROMPT = """Analyze this article and provide a structured response.

{taxonomy}

Article Title: {title}
Article Content:
{content}

Provide your analysis in the following JSON format:
{{
    "summary": "A concise 50-200 word summary of the article's main points and key takeaways",
    "key_quotes": ["3-5 important sentences or quotes from the article"],
    "tags": [
        {{"domain": "technology", "topic": "ai-ml"}},
        {{"domain": "business", "topic": "startups"}}
    ],
    "entities": [
        {{"entity": "OpenAI", "entity_type": "company"}},
        {{"entity": "GPT-4", "entity_type": "product"}},
        {{"entity": "Sam Altman", "entity_type": "person"}}
    ],
    "special_tags": ["tutorial"]
}}

Rules:
1. Tags MUST use domains and topics from the taxonomy above
2. Include 1-3 relevant tags
3. Entities should be specific names (people, companies, products, concepts)
4. Entity types: person, company, product, concept
5. Special tags are optional, only include if clearly applicable
6. Summary should be informative and capture the article's value

Respond ONLY with valid JSON, no other text."""


async def call_deepseek(prompt: str) -> Optional[str]:
    """Call DeepSeek API and track usage."""
    if not settings.deepseek_api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.deepseek_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 2000
                }
            )
            response.raise_for_status()
            data = response.json()

            # Track usage if available
            if "usage" in data:
                _track_usage(
                    data["usage"].get("prompt_tokens", 0),
                    data["usage"].get("completion_tokens", 0)
                )

            return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"DeepSeek API error: {e}")
        return None


async def call_ollama(prompt: str, model: str = "llama3.2") -> Optional[str]:
    """Call local Ollama API."""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.ollama_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3
                    }
                }
            )
            response.raise_for_status()
            data = response.json()
            return data["response"]
    except Exception:
        return None


def parse_llm_response(response: str) -> Optional[Dict[str, Any]]:
    """Parse LLM JSON response."""
    try:
        # Try to extract JSON from response
        response = response.strip()

        # Handle markdown code blocks
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]

        return json.loads(response.strip())
    except json.JSONDecodeError:
        # Try to find JSON in the response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        return None


def rule_based_analysis(title: str, content: str, source_domain: str) -> AnalysisResult:
    """Fallback rule-based analysis when LLM is unavailable."""
    # Simple domain detection based on source
    domain_mapping = {
        'arxiv.org': ('science', 'research'),
        'github.com': ('technology', 'programming'),
        'medium.com': ('technology', None),
        'substack.com': ('culture', 'media'),
        'twitter.com': ('culture', 'media'),
        'x.com': ('culture', 'media'),
        'linkedin.com': ('career', None),
        'news.ycombinator.com': ('technology', 'startups'),
        'reddit.com': ('culture', 'media'),
    }

    # Keyword-based detection
    content_lower = (title + ' ' + content[:1000]).lower()

    tags = []

    # Check source domain
    for domain_key, (dom, topic) in domain_mapping.items():
        if domain_key in source_domain:
            tags.append({"domain": dom, "topic": topic})
            break

    # Keyword detection
    if not tags:
        if any(kw in content_lower for kw in ['ai', 'machine learning', 'neural', 'gpt', 'llm']):
            tags.append({"domain": "technology", "topic": "ai-ml"})
        elif any(kw in content_lower for kw in ['startup', 'funding', 'venture', 'series a']):
            tags.append({"domain": "business", "topic": "startups"})
        elif any(kw in content_lower for kw in ['python', 'javascript', 'code', 'programming']):
            tags.append({"domain": "technology", "topic": "programming"})
        else:
            tags.append({"domain": "technology", "topic": None})

    # Create simple summary
    sentences = content.split('.')[:3]
    summary = '. '.join(s.strip() for s in sentences if s.strip())
    if len(summary) > 500:
        summary = summary[:500] + '...'

    return AnalysisResult(
        summary=summary or title,
        key_quotes=[],
        tags=tags,
        entities=[]
    )


async def analyze_content(title: str, content: str, source_domain: str) -> AnalysisResult:
    """Analyze content using LLM with fallback chain."""
    # Truncate content for LLM (keep first ~4000 chars)
    truncated_content = content[:4000] if len(content) > 4000 else content

    prompt = ANALYSIS_PROMPT.format(
        taxonomy=get_taxonomy_prompt(),
        title=title,
        content=truncated_content
    )

    # Try DeepSeek first
    logger.info(f"LLM analysis: attempting DeepSeek for '{title[:50]}...'")
    response = await call_deepseek(prompt)

    if response:
        logger.info("LLM analysis: DeepSeek succeeded")
        parsed = parse_llm_response(response)
        if parsed:
            tags = parsed.get("tags", [])
            for special in parsed.get("special_tags", []):
                if special in SPECIAL_TAGS:
                    tags.append({"domain": special, "topic": None})
            return AnalysisResult(
                summary=parsed.get("summary", ""),
                key_quotes=parsed.get("key_quotes", []),
                tags=tags,
                entities=parsed.get("entities", [])
            )
        else:
            logger.warning("LLM analysis: DeepSeek returned unparseable response, trying Ollama")
    else:
        logger.warning("LLM analysis: DeepSeek failed or unavailable, trying Ollama")

    # Fallback to Ollama
    logger.info("LLM analysis: attempting Ollama fallback")
    response = await call_ollama(prompt)

    if response:
        logger.info("LLM analysis: Ollama succeeded")
        parsed = parse_llm_response(response)
        if parsed:
            tags = parsed.get("tags", [])
            for special in parsed.get("special_tags", []):
                if special in SPECIAL_TAGS:
                    tags.append({"domain": special, "topic": None})
            return AnalysisResult(
                summary=parsed.get("summary", ""),
                key_quotes=parsed.get("key_quotes", []),
                tags=tags,
                entities=parsed.get("entities", [])
            )
        else:
            logger.warning("LLM analysis: Ollama returned unparseable response, using rule-based")
    else:
        logger.warning("LLM analysis: Ollama failed or unavailable, using rule-based")

    # Fallback to rule-based
    logger.info("LLM analysis: using rule-based fallback")
    return rule_based_analysis(title, content, source_domain)


async def generate_embedding(text: str) -> Optional[List[float]]:
    """Generate embedding for text using DeepSeek or Ollama."""
    # Try DeepSeek embedding
    if settings.deepseek_api_key:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.deepseek.com/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {settings.deepseek_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "deepseek-chat",
                        "input": text[:8000]  # Truncate if needed
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return data["data"][0]["embedding"]
        except Exception:
            pass

    # Try Ollama embedding
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.ollama_url}/api/embeddings",
                json={
                    "model": "nomic-embed-text",
                    "prompt": text[:8000]
                }
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("embedding")
    except Exception:
        pass

    return None
