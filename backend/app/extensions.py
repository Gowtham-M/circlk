from pymongo import MongoClient, ReturnDocument


class MongoDB:
    def __init__(self):
        self._client = None
        self._database = None

    def init_app(self, app):
        uri = app.config["MONGODB_URI"]
        db_name = app.config.get("MONGODB_DB_NAME", "circlk")
        self._client = MongoClient(uri)
        self._database = self._client[db_name]
        self.ensure_indexes()

    def collection(self, name: str):
        if self._database is None:
            raise RuntimeError("MongoDB is not initialized.")
        return self._database[name]

    def next_id(self, sequence_name: str) -> int:
        counters = self.collection("counters")
        result = counters.find_one_and_update(
            {"_id": sequence_name},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return int(result["seq"])

    def ensure_indexes(self):
        users = self.collection("users")
        events = self.collection("events")
        bookings = self.collection("bookings")

        users.create_index("email", unique=True)
        events.create_index("city")
        events.create_index("event_time")
        bookings.create_index("user_id")
        bookings.create_index("event_id")


db = MongoDB()
