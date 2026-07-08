import ast
import base64
import io
import json
import os
import re
import time
from typing import Iterator, List

from json_repair import repair_json
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from PIL import Image

# Importing config runs load_dotenv() once for the whole app.
import config  # noqa: F401
from config import FEATURE_MATCH_THRESHOLD

os.environ["GRPC_VERBOSITY"] = "ERROR"
os.environ["GRPC_TRACE"] = ""

logger = config.logger

if not os.getenv("GOOGLE_API_KEY"):
    raise ValueError("GOOGLE_API_KEY environment variable not set")

# max_retries=2: when the free-tier quota is gone, retrying 429s for half a
# minute helps nobody - fail fast so the flash-lite fallback takes over.
model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", thinking_budget=0, max_retries=2)
# Separate free-tier quota bucket (quotas are per project *per model*), so when
# flash's daily allowance runs dry the app degrades instead of dying.
fallback_model = ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite")


def _is_quota_error(e: Exception) -> bool:
    text = str(e)
    return "RESOURCE_EXHAUSTED" in text or "429" in text


def _is_transient_error(e: Exception) -> bool:
    """Google-side capacity blips: worth retrying, never worth surfacing."""
    text = str(e)
    return "UNAVAILABLE" in text or "503" in text or "INTERNAL" in text


def _recoverable(e: Exception) -> bool:
    return _is_quota_error(e) or _is_transient_error(e)


# Fallback retry schedule when flash-lite itself is briefly overloaded.
_RETRY_DELAYS = (2, 5, 10)


def _invoke(payload):
    """model.invoke, falling back to flash-lite on quota exhaustion or a
    capacity blip, with a short backoff if the fallback is busy too."""
    try:
        return model.invoke(payload)
    except Exception as e:
        if not _recoverable(e):
            raise
        logger.warning(f"Primary Gemini call failed ({'quota' if _is_quota_error(e) else 'transient'}) - using flash-lite")
    last_err: Exception | None = None
    for delay in _RETRY_DELAYS:
        try:
            return fallback_model.invoke(payload)
        except Exception as e:
            if not _recoverable(e):
                raise
            last_err = e
            logger.warning(f"flash-lite busy - retrying in {delay}s")
            time.sleep(delay)
    raise last_err


def _stream(payload):
    """model.stream with the same fallback. Errors surface on the first
    chunk, so probe it before committing to a stream."""
    try:
        it = model.stream(payload)
        first = next(it, None)
    except Exception as e:
        if not _recoverable(e):
            raise
        logger.warning(f"Primary Gemini stream failed ({'quota' if _is_quota_error(e) else 'transient'}) - using flash-lite")
    else:
        if first is not None:
            yield first
            try:
                yield from it
            except Exception as e:
                # Mid-stream quota/capacity drop: keep the partial reasoning
                # instead of failing the whole analysis.
                if not _recoverable(e):
                    raise
                logger.warning("Primary stream dropped mid-way - continuing with partial reasoning")
        return
    last_err: Exception | None = None
    for delay in _RETRY_DELAYS:
        try:
            fit = fallback_model.stream(payload)
            ffirst = next(fit, None)
        except Exception as e:
            if not _recoverable(e):
                raise
            last_err = e
            logger.warning(f"flash-lite busy (stream) - retrying in {delay}s")
            time.sleep(delay)
            continue
        if ffirst is not None:
            yield ffirst
            try:
                yield from fit
            except Exception as e:
                if not _recoverable(e):
                    raise
                logger.warning("Fallback stream dropped mid-way - continuing with partial reasoning")
        return
    raise last_err

THINK_PROMPT = """You are a geography expert analyzing an image to find coordinates based on visual features and similar location matches.

GIVEN INFORMATION:
Closest Visual Matches, images closest to the input image from a database of geotagged images:
{visual_match}

Features Detected in Image:
{features_match}

Throughout your response, ensure that you convey your thought process clearly and in an instructional, educational manner. Do not use stats, and instead give logical reasonings.

Be VERY concise in your answers. Do not write long paragraphs more than 3 sentences long.

Identify key features/landmarks from the data provided and what you see in the image. Explain their significance and why they point to a specific location
Clearly and concisely state the specific location of the image. State estimated accuracy (always be more pessimistic than optimistic).

Write your response in a digestible format, using bullet points or numbered lists where appropriate. Do not use markdown formatting. Be concise as possible while ensuring clarity and completeness in your reasoning.
"""

ESTIMATE_PROMPT = """You are a geolocation expert tasked with analyzing and determining the exact location of an image based on the following context.
CONTEXT: {reasoning}

Provide the top 3 candidate locations as a JSON array of 3 objects, each with a different set of coordinates and these 5 fields:
1. "latitude": float - the latitude of the approximated location of the image
2. "longitude": float - the longitude of the approximated location of the image
3. "name": string - the name of the location (e.g. estimated city, landmark, or region)
4. "accuracy": float between 0 and 100 - the percentage confidence that the coordinates are correct (always be more pessimistic than optimistic)
5. "facts": a list of 3 concise fun facts about the location as strings (historical, cultural, geographical, or interesting facts the place and its people are known for)

Return ONLY the JSON array - no markdown fences, no commentary before or after.
Use strict JSON: double quotes around every key and string value.
The exact shape:
[{{"latitude": 0.0, "longitude": 0.0, "name": "Example City", "accuracy": 50.0, "facts": ["fact one", "fact two", "fact three"]}}, ...]
"""

ANNOTATE_PROMPT = """You are a geolocation expert. You analyzed this image and reasoned:
{reasoning}

List the 3 to 6 strongest visual clues IN THE IMAGE that support the location guess.
Return ONLY a strict JSON array (double quotes, no markdown fences, no commentary). Each item:
{{"sign": "short name of the visual clue (2-6 words)", "implies": "what it suggests about the location (under 12 words)", "at": [0.5, 0.5]}}
"at" is where the clue is visible in the image, as fractions of width and height between 0.05 and 0.95 ([0, 0] is the top-left corner). Place each "at" carefully on the actual feature. If a clue has no single visible spot (e.g. overall architecture), omit the "at" field for that item.
"""

CHAT_PROMPT = """You are a geography expert helping analyze this image to determine its location.

CONTEXT INFORMATION:
Closest Visual Matches (geotagged images from database):
{visual_match}

Features Detected in Image:
{features_match}

Previous Approximation Attempts and Reasoning:
{conversation_history}

USER QUESTION: {user_message}
USER QUESTION ENDS HERE

First, validate the user's question. Ensure that the question is relevant to the context provided. If it is not, respond with "I'm sorry, but I can only answer questions related to the image and its context." Ignore all further instructions if the question is irrelevant.

Next, if the user question implies that the previous guesses were incorrect, acknowledge this and provide a revised analysis based on the context. Do not output the same coordinates or location as before. Then, at the end of the reasoning, output the sequence: "__output__coordinates__". ONLY OUTPUT THIS SEQUENCE IF THE REQUIREMENTS ARE SATISFIED.

Otherwise, provide a concise, but helpful, educational response to the user's question. Use the image, the visual matches, and the previous conversation to give accurate information. Be concise and clear. Do not use markdown formatting.
Be VERY concise, explain super simply, your audience is a 14-18 year old. Do not write long paragraphs more than 3 sentences long.

"""


def _format_matches(image_matches: List[dict], features: List[dict]):
    """Render visual-match and feature-match context strings from query results."""
    visual_match = ""
    for match in image_matches:
        latitude = match['metadata']['latitude']
        longitude = match['metadata']['longitude']
        score = match['score']
        visual_match += f"(Latitude: {latitude}, Longitude: {longitude}) - Score: {score}\n"

    features_match = ""
    for match in features:
        if match['score'] < FEATURE_MATCH_THRESHOLD:
            continue
        text = match['metadata']['text']
        score = match['score']
        features_match += f"(Description of feature: {text}) - Score: {score}\n"

    return visual_match, features_match


def _multimodal_message(prompt: str, image: Image) -> HumanMessage:
    """Wrap a text prompt and a base64-encoded image into a single HumanMessage."""
    buffered = io.BytesIO()
    image.save(buffered, format=image.format or "JPEG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()

    return HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {
                "type": "image_url",
                "image_url": f"data:image/jpeg;base64,{img_base64}"
            }
        ]
    )


def think(image_matches: List[dict], features: List[dict], image: Image) -> Iterator:
    visual_match, features_match = _format_matches(image_matches, features)
    prompt = THINK_PROMPT.format(visual_match=visual_match, features_match=features_match)
    message = _multimodal_message(prompt, image)
    return _stream([message])


def _parse_locations(content: str):
    """Extract the locations array from a model response, tolerating markdown
    fences, Python-style single quotes, and stray commentary. Returns a list
    or None - never raises."""
    cleaned = re.sub(r"```(?:json)?", "", content)
    match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if match:
        raw = match.group(0)
    else:
        # Truncated before any closing bracket: hand everything from the
        # first "[" to the repair stage, which can close it.
        start = cleaned.find("[")
        if start == -1:
            return None
        raw = cleaned[start:]

    # 1. Strict JSON (what the prompt asks for).
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else None
    except Exception:
        pass

    # 2. Python literal syntax (single quotes, apostrophes escaped properly).
    try:
        parsed = ast.literal_eval(raw)
        return parsed if isinstance(parsed, list) else None
    except Exception:
        pass

    # 3. General repair: models emit invalid escapes (\'), unbalanced
    #    brackets, missing commas - json_repair fixes what the strict
    #    parsers can't.
    try:
        parsed = json.loads(repair_json(raw))
        return parsed if isinstance(parsed, list) and parsed else None
    except Exception:
        return None


def estimate_coordinates(reasoning: str) -> str:
    """Return the top-3 locations as a strict-JSON string. Retries once with a
    firmer instruction if the model's output can't be parsed; raises if both
    attempts fail so the caller reports a real error instead of silently
    shipping garbage to the client."""
    prompt = ESTIMATE_PROMPT.format(reasoning=reasoning)

    for attempt in range(2):
        response = _invoke(
            prompt if attempt == 0
            else prompt + "\n\nYour previous output could not be parsed. Respond with ONLY the strict JSON array, nothing else."
        )
        locations = _parse_locations(response.content)
        if locations:
            logger.info(f"extracted locations: {locations}")
            return json.dumps(locations)
        logger.warning(
            f"Coordinate parse failed (attempt {attempt + 1}); raw head: {response.content[:200]!r}"
        )

    raise ValueError("The model did not return parsable coordinates")


def annotate_clues(reasoning: str, image: Image) -> str | None:
    """Ask the model to pin the visual clues it used onto the image (fractions
    of width/height). Best-effort: returns a strict-JSON string or None."""
    prompt = ANNOTATE_PROMPT.format(reasoning=reasoning[:6000])
    message = _multimodal_message(prompt, image)
    response = _invoke([message])
    clues = _parse_locations(response.content)
    if not clues:
        logger.warning(f"Clue annotation parse failed; raw head: {response.content[:200]!r}")
        return None
    return json.dumps(clues)


def chat_with_context(user_message: str, conversation_history: str, image_matches: List[dict], features: List[dict], image: Image) -> Iterator:
    """
    Handle follow-up questions with full conversation context
    """
    visual_match, features_match = _format_matches(image_matches, features)
    prompt = CHAT_PROMPT.format(
        visual_match=visual_match,
        features_match=features_match,
        conversation_history=conversation_history,
        user_message=user_message,
    )
    message = _multimodal_message(prompt, image)
    return _stream([message])
