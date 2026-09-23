-- ------------------------------------------------------------------------------
-- Table: whitelist
-- Stores cryptographic whitelist allocations for NFT minting
-- ------------------------------------------------------------------------------

DEFINE TABLE OVERWRITE whitelist SCHEMAFULL
    PERMISSIONS
        FOR select FULL
        FOR create, update, delete NONE;

-- Typed Record Pointers
DEFINE FIELD OVERWRITE player          ON whitelist TYPE record<player>;
DEFINE FIELD OVERWRITE session         ON whitelist TYPE record<run_session>;

-- String Identifiers & Proof Data
DEFINE FIELD OVERWRITE wallet          ON whitelist TYPE string
    ASSERT string::starts_with($value, '0x');

DEFINE FIELD OVERWRITE run_id          ON whitelist TYPE string
    ASSERT string::len($value) >= 6;

DEFINE FIELD OVERWRITE completion_time ON whitelist TYPE number
    ASSERT $value >= 30000;

DEFINE FIELD OVERWRITE proof_hash      ON whitelist TYPE string
    ASSERT string::len($value) >= 8;

DEFINE FIELD OVERWRITE allocated_at    ON whitelist TYPE datetime 
    VALUE $before.allocated_at OR time::now();

DEFINE INDEX OVERWRITE idx_whitelist_wallet ON whitelist FIELDS wallet UNIQUE;
