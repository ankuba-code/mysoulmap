from src.geoip import country_code_for_ip


def test_country_code_without_database_is_xx() -> None:
    assert country_code_for_ip("8.8.8.8") == "XX"
    assert country_code_for_ip("127.0.0.1") == "XX"
