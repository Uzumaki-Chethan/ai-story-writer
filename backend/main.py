from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from groq import Groq
import os
from dotenv import load_dotenv
import json
import asyncio
import re
from typing import List

load_dotenv()

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def extract_characters(text: str) -> List[str]:
    """Use AI to detect character names accurately"""
    if not text or len(text.strip()) < 10:
        return []
    
    try:
        prompt = f"""Analyze this story and identify ONLY the character names (people, animals, or beings with specific names).

Rules:
- List only actual character names, not common nouns
- Do not include places, objects, or descriptive words
- Return names separated by commas
- If no characters, return "none"

Story:
{text[:1000]}

Character names (comma-separated):"""
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=100,
            stream=False
        )
        
        result = response.choices[0].message.content.strip()
        
        # Handle "none" response
        if result.lower() in ["none", "none.", "no characters", "n/a"]:
            return []
        
        # Parse comma-separated names
        names = [n.strip() for n in result.split(",") if n.strip()]
        
        # Clean up any extra text
        cleaned_names = []
        for name in names:
            # Remove any extra explanation text
            name = re.sub(r'\(.*?\)', '', name)  # Remove parentheses
            name = re.sub(r'\[.*?\]', '', name)  # Remove brackets
            name = name.strip()
            
            # Only keep if it looks like a name (capitalized, 2-20 chars)
            if name and 2 <= len(name) <= 20 and name[0].isupper():
                cleaned_names.append(name)
        
        return cleaned_names[:10]  # Max 10 characters
        
    except Exception as e:
        print(f"Character extraction error: {e}")
        return []

class SuggestRequest(BaseModel):
    context: str

class CompleteRequest(BaseModel):
    context: str
    max_tokens: int | None = 500

class ExtractRequest(BaseModel):
    context: str

@app.get("/")
def root():
    return {"message": "AI Story Writer API - Powered by Groq"}

@app.post("/extract")
def extract(req: ExtractRequest):
    names = extract_characters(req.context or "")
    return {"characters": names}

# Generate 3 complete suggestions, then stream them separately
@app.post("/suggestions_stream")
async def suggestions_stream(req: SuggestRequest):
    context_text = (req.context or "").strip()
    chars = extract_characters(context_text)
    char_line = ""
    if chars:
        char_line = "Characters: " + ", ".join(chars) + "\n\n"

    queue: asyncio.Queue = asyncio.Queue()

    async def generate_all_suggestions():
        """Generate 3 complete suggestions in parallel"""
        temps = [0.7, 0.85, 1.0]
        
        async def get_one_suggestion(idx: int, temp: float):
            try:
                prompt = (
                    "You are a creative story writer. Based on this story, write ONE short continuation (2-3 sentences maximum).\n"
                    "Be creative and engaging. Only write the continuation, nothing else.\n\n"
                    + char_line +
                    f"Story:\n{context_text}\n\nContinuation:"
                )
                
                completion = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temp,
                    max_tokens=150,
                    stream=False  # Get complete response
                )
                
                suggestion = completion.choices[0].message.content.strip()
                
                # Stream it word by word for smooth effect
                words = suggestion.split()
                for word in words:
                    await queue.put({"type": "chunk", "idx": idx, "text": word + " "})
                    await asyncio.sleep(0.02)  # Small delay for streaming effect
                
                await queue.put({"type": "done", "idx": idx})
                
            except Exception as e:
                await queue.put({"type": "error", "idx": idx, "text": str(e)})
        
        # Generate all 3 in parallel
        await asyncio.gather(
            get_one_suggestion(0, temps[0]),
            get_one_suggestion(1, temps[1]),
            get_one_suggestion(2, temps[2])
        )

    # Start generation task
    task = asyncio.create_task(generate_all_suggestions())

    async def event_generator():
        finished = 0
        while finished < 3:
            ev = await queue.get()
            yield (json.dumps(ev) + "\n").encode("utf-8")
            if ev.get("type") == "done":
                finished += 1
        await task

    return StreamingResponse(event_generator(), media_type="application/x-ndjson; charset=utf-8")

# Streaming completion
@app.post("/complete_stream")
async def complete_stream(req: CompleteRequest):
    context_text = (req.context or "").strip()
    chars = extract_characters(context_text)
    char_line = ""
    if chars:
        char_line = "Characters: " + ", ".join(chars) + "\n\n"

    prompt = (
        "You are a creative co-writer. Continue and finish the story from the text below. "
        "Produce a coherent, satisfying continuation that completes the scene or short story.\n\n"
        + char_line +
        "Story so far:\n\"\"\"\n"
        + context_text
        + "\n\"\"\"\n\nComplete the rest of the story:"
    )

    queue: asyncio.Queue = asyncio.Queue()

    async def run_complete():
        try:
            # Get complete response first
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.9,
                max_tokens=req.max_tokens or 800,
                stream=False  # Get full response
            )
            
            full_text = completion.choices[0].message.content.strip()
            
            # Stream it word by word for smooth effect
            words = full_text.split()
            for word in words:
                await queue.put({"type": "chunk", "text": word + " "})
                await asyncio.sleep(0.03)  # Smooth streaming delay
            
            await queue.put({"type": "done"})
        except Exception as e:
            await queue.put({"type": "error", "text": str(e)})

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
