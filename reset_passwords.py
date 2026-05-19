from backend import database, models, auth_utils

db = database.SessionLocal()
roles = {
    "admin": models.Role.ADMIN,
    "buyer": models.Role.BUYER,
    "warehouse": models.Role.WAREHOUSE,
    "finance": models.Role.FINANCE
}

for username, role in roles.items():
    email = f"{username}@example.com"
    user = db.query(models.User).filter((models.User.email == email) | (models.User.username == username)).first()
    if user:
        user.email = email
        user.hashed_password = auth_utils.get_password_hash("password")
        print(f"Updated {username}")
    else:
        user = models.User(
            username=username,
            email=email,
            hashed_password=auth_utils.get_password_hash("password"),
            role=role
        )
        db.add(user)
        print(f"Added {username}")

db.commit()
print("Done!")
