import re
import random

# -----------------------------
# Bad Words
# -----------------------------
PROFANITY_WORDS = set([
    "fuck", "fucker", "fucking", "shit", "bitch", "bastard",
    "asshole", "cunt", "dick", "pussy", "cock",
    "motherfucker", "whore", "slut", "bullshit", "douche",
    "nigger", "faggot", "wanker","suck","dih","dihh","nigga","negro","puh","ahole","a-hole","dwarf","milf","gilf","porn","poopjeet","bomb","4","5"

    "chutiya", "bhenchod", "madarchod", "gandu", "bhosdike",
    "harami", "kutta", "kamina", "lauda", "lode",
    "gaand", "chut", "saala", "bakchod", "mc", "bc",
    "gaandu", "saale","die","suicide","1"

    "mierda", "puta", "pendejo", "cabron", "maricon",
    "joder", "coño",

    "merde", "putain", "salope", "connard", "enculè",

    "scheisse", "arschloch", "fick", "hurensohn",

    "oombu", "thevudiya", "sunni", "paadu",
    "kuchukaari", "owsaari", "ommala", "gotha", "oaka"
])

# -----------------------------
# Crisis Detection
# -----------------------------
CRISIS_PATTERNS = [
    r"want to die",
    r"wanna die",
    r"kill myself",
    r"end my life",
    r"suicide",
    r"dont want to live",
    r"don't want to live",
    r"want to end it all",
    r"no reason to live",
    r"better off dead",
    r"cutting myself",
    r"self harm",
    r"marna hai",
    r"mar jana hai",
    r"mar jana chahta",
    r"zindagi khatam",
    r"suicidal",
    r"die tonight",
    r"take my life"
]

HELPLINE_RESOURCES = {
    "title": "You Are Not Alone 💙",
    "description": "Please reach out to someone you trust. Professional help is available.",
    "contacts": [
        {"name": "Tele-MANAS", "number": "14416"},
        {"name": "988 Lifeline", "number": "988"}
    ]
}

# -----------------------------
# Emotion Detection
# -----------------------------
EMOTIONS = {
    "Sad 😢": [
        "sad", "cry", "crying", "depressed",
        "lonely", "hurt", "pain", "broken",
        "unhappy", "upset"
    ],

    "Happy 😊": [
        "happy", "joy", "excited", "great",
        "awesome", "good", "love", "smile",
        "wonderful"
    ],

    "Anxious 😟": [
        "anxious", "stress", "stressed",
        "worried", "panic", "fear",
        "nervous", "overthinking"
    ],

    "Angry 😠": [
        "angry", "mad", "hate",
        "annoyed", "frustrated",
        "furious"
    ]
}


# -----------------------------
# Analyze Text
# -----------------------------
def analyze_text(text: str) -> dict:

    cleaned_text = text.lower()

    # Crisis
    for pattern in CRISIS_PATTERNS:
        if re.search(pattern, cleaned_text):
            emotion = "Neutral"
            stress = "Low"
            risk = "Safe"
            recommendation = "Keep sharing your thoughts."

            text = cleaned_text

            if any(word in text for word in ["sad", "cry", "lonely", "depressed"]):
                emotion = "Sadness"
                stress = "High"
                recommendation = "Take some time to rest and talk with someone you trust."

            elif any(word in text for word in ["anxiety", "stress", "worried", "panic"]):
                emotion = "Anxiety"
                stress = "High"
                recommendation = "Try deep breathing and take a short break."

            elif any(word in text for word in ["angry", "hate", "furious"]):
                emotion = "Anger"
                stress = "Medium"
                recommendation = "Take a moment before reacting and express your feelings calmly."

            elif any(word in text for word in ["happy", "great", "excited", "joy"]):
                emotion = "Happiness"
                stress = "Low"
                recommendation = "It's great to hear you're feeling positive. Keep it up!"

            return {
                "status": "clean",
                "blocked": False,
                "reason": None,
                "message": "Message is clean and safe to post.",
                "emotion": emotion,
                "stress_level": stress,
                "risk_level": risk,
                "recommendation": recommendation
            }

    # Bad Words
    words = re.findall(r"\b\w+\b", cleaned_text)

    detected_bad_words = [
        word for word in words
        if word in PROFANITY_WORDS
    ]

    if not detected_bad_words:
        for bad in PROFANITY_WORDS:
            if len(bad) > 3 and bad in cleaned_text:
                detected_bad_words.append(bad)

    if detected_bad_words:
        return {
            "status": "bad_word",
            "blocked": True,
            "reason": "profanity_detected",
            "emotion": "Offensive ⚠️",
            "detected_words": list(set(detected_bad_words)),
            "message": "Please avoid offensive language."
        }

    # Emotion Detection
    emotion = "Neutral 😐"

    for mood, keywords in EMOTIONS.items():
        if any(word in cleaned_text for word in keywords):
            emotion = mood
            break

    return {
        "status": "clean",
        "blocked": False,
        "reason": None,
        "emotion": emotion,
        "message": "Message is clean and safe."
    }


# -----------------------------
# MindBot Replies
# -----------------------------
MINDBOT_RESPONSES = {
    "crisis": [
        "I'm here with you. Please reach out to someone you trust."
    ],

    "sadness": [
        "I'm sorry you're feeling sad. Would you like to tell me what's been happening?"
    ],

    "anxiety": [
        "Take a slow breath. I'm here to listen."
    ],

    "general": [
        "Hello! I'm here for you. What's on your mind today?"
    ]
}


def generate_mindbot_reply(user_message: str):

    analysis = analyze_text(user_message)

    if analysis["status"] == "crisis":
        return random.choice(MINDBOT_RESPONSES["crisis"])

    msg = user_message.lower()

    if analysis["emotion"] == "Sad 😢":
        return random.choice(MINDBOT_RESPONSES["sadness"])

    elif analysis["emotion"] == "Anxious 😟":
        return random.choice(MINDBOT_RESPONSES["anxiety"])

    else:
        return random.choice(MINDBOT_RESPONSES["general"])