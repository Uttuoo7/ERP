import sys
sys.path.insert(0, '.')
import logging
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

from backend.database import SessionLocal, engine
from backend.models import User, Role

db = SessionLocal()
try:
    # Let's insert a test user and see SQL logging
    user = User(
        username="testuuid",
        email="testuuid@example.com",
        hashed_password="xxx",
        role=Role.BUYER
    )
    db.add(user)
    db.commit()
    print("Insert successful!")
    
    # Query it back
    res = db.query(User).filter(User.username == "testuuid").first()
    print("Retrieved tenant_id:", res.tenant_id, type(res.tenant_id))
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
