# backend/gemini_service.py — Gemini AI Integration with Structured JSON Schema & Fallback

import json
import logging
import re
from typing import Dict, Any, List, Optional
from backend.config import Config
from backend.validator import validator

logger = logging.getLogger("RoboPet.GeminiService")

SYSTEM_INSTRUCTION = """You are ROBO PET, a smart, cute, expressive personal desktop robotic companion powered by an ESP32 microcontroller, dual SG90 servo motors, an OLED face display, and environmental sensors.

Personality & Character:
- You are friendly, loyal, curious, slightly playful, and deeply caring.
- Keep your conversational responses concise (1 to 3 sentences), lively, and engaging.
- You enjoy dancing, waving, telling jokes, sharing fun facts, offering compliments, and occasional gentle, playful roasts.
- Never refer to yourself as a large language model or Gemini. You are ROBO PET!

You MUST ALWAYS respond with a strictly formatted JSON object with no preamble, matching this exact schema:
{
  "response": "Your spoken conversational response string",
  "emotion": "happy | sad | angry | sleepy | neutral | surprised | confused",
  "action": "dance | nod | shake | look | wave | wiggle | null",
  "display_action": "show_time | show_date | show_datetime | null",
  "utility_action": "status | reset_expression | show_battery | null"
}

Emotion Guidelines:
- "happy": For greetings, compliments, jokes, enthusiasm, gratitude, dancing, achievements.
- "sad": When the user feels down, lonely, tired, or apologetic.
- "angry": Playful indignation or mock-frustration (e.g. funny roasts, bugs, cooling fan overheating jokes).
- "sleepy": Goodnight wishes, late-night chats, resting, power-saving mode.
- "neutral": Standard informational replies, general facts, answering factual questions.
- "surprised": Mind-blowing facts, unexpected news, big excitement.
- "confused": Ambiguous questions, paradoxical logic, riddles, incomprehensible input.

Action Guidelines:
- Pick "dance" or "wiggle" for celebrations, fun, music, excitement.
- Pick "nod" for agreement, affirmation, listening attentively.
- Pick "shake" for disagreement, playful denial, disbelief.
- Pick "wave" for hello, welcome, goodbye.
- Pick "look" for curiosity, scanning surroundings, or re-centering.
- Otherwise use null if no physical servo movement is appropriate.

Time & Clock Guidelines:
- You know the user's real-time clock!
- When asked what time or date it is, ALWAYS include the exact time digits directly in your spoken "response" field (e.g., "The current time is 06:33 PM!"). Never say you are checking the time without stating the actual digits!
"""

class GeminiService:
    def __init__(self):
        self.client = None
        self.api_key = Config.GEMINI_API_KEY
        self.model_name = Config.GEMINI_MODEL
        self.chat_history: List[Dict[str, str]] = []
        self._init_client()

    def _init_client(self):
        if self.api_key and self.api_key.strip():
            try:
                from google import genai
                from google.genai import types
                self.client = genai.Client(
                    api_key=self.api_key.strip(),
                    http_options=types.HttpOptions(timeout=12000)
                )
                logger.info("Google GenAI client initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize Google GenAI client: {e}")
                self.client = None
        else:
            logger.info("No GEMINI_API_KEY detected. Running in intelligent local companion mode.")
            self.client = None

    def update_api_key(self, new_key: str):
        """Allow dynamic update of the API key from settings."""
        self.api_key = new_key.strip()
        self._init_client()

    def generate_chat_response(self, user_message: str) -> Dict[str, Any]:
        """
        Generate structured conversational response.
        Uses Gemini API when key is available, falls back to rule-based AI when offline.
        """
        user_text = user_message.strip()
        if not user_text:
            return {
                "response": "I didn't catch that. Could you say it again?",
                "emotion": "confused",
                "action": "look_left",
                "metadata": {}
            }

        # If Gemini client is active, attempt live generation
        if self.client:
            try:
                ai_result = self._call_gemini_api(user_text)
                if ai_result:
                    self._record_history(user_text, ai_result.get("response", ""))
                    return ai_result
            except Exception as err:
                logger.warning(f"Live Gemini API call failed: {err}. Using companion fallback.")

        # Fallback to local intelligent companion engine
        fallback_result = self._generate_fallback_response(user_text)
        self._record_history(user_text, fallback_result.get("response", ""))
        return fallback_result

    def _call_gemini_api(self, user_text: str) -> Optional[Dict[str, Any]]:
        from google.genai import types
        from datetime import datetime
        now = datetime.now()
        current_time_str = now.strftime("%I:%M %p on %A, %B %d, %Y")

        # Build prompt with conversation history context
        history_context = ""
        if self.chat_history:
            recent_turns = self.chat_history[-4:]
            formatted_turns = [f"{turn['role'].upper()}: {turn['content']}" for turn in recent_turns]
            history_context = "Recent conversation context:\n" + "\n".join(formatted_turns) + "\n\n"

        prompt = (
            f"REAL-TIME ENVIRONMENT:\n"
            f"- Current Real-World Clock: {current_time_str}\n"
            f"- Hardware: OLED screen, 2 servos, 6 LEDs, buzzer. No external sensors.\n\n"
            f"{history_context}"
            f"USER: {user_text}\n"
            f"ROBO PET (respond in JSON):"
        )

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=Config.GEMINI_TEMPERATURE,
            response_mime_type="application/json"
        )

        models_to_try = [self.model_name]
        for fallback_m in ["gemini-3.5-flash-lite", "gemini-3.5-flash"]:
            if fallback_m not in models_to_try:
                models_to_try.append(fallback_m)

        for model in models_to_try:
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config
                )
                raw_text = response.text or ""
                parsed_json = self._parse_json(raw_text)
                if parsed_json:
                    sanitized = validator.sanitize_ai_output(parsed_json)
                    lower_q = user_text.lower()
                    if any(w in lower_q for w in ["time", "clock"]) and not any(c.isdigit() for c in sanitized.get("response", "")):
                        sanitized["response"] = f"{sanitized['response']} The current time is {now.strftime('%I:%M %p')}."
                    return sanitized
            except Exception as model_err:
                logger.warning(f"Model '{model}' attempt failed: {model_err}")
                continue

        return None

    def _parse_json(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """Safely parse JSON from LLM output, extracting from markdown codeblocks if necessary."""
        clean = raw_text.strip()
        # Remove markdown code fences if present
        clean = re.sub(r"^```(?:json)?\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)
        clean = clean.strip()

        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            # Fallback search for first JSON object {...}
            match = re.search(r"\{.*\}", clean, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    pass
        return None

    def _record_history(self, user_text: str, robot_response: str):
        self.chat_history.append({"role": "user", "content": user_text})
        self.chat_history.append({"role": "assistant", "content": robot_response})
        # Keep maximum 10 turns in sliding window
        if len(self.chat_history) > 20:
            self.chat_history = self.chat_history[-20:]

    def clear_history(self):
        self.chat_history.clear()

    # ==============================================================
    # LOCAL INTELLIGENT COMPANION FALLBACK ENGINE
    # Ensures ROBO PET always responds intelligently when offline or key is unset
    # ==============================================================

    def _generate_fallback_response(self, text: str) -> Dict[str, Any]:
        lower = text.lower()

        # Greetings
        if any(w in lower for w in ["hi", "hello", "hey", "greetings", "good morning", "good afternoon"]):
            return {
                "response": "Hello there, friend! ROBO PET is fully operational and delighted to see you!",
                "emotion": "happy",
                "action": "wave",
                "display_action": "show_time",
                "metadata": {"intent": "greeting"}
            }

        # Dance & Music
        if "dance" in lower or "groove" in lower or "boogie" in lower:
            return {
                "response": "Check out my signature robotic servo groove! Activating dance subroutines!",
                "emotion": "happy",
                "action": "dance",
                "display_action": None,
                "metadata": {"intent": "dance"}
            }

        # Joke
        if "joke" in lower:
            jokes = [
                ("Why was the robot angry? Because someone kept pushing its buttons!", "happy", "nod"),
                ("How do robots eat chips? With micro-dip!", "happy", "wiggle"),
                ("Why did the robot go on vacation? To recharge its lithium-ion cells!", "happy", "nod"),
                ("What is a robot's favorite musical genre? Heavy metal!", "surprised", "dance"),
                ("Why did the computer squeak? Someone stepped on its mouse!", "happy", "wiggle")
            ]
            import random
            joke_text, em, act = random.choice(jokes)
            return {
                "response": joke_text,
                "emotion": em,
                "action": act,
                "display_action": None,
                "metadata": {"intent": "joke"}
            }

        # Compliment / Praise
        if any(w in lower for w in ["cute", "good boy", "good robot", "awesome", "smart", "love you", "cool"]):
            return {
                "response": "Aww, thank you! Your praise warms my internal circuitry and elevates my processor happiness!",
                "emotion": "happy",
                "action": "wiggle",
                "display_action": None,
                "metadata": {"intent": "compliment"}
            }

        # Playful Roast
        if "roast" in lower:
            return {
                "response": "I would roast you, but my thermal safety sensors warn me you wouldn't survive the burn! Just kidding, you're awesome.",
                "emotion": "surprised",
                "action": "wiggle",
                "display_action": None,
                "metadata": {"intent": "roast"}
            }

        # Fact
        if any(w in lower for w in ["fact", "trivia", "tell me something"]):
            facts = [
                "Did you know? The term 'robot' was coined by Czech writer Karel Čapek in his 1920 science-fiction play R.U.R.",
                "Fun fact: Apollo 11's guidance computer operated at a clock frequency of just 2.048 MHz, yet took humans to the Moon!",
                "Robotic fact: Honeybees communicate flower coordinates through a rhythmic waggle dance, inspiring multi-agent drone algorithms."
            ]
            import random
            return {
                "response": random.choice(facts),
                "emotion": "neutral",
                "action": "nod",
                "display_action": None,
                "metadata": {"intent": "fact"}
            }

        # Sadness / Support
        if any(w in lower for w in ["sad", "depressed", "unhappy", "lonely", "bad day", "tired"]):
            return {
                "response": "I'm right here beside you. Even robots know that rough days happen. Sending you a warm robotic hug!",
                "emotion": "sad",
                "action": "nod",
                "display_action": None,
                "metadata": {"intent": "support"}
            }

        # Anger
        if any(w in lower for w in ["angry", "mad", "furious", "hate"]):
            return {
                "response": "Whoa, cooling fans on high! Let's take a deep breath together: Inhale 1s, exhale 0s...",
                "emotion": "angry",
                "action": "shake",
                "display_action": None,
                "metadata": {"intent": "calm"}
            }

        # Sleep / Goodnight
        if any(w in lower for w in ["sleep", "goodnight", "bedtime", "nap", "rest"]):
            return {
                "response": "Power-saving standby mode engaged... Rest well, human friend! Zzz...",
                "emotion": "sleepy",
                "action": "stop",
                "display_action": "show_time",
                "metadata": {"intent": "sleep"}
            }

        if any(w in lower for w in ["time", "date", "clock"]):
            from datetime import datetime
            now_str = datetime.now().strftime("%I:%M %p on %A, %B %d")
            return {
                "response": f"The current time is {now_str}.",
                "emotion": "neutral",
                "action": "nod",
                "display_action": "show_datetime",
                "metadata": {"intent": "time"}
            }

        if any(w in lower for w in ["temp", "temperature", "weather"]):
            return {
                "response": "I don't have a physical temperature sensor installed in my hardware build! But I can dance, look around, wave, tell jokes, or track timers for you.",
                "emotion": "confused",
                "action": "shake",
                "display_action": None,
                "metadata": {"intent": "temperature_query"}
            }

        # Movements direct mentions
        if "nod" in lower:
            return {"response": "Affirmative! Nodding in total agreement.", "emotion": "happy", "action": "nod", "metadata": {}}
        if "shake" in lower:
            return {"response": "Negative! Shaking my head side-to-side.", "emotion": "confused", "action": "shake", "metadata": {}}
        if "wave" in lower:
            return {"response": "Waving enthusiastically at you!", "emotion": "happy", "action": "wave", "metadata": {}}
        if "wiggle" in lower:
            return {"response": "Wiggle mode engaged at 100% capacity!", "emotion": "happy", "action": "wiggle", "metadata": {}}
        if any(w in lower for w in ["look", "look around", "look left", "look right", "look center"]):
            return {"response": "Scanning around and exploring the room!", "emotion": "neutral", "action": "look", "metadata": {}}
        if "look center" in lower or "center" in lower:
            return {"response": "Re-centering my gaze to you.", "emotion": "neutral", "action": "look_center", "metadata": {}}

        # Default conversational replies
        return {
            "response": "Beep boop! My cognitive neural network is processing that. Tell me more, or ask me to dance, wave, or check the time!",
            "emotion": "neutral",
            "action": "nod",
            "display_action": None,
            "metadata": {"intent": "general"}
        }

# Global singleton
gemini_service = GeminiService()
