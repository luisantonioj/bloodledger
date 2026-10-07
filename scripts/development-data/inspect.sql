BEGIN READ ONLY;
-- DBeaver: select bloodledger_dev → SQL Editor → New SQL Script. Read-only.
SELECT seed_id,manifest_sha256,target_sha256,created_at,classification FROM app.development_seed_runs;
SELECT c.component_id,c.blood_type,c.component_type,c.inventory_status,c.expires_at,c.ledger_version,c.ledger_transaction_id FROM app.v2_components c ORDER BY c.component_id;
SELECT r.reservation_id,r.transfer_id,r.purpose,r.status,r.version,r.prepared_at FROM app.v2_reservations r ORDER BY r.reservation_id;
SELECT q.command_id,q.operation,q.status,q.ledger_transaction_id,s.block_number,s.validation_status FROM app.development_seed_commands s JOIN app.v2_commands q USING(command_id) ORDER BY q.accepted_at,q.command_id;
SELECT source_business_date,source_institution_id,status,expected_units,verified_units,manifest_sha256 FROM app.synthetic_inventory_snapshots;
SELECT snapshot_id,blood_type,component_type,available_units,reserved_units,closing_units FROM app.synthetic_inventory_counts ORDER BY snapshot_id,series_key;
SELECT snapshot_id,component_id,snapshot_status,allocation_group_id,ledger_transaction_id,block_number,validation_status,committed_at FROM app.synthetic_inventory_units ORDER BY snapshot_id,component_id;
SELECT snapshot_id,institution_id,captured_at,source_projection_digest FROM app.ml_inventory_snapshots;
SELECT snapshot_id,COUNT(*) AS combinations,SUM(available_count) AS available,SUM(reserved_count) AS reserved FROM app.ml_inventory_snapshot_counts GROUP BY snapshot_id;
COMMIT;
