import sys
from datetime import timedelta

import pendulum
from airflow.decorators import dag, task

sys.path.insert(0, "/opt/revive/backend")


@dag(
    dag_id="sync_products_to_milvus",
    schedule="0 2 * * *",
    start_date=pendulum.datetime(2026, 1, 1, tz="Asia/Bangkok"),
    catchup=False,
    max_active_runs=1,
    default_args={"retries": 2, "retry_delay": timedelta(minutes=5)},
    tags=["vera", "products"],
)
def sync_products_to_milvus():
    @task
    def sync_products():
        from etl import run

        run()

    sync_products()


sync_products_to_milvus()
