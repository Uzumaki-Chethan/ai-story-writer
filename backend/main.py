# backend/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import StreamingResponse, JSONResponse
import httpx
import asyncio
import re
import json
from typing import List

app = FastAPI()

# allow local frontend to call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL_NAME = "gemma:2b"

# Expanded stoplist for capitalized words that aren't names (covers sentence starts)
STOPWORDS = {
    "The","A","An","In","On","At","Of","For","And","But","Or","If","When","Then",
    "He","She","It","They","We","You","I","This","That","There","Here","As","By",
    "What","One","Is","Are","Was","Were","Has","Have","Had","Do","Does","Did",
    "Said","Says","Shouted","Asked","Told","Then","So","Because","While","After",
    "Before","Meanwhile","However","Also","Still","Very","All","Some","Many","Few",
    "Its","His","Her","Their","My","Your"
}

def extract_characters(text: str) -> List[str]:
    """
    Heuristic extractor: find capitalized words or two-word capitalized sequences.
    Filters using STOPWORDS to avoid common sentence-start words.
    """
    if not text:
        return []
    matches = re.findall(r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b", text)
    seen = set()
    chars = []
    for m in matches:
        # skip common non-name tokens
        if m in STOPWORDS:
            continue
        if len(m) <= 1:
            continue
        # skip single-word tokens that are purely numeric-like
        if re.fullmatch(r"\d+", m):
            continue
        if m not in seen:
            seen.add(m)
            chars.append(m)
    return chars

class SuggestRequest(BaseModel):
    context: str

class CompleteRequest(BaseModel):
    context: str
    max_tokens: int | None = 500

class ExtractRequest(BaseModel):
    context: str

# ---------------------------
# Helper: non-stream call
# ---------------------------
async def call_ollama(prompt: str, temperature: float = 0.8, max_tokens: int | None = None) -> str:
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "temperature": temperature,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens

    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(OLLAMA_URL, json=payload)
        r.raise_for_status()
        data = r.json()
    return data.get("response", "").strip()

# ---------------------------
# Helper: stream from Ollama (yields combined text chunks)
# ---------------------------
async def ollama_stream_generator(prompt: str, temperature: float = 0.8):
    """
    Yield smoothed text pieces (buffer small tokens until punctuation or threshold).
    """
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            OLLAMA_URL,
            json={"model": MODEL_NAME, "prompt": prompt, "stream": True, "temperature": temperature},
        ) as resp:
            resp.raise_for_status()
            buffer_text = ""
            buffer_chars = 0

            async for chunk in resp.aiter_bytes():
                if not chunk:
                    continue
                try:
                    decoded = chunk.decode("utf-8", errors="ignore")
                except Exception:
                    continue

                parts = decoded.split("\n")
                for part in parts:
                    part = part.strip()
                    if not part:
                        continue
                    piece = ""
                    try:
                        parsed = json.loads(part)
                        piece = parsed.get("response", "")
                    except Exception:
                        piece = part

                    if not piece:
                        continue

                    buffer_text += piece
                    buffer_chars += len(piece)

                    should_flush = False
                    last_char = buffer_text[-1] if buffer_text else ""
                    if buffer_chars >= 25:
                        should_flush = True
                    if last_char in {'.', '!', '?', '\n'}:
                        should_flush = True

                    if should_flush:
                        to_yield = buffer_text
                        buffer_text = ""
                        buffer_chars = 0
                        yield to_yield

            if buffer_text:
                yield buffer_text

# ---------------------------
# Root & extract endpoints
# ---------------------------
@app.get("/")
def root():
    return {"message": "Backend is working!"}

@app.post("/extract")
def extract(req: ExtractRequest):
    names = extract_characters(req.context or "")
    return {"characters": names}

# ---------------------------
# Streaming suggestions (3 concurrent streams)
# ---------------------------
@app.post("/suggestions_stream")
async def suggestions_stream(req: SuggestRequest):
    context_text = (req.context or "").strip()
    chars = extract_characters(context_text)
    char_line = ""
    if chars:
        char_line = "Characters: " + ", ".join(chars) + "\n\n"

    base_prompt = (
        "You are a helpful creative co-writer. Continue the user's story in the same voice and tone. "
        "Keep the continuation short (2-4 sentences) unless user asks for a full completion.\n\n"
        + char_line +
        "Story so far:\n\"\"\"\n"
        + context_text
        + "\n\"\"\"\n\nContinue:"
    )

    temps = [0.6, 0.8, 1.0]
    queue: asyncio.Queue = asyncio.Queue()

    async def run_stream(idx: int, temp: float):
        try:
            async for piece in ollama_stream_generator(base_prompt, temperature=temp):
                await queue.put({"type": "chunk", "idx": idx, "text": piece})
            await queue.put({"type": "done", "idx": idx})
        except Exception as e:
            await queue.put({"type": "error", "idx": idx, "text": str(e)})

    tasks = [asyncio.create_task(run_stream(i, temps[i])) for i in range(3)]

    async def event_generator():
        finished = 0
        while finished < 3:
            ev = await queue.get()
            # ensure error/text values are plain strings (no square brackets added)
            yield (json.dumps(ev) + "\n").encode("utf-8")
            if ev.get("type") == "done":
                finished += 1
        await asyncio.gather(*tasks, return_exceptions=True)

    return StreamingResponse(event_generator(), media_type="application/x-ndjson; charset=utf-8")

# ---------------------------
# Streaming completion (single stream)
# ---------------------------
@app.post("/complete_stream")
async def complete_stream(req: CompleteRequest):
    context_text = (req.context or "").strip()
    chars = extract_characters(context_text)
    char_line = ""
    if chars:
        char_line = "Characters: " + ", ".join(chars) + "\n\n"

    prompt = (
        "You are a creative co-writer. Continue and finish the story from the text below. "
        "Produce a coherent, satisfying continuation that completes the scene or short story. "
        "Keep consistent character names and facts from the context.\n\n"
        + char_line +
        "Story so far:\n\"\"\"\n"
        + context_text
        + "\n\"\"\"\n\nComplete the rest of the story:"
    )

    queue: asyncio.Queue = asyncio.Queue()

    async def run_complete():
        try:
            async for piece in ollama_stream_generator(prompt, temperature=0.9):
                await queue.put({"type":"chunk", "text": piece})
            await queue.put({"type":"done"})
        except Exception as e:
            await queue.put({"type":"error", "text": str(e)})

    task = asyncio.create_task(run_complete())

    async def event_generator():
        finished = False
        while not finished:
            ev = await queue.get()
            yield (json.dumps(ev) + "\n").encode("utf-8")
            if ev.get("type") in ("done", "error"):
                finished = True
        await task

    return StreamingResponse(event_generator(), media_type="application/x-ndjson; charset=utf-8")

# ---------------------------
# Non-streaming fallback endpoints (no bracketed error text)
# ---------------------------
@app.post("/suggestions")
async def suggestions(req: SuggestRequest):
    context_text = (req.context or "").strip()
    chars = extract_characters(context_text)
    char_line = ""
    if chars:
        char_line = "Characters: " + ", ".join(chars) + "\n\n"

    base_prompt = (
        "You are a helpful creative co-writer. Continue the user's story in the same voice and tone. "
        "Keep the continuation short (2-4 sentences) unless user asks for a full completion.\n\n"
        + char_line +
        "Story so far:\n\"\"\"\n"
        + context_text
        + "\n\"\"\"\n\nContinue:"
    )

    temps = [0.6, 0.8, 1.0]
    results = await asyncio.gather(*(call_ollama(base_prompt, temperature=t) for t in temps), return_exceptions=True)

    out = []
    for r in results:
        if isinstance(r, Exception):
            out.append("Error generating suggestion")
        else:
            out.append(r)
    return {"suggestions": out, "characters": chars}

@app.post("/complete")
async def complete(req: CompleteRequest):
    context_text = (req.context or "").strip()
    chars = extract_characters(context_text)
    char_line = ""
    if chars:
        char_line = "Characters: " + ", ".join(chars) + "\n\n"

    prompt = (
        "You are a creative co-writer. Continue and finish the story from the text below. "
        "Produce a coherent, satisfying continuation that completes the scene or short story. "
        "Keep consistent character names and facts from the context.\n\n"
        + char_line +
        "Story so far:\n\"\"\"\n"
        + context_text
        + "\n\"\"\"\n\nComplete the rest of the story:"
    )

    text = await call_ollama(prompt, temperature=0.9, max_tokens=req.max_tokens or 800)
    return {"completion": text, "characters": chars}
