-- Add unit type configuration to feeds
ALTER TABLE feeds ADD COLUMN unit_type TEXT NOT NULL DEFAULT 'fraction' 
  CHECK (unit_type IN ('fraction', 'int', 'decimal', 'choice'));

ALTER TABLE feeds ADD COLUMN unit_label TEXT NOT NULL DEFAULT 'scoop';

ALTER TABLE feeds ADD COLUMN entry_options TEXT; -- JSON blob, nullable

-- Add variant columns to diet_entries for choice-type labels
ALTER TABLE diet_entries ADD COLUMN am_variant TEXT;
ALTER TABLE diet_entries ADD COLUMN pm_variant TEXT;

-- Migrate existing unit values to unit_type + unit_label
-- scoop -> fraction/scoop, ml -> decimal/ml, biscuit -> int/biscuit, sachet -> int/sachet
UPDATE feeds SET unit_type = 'fraction', unit_label = 'scoop' WHERE unit = 'scoop';
UPDATE feeds SET unit_type = 'decimal', unit_label = 'ml' WHERE unit = 'ml';
UPDATE feeds SET unit_type = 'int', unit_label = 'biscuit' WHERE unit = 'biscuit';
UPDATE feeds SET unit_type = 'int', unit_label = 'sachet' WHERE unit = 'sachet';
