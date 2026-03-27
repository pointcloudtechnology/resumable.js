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

import Helpers from './resumableHelpers';
import ResumableFile from './resumableFile';
import ResumableEventHandler from './resumableEventHandler';
import {DebugVerbosityLevel, ExtendedFile, ResumableConfiguration, UploadTask, UploadTaskId} from './types/types';
import {DefaultConfiguration} from './resumableDefaultValues';

/**
 * An instance of a resumable upload handler that contains one or multiple files which should be uploaded in chunks.
 */
export class Resumable extends ResumableEventHandler {
  private opts: ResumableConfiguration;
  /**
   * An object that contains one entry for every file category. The key is the category name, the value is an array of
   * all ResumableFiles of that category that were added to this instance.
   */
  private files: {[key: string]: ResumableFile[]} = {};
  private validators: {[fileType: string]: Function} = {};
  private uploadTasks: Map<UploadTaskId, UploadTask> = new Map();
  private support: boolean;
  private isCancelled: boolean = false;
  /**
   * When this is set, all upload tasks reached the end of the file list and no more chunks are left to upload.
   * One task is currently iterating over all chunks once more to check if all of them really are uploaded.
   * Only this task will perform any missing uploads.
   */
  private uploadTaskIdCurrentlyCheckingIfUploadFinished: UploadTaskId | undefined = undefined;

  // Configuration Options
  private clearInput: boolean = DefaultConfiguration.clearInput;
  private dragOverClass: string = DefaultConfiguration.dragOverClass;
  private fileCategories: string[] = DefaultConfiguration.fileCategories.slice();
  private defaultFileCategory: string | null = DefaultConfiguration.defaultFileCategory;
  private fileTypes: string[] | {[fileCategory: string]: string[]} = DefaultConfiguration.fileTypes;
  private fileTypeErrorCallback: Function = (file) => {
    alert(`${file.fileName || file.name} has an unsupported file type.`);
  };
  private generateUniqueIdentifier: Function = DefaultConfiguration.generateUniqueIdentifier;
  private maxFileSize?: number = DefaultConfiguration.maxFileSize;
  private maxFileSizeErrorCallback: Function = (file) => {
    alert(file.fileName || file.name + ' is too large, please upload files less than ' +
      Helpers.formatSize(this.maxFileSize) + '.');
  };
  private maxFiles?: number = DefaultConfiguration.maxFiles;
  private maxFilesErrorCallback: Function = (files) => {
    var maxFiles = this.maxFiles;
    alert('Please upload no more than ' + maxFiles + ' file' + (maxFiles === 1 ? '' : 's') + ' at a time.');
  };
  private minFileSize: number = DefaultConfiguration.minFileSize;
  private minFileSizeErrorCallback: Function = (file) => {
    alert(file.fileName || file.name + ' is too small, please upload files larger than ' +
      Helpers.formatSize(this.minFileSize) + '.');
  };
  private fileValidationErrorCallback: Function = (file) => {};
  private simultaneousUploads: number = DefaultConfiguration.simultaneousUploads;

  private debugVerbosityLevel: DebugVerbosityLevel = DefaultConfiguration.debugVerbosityLevel;

  constructor(options: ResumableConfiguration = {}) {
    super();
    this.setInstanceProperties(options);
    this.opts = options;
    this.checkSupport();

    for (let i = 0; i < this.simultaneousUploads; i++) {
      const uploadTaskId: UploadTaskId = `upload-task-${i}`;
      this.uploadTasks.set(
        uploadTaskId,
        {
          id: uploadTaskId,
          fileCategoryIndex: undefined,
          fileIndex: undefined,
          chunkIndex: undefined,
        },
      );
    }

    Helpers.printDebugLow(this.debugVerbosityLevel, 'Constructed Resumable.', this);
  }

  /**
   * Check whether the current browser supports the essential functions for the package to work.
   * The method checks if these features are supported:
   * - File object type
   * - Blob object type
   * - FileList object type
   * - slicing files
   */
  private checkSupport(): void {
    this.support =
      File !== undefined &&
      Blob !== undefined &&
      FileList !== undefined &&
      !!Blob.prototype.slice;
    if (!this.support) {
      throw new Error('Not supported by Browser');
    }
  }

  /**
   * Assign the attributes of this instance via destructuring of the options object.
   */
  private setInstanceProperties(options: ResumableConfiguration): void {
    Object.assign(this, options);

    // Explicitly test for null because other falsy values could be used as default.
    if (this.defaultFileCategory === null) {
      if (this.fileCategories.length === 0) {
        throw new Error('If no default category is set, at least one file category must be defined.');
      }
    } else if (!this.fileCategories.includes(this.defaultFileCategory)) {
      this.fileCategories.push(this.defaultFileCategory);
    } else {
      console.warn('Default file category already part of file categories array. Will not be added again.');
    }

    // To avoid any problems if the same category was added twice, we use the following loop to also deduplicate the
    // file categories.
    const deduplicatedFileCategories = [];
    this.fileCategories.forEach((fileCategory) => {
      if (this.files[fileCategory]) {
        return;
      }

      this.files[fileCategory] = [];
      deduplicatedFileCategories.push(fileCategory);
    });

    this.fileCategories = deduplicatedFileCategories.slice();

    // Create/Check file types object.
    if (Array.isArray(this.fileTypes)) {
      // If fileTypes are given as an array, these types should be used for all file categories.
      // Create the file types object and assign the given array to every file category.
      const fileTypes = this.fileTypes.slice();

      this.fileTypes = {};
      this.fileCategories.forEach((fileCategory) => {
        this.fileTypes[fileCategory] = fileTypes.slice();
      });
    } else {
      const fileTypeCategories = Object.keys(this.fileTypes);
      this.fileCategories.forEach((fileCategory) => {
        if (!fileTypeCategories.includes(fileCategory)) {
          console.warn('File category "' + fileCategory + '" not part of fileTypes object. Assuming empty array (which allows all file types).');
        }

        this.fileTypes[fileCategory] = [];
      });
    }

    this.sanitizeFileTypes();
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Set Resumable instance properties.', this);
  }

  private sanitizeFileTypes(): void {
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Sanitizing file types...');
    // For good behaviour we do some sanitizing. Remove spaces and dots and lowercase all.
    Object.keys(this.fileTypes).forEach((fileCategory) => {
      this.fileTypes[fileCategory] = this.fileTypes[fileCategory].map((type) => type.replace(/[\s.]/g, '').toLowerCase());
    });
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Sanitized file types.');
  }

  private throwIfUnknownFileCategory(fileCategory: string): void {
    if (!this.fileCategories.includes(fileCategory)) {
      throw new Error('Unknown file category: ' + fileCategory);
    }
  }

  /**
   * Transforms a single fileEntry or directoryEntry item into a list of File objects. This method is used to convert
   * entries found inside dragged-and-dropped directories.
   * @param {Object} item item to upload, may be file or directory entry
   * @param {string} path current file path
   */
  private async mapDirectoryItemToFile(item: FileSystemEntry, path: string): Promise<File[]> {
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Mapping directory item to file (' + path + ')...', item);
    if (item.isFile) {
      // file entry provided
      const file = await new Promise(
        (resolve, reject) => (item as FileSystemFileEntry).file(resolve, reject)
      ) as ExtendedFile;
      file.relativePath = path + file.name;
      Helpers.printDebugHigh(
        this.debugVerbosityLevel,
        'Mapped directory item (FileSystemFileEntry) to file (' + path + ').',
        file
      );
      return [file];
    } else if (item.isDirectory) {
      // directory entry provided
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Directory item contains new directory (' + path + ').');
      return await this.processDirectory(item as FileSystemDirectoryEntry, path + item.name + '/');
    } else if (item instanceof File) {
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Directory item already is a file (' + path + ').');
      return [item];
    }

    console.warn('Item mapping did not return a file object. This might be due to an unknown file type.')
    return [];
  }

  /**
   * Transforms a single DataTransfer item into a File object. This may include either extracting the given file or
   * all files inside the provided directory.
   * @param item item to upload, may be file or directory entry
   * @param path current file path
   */
  private async mapDragItemToFile(item: DataTransferItem, path: string): Promise<File[]> {
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Mapping drag item to file (' + path + ')...', item);
    let entry = item.webkitGetAsEntry();
    if (entry.isDirectory) {
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Drag item contains new directory (' + path + ').');
      return await this.processDirectory(entry as FileSystemDirectoryEntry, path + entry.name + '/');
    }

    let file = item.getAsFile();
    if (file instanceof File) {
      (file as ExtendedFile).relativePath = path + file.name;
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Mapped drag item to file (' + path + ').', file);
      return [file];
    }

    console.warn('Item mapping did not return a file object. This might be due to an unknown file type.')
    return [];
  }

  /**
   * Recursively traverse a directory and collect files to upload
   */
  private processDirectory(directory: FileSystemDirectoryEntry, path: string): Promise<File[]> {
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Processing directory (' + path + ')...', directory);
    return new Promise((resolve, reject) => {
      const dirReader = directory.createReader();
      let allEntries = [];

      const readEntries = (): void => {
        dirReader.readEntries(async (entries: FileSystemEntry[]): Promise<void> => {
          // Read the files batch-wise (in chrome e.g. 100 at a time)
          if (entries.length) {
            allEntries = allEntries.concat(entries);
            return readEntries();
          }

          // After collecting all files, map all fileEntries to File objects
          Helpers.printDebugHigh(
            this.debugVerbosityLevel,
            'Read all entries from directory (' + path + ').',
            allEntries
          );
          allEntries = allEntries.map((entry) => {
            return this.mapDirectoryItemToFile(entry, path);
          });
          // Wait until all files are collected.
          resolve(await Promise.all(allEntries));
          Helpers.printDebugHigh(this.debugVerbosityLevel, 'Processed directory (' + path + ').');
        }, reject);
      };

      readEntries();
    });
  }

  /**
   * If "assignDrop" was used to assign the drop events to an element, we automatically add the "dragOverClass" CSS
   * class to the element when a file is dropped onto it. In this case, we have to remove that class again before
   * calling "onDrop()".
   * If "onDrop()" is called from "handleDropEvent()" this is not needed.
   */
  private removeDragOverClassAndCallOnDrop(e: DragEvent): Promise<void> {
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Removing drag over class and calling onDrop...', e);
    const domNode: HTMLElement = e.currentTarget as HTMLElement;
    domNode.classList.remove(this.dragOverClass);
    const fileCategory = domNode.getAttribute('resumable-file-category');

    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Removed drag over class.');

    this.throwIfUnknownFileCategory(fileCategory);

    return this.onDrop(e, fileCategory);
  }

  /**
   * Handle the event when a new file was provided via drag-and-drop
   */
  private async onDrop(e: DragEvent, fileCategory: string = this.defaultFileCategory): Promise<void> {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling onDrop...', e, fileCategory);
    Helpers.stopEvent(e);

    let items = [];

    //handle dropped things as items if we can (this lets us deal with folders nicer in some cases)
    if (e.dataTransfer && e.dataTransfer.items) {
      items = [...e.dataTransfer.items as any];
    }
    //else handle them as files
    else if (e.dataTransfer && e.dataTransfer.files) {
      items =  [...e.dataTransfer.files as any];
    }

    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Collected items in onDrop.', items);

    if (!items.length) {
      return; // nothing to do
    }
    this.fire('fileProcessingBegin', items, fileCategory);
    let promises = items.map((item) => this.mapDragItemToFile(item, ''));
    let files = Helpers.flattenDeep(await Promise.all(promises));
    if (files.length) {
      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Handling files in onDrop...', files);
      // at least one file found
      this.appendFilesFromFileList(files, e, fileCategory);
    }

    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled onDrop.');
  }

  /**
   * Handle the event when a drag-and-drop item leaves the area of assigned drag-and-drop area
   */
  private onDragLeave(e: DragEvent): void {
    (e.currentTarget as HTMLElement).classList.remove(this.dragOverClass);
  }

  /**
   * Handle the event when a drag-and-drop item enters the area of assigned drag-and-drop area
   */
  private onDragOverEnter(e: DragEvent): void {
    e.preventDefault();
    let dt = e.dataTransfer;
    if (dt.types.includes('Files')) { // only for file drop
      e.stopPropagation();
      dt.dropEffect = 'copy';
      dt.effectAllowed = 'copy';
      (e.currentTarget as HTMLElement).classList.add(this.dragOverClass);
    } else {
      dt.dropEffect = 'none';
      dt.effectAllowed = 'none';
    }
  };

  /**
   * Validate and clean a list of files. This includes the removal of duplicates, a check whether the file type is
   * allowed and custom validation functions defined per file type.
   * @param {ExtendedFile[]} files A list of File instances that were previously extended with a uniqueIdentifier
   * @param fileCategory The file category that has been provided for the files. Defaults to `defaultFileCategory`.
   */
  private async validateFiles(files: ExtendedFile[], fileCategory: string = this.defaultFileCategory): Promise<ExtendedFile[]> {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Validating files....', files, fileCategory);
    if (!this.fileCategories.includes(fileCategory)) {
      this.fire('fileProcessingFailed', undefined, 'unknownFileCategory', fileCategory);
      Helpers.printDebugLow(
        this.debugVerbosityLevel,
        'File validation failed because of "unknownFileCategory".',
        fileCategory
      );
      return;
    }

    // Remove files that are duplicated in the original array, based on their unique identifiers
    let filesWithoutDuplicates = Helpers.uniqBy(files,
      (file) => file.uniqueIdentifier,
      (file) => this.fire('fileProcessingFailed', file, 'duplicate', fileCategory),
    );

    const validationResults = [];
    for (const file of filesWithoutDuplicates) {
      // Check if the file has already been added with a previous batch (based on its unique identifier).
      if (this.files[fileCategory].some((addedFile) => addedFile.uniqueIdentifier === file.uniqueIdentifier)) {
        this.fire('fileProcessingFailed', file, 'duplicate', fileCategory);
        Helpers.printDebugLow(this.debugVerbosityLevel, 'File validation failed because of "duplicate".', file);
        validationResults.push(false);
        continue;
      }

      let fileType: string = file.type.toLowerCase();
      let fileExtension = file.name.split('.').pop().toLowerCase();

      if (this.fileTypes[fileCategory].length > 0) {
        const fileTypeFound = this.fileTypes[fileCategory].some((type) => {
          // Check whether the extension inside the filename is an allowed file type
          return fileExtension === type ||
            // If MIME type, check for wildcard or if extension matches the file's tile type
            type.includes('/') && (
              type.includes('*') &&
              fileType.substring(0, type.indexOf('*')) === type.substring(0, type.indexOf('*')) ||
              fileType === type
            );
        });
        if (!fileTypeFound) {
          this.fire('fileProcessingFailed', file, 'fileType', fileCategory);
          this.fileTypeErrorCallback(file);
          Helpers.printDebugLow(this.debugVerbosityLevel, 'File validation failed because of "fileType".', file);
          validationResults.push(false);
          continue;
        }
      }

      // Validate the file size against minimum and maximum allowed sizes
      if (this.minFileSize !== undefined && file.size < this.minFileSize) {
        this.fire('fileProcessingFailed', file, 'minFileSize', fileCategory);
        this.minFileSizeErrorCallback(file);
        Helpers.printDebugLow(this.debugVerbosityLevel, 'File validation failed because of "minFileSize".', file);
        validationResults.push(false);
        continue;
      }
      if (this.maxFileSize !== undefined && file.size > this.maxFileSize) {
        this.fire('fileProcessingFailed', file, 'maxFileSize', fileCategory);
        this.maxFileSizeErrorCallback(file);
        validationResults.push(false);
        continue;
      }

      // Apply a custom validator based on the file extension
      if (fileExtension in this.validators && !await this.validators[fileExtension](file, fileCategory)) {
        this.fire('fileProcessingFailed', file, 'validation', fileCategory);
        this.fileValidationErrorCallback(file);
        Helpers.printDebugLow(this.debugVerbosityLevel, 'File validation failed because of "validation".', file);
        validationResults.push(false);
        continue;
      }

      validationResults.push(true);
    }

    // Filter the previously deduplicated files based on their corresponding validation result.
    const validatedFiles = filesWithoutDuplicates.filter((_v, index) => validationResults[index]);

    Helpers.printDebugLow(this.debugVerbosityLevel, 'Successfully validated files.', validatedFiles);

    return validatedFiles;
  }

  /**
   * Add an array of files to this instance's file list (of the file category, if given) by creating new ResumableFiles.
   * This includes a validation and deduplication of the provided array.
   * @param fileList An array containing File objects
   * @param event The event with which the fileList was provided
   * @param fileCategory The file category that has been provided for the file. Defaults to `defaultFileCategory`.
   */
  private async appendFilesFromFileList(fileList: File[], event: Event, fileCategory: string = this.defaultFileCategory): Promise<boolean> {
    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Appending files from list...', fileList, event, fileCategory);
    const resumableFiles = this.files[fileCategory];

    if (!resumableFiles) {
      this.fire('fileProcessingFailed', undefined, 'unknownFileCategory', fileCategory);
      Helpers.printDebugHigh(
        this.debugVerbosityLevel,
        'Can\'t append files from list, because of "unknownFileCategory"',
        fileCategory
      );
      return false;
    }

    const allResumableFiles = this.getFilesOfAllCategories();

    // check for uploading too many files
    if (this.maxFiles !== undefined && this.maxFiles < fileList.length + allResumableFiles.length) {
      // if single-file upload, file is already added, and trying to add 1 new file, simply replace the already-added file
      if (this.maxFiles === 1 && allResumableFiles.length === 1 && fileList.length === 1) {
        Helpers.printDebugHigh(this.debugVerbosityLevel,'Replacing already added file, because of single-file upload.');
        this.removeFile(resumableFiles[0]);
      } else {
        this.fire('fileProcessingFailed', undefined, 'maxFiles', fileCategory);
        this.maxFilesErrorCallback(fileList);
        Helpers.printDebugHigh(
          this.debugVerbosityLevel,
          'Can\'t append files from list, because of "maxFiles"',
          {maxFiles: this.maxFiles, alreadyAddedFilesCount: allResumableFiles.length, newFilesCount: fileList.length}
        );
        return false;
      }
    }

    // Add the unique identifier for every new file.
    // Since this might return a promise, we have to wait until it completed.
    const filesWithUniqueIdentifiers = await Promise.all(fileList.map(async (file: ExtendedFile): Promise<ExtendedFile> => {
      file.uniqueIdentifier = await this.callGenerateUniqueIdentifier(file, event, fileCategory);
      return file;
    }));

    // Validate the files and remove duplicates
    const validatedFiles = await this.validateFiles(filesWithUniqueIdentifiers, fileCategory);

    let skippedFiles = filesWithUniqueIdentifiers.filter((file) => !validatedFiles.includes(file));

    Helpers.printDebugHigh(this.debugVerbosityLevel,'Creating ResumableFiles for every file from file list...');
    for (const file of validatedFiles) {
      let f = new ResumableFile(
        file,
        file.uniqueIdentifier,
        fileCategory,
        this.files[fileCategory].length,
        this.opts,
      );
      f.on('chunkingStart', (...args) => this.handleChunkingStart(args, fileCategory));
      f.on('chunkingProgress', (...args) => this.handleChunkingProgress(args, fileCategory));
      f.on('chunkingComplete', (...args) => this.handleChunkingComplete(args, fileCategory));
      f.on('chunkSuccess', (uploadTaskId, ...args) => this.handleChunkSuccess(args, uploadTaskId, fileCategory));
      f.on('chunkError', (uploadTaskId, ...args) => this.handleChunkError(args, uploadTaskId, fileCategory));
      f.on('chunkCancel', (uploadTaskId, ...args) => this.handleChunkCancel(args, uploadTaskId, fileCategory));
      f.on('chunkRetry', (...args) => this.handleChunkRetry(args, fileCategory));
      f.on('chunkProgress', (...args) => this.handleChunkProgress(args, fileCategory));
      f.on('fileProgress', (...args) => this.handleFileProgress(args, fileCategory));
      f.on('fileError', (...args) => this.handleFileError(args, fileCategory));
      f.on('fileSuccess', (file, ...args) => this.handleFileSuccess(file, args, fileCategory));
      f.on('fileCancel', (...args) => this.handleFileCancel(args, fileCategory));
      f.on('fileRetry', (...args) => this.handleFileRetry(args, fileCategory));
      this.files[fileCategory].push(f);
      this.fire('fileAdded', f, event, fileCategory);
      Helpers.printDebugHigh(this.debugVerbosityLevel,'Created ResumableFile.', file, f);
    }
    Helpers.printDebugHigh(this.debugVerbosityLevel,'Created ResumableFiles for every file from file list.');

    // all files processed, trigger event
    if (!validatedFiles.length && !skippedFiles.length) {
      // no succeeded files, just skip
      return;
    }
    this.fire('filesAdded', validatedFiles, skippedFiles, fileCategory);

    Helpers.printDebugHigh(this.debugVerbosityLevel, 'Appended all files from list.');
  }

  /**
   * Generate a new unique identifier for a given file either with a default helper function or with a custom
   * generator function.
   * @param file The file as an HTML 5 File object
   * @param event The event with which the file was provided originally
   * @param fileCategory The file category that has been provided for the file. Defaults to `defaultFileCategory`.
   */
  private callGenerateUniqueIdentifier(file: File, event: Event, fileCategory: string = this.defaultFileCategory): string {
    return typeof this.generateUniqueIdentifier === 'function' ?
      this.generateUniqueIdentifier(file, event, fileCategory) : Helpers.generateUniqueIdentifier(file);
  }

  /**
   * Queue a new chunk to be uploaded that is currently awaiting upload.
   */
  private uploadNextChunk(currentUploadTaskId: UploadTaskId): void {
    if (this.isCancelled) {
      return;
    }

    if (this.uploadTaskIdCurrentlyCheckingIfUploadFinished !== undefined) {
      if (this.uploadTaskIdCurrentlyCheckingIfUploadFinished === currentUploadTaskId) {
        // The final check for upload completion is currently performed by this upload task. The next relevant chunk
        // is found and uploaded by `finalCheckIfUploadFinished()`.
        this.finalCheckIfUploadFinished(currentUploadTaskId);
        return;
      }

      // The final check for upload completion is already running. No new chunks should be uploaded anymore via this
      // function. This task can simply stop now.
      return;
    }

    if (!this.uploadTasks.has(currentUploadTaskId)) {
      throw new Error('Error while starting next chunk upload. Unknown upload task ID: ' + currentUploadTaskId);
    }
    const uploadTask = this.uploadTasks.get(currentUploadTaskId);

    Helpers.printDebugHigh(
      this.debugVerbosityLevel,
      'Queueing next chunk upload for upload task ID ' + currentUploadTaskId + '...',
    );

    this.setNextAvailableChunkForUploadTask(uploadTask);

    if (
      uploadTask.fileCategoryIndex !== undefined
      && uploadTask.fileIndex !== undefined
      && uploadTask.chunkIndex !== undefined
    ) {
      Helpers.printDebugHigh(
        this.debugVerbosityLevel,
        'Found next chunk to upload for upload task ID ' + currentUploadTaskId + ': '
          + 'file category index '+ uploadTask.fileCategoryIndex
          + ', file index ' + uploadTask.fileIndex
          + ', chunk index ' + uploadTask.chunkIndex + '.',
      );

      const file = this.files[this.fileCategories[uploadTask.fileCategoryIndex]][uploadTask.fileIndex];
      if (file.uploadChunk(uploadTask.chunkIndex, currentUploadTaskId, false)) {
        return;
      }

      // Something went wrong or the chunk was simply already uploading because another task picked it up.
      // Just try to upload the next chunk.
      this.uploadNextChunk(currentUploadTaskId);
      return;
    }

    // Since no chunk was found, the last chunk was already finished.
    // If the final check for upload completion is already running, this task can stop here.
    // Otherwise, we start the final check further below.
    if (this.uploadTaskIdCurrentlyCheckingIfUploadFinished !== undefined) {
      this.resetUploadTask(uploadTask);
      return;
    }

    // Only the last running upload task should start the final check for upload completion. Otherwise the final check
    // might interfere with still running uploads.
    let areAllTasksFinished = true;
    for (const [uploadTaskId, uploadTask] of this.uploadTasks) {
      if (
        uploadTaskId !== currentUploadTaskId
          && uploadTask.fileCategoryIndex !== undefined
          && uploadTask.fileIndex !== undefined
          && uploadTask.chunkIndex !== undefined
      ) {
        areAllTasksFinished = false;
        break;
      }
    }

    if (!areAllTasksFinished) {
      Helpers.printDebugLow(
        this.debugVerbosityLevel,
        'No more chunks to upload for upload task ID ' + currentUploadTaskId + '. Waiting for other tasks to finish.',
      );
      return;
    }

    Helpers.printDebugLow(
      this.debugVerbosityLevel,
      'All upload tasks are finished with their last available uploads. Upload task ID '
        + currentUploadTaskId
        + ' will now check if all chunks are really uploaded.',
    );

    this.finalCheckIfUploadFinished(currentUploadTaskId);
    return;
}

  private setNextAvailableChunkForUploadTask(uploadTask: UploadTask): void {
    let fileCategoryIndex = -1;
    let fileIndex = -1;
    let chunkIndex = -1;

    // Find the highest file category, file and chunk index that is currently set for any upload task.
    for (const [_, task] of this.uploadTasks) {
      if (task.fileCategoryIndex === undefined) {
        continue;
      }

      if (task.fileCategoryIndex > fileCategoryIndex) {
        fileCategoryIndex = task.fileCategoryIndex;
        fileIndex = task.fileIndex;
        chunkIndex = task.chunkIndex;
      } else if (task.fileCategoryIndex === fileCategoryIndex) {
        if (task.fileIndex > fileIndex) {
          fileIndex = task.fileIndex;
          chunkIndex = task.chunkIndex;
        } else if (task.fileIndex === fileIndex) {
          if (task.chunkIndex > chunkIndex) {
            chunkIndex = task.chunkIndex;
          }
        }
      }
    }

    if (fileCategoryIndex === -1) {
      fileCategoryIndex = undefined;
      fileIndex = undefined;
      chunkIndex = undefined;
    }

    uploadTask.fileCategoryIndex = fileCategoryIndex;
    uploadTask.fileIndex = fileIndex;
    uploadTask.chunkIndex = chunkIndex;
    this.uploadTasks.set(uploadTask.id, uploadTask);

    // When no chunk is currently uploading, the upload was probably just started, so we simply start with the first
    // available chunk.
    if (uploadTask.fileCategoryIndex === undefined) {
      // Pass -1 to start searching in the first file category, because "next" is index 0 then.
      fileCategoryIndex = this.findNextIndexOfFileCategoryWithFiles(-1);

      // No file category with files found, so no chunk available.
      if (fileCategoryIndex === undefined) {
        this.resetUploadTask(uploadTask);
        return;
      }

      fileIndex = 0;
      chunkIndex = -1;
    }

    // The indices now all either point to the latest uploading chunk or to the first available file with `chunkIndex`
    // set to -1. In both cases, we need to increase the chunk index to set it to the next relevant chunk.
    chunkIndex++;

    // Check if the chunk index is now out of bounds. This means the current file is finished and we have to move to the
    // next file (and potentially the next file category as well).
    if (chunkIndex >= this.files[this.fileCategories[fileCategoryIndex]][fileIndex].chunks.length) {
      // Move to next file.
      chunkIndex = 0;
      fileIndex++;
      if (fileIndex >= this.files[this.fileCategories[fileCategoryIndex]].length) {
        // Move to next file category and make sure we select a file category that actually contains files.
        fileIndex = 0;
        fileCategoryIndex = this.findNextIndexOfFileCategoryWithFiles(fileCategoryIndex);

        if (fileCategoryIndex === undefined) {
          // No more file categories with files found, so no more chunks available.
          this.resetUploadTask(uploadTask);
          return;
        }
      }
    }

    uploadTask.fileCategoryIndex = fileCategoryIndex;
    uploadTask.fileIndex = fileIndex;
    uploadTask.chunkIndex = chunkIndex;
    this.uploadTasks.set(uploadTask.id, uploadTask);
  }

  private findNextIndexOfFileCategoryWithFiles(currentFileCategoryIndex: number): number | undefined {
    let fileCategoryIndex = currentFileCategoryIndex + 1;

    while (
      fileCategoryIndex < this.fileCategories.length
        && this.files[this.fileCategories[fileCategoryIndex]].length === 0
    ) {
      fileCategoryIndex++;
    }

    // All remaining file categories are empty. No applicable file category found.
    if (fileCategoryIndex >= this.fileCategories.length) {
      return undefined;
    }

    return fileCategoryIndex;
  }

  private resetUploadTask(uploadTask: UploadTask): void {
    uploadTask.fileCategoryIndex = undefined;
    uploadTask.fileIndex = undefined;
    uploadTask.chunkIndex = undefined;
    this.uploadTasks.set(uploadTask.id, uploadTask);
  }

  private finalCheckIfUploadFinished(uploadTaskId: UploadTaskId): void {
    if (
      this.uploadTaskIdCurrentlyCheckingIfUploadFinished !== undefined
        && this.uploadTaskIdCurrentlyCheckingIfUploadFinished !== uploadTaskId
    ) {
      throw new Error('There\'s already another upload task checking if the upload is finished.');
    }

    // Initially we reset all upload tasks to make sure no other task is interfering with the final check.
    if (this.uploadTaskIdCurrentlyCheckingIfUploadFinished === undefined) {
      for (const [, task] of this.uploadTasks) {
        this.resetUploadTask(task);
      }

      this.uploadTaskIdCurrentlyCheckingIfUploadFinished = uploadTaskId;
    }

    const uploadTask = this.uploadTasks.get(this.uploadTaskIdCurrentlyCheckingIfUploadFinished);

    while (
      uploadTask.fileCategoryIndex === undefined
        || (
          uploadTask.fileCategoryIndex < this.fileCategories.length
          && uploadTask.fileIndex < this.files[this.fileCategories[uploadTask.fileCategoryIndex]].length
          && uploadTask.chunkIndex < this.files[this.fileCategories[uploadTask.fileCategoryIndex]][uploadTask.fileIndex].chunks.length
        )
    ) {
      this.setNextAvailableChunkForUploadTask(uploadTask);

      if (uploadTask.fileCategoryIndex === undefined) {
        Helpers.printDebugLow(
          this.debugVerbosityLevel,
          'Final check by upload task ID '
            + this.uploadTaskIdCurrentlyCheckingIfUploadFinished
            + ' determined that all chunks have been uploaded.',
        );
        this.fire('complete');
        return;
      }

      Helpers.printDebugHigh(
        this.debugVerbosityLevel,
        'Performing final check by upload task ID '
          + this.uploadTaskIdCurrentlyCheckingIfUploadFinished
          + ' for chunk with index ' + uploadTask.chunkIndex
          + ' of file with index ' + uploadTask.fileIndex
          + ' of file category with index ' + uploadTask.fileCategoryIndex + '.',
      );

      const file = this.files[this.fileCategories[uploadTask.fileCategoryIndex]][uploadTask.fileIndex];
      if (file.isComplete) {
        // Set chunk index to last chunk, so that the next iteration will automatically move to the next file.
        uploadTask.chunkIndex = file.chunks.length - 1;
        this.uploadTasks.set(this.uploadTaskIdCurrentlyCheckingIfUploadFinished, uploadTask);
        continue;
      }

      file.uploadChunk(uploadTask.chunkIndex, this.uploadTaskIdCurrentlyCheckingIfUploadFinished, true);

      // Return here, because we only want to upload one chunk at a time. This function will be called again, once this
      // chunk is finished.
      return;
    }
  }

  /**
   * Returns all ResumableFiles of all file categories.
   * The files are ordered by the order of the file categories in `this.fileCategories`. Files of the first category
   * are added first, files of the second category are added second etc.
   *
   * @returns {ResumableFile[]} Array of all ResumableFiles that are stored for any category.
   */
  private getFilesOfAllCategories(): ResumableFile[] {
    let allFiles = [];

    this.fileCategories.forEach((fileCategory) => {
      allFiles = allFiles.concat(this.files[fileCategory]);
    });

    return allFiles;
  }

  /**
   *  PUBLIC METHODS FOR RESUMABLE.JS
   *  This section only includes methods that should be callable from external packages.
   */

  /**
   * Assign a browse action to one or more DOM nodes. Pass in true to allow directories to be selected (Chrome only).
   *
   * @param domNodes The dom nodes to which the browse action should be assigned (can be an array or a single dom node).
   * @param isDirectory If true, directories can be added via the file picker (Chrome only).
   * @param fileCategory The file category that will be assigned to all added files. Defaults to `defaultFileCategory`.
   */
  assignBrowse(domNodes: HTMLElement | HTMLElement[], isDirectory: boolean = false, fileCategory: string = this.defaultFileCategory): void {
    Helpers.printDebugLow(
      this.debugVerbosityLevel,
      'Assigning browse to DOM nodes...',
      domNodes,
      {isDirectory: isDirectory},
      fileCategory
    );
    this.throwIfUnknownFileCategory(fileCategory);

    if (domNodes instanceof HTMLElement) domNodes = [domNodes];
    for (const domNode of domNodes) {
      let input;
      if (domNode instanceof HTMLInputElement && domNode.type === 'file') {
        input = domNode;
      } else {
        input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.style.display = 'none';
        domNode.addEventListener('click', () => {
          input.style.opacity = 0;
          input.style.display = 'block';
          input.focus();
          input.click();
          input.style.display = 'none';
        }, false);
        domNode.appendChild(input);
      }
      if (this.maxFiles !== 1) {
        input.setAttribute('multiple', 'multiple');
      } else {
        input.removeAttribute('multiple');
      }
      if (isDirectory) {
        input.setAttribute('webkitdirectory', 'webkitdirectory');
      } else {
        input.removeAttribute('webkitdirectory');
      }

      // Call setFileTypes() without changing the file types to just update the file types which are accepted by the
      // input dom element.
      this.setFileTypes(this.fileTypes[fileCategory], input, fileCategory);

      input.addEventListener(
        'change',
        (event: InputEvent) => {
          this.handleChangeEvent(event, fileCategory);
        },
        false
      );

      Helpers.printDebugHigh(this.debugVerbosityLevel, 'Added input (for browse) to DOM node.', domNode, input);
    }
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Assigned browse to DOM nodes.', domNodes);
  }

  /**
   * Assign one or more DOM nodes as a drop target.
   *
   * @param domNodes The dom nodes to which the drop action should be assigned (can be an array or a single dom node).
   * @param fileCategory The file category that will be assigned to all added files. Defaults to `defaultFileCategory`.
   */
  assignDrop(domNodes: HTMLElement | HTMLElement[], fileCategory: string = this.defaultFileCategory): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Assigning drop to DOM nodes...', domNodes, fileCategory);
    this.throwIfUnknownFileCategory(fileCategory);

    if (domNodes instanceof HTMLElement) domNodes = [domNodes];

    for (const domNode of domNodes) {
      if (fileCategory) {
        // Assign the file category as attribute to the Dom node. This is needed because this information needs to be read
        // in the "drop" event listener, but we can't pass a value into the listener directly. Unfortunately we can't use
        // an arrow function as a wrapper here (as done in assignBrowse()) because we need to be able to access the same
        // function in unAssignDrop().
        domNode.setAttribute('resumable-file-category', fileCategory);
      }

      domNode.addEventListener('dragover', this.onDragOverEnter.bind(this), false);
      domNode.addEventListener('dragenter', this.onDragOverEnter.bind(this), false);
      domNode.addEventListener('dragleave', this.onDragLeave.bind(this), false);
      domNode.addEventListener('drop', this.removeDragOverClassAndCallOnDrop.bind(this), false);
    }
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Assigned drop to DOM nodes.', domNodes);
  }

  /**
   * Remove one or more DOM nodes as a drop target.
   */
  unAssignDrop(domNodes: HTMLElement | HTMLElement[]): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Unassigning drop from DOM nodes...', domNodes);
    if (domNodes instanceof HTMLElement) domNodes = [domNodes];

    for (const domNode of domNodes) {
      domNode.removeEventListener('dragover', this.onDragOverEnter.bind(this));
      domNode.removeEventListener('dragenter', this.onDragOverEnter.bind(this));
      domNode.removeEventListener('dragleave', this.onDragLeave.bind(this));
      domNode.removeEventListener('drop', this.removeDragOverClassAndCallOnDrop.bind(this));
    }
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Unassigned drop from DOM nodes.', domNodes);
  }

  /**
   * Set the file types allowed to upload.
   * Per default the file types are updated for the default file category.
   * Optionally pass a dom node on which the accepted file types should be updated as well.
   *
   * @param fileTypes String array of all allowed file types
   * @param domNode An optional HTMLInputElement for which the "accepted" attribute should be updated accordingly.
   * @param fileCategory The file category for which the file types should be updated. Defaults to `defaultFileCategory`.
   */
  setFileTypes(fileTypes: string[], domNode: HTMLInputElement = null, fileCategory: string = this.defaultFileCategory): void {
    Helpers.printDebugLow(
      this.debugVerbosityLevel,
      'Setting file types for DOM node...',
      fileTypes,
      domNode,
      fileCategory
    );
    this.throwIfUnknownFileCategory(fileCategory);

    if (domNode && domNode.type !== 'file') {
      throw new Error('Dom node is not a file input.');
    }

    // Store new file types and sanitize them.
    this.fileTypes[fileCategory] = fileTypes;
    this.sanitizeFileTypes();

    if (domNode) {
      if (fileTypes.length >= 1) {
        // Set the new file types as "accepted" by the given dom node.
        domNode.setAttribute('accept', this.fileTypes[fileCategory].map((type) => {
          if (type.match(/^[^.][^/]+$/)) {
            type = '.' + type;
          }
          return type;
        }).join(','));
      } else {
        // Make all file types "accepted" by the given dom node.
        domNode.removeAttribute('accept');
      }
    }

    Helpers.printDebugLow(this.debugVerbosityLevel, 'Set file types for DOM node.');
  }

  /**
   * Check whether any files are currently uploading
   */
  get isUploading(): boolean {
    return this.getFilesOfAllCategories().some((file) => file.isUploading);
  }

  /**
   * Start or resume the upload of the provided files by initiating the upload of the first chunk
   */
  upload(): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Starting Upload...');

    this.isCancelled = false;

    if (this.isUploading) {
      Helpers.printDebugLow(this.debugVerbosityLevel, 'Already uploading. Not starting again.');
      return;
    }

    this.fire('uploadStart');

    for (const [uploadTaskId] of this.uploadTasks) {
      Helpers.printDebugHigh(
        this.debugVerbosityLevel,
        'Starting upload for upload task "' + uploadTaskId + '"...',
      );

      this.uploadNextChunk(uploadTaskId);

      Helpers.printDebugHigh(
        this.debugVerbosityLevel,
        'Started upload for upload task "' + uploadTaskId + '".',
      );
    }

    Helpers.printDebugLow(this.debugVerbosityLevel, 'Started Upload.');
  }

  /**
   * Pause the upload
   */
  pause(): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Pausing Upload...');
    // Resume all chunks currently being uploaded
    for (const file of this.getFilesOfAllCategories()) {
      file.abort();
    }
    this.fire('pause');
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Paused Upload.');
  };

  /**
   * Cancel upload and remove all files from the file list.
   */
  cancel(): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Cancelling Upload...');
    this.fire('beforeCancel');

    this.isCancelled = true;

    // Abort the upload of all currently uploading files.
    for (const [, uploadTask] of this.uploadTasks) {
      if (
        uploadTask.fileCategoryIndex !== undefined
        && uploadTask.fileIndex !== undefined
        && uploadTask.chunkIndex !== undefined
      ) {
        const file = this.files[this.fileCategories[uploadTask.fileCategoryIndex]][uploadTask.fileIndex];
        file.abort();
      }

      this.resetUploadTask(uploadTask);
    }

    // Remove all files.
    this.fileCategories.forEach((fileCategory) => {
      this.files[fileCategory] = [];
    });

    this.fire('cancel');
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Cancelled Upload.');
  };

  /**
   * Return the progress of the current upload as a float between 0 and 1
   */
  progress(): number {
    let totalDone = this.getFilesOfAllCategories().reduce((accumulator, file) => accumulator + file.size * file.progress(), 0);
    let totalSize = this.getSize();
    return totalSize > 0 ? totalDone / totalSize : 0;
  };

  /**
   * Add a HTML5 File object to the list of files.
   */
  addFile(file: File, event: Event, fileCategory: string = this.defaultFileCategory): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Adding file...', file, event, fileCategory);
    this.throwIfUnknownFileCategory(fileCategory);

    this.appendFilesFromFileList([file], event, fileCategory);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Added file.', file);
  };

  /**
   * Add a list of HTML5 File objects to the list of files.
   */
  addFiles(files: File[], event: Event, fileCategory: string = this.defaultFileCategory): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Adding files...', files, event, fileCategory);
    this.throwIfUnknownFileCategory(fileCategory);

    this.appendFilesFromFileList(files, event, fileCategory);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Added files.', files);
  };

  /**
   * Add a validator function for the given file type. This can e.g. be used to read the file and validate
   * checksums based on certain properties.
   * @param fileType The file extension for the given validator
   * @param validator A callback function that should be called when validating files with the given type
   */
  addFileValidator(fileType: string, validator: Function): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Adding file validator for file type...', fileType);
    if (fileType in this.validators) {
      console.warn(`Overwriting validator for file type: ${fileType}`);
    }
    this.validators[fileType] = validator;
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Added file validator for file type.', fileType);
  }

  /**
   * Remove the given resumable file from the file list (of its corresponding file category).
   */
  removeFile(file: ResumableFile): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Removing file...', file);
    const fileCategory = file.fileCategory;
    const fileIndex = this.files[fileCategory].findIndex(
      (fileFromArray) => fileFromArray.uniqueIdentifier === file.uniqueIdentifier
    );

    if (fileIndex >= 0) {
      this.files[fileCategory].splice(fileIndex, 1);
    }
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Removed file.', file);
  };

  /**
   * Retrieve a ResumableFile object from the file list by its unique identifier.
   */
  getFromUniqueIdentifier(uniqueIdentifier: string): ResumableFile | undefined {
    return this.getFilesOfAllCategories().find((file) => file.uniqueIdentifier === uniqueIdentifier);
  };

  /**
   * Get the combined size of all files for the upload
   */
  getSize(): number {
    return this.getFilesOfAllCategories().reduce((accumulator, file) => accumulator + file.size, 0);
  }

  /**
   * Call the event handler for a DragEvent (when a file is dropped on a drop area).
   */
  handleDropEvent(e: DragEvent, fileCategory: string = this.defaultFileCategory): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling drop event...', e, fileCategory);
    this.throwIfUnknownFileCategory(fileCategory);

    this.onDrop(e, fileCategory);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled drop event.');
  }

  /**
   * Call the event handler for an InputEvent (i.e. received one or multiple files).
   */
  handleChangeEvent(e: InputEvent, fileCategory: string = this.defaultFileCategory): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling change event...', e, fileCategory);
    this.throwIfUnknownFileCategory(fileCategory);

    const eventTarget = e.target as HTMLInputElement;
    this.fire('fileProcessingBegin', eventTarget.files, fileCategory);
    this.appendFilesFromFileList([...eventTarget.files as any], e, fileCategory);
    if (this.clearInput) {
      eventTarget.value = '';
    }
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled change event.');
  }

  /**
   * Check whether the upload of the given file category is completed.
   */
  private checkFileCategoryUploadComplete(fileCategory: string): void {
    Helpers.printDebugHigh(
      this.debugVerbosityLevel,
      'Checking for upload completion of file category "' + fileCategory + '"...',
    );
    // If no files were added, there is no upload that could be complete.
    if (this.files[fileCategory].length === 0) {
      return;
    }

    const isUploadComplete = this.files[fileCategory].every((file) => file.isComplete);

    if (isUploadComplete) {
      this.fire('categoryComplete', fileCategory);
    }

    Helpers.printDebugHigh(
      this.debugVerbosityLevel,
      'Checked for upload completion of file category "' + fileCategory + '". Upload completed: '
        + (isUploadComplete ? 'no' : 'yes')
    );
  }

  /**
   * Event Handlers: This section should only include methods that are used to
   * handle events coming from the files or chunks.
   */

  /**
   * The event handler when the chunking of a file was started
   */
  private handleChunkingStart(args: any[], fileCategory: string): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkingStart" in main resumable object...', args);
    this.fire('chunkingStart', ...args, fileCategory);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkingStart" in main resumable object.', args);
  }

  /**
   * The event handler when there was any progress while chunking a file
   */
  private handleChunkingProgress(args: any[], fileCategory: string): void {
    // No debugging messages because this would really spam the console.
    this.fire('chunkingProgress', ...args, fileCategory);
  }

  /**
   * The event handler when the chunking of a file was completed
   */
  private handleChunkingComplete(args: any[], fileCategory: string): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkingComplete" in main resumable object...', args);
    this.fire('chunkingComplete', ...args, fileCategory);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkingComplete" in main resumable object.', args);
  }

  /**
   * The event handler when a chunk was uploaded successfully
   */
  private handleChunkSuccess(args: any[], uploadTaskId: UploadTaskId, fileCategory: string): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkSuccess" in main resumable object...', args);
    this.fire('chunkSuccess', ...args, fileCategory);
    this.uploadNextChunk(uploadTaskId);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkSuccess" in main resumable object.', args);
  }

  /**
   * The event handler when an error happened while uploading a chunk
   */
  private handleChunkError(args: any[], uploadTaskId: UploadTaskId, fileCategory: string): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkError" in main resumable object...', args);
    this.fire('chunkError', ...args, fileCategory);
    this.uploadNextChunk(uploadTaskId);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkError" in main resumable object.', args);
  }

  /**
   * The event handler when an the upload of a chunk was canceled
   */
  private handleChunkCancel(args: any[], uploadTaskId: UploadTaskId, fileCategory: string): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkCancel" in main resumable object...', args);
    this.fire('chunkCancel', ...args, fileCategory);
    this.uploadNextChunk(uploadTaskId);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkCancel" in main resumable object.', args);
  }

  /**
   * The event handler when the upload of a chunk is being retried
   */
  private handleChunkRetry(args: any[], fileCategory: string): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkRetry" in main resumable object...', args);
    this.fire('chunkRetry', ...args, fileCategory);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkRetry" in main resumable object.', args);
  }

  /**
   * The event handler when there is any progress while uploading a chunk
   */
  private handleChunkProgress(args: any[], fileCategory: string): void {
    // No debugging messages because this would really spam the console.
    this.fire('chunkProgress', ...args, fileCategory);
  }

  /**
   * The event handler when an error occurred during the upload of a file
   */
  private handleFileError(args: any[], fileCategory: string): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling "fileError" in main resumable object...', args);
    this.fire('fileError', ...args, fileCategory);
    // 'error' event for backward compatibility ('fileError' was not fired in previous versions).
    // If there will be other errors besides 'fileError's at some point, the 'error' event (as a general "catch all
    // errors" event) would make more sense.
    this.fire('error', args[1], args[0], fileCategory);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled "fileError" in main resumable object.', args);
  }

  /**
   * The event handler when all chunks from a file were uploaded successfully
   */
  private handleFileSuccess(file: ResumableFile, args: any[], fileCategory: string): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling "fileSuccess" in main resumable object...', args);
    this.fire('fileSuccess', file, ...args, fileCategory);

    // To prevent iterating over all files every time any file is uploaded, we only check for completion of the
    // category when the last files are uploaded. As the files are processed in order, we can simply check their offset
    // against the length of the files array to determine if we are at the end of the category. We have to consider the
    // simultaneous uploads because it could happen that the last file is uploaded faster than e.g. the one before that.
    if (file.offset >= this.files[fileCategory].length - this.simultaneousUploads) {
      this.checkFileCategoryUploadComplete(fileCategory);
    }

    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled "fileSuccess" in main resumable object.', args);
  }

  /**
   * The event handler when a file progress event was received
   */
  private handleFileProgress(args: any[], fileCategory: string): void {
    // No debugging messages because this would really spam the console.
    this.fire('fileProgress', ...args, fileCategory);
    this.fire('progress');
  }

  /**
   * The event handler when the upload of a file was canceled
   */
  private handleFileCancel(args: any[], fileCategory: string): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling "fileCancel" in main resumable object...', args);
    this.fire('fileCancel', ...args, fileCategory);
    this.removeFile(args[0]);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled "fileCancel" in main resumable object.', args);
  }

  /**
   * The event handler, when the retry of a file was initiated.
   * This event handler only re-fires the event to the calling code (outside resumable). The event is only used as a
   * notification. The handler does not perform any retries of the upload itself. This is already handled by the chunk
   * retry handling which always occurs before a `fileRetry` event is fired.
   */
  private handleFileRetry(args: any[], fileCategory: string): void {
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handling "fileRetry" in main resumable object...', args);
    this.fire('fileRetry', ...args, fileCategory);
    Helpers.printDebugLow(this.debugVerbosityLevel, 'Handled "fileRetry" in main resumable object.', args);
  }
}
