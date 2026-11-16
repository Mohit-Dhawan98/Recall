# Principles

The decisions behind Recall, and where each one lives in the code. Most of them
came from getting the first version wrong; `SPEC.md` records what changed.

## 1. Capture is a decision, not a side effect

The first design captured any page you stayed on for 30 seconds. Feedback on
that was blunt: "it will be more like browser history". A pile you never chose
is a pile you never revisit. Recall only stores what you explicitly save, by
extension click, keyboard shortcut, phone share sheet or a message to the
Telegram bot.

*Where:* `extension/`, the PWA share target in `frontend/`, `bot/`.

## 2. Keep the memory, not the copy

Recall stores the URL, metadata, an AI summary and a few key quotes: about
2–3 KB per article instead of roughly 50 KB of full text. That is enough to
search and to remember why you saved something, it avoids keeping other
people's copyrighted text, and it keeps a personal database small enough to
back up anywhere.

*Where:* `backend/app/models.py`, `backend/app/services/extractor.py`.

## 3. Tags come from a fixed vocabulary

Let a model invent tags and you get `ai`, `AI`, `artificial-intelligence` and
`machine learning` as four unrelated things. Recall gives the model a two-level
taxonomy (domain, then topic) and requires tags to come from it. A smaller
vocabulary is what makes tags useful for connecting articles later.

*Where:* `TAXONOMY` and the prompt in `backend/app/services/llm.py`.

## 4. Use the model once, then use arithmetic

Each article gets one LLM call (summary, tags, entities) and one embedding.
Everything after that is rules: two shared tags make a `SAME_TOPIC` edge, a
shared author or site or entity makes its own edge, and embedding similarity
above a threshold makes a `SIMILAR` edge. The knowledge graph costs nothing to
build, is deterministic, and every edge can explain itself.

*Where:* `build_relations_for_article` in `backend/app/services/graph.py`.

## 5. Five relation types, on purpose

A graph with thirty edge types is a research project. Five types that a person
can read at a glance is a tool.

*Where:* `backend/app/services/graph.py`, `backend/app/models.py`.

## 6. Degrade, do not fail

Analysis tries a cheap hosted model, then a local model, then plain rules
(domain and title heuristics). A save never fails because a model is down; at
worst the article arrives with rough tags.

*Where:* `analyze_content` and `rule_based_analysis` in
`backend/app/services/llm.py`.

## 7. Your reading list is yours

Self-hosted with Docker Compose, one Postgres database with pgvector, an
optional tunnel for other devices. No hosted version, no account.

*Where:* `docker-compose.yml`, `docs/SELF_HOSTING.md`.
