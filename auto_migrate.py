import logging
from sqlalchemy import text
from backend.database import engine
from backend.models import Base, SYSTEM_DEFAULT_TENANT_UUID

logger = logging.getLogger(__name__)

def auto_migrate():
    dialect = engine.dialect.name
    logger.info(f"Starting database auto-migration for dialect: {dialect}")
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            for table_name, table_obj in Base.metadata.tables.items():
                # Inspect columns in active database table
                if dialect == "sqlite":
                    res = conn.execute(text(f"PRAGMA table_info({table_name});"))
                    existing_cols = {row[1] for row in res.fetchall()}
                else:
                    # PostgreSQL
                    res = conn.execute(text(
                        f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}';"
                    ))
                    existing_cols = {row[0] for row in res.fetchall()}
                
                if not existing_cols:
                    # Table does not exist in DB yet, create_all will create it fresh
                    continue
                
                # Check for missing columns and dynamically alter table
                for col_name, col_obj in table_obj.columns.items():
                    if col_name not in existing_cols:
                        if dialect == "sqlite":
                            col_type = "TEXT"
                            from sqlalchemy import Integer, Boolean, DateTime, Numeric
                            if isinstance(col_obj.type, Integer):
                                col_type = "INTEGER"
                            elif isinstance(col_obj.type, Boolean):
                                col_type = "BOOLEAN"
                            elif isinstance(col_obj.type, DateTime):
                                col_type = "DATETIME"
                            elif isinstance(col_obj.type, Numeric):
                                col_type = "NUMERIC"
                            
                            default_clause = ""
                            if col_name == "tenant_id":
                                default_clause = f" DEFAULT '{SYSTEM_DEFAULT_TENANT_UUID}'"
                            elif col_name == "is_deleted":
                                default_clause = " DEFAULT 0"
                                
                            alter_query = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}{default_clause};"
                        else:
                            # PostgreSQL type maps
                            col_type = str(col_obj.type)
                            if "UUID" in col_type:
                                col_type = "UUID"
                            elif "VARCHAR" in col_type:
                                col_type = "VARCHAR"
                                
                            default_clause = ""
                            if col_name == "tenant_id":
                                default_clause = f" DEFAULT '{SYSTEM_DEFAULT_TENANT_UUID}'"
                            elif col_name == "is_deleted":
                                default_clause = " DEFAULT FALSE"
                                
                            alter_query = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}{default_clause};"
                        
                        try:
                            conn.execute(text(alter_query))
                            logger.info(f" [SUCCESS] Altered table '{table_name}': Added column '{col_name}'")
                        except Exception as err:
                            logger.error(f" [FAILED] Could not add '{col_name}' to '{table_name}': {err}")
            trans.commit()
            logger.info("Auto-migration verification completed successfully.")
        except Exception as e:
            trans.rollback()
            logger.error(f"Error during auto-migration execution: {e}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    auto_migrate()
