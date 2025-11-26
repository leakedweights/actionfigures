def test_register_user(client):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "newuser"
    assert "id" in data


def test_login_user(client):
    client.post(
        "/api/auth/register",
        json={
            "username": "loginuser",
            "email": "login@example.com",
            "password": "password123",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_get_me(client, auth_headers):
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"


def test_create_model_api(client, auth_headers):
    response = client.post(
        "/api/models", json={"instructions": "API Model"}, headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["instructions"] == "API Model"
    assert data["is_public"] is False


def test_get_models_api(client, auth_headers):
    client.post("/api/models", json={"instructions": "Model 1"}, headers=auth_headers)

    response = client.get("/api/models", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["instructions"] == "Model 1"


def test_update_model_api(client, auth_headers):
    create_res = client.post(
        "/api/models", json={"instructions": "Original"}, headers=auth_headers
    )
    model_id = create_res.json()["id"]

    response = client.put(
        f"/api/models/{model_id}",
        json={"instructions": "Updated"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["instructions"] == "Updated"


def test_delete_model_api(client, auth_headers):
    create_res = client.post(
        "/api/models", json={"instructions": "To Delete"}, headers=auth_headers
    )
    model_id = create_res.json()["id"]

    response = client.delete(f"/api/models/{model_id}", headers=auth_headers)
    assert response.status_code == 204

    get_res = client.get(f"/api/models/{model_id}", headers=auth_headers)
    assert get_res.status_code == 404


def test_public_models_api(client, auth_headers):
    client.post(
        "/api/models",
        json={"instructions": "Public Model", "is_public": True},
        headers=auth_headers,
    )

    response = client.get("/api/public/models")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
