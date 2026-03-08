from app import create_app
from app.extensions import db

app = create_app()


@app.cli.command("init-db")
def init_db():
    db.ensure_indexes()
    print("MongoDB collections initialized.")


@app.cli.command("migrate-db")
def migrate_db():
    db.ensure_indexes()
    print("MongoDB indexes ensured.")
