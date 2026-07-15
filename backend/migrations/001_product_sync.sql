ALTER TABLE tbl_material
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS vera_synced_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS vera_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS vera_sync_error TEXT;

UPDATE tbl_material
SET created_at = COALESCE(create_date, CURRENT_TIMESTAMP),
    updated_at = COALESCE(update_date, create_date, CURRENT_TIMESTAMP)
WHERE create_date IS NOT NULL OR update_date IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'tbl_material'::regclass
          AND contype = 'u'
          AND conname = 'tbl_material_code_key'
    ) THEN
        ALTER TABLE tbl_material
            ADD CONSTRAINT tbl_material_code_key UNIQUE (code);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tbl_material_updated_at ON tbl_material (updated_at);
CREATE INDEX IF NOT EXISTS idx_tbl_material_vera_sync_status ON tbl_material (vera_sync_status);
