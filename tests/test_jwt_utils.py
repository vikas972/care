from app.services.jwt_utils import create_access_token, decode_user_id


def test_jwt_roundtrip():
    tok = create_access_token(42)
    assert decode_user_id(tok) == 42
