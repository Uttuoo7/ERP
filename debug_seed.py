"""Debug the seeding error to find exact traceback."""
import traceback
import sys
sys.path.insert(0, '.')

try:
    from backend.database import SessionLocal
    from backend.auth_router import seed_users
    from backend.warehouse_router import seed_warehouses
    
    with SessionLocal() as db:
        try:
            seed_users(db)
            print("seed_users: OK")
        except Exception as e:
            print(f"seed_users FAILED:")
            traceback.print_exc()
        
        try:
            seed_warehouses(db)
            print("seed_warehouses: OK")
        except Exception as e:
            print(f"seed_warehouses FAILED:")
            traceback.print_exc()
except Exception as e:
    print(f"Import error:")
    traceback.print_exc()
