"""Demo dataset is seeded automatically when the Flask app starts."""
from mockdb import get_db

def seed():
    db = get_db()
    print("FOODFLOW mock dataset is loaded automatically. Collections:", list(db.collections))

if __name__ == "__main__":
    seed()
