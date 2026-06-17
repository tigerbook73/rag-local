-- create test schema
CREATE SCHEMA IF NOT EXISTS test;

-- create default buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('documents', 'documents', false),
  ('test-documents', 'test-documents', false)
ON CONFLICT (id) DO NOTHING;