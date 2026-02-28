from app import create_app
from app.extensions import db
from sqlalchemy import inspect, text

app = create_app()


@app.cli.command("init-db")
def init_db():
    db.create_all()
    print("Database initialized.")


def ensure_event_image_column():
    inspector = inspect(db.engine)
    if "events" not in inspector.get_table_names():
        return "events table not found; run init-db first"

    columns = {col["name"] for col in inspector.get_columns("events")}
    if "image_url" in columns:
        return "events.image_url already exists"

    with db.engine.begin() as conn:
        conn.execute(text("ALTER TABLE events ADD COLUMN image_url TEXT"))

    return "added events.image_url"


@app.cli.command("migrate-db")
def migrate_db():
    db.create_all()
    result = ensure_event_image_column()
    print(f"Migration complete: {result}")
