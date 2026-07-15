ORDER_COMPLETION_SQL = """
WITH intent_sessions AS (
  SELECT id AS session_id FROM chat_sessions
  WHERE active_intent = 'create_order'
    AND started_at >= %(start_date)s AND closed_at <= %(end_date)s
),
ai_create_order AS (
  SELECT cm.session_id FROM chat_messages cm
  WHERE cm.used_tools @> '["create_order"]'::jsonb
    AND cm.created_at >= %(start_date)s AND cm.created_at <= %(end_date)s
)
SELECT COUNT(*) AS intent_sessions,
  (SELECT COUNT(*) FROM ai_create_order) AS ai_create_order,
  ROUND((SELECT COUNT(*) FROM ai_create_order)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS complete_rate
FROM intent_sessions;
"""

ORDER_COMPLETION_ALL_SQL = """
WITH intent_sessions AS (
  SELECT id AS session_id FROM chat_sessions WHERE active_intent = 'create_order'
),
ai_create_order AS (
  SELECT session_id FROM chat_messages WHERE used_tools @> '["create_order"]'::jsonb
)
SELECT COUNT(*) AS intent_sessions,
  (SELECT COUNT(*) FROM ai_create_order) AS ai_create_order,
  ROUND((SELECT COUNT(*) FROM ai_create_order)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS complete_rate
FROM intent_sessions;
"""

TICKET_CREATE_SQL = """
WITH all_sessions AS (
  SELECT id AS session_id FROM chat_sessions
  WHERE started_at >= %(start_date)s AND closed_at <= %(end_date)s
),
handoff_sessions AS (
  SELECT session_id FROM chat_messages cm
  WHERE cm.used_tools @> '["create_ticket"]'::jsonb
    AND cm.created_at >= %(start_date)s AND cm.created_at <= %(end_date)s
)
SELECT
  (SELECT COUNT(*) FROM all_sessions) AS total_sessions,
  (SELECT COUNT(*) FROM handoff_sessions) AS handoff_sessions,
  ROUND((SELECT COUNT(*) FROM handoff_sessions)::numeric / NULLIF((SELECT COUNT(*) FROM all_sessions), 0) * 100, 2) AS handoff_rate;
"""

TICKET_CREATE_ALL_SQL = """
WITH all_sessions AS (SELECT id AS session_id FROM chat_sessions),
handoff_sessions AS (
  SELECT DISTINCT session_id FROM chat_messages WHERE used_tools @> '["create_ticket"]'::jsonb
)
SELECT
  (SELECT COUNT(*) FROM all_sessions) AS total_sessions,
  (SELECT COUNT(*) FROM handoff_sessions) AS handoff_sessions,
  ROUND((SELECT COUNT(*) FROM handoff_sessions)::numeric / NULLIF((SELECT COUNT(*) FROM all_sessions), 0) * 100, 2) AS handoff_rate;
"""

AVG_AI_CON_SQL = """
SELECT COUNT(*) AS ai_message_count,
  ROUND(AVG(ai_confident)::numeric, 4) AS avg_ai_confident
FROM chat_messages
WHERE ai_message IS NOT NULL AND ai_message <> '' AND ai_confident IS NOT NULL
  AND created_at >= %(start_date)s AND created_at <= %(end_date)s;
"""

AVG_AI_CON_ALL_SQL = """
SELECT COUNT(*) AS ai_message_count,
  ROUND(AVG(ai_confident)::numeric, 4) AS avg_ai_confident
FROM chat_messages
WHERE ai_message IS NOT NULL AND ai_message <> '' AND ai_confident IS NOT NULL;
"""

AVG_SESSION_TIME_SQL = """
SELECT COUNT(*) AS session_used,
  ROUND(AVG(message_count)::numeric, 2) AS avg_message_count,
  ROUND(AVG(total_duration_sec)::numeric, 2) AS avg_session_duration_sec,
  ROUND(AVG(total_duration_sec) / 60.0, 2) AS avg_session_duration_min
FROM chat_sessions
WHERE message_count > 0 AND total_duration_sec IS NOT NULL
  AND started_at >= %(start_date)s AND started_at <= %(end_date)s;
"""

AVG_SESSION_TIME_ALL_SQL = """
SELECT COUNT(*) AS session_used,
  ROUND(AVG(message_count)::numeric, 2) AS avg_message_count,
  ROUND(AVG(total_duration_sec)::numeric, 2) AS avg_session_duration_sec,
  ROUND(AVG(total_duration_sec) / 60.0, 2) AS avg_session_duration_min
FROM chat_sessions
WHERE message_count > 0 AND total_duration_sec IS NOT NULL;
"""

KEYWORD_TOPIC_SQL = """
SELECT topic, keywords FROM message_insights ORDER BY created_at DESC LIMIT 1;
"""

CATALOG_SQL = """
SELECT COUNT(*) AS total_products,
  COUNT(*) FILTER (WHERE stock_qty < 100) AS low_stock
FROM tbl_material WHERE is_enable = 'T';
"""
