from src.modeling import (
    create_model,
    create_user,
    delete_model,
    get_models,
    get_user_by_email,
    update_model,
)


def test_create_user(test_db):
    user = create_user(test_db, "testuser", "test@example.com", "password123")
    assert user.username == "testuser"
    assert user.email == "test@example.com"
    assert user.hashed_password != "password123"  # Should be hashed


def test_get_user_by_email(test_db):
    create_user(test_db, "testuser", "test@example.com", "password123")
    user = get_user_by_email(test_db, "test@example.com")
    assert user is not None
    assert user.username == "testuser"


def test_create_model(test_db):
    user = create_user(test_db, "testuser", "test@example.com", "password123")
    model_data = {
        "instructions": "A robot",
        "reference_image_path": "path/to/image.png",
    }
    model = create_model(test_db, model_data, user.id)
    assert model.instructions == "A robot"
    assert model.user_id == user.id
    assert model.is_public is False


def test_get_models(test_db):
    user = create_user(test_db, "testuser", "test@example.com", "password123")
    create_model(test_db, {"instructions": "Model 1"}, user.id)
    create_model(test_db, {"instructions": "Model 2"}, user.id)

    models = get_models(test_db, user.id)
    assert len(models) == 2
    assert models[0].instructions == "Model 1"


def test_update_model(test_db):
    user = create_user(test_db, "testuser", "test@example.com", "password123")
    model = create_model(test_db, {"instructions": "Old instructions"}, user.id)

    updated = update_model(
        test_db, model.id, {"instructions": "New instructions"}, user.id
    )
    assert updated.instructions == "New instructions"

    # Verify in DB
    models = get_models(test_db, user.id)
    assert models[0].instructions == "New instructions"


def test_delete_model(test_db):
    user = create_user(test_db, "testuser", "test@example.com", "password123")
    model = create_model(test_db, {"instructions": "To delete"}, user.id)

    delete_model(test_db, model.id, user.id)

    models = get_models(test_db, user.id)
    assert len(models) == 0
