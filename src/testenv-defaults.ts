// Test-only env bootstrap simulating an unconfigured environment: no Builder API key,
// no MIND_ID, no explicit DB path. DOTENV_CONFIG_PATH points at a nonexistent file so
// `import 'dotenv/config'` cannot repopulate the deleted keys from a real .env.
process.env.DOTENV_CONFIG_PATH = '/porchlight-nonexistent-env/.env'
delete process.env.MINDS_BUILDER_API_KEY
delete process.env.MIND_ID
delete process.env.PORCHLIGHT_DB
delete process.env.PORCHLIGHT_MOCK
delete process.env.PORT
