from pathlib import Path

from fastapi.testclient import TestClient

from app.server import create_deployment_app


def test_deployment_app_serves_api_assets_and_spa(tmp_path: Path) -> None:
    assets = tmp_path / "assets"
    assets.mkdir()
    (tmp_path / "index.html").write_text("<main>Calendar booking</main>")
    (assets / "app.js").write_text("console.log('ready')")

    client = TestClient(create_deployment_app(tmp_path))

    assert client.get("/").text == "<main>Calendar booking</main>"
    assert client.get("/owner").text == "<main>Calendar booking</main>"
    assert client.get("/assets/app.js").text == "console.log('ready')"
    assert client.get("/api/owner").json()["name"] == "Александр"
