import asyncio
import base64
import uuid
from datetime import datetime, timedelta, timezone, date
from fastapi import APIRouter, Depends, UploadFile, File
from supabase import Client
from postgrest.exceptions import APIError as PostgRESTError
from database import get_db
from schemas import (
    StructureRequest, StructureResponse,
    TagsRequest, TagsResponse,
    FlashcardsRequest, FlashcardsResponse, Flashcard,
    ChatRequest, ChatResponse, NoteListItem,
    WritingAssistRequest, WritingAssistResponse,
    WritingCoachRequest,
    ExpandIdeaRequest, ExpandIdeaResponse,
    MeetingNotesRequest, MeetingNotesResponse,
    InsightsResponse, VoiceNoteResponse,
    GapsResponse, LinkSuggestionsResponse, ResearchRequest, ResearchResponse,
)
from services import gemini
from services import vector as vs

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/structure", response_model=StructureResponse)
async def structure_note(body: StructureRequest):
    system = (
        "You are a note-structuring AI. Given raw, unstructured text, "
        "output a JSON object with keys: title (string) and structured_content (markdown string). "
        "structured_content should have sections: Summary, Key Points (bullet list), Action Items (bullet list)."
    )
    data = await gemini.generate_json(body.text, system=system)
    return StructureResponse(
        title=data.get("title", "Untitled"),
        structured_content=data.get("structured_content", ""),
    )


@router.post("/tags", response_model=TagsResponse)
async def generate_tags(body: TagsRequest):
    system = (
        'You are a tagging AI. Given note content, return a JSON object with a single key "tags" '
        "containing a list of 3-6 lowercase hyphenated topic tags (no # prefix). "
        "Example: {\"tags\": [\"machine-learning\", \"deep-learning\", \"cnn\"]}"
    )
    data = await gemini.generate_json(body.content, system=system)
    return TagsResponse(tags=data.get("tags", []))


@router.post("/flashcards", response_model=FlashcardsResponse)
async def generate_flashcards(body: FlashcardsRequest):
    system = (
        "You are a study AI. Given note content, return a JSON object with key \"flashcards\", "
        "each item having \"question\" and \"answer\" keys. Generate 3-8 flashcards."
    )
    data = await gemini.generate_json(body.content, system=system)
    cards = [Flashcard(**c) for c in data.get("flashcards", [])]
    return FlashcardsResponse(flashcards=cards)


@router.get("/chat/history")
async def get_chat_history(
    user_id: str,
    limit: int = 40,
    db: Client = Depends(get_db),
):
    """Return the last `limit` chat messages for a user."""
    try:
        result = await asyncio.to_thread(
            lambda: db.table("chat_messages")
            .select("id, role, content, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        return {"messages": result.data or []}
    except Exception:
        return {"messages": []}


@router.post("/chat", response_model=ChatResponse)
async def chat_with_notes(body: ChatRequest, db: Client = Depends(get_db)):
    user_messages = [m for m in body.messages if m.role == "user"]
    if not user_messages:
        return ChatResponse(reply="Please ask a question.", sources=[])

    query = user_messages[-1].content
    source_notes = []
    context_parts = []
    pinned_ids: set[str] = set()

    # If caller pinned specific note IDs, fetch them directly
    if body.note_ids:
        pinned_result = await asyncio.to_thread(
            lambda: db.table("notes").select("id, title, content, created_at, updated_at").in_("id", body.note_ids).execute()
        )
        for n in (pinned_result.data or []):
            n["tags"] = []
            source_notes.append(NoteListItem(**n))
            context_parts.append(f"=== {n['title']} ===\n{n['content']}")
            pinned_ids.add(n["id"])

    # Semantic search for additional context (exclude already-pinned notes)
    query_embedding = await gemini.embed_text(query)
    hits = await vs.similarity_search(query_embedding, top_k=5)
    relevant_hits = [(note_id, score) for note_id, score in hits if score >= 0.4 and str(note_id) not in pinned_ids]

    if relevant_hits:
        hit_ids = [str(note_id) for note_id, _ in relevant_hits]
        notes_result = await asyncio.to_thread(
            lambda: db.table("notes").select("id, title, content, created_at, updated_at").in_("id", hit_ids).execute()
        )
        notes_by_id = {n["id"]: n for n in (notes_result.data or [])}
        for note_id, score in relevant_hits:
            note = notes_by_id.get(str(note_id))
            if note:
                note["tags"] = []
                source_notes.append(NoteListItem(**note))
                context_parts.append(f"=== {note['title']} ===\n{note['content']}")

    context = "\n\n".join(context_parts)
    history = "\n".join([f"{m.role.upper()}: {m.content}" for m in body.messages[:-1]])

    prompt = (
        f"You are a knowledgeable AI assistant with access to the user's personal notes.\n\n"
        f"RELEVANT NOTES:\n{context or 'No relevant notes found.'}\n\n"
        f"CONVERSATION HISTORY:\n{history}\n\n"
        f"USER: {query}\n\n"
        f"Answer the question based on the notes above. If the notes don't contain enough information, "
        f"say so and answer from general knowledge."
    )
    reply = await gemini.generate(prompt)

    # Persist this turn to chat_messages if user_id is provided
    user_id = getattr(body, "user_id", None)
    if user_id:
        try:
            await asyncio.to_thread(
                lambda: db.table("chat_messages").insert([
                    {"user_id": user_id, "role": "user", "content": query},
                    {"user_id": user_id, "role": "assistant", "content": reply},
                ]).execute()
            )
        except Exception:
            pass  # persistence failure must not break the response

    return ChatResponse(reply=reply, sources=source_notes)


@router.post("/writing-assist", response_model=WritingAssistResponse)
async def writing_assist(body: WritingAssistRequest):
    action_prompts = {
        "improve": "Improve the writing quality, clarity, and flow of the following text. Return only the improved text.",
        "summarize": "Summarize the following text concisely in 2-3 sentences. Return only the summary.",
        "expand": "Expand the following text with more detail, examples, and depth. Return only the expanded text.",
        "bullet": "Convert the following text into a clear bullet point list. Return only the bullet points.",
        "explain": "Explain the following text in simple terms as if explaining to a beginner. Return only the explanation.",
    }
    instruction = action_prompts.get(body.action, "Improve the following text.")
    result = await gemini.generate(f"{instruction}\n\nTEXT:\n{body.text}")
    return WritingAssistResponse(result=result)


@router.post("/expand-idea", response_model=ExpandIdeaResponse)
async def expand_idea(body: ExpandIdeaRequest):
    system = (
        "You are an idea-expansion AI. Given a short idea, generate 5-8 specific, actionable "
        "sub-ideas or expansions. Return JSON: {\"expanded\": [\"idea1\", \"idea2\", ...]}"
    )
    data = await gemini.generate_json(body.idea, system=system)
    return ExpandIdeaResponse(expanded=data.get("expanded", []))


@router.post("/meeting-notes", response_model=MeetingNotesResponse)
async def extract_meeting_notes(body: MeetingNotesRequest):
    system = (
        "You are an expert at processing meeting transcripts. Extract and return JSON with keys: "
        "summary (string), action_items (list of strings), key_decisions (list of strings)."
    )
    data = await gemini.generate_json(body.transcript, system=system)
    return MeetingNotesResponse(
        summary=data.get("summary", ""),
        action_items=data.get("action_items", []),
        key_decisions=data.get("key_decisions", []),
    )


@router.get("/insights", response_model=InsightsResponse)
async def daily_insights(db: Client = Depends(get_db)):
    # Total notes count
    all_notes_result = await asyncio.to_thread(
        lambda: db.table("notes").select("id, created_at").execute()
    )
    all_notes = all_notes_result.data or []
    total_notes = len(all_notes)

    # Notes this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    notes_this_week = sum(
        1 for n in all_notes
        if datetime.fromisoformat(n["created_at"].replace("Z", "+00:00")) >= week_ago
    )

    # Top tag: fetch note_tags counts per tag
    tags_result = await asyncio.to_thread(
        lambda: db.table("tags").select("id, name, note_tags(note_id)").execute()
    )
    tags_data = tags_result.data or []
    top_topic = "General"
    if tags_data:
        tags_sorted = sorted(tags_data, key=lambda t: len(t.get("note_tags") or []), reverse=True)
        if tags_sorted and (tags_sorted[0].get("note_tags") or []):
            top_topic = tags_sorted[0]["name"]

    # Unfinished ideas: notes with no tags AND content < 150 chars
    note_tags_result = await asyncio.to_thread(
        lambda: db.table("note_tags").select("note_id").execute()
    )
    tagged_note_ids = {nt["note_id"] for nt in (note_tags_result.data or [])}
    content_result = await asyncio.to_thread(
        lambda: db.table("notes").select("id, content").execute()
    )
    unfinished_ideas = sum(
        1 for n in (content_result.data or [])
        if n["id"] not in tagged_note_ids and len(n.get("content") or "") < 150
    )

    # Recent note titles for AI insight
    recent_result = await asyncio.to_thread(
        lambda: db.table("notes").select("title").order("updated_at", desc=True).limit(5).execute()
    )
    recent_titles = [n["title"] for n in (recent_result.data or [])]
    note_summaries = "\n".join([f"- {t}" for t in recent_titles])

    ai_insight_task = gemini.generate(
        f"Based on these recent notes, give one concise, encouraging insight about the user's knowledge journey (1-2 sentences):\n{note_summaries or 'No notes yet.'}"
    )
    suggested_topics_task = gemini.generate_json(
        f"Based on these note titles, suggest 3-4 related topics the user hasn't covered yet. "
        f"Return JSON: {{\"topics\": [\"topic1\", \"topic2\", ...]}}\n{note_summaries or 'No notes yet.'}"
    )

    ai_insight_raw, suggested_data = await asyncio.gather(ai_insight_task, suggested_topics_task)

    return InsightsResponse(
        total_notes=total_notes,
        notes_this_week=notes_this_week,
        top_topic=top_topic,
        unfinished_ideas=unfinished_ideas,
        ai_insight=ai_insight_raw.strip(),
        suggested_topics=suggested_data.get("topics", []),
    )


@router.post("/voice", response_model=VoiceNoteResponse)
async def process_voice_note(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    mime_type = file.content_type or "audio/webm"
    transcript = await gemini.transcribe_audio(audio_bytes, mime_type)

    system = (
        "Given a voice transcription, return JSON with keys: "
        "title (short note title), structured_content (well-formatted markdown note)."
    )
    data = await gemini.generate_json(transcript, system=system)
    return VoiceNoteResponse(
        transcript=transcript,
        title=data.get("title", "Voice Note"),
        structured_content=data.get("structured_content", transcript),
    )


@router.get("/gaps", response_model=GapsResponse)
async def knowledge_gaps(db: Client = Depends(get_db)):
    """Detect missing concepts in the user's knowledge base."""
    result = await asyncio.to_thread(
        lambda: db.table("notes").select("title").order("updated_at", desc=True).limit(30).execute()
    )
    titles = [n["title"] for n in (result.data or [])]
    if not titles:
        return GapsResponse(gaps=[], suggestion="Create some notes first to detect knowledge gaps.")

    titles_list = "\n".join([f"- {t}" for t in titles])
    data = await gemini.generate_json(
        f"Here are the topics a user has written notes about:\n{titles_list}\n\n"
        "Identify 4-6 important related concepts they haven't covered yet. "
        'Return JSON: {"gaps": ["concept1", "concept2", ...], "suggestion": "one sentence of encouragement"}'
    )
    return GapsResponse(
        gaps=data.get("gaps", []),
        suggestion=data.get("suggestion", "Keep learning!"),
    )


@router.get("/link-suggestions/{note_id}", response_model=LinkSuggestionsResponse)
async def link_suggestions(
    note_id: uuid.UUID,
    db: Client = Depends(get_db),
):
    """Return top related notes for a given note that are not yet linked."""
    # Fetch the note's embedding
    try:
        note_result = await asyncio.to_thread(
            lambda: db.table("notes").select("id, embedding").eq("id", str(note_id)).single().execute()
        )
    except PostgRESTError:
        return LinkSuggestionsResponse(suggestions=[])
    if not note_result.data or not note_result.data.get("embedding"):
        return LinkSuggestionsResponse(suggestions=[])

    note_embedding = note_result.data["embedding"]
    # embedding comes back as a list from Supabase REST

    # Get already-linked note IDs
    links_result = await asyncio.to_thread(
        lambda: db.table("note_links")
        .select("source_id, target_id")
        .or_(f"source_id.eq.{note_id},target_id.eq.{note_id}")
        .execute()
    )
    linked_ids: set[str] = {str(note_id)}
    for link in (links_result.data or []):
        linked_ids.add(str(link["source_id"]))
        linked_ids.add(str(link["target_id"]))

    # Find top similar notes
    hits = await vs.similarity_search(note_embedding, top_k=10, threshold=0.6, exclude_id=note_id)
    candidate_ids = [
        str(hit_id) for hit_id, score in hits
        if str(hit_id) not in linked_ids
    ][:3]

    if not candidate_ids:
        return LinkSuggestionsResponse(suggestions=[])

    suggestions_result = await asyncio.to_thread(
        lambda: db.table("notes")
        .select("id, title, content, created_at, updated_at")
        .in_("id", candidate_ids)
        .execute()
    )
    suggestions = []
    for n in (suggestions_result.data or []):
        n["tags"] = []
        suggestions.append(NoteListItem(**n))

    return LinkSuggestionsResponse(suggestions=suggestions)


@router.post("/writing-coach")
async def writing_coach(body: WritingCoachRequest):
    system = (
        "You are an inline writing coach. Given the last sentence or paragraph the user wrote, "
        "suggest ONE concise continuation (max 15 words) that helps them think deeper or elaborate. "
        "Return ONLY the suggestion text, no explanation, no quotes."
    )
    suggestion = await gemini.generate(body.text, system=system)
    return {"suggestion": suggestion.strip()}


@router.post("/extract-actions")
async def extract_action_items(body: dict):
    system = (
        "Extract all action items, tasks, and reminders from this note. "
        'Return JSON: {"actions": [{"task": "string", "due_hint": "string or null", "priority": "high or medium or low"}]}'
    )
    data = await gemini.generate_json(body.get("content", ""), system=system)
    return {"actions": data.get("actions", [])}


@router.get("/clusters")
async def get_topic_clusters(db: Client = Depends(get_db)):
    """Group notes by their top tag to form topic clusters."""
    # Fetch all note_tags with tag names
    tags_result = await asyncio.to_thread(
        lambda: db.table("tags").select("id, name, note_tags(note_id)").execute()
    )
    tags_data = tags_result.data or []

    # Fetch all notes for lookup
    notes_result = await asyncio.to_thread(
        lambda: db.table("notes").select("id, title, created_at, updated_at").execute()
    )
    notes_by_id = {n["id"]: n for n in (notes_result.data or [])}

    clusters = []
    for tag in tags_data:
        note_ids = [nt["note_id"] for nt in (tag.get("note_tags") or [])]
        if not note_ids:
            continue
        top_notes = []
        for nid in note_ids[:3]:
            n = notes_by_id.get(nid)
            if n:
                top_notes.append({"id": n["id"], "title": n.get("title", "Untitled")})
        clusters.append({
            "topic": tag["name"],
            "note_ids": note_ids,
            "notes": top_notes,
            "count": len(note_ids),
        })

    clusters.sort(key=lambda c: c["count"], reverse=True)
    return {"clusters": clusters}


@router.get("/flashcards/{note_id}/due")
async def get_due_flashcards(note_id: str, db: Client = Depends(get_db)):
    """Return flashcards due for review for a note."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        result = await asyncio.to_thread(
            lambda: db.table("flashcards")
            .select("*")
            .eq("note_id", note_id)
            .lte("next_review", now_iso)
            .execute()
        )
        return {"flashcards": result.data or []}
    except Exception:
        return {"flashcards": []}


@router.post("/flashcards/{note_id}/review")
async def review_flashcard(note_id: str, card_id: str, quality: int, db: Client = Depends(get_db)):
    """Update a flashcard's SM-2 interval after review."""
    quality = max(0, min(5, quality))
    try:
        card_result = await asyncio.to_thread(
            lambda: db.table("flashcards").select("*").eq("id", card_id).single().execute()
        )
        card = card_result.data
        if not card:
            return {"error": "Card not found"}

        easiness = float(card.get("easiness", 2.5))
        repetitions = int(card.get("repetitions", 0))
        interval = int(card.get("interval", 1))

        new_easiness = max(1.3, easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_repetitions = repetitions + 1 if quality >= 3 else 0
        if new_repetitions <= 1:
            new_interval = 1
        elif new_repetitions == 2:
            new_interval = 6
        else:
            new_interval = round(interval * new_easiness)

        next_review = (datetime.now(timezone.utc) + timedelta(days=new_interval)).isoformat()

        await asyncio.to_thread(
            lambda: db.table("flashcards").update({
                "easiness": new_easiness,
                "repetitions": new_repetitions,
                "interval": new_interval,
                "next_review": next_review,
            }).eq("id", card_id).execute()
        )
        return {"interval": new_interval, "next_review": next_review}
    except Exception as e:
        return {"error": str(e)}


@router.post("/flashcards/{note_id}/save")
async def save_flashcards_to_db(note_id: str, body: dict, db: Client = Depends(get_db)):
    """Save AI-generated flashcards to the flashcards table."""
    cards = body.get("flashcards", [])
    if not cards:
        return {"saved": 0}
    rows = [
        {
            "note_id": note_id,
            "question": c["question"],
            "answer": c["answer"],
        }
        for c in cards
    ]
    try:
        await asyncio.to_thread(
            lambda: db.table("flashcards").insert(rows).execute()
        )
        return {"saved": len(rows)}
    except Exception as e:
        return {"error": str(e)}


@router.post("/template-fill")
async def fill_template(body: dict):
    template_type = body.get("template_type", "blank")
    context = body.get("context", "")
    system = (
        f"You are an AI that fills note templates. Template type: {template_type}. "
        f"Context: {context}. Generate helpful placeholder content for each section. "
        "Return only the filled template as plain text with section headers."
    )
    result = await gemini.generate(f"Fill this {template_type} template with relevant content.", system=system)
    return {"content": result}


@router.post("/image-to-text")
async def image_to_text(file: UploadFile = File(...)):
    """Extract text from an image using Gemini vision (handwriting, whiteboards, documents)."""
    image_bytes = await file.read()
    mime_type = file.content_type or "image/jpeg"
    image_b64 = base64.b64encode(image_bytes).decode()
    extracted_text = await gemini.extract_text_from_image(image_b64, mime_type)
    # Create a lightly structured version too
    structured_prompt = (
        f"Given this extracted text, format it cleanly with proper paragraphs and punctuation:\n\n{extracted_text}"
    )
    structured_content = await gemini.generate(structured_prompt) if extracted_text else ""
    return {"extracted_text": extracted_text, "structured_content": structured_content}


@router.post("/detect-events")
async def detect_calendar_events(body: dict):
    """Scan note content for dates, times, events, and deadlines."""
    content = body.get("content", "")
    if not content or len(content.replace("<", "").replace(">", "")) < 30:
        return {"events": []}
    data = await gemini.generate_json(
        f"Extract calendar events, meetings, deadlines, or appointments from this note content. "
        f'Return JSON: {{"events": [{{"title": "string", "date_hint": "string", "time_hint": "string", "description": "string"}}]}} '
        f"If there are no events, return an empty list. "
        f"Content: {content[:2000]}"
    )
    return {"events": data.get("events", [])}


@router.get("/trends")
async def get_trends(db: Client = Depends(get_db)):
    """
    Real-time Technical Trend Intelligence derived from the user's own notes.
    Returns:
    - trending_topics: tag-based clusters sorted by note count
    - most_connected: notes with most knowledge-graph links
    - activity_heatmap: daily note creation counts for the last 84 days (12 weeks)
    """
    # ── 1. Trending topics (tags with most notes) ──────────────────────────────
    tags_result = await asyncio.to_thread(
        lambda: db.table("tags").select("id, name, note_tags(note_id, notes(id, title))").execute()
    )
    tags_raw = tags_result.data or []
    trending_topics = []
    for tag in tags_raw:
        notes_in_tag = [
            nt["notes"] for nt in (tag.get("note_tags") or [])
            if nt and nt.get("notes")
        ]
        if not notes_in_tag:
            continue
        trending_topics.append({
            "topic": tag["name"],
            "count": len(notes_in_tag),
            "notes": [{"id": n["id"], "title": n.get("title", "Untitled")} for n in notes_in_tag[:3]],
        })
    trending_topics.sort(key=lambda t: t["count"], reverse=True)

    # ── 2. Most connected notes (by note_links count) ─────────────────────────
    links_result = await asyncio.to_thread(
        lambda: db.table("note_links").select("source_id, target_id").execute()
    )
    links_raw = links_result.data or []
    connection_counts: dict[str, int] = {}
    for link in links_raw:
        for key in ("source_id", "target_id"):
            nid = str(link[key])
            connection_counts[nid] = connection_counts.get(nid, 0) + 1

    top_ids = sorted(connection_counts, key=lambda k: connection_counts[k], reverse=True)[:10]
    most_connected = []
    if top_ids:
        notes_res = await asyncio.to_thread(
            lambda: db.table("notes").select("id, title").in_("id", top_ids).execute()
        )
        id_to_title = {n["id"]: n.get("title", "Untitled") for n in (notes_res.data or [])}
        for nid in top_ids:
            most_connected.append({
                "id": nid,
                "title": id_to_title.get(nid, "Untitled"),
                "connections": connection_counts[nid],
            })

    # ── 3. Activity heatmap — daily note creation for last 84 days ────────────
    since = datetime.now(timezone.utc) - timedelta(days=84)
    activity_result = await asyncio.to_thread(
        lambda: db.table("notes").select("created_at").gte("created_at", since.isoformat()).execute()
    )
    activity_raw = activity_result.data or []

    # Build date → count map
    counts_by_date: dict[str, int] = {}
    for n in activity_raw:
        day = n["created_at"][:10]  # "YYYY-MM-DD"
        counts_by_date[day] = counts_by_date.get(day, 0) + 1

    # Generate 84 consecutive days
    today = date.today()
    heatmap = []
    for i in range(83, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        heatmap.append({"date": d, "count": counts_by_date.get(d, 0)})

    return {
        "trending_topics": trending_topics[:12],
        "most_connected": most_connected,
        "activity_heatmap": heatmap,
    }


@router.post("/translate")
async def translate_note(body: dict):
    """Translate note content to a target language using Gemini."""
    content = body.get("content", "")
    target_language = body.get("target_language", "Spanish")
    if not content.strip():
        return {"translated": ""}
    prompt = (
        f"Translate the following text to {target_language}. "
        f"Preserve the original formatting (headings, lists, etc.) as much as possible. "
        f"Return ONLY the translated text, nothing else.\n\nTEXT:\n{content}"
    )
    translated = await gemini.generate(prompt)
    return {"translated": translated.strip()}


@router.post("/research", response_model=ResearchResponse)
async def research_assistant(body: ResearchRequest):
    """Summarize an article or research paper and extract key insights."""
    system = (
        "You are an expert research assistant. Given the provided text (article, paper, or notes), "
        "return JSON with keys: "
        "summary (2-3 sentence summary), "
        "key_insights (list of 4-6 specific insights or findings), "
        "concepts (list of 3-5 important concepts introduced). "
        'Example: {"summary": "...", "key_insights": [...], "concepts": [...]}'
    )
    data = await gemini.generate_json(body.text, system=system)
    return ResearchResponse(
        summary=data.get("summary", ""),
        key_insights=data.get("key_insights", []),
        concepts=data.get("concepts", []),
    )
