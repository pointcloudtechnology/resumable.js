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
import {ResumableChunkStatus, ResumableConfiguration} from './types/types';

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

  constructor(file: File, uniqueIdentifier: string, fileCategory: string, options: object) {
    super();
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
  }

  /**
   * Set the options provided inside the configuration object on this instance
   */
  private setInstanceProperties(options: ResumableConfiguration) {
    Object.assign(this, options);
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
    let abortCount = 0;
    for (const chunk of this._chunks) {
      if (chunk.status === ResumableChunkStatus.UPLOADING) {
        chunk.abort();
        abortCount++;
      }
    }
    if (abortCount > 0) this.fire('fileProgress', this, null);
  }

  /**
   * Cancel uploading this file and remove it from the file list
   */
  cancel(): void {
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
  }

  /**
   * Retry uploading this file
   */
  retry(): void {
    this.bootstrap();
    let firedRetry = false;
    this.on('chunkingComplete', () => {
      if (!firedRetry) this.fire('fileRetry', this, null);
      firedRetry = true;
    });
  }

  /**
   * Prepare this file for a new upload, by dividing it into multiple chunks
   */
  private bootstrap(): void {
    const progressHandler = (message, chunk) => {
      this.fire('chunkProgress', chunk, message);
      this.fire('fileProgress', this, message);
    };
    const retryHandler = (message, chunk) => {
      this.fire('chunkRetry', chunk, message);
      this.fire('fileRetry', this, message);
    }
    const successHandler = (message, chunk) => {
      if (this._error) return;
      this.fire('chunkSuccess', chunk, message);
      this.fire('fileProgress', this, message);
      if (this.isComplete) {
        this.fire('fileSuccess', this, message);
      }
    };
    const errorHandler = (message, chunk) => {
      this.fire('chunkError', chunk, message);
      this.abort();
      this._error = true;
      this._chunks = [];
      this.fire('fileError', this, message);
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
    if (this.isPaused) {
      return false;
    }

    for (const chunk of this._chunks) {
      if (chunk.status === ResumableChunkStatus.PENDING) {
        chunk.send();
        return true;
      }
    }
    return false;
  }

  /**
   * Mark a given number of chunks as already uploaded to the server.
   * @param chunkNumber The index until which all chunks should be marked as completed
   */
  markChunksCompleted(chunkNumber: number): void {
    if (!this._chunks || this._chunks.length <= chunkNumber) {
      return;
    }
    for (let num = 0; num < chunkNumber; num++) {
      this._chunks[num].markComplete();
    }
  }
}
