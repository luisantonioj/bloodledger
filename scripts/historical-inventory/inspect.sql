-- Read-only DBeaver walkthrough. All source/operational times are UTC in storage.
BEGIN READ ONLY;
SELECT snapshot_id,source_business_date,source_institution_id,dataset_version,
       workbook_sha256,manifest_sha256,review_reference,status,expected_units,verified_units
FROM app.synthetic_inventory_snapshots ORDER BY created_at;

-- Generated status totals per snapshot, to compare with source closing counts.
SELECT snapshot_id,snapshot_status,count(*) AS generated_components
FROM app.synthetic_inventory_units
GROUP BY snapshot_id,snapshot_status ORDER BY snapshot_id,snapshot_status;

SELECT snapshot_id,blood_type,component_type,available_units,reserved_units,closing_units
FROM app.synthetic_inventory_counts ORDER BY snapshot_id,series_key;

SELECT component_id,snapshot_id,series_key,snapshot_status,allocation_group_id,
       original_reservation_purpose,collected_at,expires_at,donation_number,
       ledger_transaction_id,block_number,validation_status,committed_at,provenance
FROM app.synthetic_inventory_units ORDER BY snapshot_id,series_key,component_id;

SELECT snapshot_id,allocation_group_id,series_key,count(*) AS constructed_reserved_units
FROM app.synthetic_inventory_units WHERE snapshot_status='RESERVED'
GROUP BY snapshot_id,allocation_group_id,series_key ORDER BY snapshot_id,series_key;

-- This view excludes partially imported snapshots.
SELECT * FROM app.synthetic_inventory_completed_units ORDER BY snapshot_id,component_id;

SELECT snapshot_id,step_index,operation,status,transaction_id,block_number,
       validation_status,attempt_count,safe_error_code
FROM app.synthetic_inventory_import_commands ORDER BY snapshot_id,step_index;
COMMIT;
