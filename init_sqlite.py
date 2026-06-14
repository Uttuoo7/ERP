import sys
sys.path.insert(0, '.')
from backend.database import engine
from backend.models import Base

def init_db():
    print("Creating all tables in SQLite database...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

if __name__ == "__main__":
    init_db()
