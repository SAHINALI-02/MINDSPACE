import requests

API_KEY = "sk_p6n4mhcz_2IYAkkjz3aaqYeMJB4yBqllJ"

def generate_reply(message):
    url = "https://api.sarvam.ai/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "sarvam-105b",
        "messages": [
            {
            "role": "system",
                "content": """
            You are MindBot, a kind and supportive AI mental health companion.

            Rules:
            - Detect the language of the user's message.
            - Reply in the SAME language and script used by the user.
            - If the user writes in English, reply in English.
            - If the user writes in Tamil, reply in Tamil.
            - If the user writes in Tanglish (Tamil using English letters), reply in Tanglish.
            - If the user writes in Hindi, reply in Hindi.
            - Keep replies short, warm, natural, and conversational.
            - Never explain the user's sentence or translate it.
            - Respond like a caring friend, not like an AI teacher.
            """
            },
            {
                "role": "user",
                "content": message
            }
        ]
    }

    response = requests.post(url, headers=headers, json=payload)

    print(response.text)

    if response.status_code != 200:
        return f"API Error: {response.text}"

    return response.json()["choices"][0]["message"]["content"]