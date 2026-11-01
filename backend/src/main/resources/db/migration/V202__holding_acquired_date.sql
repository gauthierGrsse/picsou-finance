-- Optional, user-entered date the member acquired a holding. Nullable: most holdings
-- (broker-synced or entered before this column existed) won't have one, and the range
-- P&L calculation in HistoryService treats a null the same as "assume held for the
-- whole requested range" -- its existing, pre-this-migration behavior.
--
-- When set and the holding was acquired *after* a range's start date, the P&L
-- calculation switches that holding to (current value - cost basis) instead of
-- needing a historical price from before the member even owned it.
ALTER TABLE account_holding ADD COLUMN acquired_at DATE;
