from unittest.mock import MagicMock, patch

import etl


def test_run_returns_sync_contract():
    row = {field: "" for field in set(etl.TEXT_FIELDS + etl.METADATA_FIELDS)}
    row.update({"code": "M1", "name": "Test product", "cost": 10, "stock_qty": 2})
    conn = MagicMock()
    cursor = conn.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = (True,)

    with (
        patch.object(etl.psycopg2, "connect", return_value=conn),
        patch.object(etl, "fetch_materials", return_value=[row]),
        patch.object(etl, "_preflight", return_value=(object(), MagicMock())),
        patch.object(etl, "_rebuild_collection") as load,
    ):
        result = etl.run()

    assert result.source_count == 1
    assert result.embedded_count == 1
    assert result.collection_name == "materials"
    assert result.duration_sec >= 0
    load.assert_called_once()


def test_swap_staging_moves_alias_and_keeps_one_previous_version():
    client = MagicMock()
    client.get_collection_stats.return_value = {"row_count": "2"}
    client.describe_collection.return_value = {
        "fields": [{"name": "vector", "params": {"dim": 1024}}]
    }
    client.list_aliases.return_value = {"aliases": ["materials"]}
    client.describe_alias.return_value = {"collection_name": "materials_v_previous"}
    client.list_collections.return_value = [
        "materials_v_current",
        "materials_v_previous",
        "materials_v_old",
        "unrelated",
    ]

    etl._swap_staging(client, "materials_v_current", 2)

    client.flush.assert_called_once_with("materials_v_current")
    client.alter_alias.assert_called_once_with("materials_v_current", "materials")
    client.drop_collection.assert_called_once_with("materials_v_old")


def test_swap_staging_rejects_invalid_collection_before_alias_change():
    client = MagicMock()
    client.get_collection_stats.return_value = {"row_count": "1"}

    try:
        etl._swap_staging(client, "materials_v_bad", 2)
    except RuntimeError as exc:
        assert "row count mismatch" in str(exc)
    else:
        raise AssertionError("Invalid staging collection was accepted")

    client.alter_alias.assert_not_called()
    client.create_alias.assert_not_called()


def test_swap_staging_migrates_real_materials_collection_to_alias():
    client = MagicMock()
    client.get_collection_stats.return_value = {"row_count": "2"}
    client.describe_collection.return_value = {
        "fields": [{"name": "vector", "params": {"dim": 1024}}]
    }
    client.list_aliases.return_value = {"aliases": []}
    client.has_collection.return_value = True
    client.list_collections.return_value = ["materials_v_current"]

    with patch.object(etl.time, "time_ns", return_value=123):
        etl._swap_staging(client, "materials_v_current", 2)

    client.rename_collection.assert_called_once_with("materials", "materials_v_legacy_123")
    client.create_alias.assert_called_once_with("materials_v_current", "materials")


def test_preflight_rejects_wrong_dimension():
    embeddings = MagicMock()
    embeddings.embed_query.return_value = [0.0] * 3
    with patch.dict(etl.os.environ, {"OPENROUTER_API_KEY": "test"}), patch.object(
        etl, "openrouter_embeddings", return_value=embeddings
    ):
        try:
            etl._preflight()
        except RuntimeError as exc:
            assert "Expected 1024 embedding dimensions" in str(exc)
        else:
            raise AssertionError("Wrong embedding dimension was accepted")


def test_run_rejects_concurrent_sync():
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value.fetchone.return_value = (False,)
    with patch.object(etl.psycopg2, "connect", return_value=conn):
        try:
            etl.run()
        except etl.SyncAlreadyRunning:
            pass
        else:
            raise AssertionError("Concurrent sync was accepted")


def test_run_marks_products_failed_when_milvus_preflight_fails():
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value.fetchone.return_value = (True,)

    with (
        patch.object(etl.psycopg2, "connect", return_value=conn),
        patch.object(etl, "_preflight", side_effect=ConnectionError("Milvus unavailable")),
        patch.object(etl, "_set_status") as set_status,
    ):
        try:
            etl.run()
        except ConnectionError:
            pass
        else:
            raise AssertionError("Milvus failure was accepted")

    set_status.assert_called_once_with(conn, "failed", None, "Milvus unavailable")
