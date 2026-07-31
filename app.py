import os
import sqlite3
import hashlib
import requests
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, EmailStr

from moderation import analyze_text
from chatbot import generate_reply

RECAPTCHA_SECRET = "6LejaWwtAAAAADTO_sRQFPm2G5OAox0PmTT47I9d"

# DB Setup
DB_FILE = "mindspace.db"

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    users_table_exists = cursor.fetchone() is not None

    if users_table_exists:
        cursor.execute("PRAGMA table_info(users)")
        user_columns = [row['name'] for row in cursor.fetchall()]
        if 'email' not in user_columns or 'name' not in user_columns or 'alias' in user_columns:
            cursor.execute("ALTER TABLE users RENAME TO users_old")
            cursor.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """)
            cursor.execute(
                "INSERT INTO users (name, email, password_hash, created_at) SELECT COALESCE(name, alias, 'Anonymous'), email, password_hash, created_at FROM users_old WHERE email IS NOT NULL"
            )
            cursor.execute("DROP TABLE users_old")
    else:
        cursor.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """)

    # Posts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_alias TEXT NOT NULL,
        content TEXT NOT NULL,
        feed_type TEXT NOT NULL, -- 'public' or 'private'
        mood_tag TEXT DEFAULT 'Venting',
        hugs_count INTEGER DEFAULT 0,
        feels_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)
    
    # Feedback Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_alias TEXT DEFAULT 'Anonymous Guest',
        rating INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)
    
    # Seed sample posts if empty
    cursor.execute("SELECT COUNT(*) FROM posts")
    if cursor.fetchone()[0] == 0:
        sample_posts = [
            ("QuietWanderer", "Sometimes late at night, I just stare at the stars and feel overwhelmed by life's direction. Sending strength to anyone feeling lost today. 🌙", "public", "NightThoughts", 12, 19, datetime.now().isoformat()),
            ("SereneOwl", "I managed to step outside for a 15-minute walk today despite my anxiety! Small wins matter.", "public", "SmallWins", 24, 30, datetime.now().isoformat()),
            ("HiddenEcho", "Being able to write in this Private Sector without revealing my identity gives me so much peace. Thank you for this safe space.", "private", "Gratitude", 8, 15, datetime.now().isoformat()),
            ("CalmBreeze", "Reminder: You are allowed to take breaks. You don't have to carry the weight of the entire world on your shoulders. 💙", "public", "Advice", 45, 62, datetime.now().isoformat())
        ]
        cursor.executemany("""
            INSERT INTO posts (author_alias, content, feed_type, mood_tag, hugs_count, feels_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, sample_posts)
        
    conn.commit()
    conn.close()

init_db()

app = FastAPI(title="MindSpace Anonymous Chat API")

# Pydantic Schemas
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class PostCreate(BaseModel):
    content: str
    mood_tag: Optional[str] = "Venting"
    alias: Optional[str] = "Anonymous Friend"

class ChatRequest(BaseModel):
    message: str

class FeedbackRequest(BaseModel):
    rating: int
    message: str
    alias: Optional[str] = "Anonymous Guest"

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_user_from_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer token_"):
        return None
    email = authorization.replace("Bearer token_", "").strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    return row["name"] if row else None

# API Routes

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    name = req.name.strip()
    email = req.email.strip().lower()
    password = req.password

    if len(name) < 3 or len(password) < 4:
        raise HTTPException(status_code=400, detail="Name must be at least 3 chars and password at least 4 chars.")

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (name, email, hash_password(password), datetime.now().isoformat())
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="This email is already registered. Please login or use another email.")

    conn.close()
    return {
        "status": "success",
        "name": name,
        "email": email,
        "token": f"token_{email}"
    }

@app.post("/api/auth/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash, name FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()

    if not row or row["password_hash"] != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "status": "success",
        "name": row["name"],
        "email": email,
        "token": f"token_{email}"
    }

@app.get("/api/posts/public")
def get_public_posts():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM posts WHERE feed_type = 'public' ORDER BY id DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()
    posts = []

    for row in rows:
        post = dict(row)
        post["analysis"] = analyze_text(post["content"])
        posts.append(post)

    return posts

@app.post("/api/posts/public")
def create_public_post(req: PostCreate):

    # AI moderation
    analysis = analyze_text(req.content)

    if analysis["blocked"]:
        return JSONResponse(
            status_code=400,
            content=analysis
        )

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO posts
        (author_alias, content, feed_type, mood_tag, created_at)
        VALUES (?, ?, 'public', ?, ?)
    """, (
        req.alias or "Anonymous Friend",
        req.content.strip(),
        req.mood_tag,
        datetime.now().isoformat()
    ))

    post_id = cursor.lastrowid
    conn.commit()

    cursor.execute(
        "SELECT * FROM posts WHERE id=?",
        (post_id,)
    )

    new_post = dict(cursor.fetchone())
    conn.close()

    new_post["analysis"] = analysis

    return {
        "status": "success",
        "post": new_post,
        "analysis": analysis
    }

@app.get("/api/posts/private")
def get_private_posts(authorization: Optional[str] = Header(None)):
    alias = get_user_from_token(authorization)
    if not alias:
        raise HTTPException(status_code=401, detail="Access denied. Please login to access Private Sector.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM posts WHERE feed_type = 'private' ORDER BY id DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()
    posts = []

    for row in rows:
        post = dict(row)
        post["analysis"] = analyze_text(post["content"])
        posts.append(post)

    return posts

@app.post("/api/posts/private")
def create_private_post(req: PostCreate, authorization: Optional[str] = Header(None)):
    alias = get_user_from_token(authorization)
    if not alias:
        raise HTTPException(status_code=401, detail="Please login to post in the Private Sector.")
    
    # Moderation check
    analysis = analyze_text(req.content)
    if analysis["blocked"]:
        return JSONResponse(status_code=400, content=analysis)
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO posts (author_alias, content, feed_type, mood_tag, created_at)
        VALUES (?, ?, 'private', ?, ?)
    """, (alias, req.content.strip(), req.mood_tag, datetime.now().isoformat()))
    post_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT * FROM posts WHERE id = ?", (post_id,))
    new_post = dict(cursor.fetchone())
    new_post["analysis"] = analysis
    conn.close()
    
    return {"status": "success", "post": new_post, "analysis": analysis}

@app.post("/api/posts/{post_id}/react")
def react_to_post(post_id: int, reaction: str):
    if reaction not in ["hug", "feel"]:
        raise HTTPException(status_code=400, detail="Invalid reaction type.")
        
    column = "hugs_count" if reaction == "hug" else "feels_count"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(f"UPDATE posts SET {column} = {column} + 1 WHERE id = ?", (post_id,))
    conn.commit()
    
    cursor.execute(f"SELECT hugs_count, feels_count FROM posts WHERE id = ?", (post_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Post not found.")
        
    return {"status": "success", "hugs": row["hugs_count"], "feels": row["feels_count"]}

@app.post("/api/analyze")
def analyze_input(req: ChatRequest):
    return analyze_text(req.message)

@app.post("/api/chat/mindbot")
def mindbot_chat(req: ChatRequest):
    analysis = analyze_text(req.message)

    # Block harmful content if needed
    if analysis.get("blocked", False):
        return {
            "reply": analysis.get(
                "message",
                "I'm here to listen, but I can't help with harmful content."
            ),
            "analysis": analysis
        }

    # Generate chatbot response
    reply = generate_reply("anonymous", req.message)

    return {
        "reply": reply,
        "analysis": analysis
    }

@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO feedback (author_alias, rating, message, created_at)
        VALUES (?, ?, ?, ?)
    """, (req.alias or "Anonymous Guest", req.rating, req.message.strip(), datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Thank you for your valuable feedback! 💙"}

# Serve Frontend static assets
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "MindSpace API running. Place index.html in static/"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)