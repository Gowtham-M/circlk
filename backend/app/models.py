from decimal import Decimal

from bson.decimal128 import Decimal128
from passlib.hash import pbkdf2_sha256


def hash_password(password: str) -> str:
    return pbkdf2_sha256.hash(password)


def check_password(password: str, password_hash: str) -> bool:
    return pbkdf2_sha256.verify(password, password_hash)


def to_decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if isinstance(value, Decimal128):
        return value.to_decimal()
    return Decimal(str(value))


def to_decimal128(value) -> Decimal128:
    return Decimal128(to_decimal(value).quantize(Decimal("0.01")))


def price_with_platform_fee(base_price, fee_percent: float) -> Decimal:
    base = to_decimal(base_price)
    fee = base * Decimal(str(fee_percent)) / Decimal("100")
    return (base + fee).quantize(Decimal("0.01"))
