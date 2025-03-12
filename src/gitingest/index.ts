/**
 * Gitingest: A package for ingesting data from Git repositories.
 */

export { clone } from './cloning';
export { ingest, ingestAsync } from './entrypoint';
export { ingestQuery } from './ingestion';
export { parseQuery } from './query_parsing';

// Re-export types that consumers might need
export { IngestionQuery } from './types/ingestion_schema';
export { FileSystemNode, FileSystemNodeType, FileSystemStats } from './types/filesystem_schema';
