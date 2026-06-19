-- Add start_offset to beir_corpus_chunks for chunk-level resume detection
ALTER TABLE "beir_corpus_chunks" ADD COLUMN "start_offset" INTEGER NOT NULL DEFAULT 0;

-- Drop old unique constraint (corpus_id, chunk_index, chunking_config)
ALTER TABLE "beir_corpus_chunks" DROP CONSTRAINT "beir_corpus_chunks_corpus_id_chunk_index_chunking_config_key";

-- Add new unique constraint (corpus_id, start_offset, chunking_config)
ALTER TABLE "beir_corpus_chunks" ADD CONSTRAINT "beir_corpus_chunks_corpus_id_start_offset_chunking_config_key" UNIQUE ("corpus_id", "start_offset", "chunking_config");
