import sqlite3

conn = sqlite3.connect("mindspace.db")
cursor = conn.cursor()

# Delete all posts
cursor.execute("DELETE FROM posts")

# Reset auto-increment ID
cursor.execute("DELETE FROM sqlite_sequence WHERE name='posts'")

conn.commit()
conn.close()

print("✅ All posts deleted successfully!")