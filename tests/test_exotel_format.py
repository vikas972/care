from app.services.exotel import format_exotel_from_number


def test_format_indian_mobile():
    assert format_exotel_from_number("919876543210") == "09876543210"
    assert format_exotel_from_number("9876543210") == "09876543210"
