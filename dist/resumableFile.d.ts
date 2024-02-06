import ResumableChunk from './resumableChunk';
import ResumableEventHandler from './resumableEventHandler';
/**
 * A single file object that should be uploaded in multiple chunks
 */
export default class ResumableFile extends ResumableEventHandler {
    private opts;
    private _prevProgress;
    private isPaused;
    private _file;
    private _fileName;
    private _size;
    private _relativePath;
    private _uniqueIdentifier;
    private _fileCategory;
    private _error;
    private _chunks;
    private chunkSize;
    private debugVerbosityLevel;
    constructor(file: File, uniqueIdentifier: string, fileCategory: string, options: object);
    /**
     * Set the options provided inside the configuration object on this instance
     */
    private setInstanceProperties;
    get file(): File;
    get fileName(): string;
    get size(): number;
    get relativePath(): string;
    get uniqueIdentifier(): string;
    get fileCategory(): string;
    get chunks(): ResumableChunk[];
    /**
     * Stop current uploads for this file
     */
    abort(): void;
    /**
     * Cancel uploading this file and remove it from the file list
     */
    cancel(): void;
    /**
     * Retry uploading this file
     */
    retry(): void;
    /**
     * Prepare this file for a new upload, by dividing it into multiple chunks
     */
    private bootstrap;
    /**
     * Get the progress for uploading this file based on the progress of the individual file chunks
     */
    progress(): number;
    /**
     * Check whether at least one of this file's chunks is currently uploading
     */
    get isUploading(): boolean;
    /**
     * Check whether all of this file's chunks completed their upload requests and whether it should be
     * treated as completed.
     */
    get isComplete(): boolean;
    /**
     * Initiate the upload of a new chunk for this file. This function returns whether a new upload was started or not.
     */
    upload(): boolean;
    /**
     * Mark a given number of chunks as already uploaded to the server.
     * @param chunkNumber The index until which all chunks should be marked as completed
     */
    markChunksCompleted(chunkNumber: number): void;
}
