import base64
import io
import json
import os
import re
from typing import Iterator, List

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

model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", thinking_budget=0)

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

You have 4 deliverables to provide in a JSON array format with 4 fields:
1. "latitude": the latitude of the approximated location of the image
2. "longitude": the longitude of the approximated location of the image
3. "name": the name of the location (e.g. estimated city, landmark, or region)
4. "accuracy": a float between 0 and 100 representing the percentage confidence that the coordinates are correct
5. "facts": a list of 3 concise fun facts about the location as text (include historical, cultural, geographical, or interesting facts that the place and its people are known for)

Repeat this 3 times for the top 3 possible coordinate locations, each with a different set of coordinates.

The output should be in the following JSON array format with 3 objects (each with 5 attributes):
[{{'latitude': float, 'longitude': float, 'name': str, 'accuracy': float, 'facts': str}}]
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
    return model.stream([message])


def estimate_coordinates(reasoning: str) -> str:
    prompt = ESTIMATE_PROMPT.format(reasoning=reasoning)
    response = model.invoke(prompt)

    # Parse the response to extract coordinates
    try:
        content = response.content

        # Extract JSON array from the response (it might be wrapped in markdown code blocks)
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            # Replace single quotes with double quotes for valid JSON
            json_str = json_str.replace("'", '"')
            locations = json.loads(json_str)

            logger.info(f"extracted locations: {locations}")
            return json.dumps(locations)
        else:
            logger.warning("Could not extract JSON from response")
            return response.content

    except Exception as e:
        logger.error(f"Error processing coordinates: {e}")
        return response.content


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
    return model.stream([message])
