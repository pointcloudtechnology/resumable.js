/*
* MIT Licensed
*
* For all code added/modified until Sep 24, 2020
* (see original repo as original code was split up into multiple files)
* https://www.twentythree.com
* https://github.com/23/resumable.js
* Steffen Fagerström Christensen, steffen@twentythree.com
*
* For all code added/modified since Sep 24, 2020
* https://www.pointcloudtechnology.com/en/
* https://github.com/pointcloudtechnology/resumable.js
* For contact (not the sole author): Marcel Wendler, https://github.com/UniquePanda, marcel.wendler@pointcloudtechnology.com
*/

import ResumableChunk from './resumableChunk';
import Helpers from './resumableHelpers';
import ResumableEventHandler from './resumableEventHandler';
import {DebugVerbosityLevel, ResumableChunkStatus, ResumableConfiguration} from './types/types';

/**
 * A single file object that should be uploaded in multiple chunks
 */
export default class ResumableFile extends ResumableEventHandler {
  private opts: ResumableConfiguration;
  private _prevProgress: number = 0;
  private isPaused: boolean = false;

  private _file: File;
  private _fileName: string;
  private _size: number;
  private _relativePath: string;
  private _uniqueIdentifier: string;
  private _fileCategory: string;
  private _error: boolean;
  private _chunks: ResumableChunk[] = [];
  private chunkSize: number = 1024 * 1024; // 1 MB

  private debugVerbosityLevel: DebugVerbosityLevel = DebugVerbosityLevel.NONE;

  constructor(file: File, uniqueIdentifier: string, fileCategory: string, options: object) {
    super();
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Constructing ResumableFile...');
    this.opts = options;
    this.setInstanceProperties(options);
    this._file = file;
    this._fileName = file.name;
    this._size = file.size;
    this._relativePath = file.webkitRelativePath || this._fileName;
    this._uniqueIdentifier = uniqueIdentifier;
    this._fileCategory = fileCategory;
    this._error = uniqueIdentifier !== undefined;

    // Bootstrap file
    this.fire('chunkingStart', this);
    this.bootstrap();
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Constructed ResumableFile.', this);
  }

  /**
   * Set the options provided inside the configuration object on this instance
   */
  private setInstanceProperties(options: ResumableConfiguration) {
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Setting ResumableFile instance properties...');
    Object.assign(this, options);
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Set ResumableFile instance properties.', this);
  }

  get file(): File {
    return this._file;
  }

  get fileName(): string {
    return this._fileName;
  }

  get size(): number {
    return this._size;
  }

  get relativePath(): string {
    return this._relativePath;
  }

  get uniqueIdentifier(): string {
    return this._uniqueIdentifier;
  }

  get fileCategory(): string {
    return this._fileCategory;
  }

  get chunks(): ResumableChunk[] {
    return this._chunks;
  }

  /**
   * Stop current uploads for this file
   */
  abort(): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Aborting upload of ResumableFile...', this);
    let abortCount = 0;
    for (const chunk of this._chunks) {
      if (chunk.status === ResumableChunkStatus.UPLOADING) {
        chunk.abort();
        abortCount++;
      }
    }
    if (abortCount > 0) this.fire('fileProgress', this, null);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Aborted upload of ResumableFile.', this);
  }

  /**
   * Cancel uploading this file and remove it from the file list
   */
  cancel(): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Cancelling upload of ResumableFile...', this);
    for (const chunk of this._chunks) {
      if (chunk.status === ResumableChunkStatus.UPLOADING) {
        chunk.abort();
        this.fire('chunkCancel', chunk);
      }
    }
    // Reset this file to be void
    this._chunks = [];
    this.fire('fileCancel', this);
    this.fire('fileProgress', this, null);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Cancelled upload of ResumableFile.', this);
  }

  /**
   * Retry uploading this file
   */
  retry(): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Retrying upload of ResumableFile...', this);
    this.bootstrap();
    let firedRetry = false;
    this.on('chunkingComplete', () => {
      if (!firedRetry) this.fire('fileRetry', this, null);
      firedRetry = true;
    });
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Retried upload of ResumableFile.', this);
  }

  /**
   * Prepare this file for a new upload, by dividing it into multiple chunks
   */
  private bootstrap(): void {
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Bootstrapping and chunking ResumableFile...', this);
    const progressHandler = (message, chunk) => {
      // No debugging messages because this would really spam the console.
      this.fire('chunkProgress', chunk, message);
      this.fire('fileProgress', this, message);
    };
    const retryHandler = (message, chunk) => {
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Handling "chunkRetry" in ResumableFile...', this, chunk, message);
      this.fire('chunkRetry', chunk, message);
      this.fire('fileRetry', this, message);
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Handled "chunkRetry" in ResumableFile.', this, chunk, message);
    }
    const successHandler = (message, chunk) => {
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Handling "chunkSuccess" in ResumableFile...', this, chunk, message);
      if (this._error) return;
      this.fire('chunkSuccess', chunk, message);
      this.fire('fileProgress', this, message);
      if (this.isComplete) {
        this.fire('fileSuccess', this, message);
      }
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Handled "chunkSuccess" in ResumableFile.', this, chunk, message);
    };
    const errorHandler = (message, chunk) => {
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Handling "chunkError" in ResumableFile...', this, chunk, message);
      this.fire('chunkError', chunk, message);
      this.abort();
      this._error = true;
      this._chunks = [];
      this.fire('fileError', this, message);
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Handled "chunkError" in ResumableFile.', this, chunk, message);
    }

    this.abort();
    this._error = false;
    // Rebuild stack of chunks from file
    this._chunks = [];
    this._prevProgress = 0;
    const maxOffset = Math.max(Math.ceil(this._size / this.chunkSize), 1);
    for (var offset = 0; offset < maxOffset; offset++) {
      const chunk = new ResumableChunk(this, offset, this.opts);
      chunk.on('chunkProgress', (message) => progressHandler(message, chunk));
      chunk.on('chunkError', (message) => errorHandler(message, chunk));
      chunk.on('chunkSuccess', (message) => successHandler(message, chunk));
      chunk.on('chunkRetry', (message) => retryHandler(message, chunk));
      this._chunks.push(chunk);
      this.fire('chunkingProgress', this, offset / maxOffset);
    }
    this.fire('chunkingComplete', this);
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Bootstrapped and chunked ResumableFile.', this);
  }

  /**
   * Get the progress for uploading this file based on the progress of the individual file chunks
   */
  progress(): number {
    if (this._error) return 1;
    // Sum up progress across everything
    var ret = 0;
    var error = false;
    for (const chunk of this._chunks) {
      if (chunk.status === ResumableChunkStatus.ERROR) error = true;
      ret += chunk.progress(true); // get chunk progress relative to entire file
    }
    ret = error ? 1 : (ret > 0.99999 ? 1 : ret);
    ret = Math.max(this._prevProgress, ret); // We don't want to lose percentages when an upload is paused
    this._prevProgress = ret;
    return ret;
  }

  /**
   * Check whether at least one of this file's chunks is currently uploading
   */
  get isUploading(): boolean {
    return this._chunks.some((chunk) => chunk.status === ResumableChunkStatus.UPLOADING);
  }

  /**
   * Check whether all of this file's chunks completed their upload requests and whether it should be
   * treated as completed.
   */
  get isComplete(): boolean {
    return !this._chunks.some((chunk) =>
      chunk.status === ResumableChunkStatus.PENDING || chunk.status === ResumableChunkStatus.UPLOADING);
  }

  /**
   * Initiate the upload of a new chunk for this file. This function returns whether a new upload was started or not.
   */
  upload(): boolean {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Starting upload of next chunk of ResumableFile...', this);
    if (this.isPaused) {
      return false;
    }

    for (const chunk of this._chunks) {
      if (chunk.status === ResumableChunkStatus.PENDING) {
        chunk.send();
        Helpers.printDebugLow(this.debugVerbosityLevel, 'Started upload of next chunk of ResumableFile.', this);
        return true;
      }
    }

    Helpers.printDebugLow(this.debugVerbosityLevel, 'No chunk found to upload for ResumableFile.', this);
    return false;
  }

  /**
   * Mark a given number of chunks as already uploaded to the server.
   * @param chunkNumber The index until which all chunks should be marked as completed
   */
  markChunksCompleted(chunkNumber: number): void {
    Helpers.printDebugLow(
      this.debugVerbosityLevel,
      'Marking ' + chunkNumber + ' chunks as complete for ResumableFile...',
      this
    );
    if (!this._chunks || this._chunks.length <= chunkNumber) {
      return;
    }
    for (let num = 0; num < chunkNumber; num++) {
      this._chunks[num].markComplete();
    }
    Helpers.printDebugLow(
      this.debugVerbosityLevel,
      'Marked ' + chunkNumber + ' chunks as complete for ResumableFile.',
      this
    );
  }
}
