DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='repository_contributions' AND column_name='commits'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='repository_contributions' AND column_name='commit_days'
  ) THEN
    ALTER TABLE repository_contributions RENAME COLUMN commits TO commit_days;
  END IF;
END $$;
