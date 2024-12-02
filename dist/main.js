(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("resumablejs", [], factory);
	else if(typeof exports === 'object')
		exports["resumablejs"] = factory();
	else
		root["resumablejs"] = factory();
})(this, function() {
return /******/ (function() { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Resumable = void 0;
const resumableHelpers_1 = __webpack_require__(1);
const resumableFile_1 = __webpack_require__(2);
const resumableEventHandler_1 = __webpack_require__(4);
/**
 * An instance of a resumable upload handler that contains one or multiple files which should be uploaded in chunks.
 */
class Resumable extends resumableEventHandler_1.default {
    constructor(options = {}) {
        super();
        /**
         * An object that contains one entry for every file category. The key is the category name, the value is an array of
         * all ResumableFiles of that category that were added to this instance.
         */
        this.files = {};
        /**
         * Contains all file categories for which the upload was not yet completed.
         */
        this.uncompletedFileCategories = [];
        this.validators = {};
        // Configuration Options
        this.clearInput = true;
        this.dragOverClass = 'dragover';
        this.fileCategories = [];
        this.defaultFileCategory = 'default';
        this.fileTypes = [];
        this.fileTypeErrorCallback = (file) => {
            alert(`${file.fileName || file.name} has an unsupported file type.`);
        };
        this.generateUniqueIdentifier = null;
        this.maxFileSizeErrorCallback = (file) => {
            alert(file.fileName || file.name + ' is too large, please upload files less than ' +
                resumableHelpers_1.default.formatSize(this.maxFileSize) + '.');
        };
        this.maxFilesErrorCallback = (files) => {
            var maxFiles = this.maxFiles;
            alert('Please upload no more than ' + maxFiles + ' file' + (maxFiles === 1 ? '' : 's') + ' at a time.');
        };
        this.minFileSize = 1;
        this.minFileSizeErrorCallback = (file) => {
            alert(file.fileName || file.name + ' is too small, please upload files larger than ' +
                resumableHelpers_1.default.formatSize(this.minFileSize) + '.');
        };
        this.prioritizeFirstAndLastChunk = false;
        this.fileValidationErrorCallback = (file) => { };
        this.simultaneousUploads = 3;
        this.debugVerbosityLevel = 0 /* DebugVerbosityLevel.NONE */;
        this.setInstanceProperties(options);
        this.opts = options;
        this.checkSupport();
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Constructed Resumable.', this);
    }
    /**
     * Check whether the current browser supports the essential functions for the package to work.
     * The method checks if these features are supported:
     * - File object type
     * - Blob object type
     * - FileList object type
     * - slicing files
     */
    checkSupport() {
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
    setInstanceProperties(options) {
        Object.assign(this, options);
        // Explicitly test for null because other falsy values could be used as default.
        if (this.defaultFileCategory === null) {
            if (this.fileCategories.length === 0) {
                throw new Error('If no default category is set, at least one file category must be defined.');
            }
        }
        else if (!this.fileCategories.includes(this.defaultFileCategory)) {
            this.fileCategories.push(this.defaultFileCategory);
        }
        else {
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
            this.uncompletedFileCategories.push(fileCategory);
            deduplicatedFileCategories.push(fileCategory);
        });
        this.fileCategories = deduplicatedFileCategories.slice();
        // Create/Check file types object.
        if (Array.isArray(this.fileTypes)) {
            // If fileTypes are given as an array, these types should be used for all file categores.
            // Create the file types object and assign the given array to every file category.
            const fileTypes = this.fileTypes.slice();
            this.fileTypes = {};
            this.fileCategories.forEach((fileCategory) => {
                this.fileTypes[fileCategory] = fileTypes.slice();
            });
        }
        else {
            const fileTypeCategories = Object.keys(this.fileTypes);
            this.fileCategories.forEach((fileCategory) => {
                if (!fileTypeCategories.includes(fileCategory)) {
                    console.warn('File category "' + fileCategory + '" not part of fileTypes object. Assuming empty array (which allows all file types).');
                }
                this.fileTypes[fileCategory] = [];
            });
        }
        this.sanitizeFileTypes();
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Set Resumable instance properties.', this);
    }
    sanitizeFileTypes() {
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Sanitizing file types...');
        // For good behaviour we do some sanitizing. Remove spaces and dots and lowercase all.
        Object.keys(this.fileTypes).forEach((fileCategory) => {
            this.fileTypes[fileCategory] = this.fileTypes[fileCategory].map((type) => type.replace(/[\s.]/g, '').toLowerCase());
        });
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Sanitized file types.');
    }
    throwIfUnknownFileCategory(fileCategory) {
        if (!this.fileCategories.includes(fileCategory)) {
            throw new Error('Unknown file category: ' + fileCategory);
        }
    }
    /**
     * Transforms a single fileEntry or directoryEntry item into a list of File objects this method is used to convert
     * entries found inside dragged-and-dropped directories.
     * @param {Object} item item to upload, may be file or directory entry
     * @param {string} path current file path
     */
    mapDirectoryItemToFile(item, path) {
        return __awaiter(this, void 0, void 0, function* () {
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Mapping directory item to file (' + path + ')...', item);
            if (item.isFile) {
                // file entry provided
                const file = yield new Promise((resolve, reject) => item.file(resolve, reject));
                file.relativePath = path + file.name;
                resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Mapped directory item (FileSystemFileEntry) to file (' + path + ').', file);
                return [file];
            }
            else if (item.isDirectory) {
                // directory entry provided
                resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Directory item contains new directory (' + path + ').');
                return yield this.processDirectory(item, path + item.name + '/');
            }
            else if (item instanceof File) {
                resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Directory item already is a file (' + path + ').');
                return [item];
            }
            console.warn('Item mapping did not return a file object. This might be due to an unknown file type.');
            return [];
        });
    }
    /**
     * Transforms a single DataTransfer item into a File object. This may include either extracting the given file or
     * all files inside the provided directory.
     * @param item item to upload, may be file or directory entry
     * @param path current file path
     */
    mapDragItemToFile(item, path) {
        return __awaiter(this, void 0, void 0, function* () {
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Mapping drag item to file (' + path + ')...', item);
            let entry = item.webkitGetAsEntry();
            if (entry.isDirectory) {
                resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Drag item contains new directory (' + path + ').');
                return yield this.processDirectory(entry, path + entry.name + '/');
            }
            let file = item.getAsFile();
            if (file instanceof File) {
                file.relativePath = path + file.name;
                resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Mapped drag item to file (' + path + ').', file);
                return [file];
            }
            console.warn('Item mapping did not return a file object. This might be due to an unknown file type.');
            return [];
        });
    }
    /**
     * Recursively traverse a directory and collect files to upload
     */
    processDirectory(directory, path) {
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Processing directory (' + path + ')...', directory);
        return new Promise((resolve, reject) => {
            const dirReader = directory.createReader();
            let allEntries = [];
            const readEntries = () => {
                dirReader.readEntries((entries) => __awaiter(this, void 0, void 0, function* () {
                    // Read the files batch-wise (in chrome e.g. 100 at a time)
                    if (entries.length) {
                        allEntries = allEntries.concat(entries);
                        return readEntries();
                    }
                    // After collecting all files, map all fileEntries to File objects
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Read all entries from directory (' + path + ').', allEntries);
                    allEntries = allEntries.map((entry) => {
                        return this.mapDirectoryItemToFile(entry, path);
                    });
                    // Wait until all files are collected.
                    resolve(yield Promise.all(allEntries));
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Processed directory (' + path + ').');
                }), reject);
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
    removeDragOverClassAndCallOnDrop(e) {
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Removing drag over class and calling onDrop...', e);
        const domNode = e.currentTarget;
        domNode.classList.remove(this.dragOverClass);
        const fileCategory = domNode.getAttribute('resumable-file-category');
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Removed drag over class.');
        this.throwIfUnknownFileCategory(fileCategory);
        return this.onDrop(e, fileCategory);
    }
    /**
     * Handle the event when a new file was provided via drag-and-drop
     */
    onDrop(e, fileCategory = this.defaultFileCategory) {
        return __awaiter(this, void 0, void 0, function* () {
            resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling onDrop...', e, fileCategory);
            resumableHelpers_1.default.stopEvent(e);
            let items = [];
            //handle dropped things as items if we can (this lets us deal with folders nicer in some cases)
            if (e.dataTransfer && e.dataTransfer.items) {
                items = [...e.dataTransfer.items];
            }
            //else handle them as files
            else if (e.dataTransfer && e.dataTransfer.files) {
                items = [...e.dataTransfer.files];
            }
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Collected items in onDrop.', items);
            if (!items.length) {
                return; // nothing to do
            }
            this.fire('fileProcessingBegin', items, fileCategory);
            let promises = items.map((item) => this.mapDragItemToFile(item, ''));
            let files = resumableHelpers_1.default.flattenDeep(yield Promise.all(promises));
            if (files.length) {
                resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handling files in onDrop...', files);
                // at least one file found
                this.appendFilesFromFileList(files, e, fileCategory);
            }
            resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled onDrop.');
        });
    }
    /**
     * Handle the event when a drag-and-drop item leaves the area of assigned drag-and-drop area
     */
    onDragLeave(e) {
        e.currentTarget.classList.remove(this.dragOverClass);
    }
    /**
     * Handle the event when a drag-and-drop item enters the area of assigned drag-and-drop area
     */
    onDragOverEnter(e) {
        e.preventDefault();
        let dt = e.dataTransfer;
        if (dt.types.includes('Files')) { // only for file drop
            e.stopPropagation();
            dt.dropEffect = 'copy';
            dt.effectAllowed = 'copy';
            e.currentTarget.classList.add(this.dragOverClass);
        }
        else {
            dt.dropEffect = 'none';
            dt.effectAllowed = 'none';
        }
    }
    ;
    /**
     * Validate and clean a list of files. This includes the removal of duplicates, a check whether the file type is
     * allowed and custom validation functions defined per file type.
     * @param {ExtendedFile[]} files A list of File instances that were previously extended with a uniqueIdentifier
     * @param fileCategory The file category that has been provided for the files. Defaults to `defaultFileCategory`.
     */
    validateFiles(files, fileCategory = this.defaultFileCategory) {
        return __awaiter(this, void 0, void 0, function* () {
            resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Validating files....', files, fileCategory);
            if (!this.fileCategories.includes(fileCategory)) {
                this.fire('fileProcessingFailed', undefined, 'unknownFileCategory', fileCategory);
                resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'File validation failed because of "unknownFileCategory".', fileCategory);
                return;
            }
            // Remove files that are duplicated in the original array, based on their unique identifiers
            let uniqueFiles = resumableHelpers_1.default.uniqBy(files, (file) => file.uniqueIdentifier, (file) => this.fire('fileProcessingFailed', file, 'duplicate', fileCategory));
            const resumableFiles = this.files[fileCategory];
            let validationPromises = uniqueFiles.map((file) => __awaiter(this, void 0, void 0, function* () {
                // Check if the file has already been added (based on its unique identifier).
                if (resumableFiles.some((addedFile) => addedFile.uniqueIdentifier === file.uniqueIdentifier)) {
                    this.fire('fileProcessingFailed', file, 'duplicate', fileCategory);
                    resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'File validation failed because of "duplicate".', file);
                    return false;
                }
                let fileType = file.type.toLowerCase();
                let fileExtension = file.name.split('.').pop().toLowerCase();
                if (this.fileTypes[fileCategory].length > 0) {
                    const fileTypeFound = this.fileTypes[fileCategory].some((type) => {
                        // Check whether the extension inside the filename is an allowed file type
                        return fileExtension === type ||
                            // If MIME type, check for wildcard or if extension matches the file's tile type
                            type.includes('/') && (type.includes('*') &&
                                fileType.substring(0, type.indexOf('*')) === type.substring(0, type.indexOf('*')) ||
                                fileType === type);
                    });
                    if (!fileTypeFound) {
                        this.fire('fileProcessingFailed', file, 'fileType', fileCategory);
                        this.fileTypeErrorCallback(file);
                        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'File validation failed because of "fileType".', file);
                        return false;
                    }
                }
                // Validate the file size against minimum and maximum allowed sizes
                if (this.minFileSize !== undefined && file.size < this.minFileSize) {
                    this.fire('fileProcessingFailed', file, 'minFileSize', fileCategory);
                    this.minFileSizeErrorCallback(file);
                    resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'File validation failed because of "minFileSize".', file);
                    return false;
                }
                if (this.maxFileSize !== undefined && file.size > this.maxFileSize) {
                    this.fire('fileProcessingFailed', file, 'maxFileSize', fileCategory);
                    this.maxFileSizeErrorCallback(file);
                    return false;
                }
                // Apply a custom validator based on the file extension
                if (fileExtension in this.validators && !(yield this.validators[fileExtension](file, fileCategory))) {
                    this.fire('fileProcessingFailed', file, 'validation', fileCategory);
                    this.fileValidationErrorCallback(file);
                    resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'File validation failed because of "validation".', file);
                    return false;
                }
                return true;
            }));
            const results = yield Promise.all(validationPromises);
            resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Successfully validated files.', results);
            // Only include files that passed their validation tests
            return files.filter((_v, index) => results[index]);
        });
    }
    /**
     * Add an array of files to this instance's file list (of the file category, if given) by creating new ResumableFiles.
     * This includes a validation and deduplication of the provided array.
     * @param fileList An array containing File objects
     * @param event The event with which the fileList was provided
     * @param fileCategory The file category that has been provided for the file. Defaults to `defaultFileCategory`.
     */
    appendFilesFromFileList(fileList, event, fileCategory = this.defaultFileCategory) {
        return __awaiter(this, void 0, void 0, function* () {
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Appending files from list...', fileList, event, fileCategory);
            const resumableFiles = this.files[fileCategory];
            if (!resumableFiles) {
                this.fire('fileProcessingFailed', undefined, 'unknownFileCategory', fileCategory);
                resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Can\'t append files from list, because of "unknownFileCategory"', fileCategory);
                return false;
            }
            const allResumableFiles = this.getFilesOfAllCategories();
            // check for uploading too many files
            if (this.maxFiles !== undefined && this.maxFiles < fileList.length + allResumableFiles.length) {
                // if single-file upload, file is already added, and trying to add 1 new file, simply replace the already-added file
                if (this.maxFiles === 1 && allResumableFiles.length === 1 && fileList.length === 1) {
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Replacing already added file, because of single-file upload.');
                    this.removeFile(resumableFiles[0]);
                }
                else {
                    this.fire('fileProcessingFailed', undefined, 'maxFiles', fileCategory);
                    this.maxFilesErrorCallback(fileList);
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Can\'t append files from list, because of "maxFiles"', { maxFiles: this.maxFiles, alreadyAddedFilesCount: allResumableFiles.length, newFilesCount: fileList.length });
                    return false;
                }
            }
            // Add the unique identifier for every new file.
            // Since this might return a promise, we have to wait until it completed.
            const filesWithUniqueIdentifiers = yield Promise.all(fileList.map((file) => __awaiter(this, void 0, void 0, function* () {
                file.uniqueIdentifier = yield this.callGenerateUniqueIdentifier(file, event, fileCategory);
                return file;
            })));
            // Validate the files and remove duplicates
            const validatedFiles = yield this.validateFiles(filesWithUniqueIdentifiers, fileCategory);
            let skippedFiles = filesWithUniqueIdentifiers.filter((file) => !validatedFiles.includes(file));
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Creating ResumableFiles for every file from file list...');
            for (const file of validatedFiles) {
                let f = new resumableFile_1.default(file, file.uniqueIdentifier, fileCategory, this.opts);
                f.on('chunkingStart', (...args) => this.handleChunkingStart(args, fileCategory));
                f.on('chunkingProgress', (...args) => this.handleChunkingProgress(args, fileCategory));
                f.on('chunkingComplete', (...args) => this.handleChunkingComplete(args, fileCategory));
                f.on('chunkSuccess', (...args) => this.handleChunkSuccess(args, fileCategory));
                f.on('chunkError', (...args) => this.handleChunkError(args, fileCategory));
                f.on('chunkCancel', (...args) => this.handleChunkCancel(args, fileCategory));
                f.on('chunkRetry', (...args) => this.handleChunkRetry(args, fileCategory));
                f.on('chunkProgress', (...args) => this.handleChunkProgress(args, fileCategory));
                f.on('fileProgress', (...args) => this.handleFileProgress(args, fileCategory));
                f.on('fileError', (...args) => this.handleFileError(args, fileCategory));
                f.on('fileSuccess', (...args) => this.handleFileSuccess(args, fileCategory));
                f.on('fileCancel', (...args) => this.handleFileCancel(args, fileCategory));
                f.on('fileRetry', (...args) => this.handleFileRetry(args, fileCategory));
                this.files[fileCategory].push(f);
                this.fire('fileAdded', f, event, fileCategory);
                resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Created ResumableFile.', file, f);
            }
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Created ResumableFiles for every file from file list.');
            // all files processed, trigger event
            if (!validatedFiles.length && !skippedFiles.length) {
                // no succeeded files, just skip
                return;
            }
            this.fire('filesAdded', validatedFiles, skippedFiles, fileCategory);
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Appended all files from list.');
        });
    }
    /**
     * Generate a new unique identifier for a given file either with a default helper function or with a custom
     * generator function.
     * @param file The file as an HTML 5 File object
     * @param event The event with which the file was provided originally
     * @param fileCategory The file category that has been provided for the file. Defaults to `defaultFileCategory`.
     */
    callGenerateUniqueIdentifier(file, event, fileCategory = this.defaultFileCategory) {
        return typeof this.generateUniqueIdentifier === 'function' ?
            this.generateUniqueIdentifier(file, event, fileCategory) : resumableHelpers_1.default.generateUniqueIdentifier(file);
    }
    /**
     * Queue a new chunk to be uploaded that is currently awaiting upload.
     */
    uploadNextChunk() {
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Queueing next chunk upload...');
        const allResumableFiles = this.getFilesOfAllCategories();
        // In some cases (such as videos) it's really handy to upload the first
        // and last chunk of a file quickly; this lets the server check the file's
        // metadata and determine if there's even a point in continuing.
        if (this.prioritizeFirstAndLastChunk) {
            for (const file of allResumableFiles) {
                if (file.chunks.length && file.chunks[0].status === "chunkPending" /* ResumableChunkStatus.PENDING */) {
                    file.chunks[0].send();
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Queued upload of prioritized first chunk.', file);
                    return;
                }
                if (file.chunks.length > 1 && file.chunks[file.chunks.length - 1].status === "chunkPending" /* ResumableChunkStatus.PENDING */) {
                    file.chunks[file.chunks.length - 1].send();
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Queued upload of prioritized last chunk.', file);
                    return;
                }
            }
        }
        // Now, simply look for the next best thing to upload
        for (const file of allResumableFiles) {
            if (file.upload()) {
                resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Queued upload of next chunk.', file);
                return;
            }
        }
    }
    /**
     * Returns all ResumableFiles of all file categories.
     * The files are ordered by the order of the file categories in `this.fileCategories`. Files of the first category
     * are added first, files of the second category are added second etc.
     *
     * @returns {ResumableFile[]} Array of all ResumableFiles that are stored for any category.
     */
    getFilesOfAllCategories() {
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
    assignBrowse(domNodes, isDirectory = false, fileCategory = this.defaultFileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Assigning browse to DOM nodes...', domNodes, { isDirectory: isDirectory }, fileCategory);
        this.throwIfUnknownFileCategory(fileCategory);
        if (domNodes instanceof HTMLElement)
            domNodes = [domNodes];
        for (const domNode of domNodes) {
            let input;
            if (domNode instanceof HTMLInputElement && domNode.type === 'file') {
                input = domNode;
            }
            else {
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
            }
            else {
                input.removeAttribute('multiple');
            }
            if (isDirectory) {
                input.setAttribute('webkitdirectory', 'webkitdirectory');
            }
            else {
                input.removeAttribute('webkitdirectory');
            }
            // Call setFileTypes() without changing the file types to just update the file types which are accepted by the
            // input dom element.
            this.setFileTypes(this.fileTypes[fileCategory], input, fileCategory);
            input.addEventListener('change', (event) => {
                this.handleChangeEvent(event, fileCategory);
            }, false);
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Added input (for browse) to DOM node.', domNode, input);
        }
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Assigned browse to DOM nodes.', domNodes);
    }
    /**
     * Assign one or more DOM nodes as a drop target.
     *
     * @param domNodes The dom nodes to which the drop action should be assigned (can be an array or a single dom node).
     * @param fileCategory The file category that will be assigned to all added files. Defaults to `defaultFileCategory`.
     */
    assignDrop(domNodes, fileCategory = this.defaultFileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Assigning drop to DOM nodes...', domNodes, fileCategory);
        this.throwIfUnknownFileCategory(fileCategory);
        if (domNodes instanceof HTMLElement)
            domNodes = [domNodes];
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
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Assigned drop to DOM nodes.', domNodes);
    }
    /**
     * Remove one or more DOM nodes as a drop target.
     */
    unAssignDrop(domNodes) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Unassigning drop from DOM nodes...', domNodes);
        if (domNodes instanceof HTMLElement)
            domNodes = [domNodes];
        for (const domNode of domNodes) {
            domNode.removeEventListener('dragover', this.onDragOverEnter.bind(this));
            domNode.removeEventListener('dragenter', this.onDragOverEnter.bind(this));
            domNode.removeEventListener('dragleave', this.onDragLeave.bind(this));
            domNode.removeEventListener('drop', this.removeDragOverClassAndCallOnDrop.bind(this));
        }
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Unassigned drop from DOM nodes.', domNodes);
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
    setFileTypes(fileTypes, domNode = null, fileCategory = this.defaultFileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Setting file types for DOM node...', fileTypes, domNode, fileCategory);
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
            }
            else {
                // Make all file types "accepted" by the given dom node.
                domNode.removeAttribute('accept');
            }
        }
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Set file types for DOM node.');
    }
    /**
     * Check whether any files are currently uploading
     */
    get isUploading() {
        return this.getFilesOfAllCategories().some((file) => file.isUploading);
    }
    /**
     * Start or resume the upload of the provided files by initiating the upload of the first chunk
     */
    upload() {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Starting Upload...');
        // Make sure we don't start too many uploads at once
        if (this.isUploading) {
            resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Already uploading. Not starting again.');
            return;
        }
        // Kick off the queue
        this.fire('uploadStart');
        for (let num = 1; num <= this.simultaneousUploads; num++) {
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Starting simultaneous upload ' + num + ' / ' + this.simultaneousUploads + '...');
            this.uploadNextChunk();
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Started simultaneous upload ' + num + ' / ' + this.simultaneousUploads + '...');
        }
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Started Upload.');
    }
    /**
     * Pause the upload
     */
    pause() {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Pausing Upload...');
        // Resume all chunks currently being uploaded
        for (const file of this.getFilesOfAllCategories()) {
            file.abort();
        }
        this.fire('pause');
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Paused Upload.');
    }
    ;
    /**
     * Cancel uploading and reset all files to their initial states
     */
    cancel() {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Cancelling Upload...');
        this.fire('beforeCancel');
        const allFiles = this.getFilesOfAllCategories();
        allFiles.forEach((file) => {
            file.cancel();
        });
        this.fire('cancel');
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Cancelled Upload.');
    }
    ;
    /**
     * Return the progress of the current upload as a float between 0 and 1
     */
    progress() {
        let totalDone = this.getFilesOfAllCategories().reduce((accumulator, file) => accumulator + file.size * file.progress(), 0);
        let totalSize = this.getSize();
        return totalSize > 0 ? totalDone / totalSize : 0;
    }
    ;
    /**
     * Add a HTML5 File object to the list of files.
     */
    addFile(file, event, fileCategory = this.defaultFileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Adding file...', file, event, fileCategory);
        this.throwIfUnknownFileCategory(fileCategory);
        this.appendFilesFromFileList([file], event, fileCategory);
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Added file.', file);
    }
    ;
    /**
     * Add a list of HTML5 File objects to the list of files.
     */
    addFiles(files, event, fileCategory = this.defaultFileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Adding files...', files, event, fileCategory);
        this.throwIfUnknownFileCategory(fileCategory);
        this.appendFilesFromFileList(files, event, fileCategory);
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Added files.', files);
    }
    ;
    /**
     * Add a validator function for the given file type. This can e.g. be used to read the file and validate
     * checksums based on certain properties.
     * @param fileType The file extension for the given validator
     * @param validator A callback function that should be called when validating files with the given type
     */
    addFileValidator(fileType, validator) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Adding file validator for file type...', fileType);
        if (fileType in this.validators) {
            console.warn(`Overwriting validator for file type: ${fileType}`);
        }
        this.validators[fileType] = validator;
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Added file validator for file type.', fileType);
    }
    /**
     * Remove the given resumable file from the file list (of its corresponding file category).
     */
    removeFile(file) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Removing file...', file);
        const fileCategory = file.fileCategory;
        const fileIndex = this.files[fileCategory].findIndex((fileFromArray) => fileFromArray.uniqueIdentifier === file.uniqueIdentifier);
        if (fileIndex >= 0) {
            this.files[fileCategory].splice(fileIndex, 1);
        }
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Removed file.', file);
    }
    ;
    /**
     * Retrieve a ResumableFile object from the file list by its unique identifier.
     */
    getFromUniqueIdentifier(uniqueIdentifier) {
        return this.getFilesOfAllCategories().find((file) => file.uniqueIdentifier === uniqueIdentifier);
    }
    ;
    /**
     * Get the combined size of all files for the upload
     */
    getSize() {
        return this.getFilesOfAllCategories().reduce((accumulator, file) => accumulator + file.size, 0);
    }
    /**
     * Call the event handler for a DragEvent (when a file is dropped on a drop area).
     */
    handleDropEvent(e, fileCategory = this.defaultFileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling drop event...', e, fileCategory);
        this.throwIfUnknownFileCategory(fileCategory);
        this.onDrop(e, fileCategory);
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled drop event.');
    }
    /**
     * Call the event handler for an InputEvent (i.e. received one or multiple files).
     */
    handleChangeEvent(e, fileCategory = this.defaultFileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling change event...', e, fileCategory);
        this.throwIfUnknownFileCategory(fileCategory);
        const eventTarget = e.target;
        this.fire('fileProcessingBegin', eventTarget.files, fileCategory);
        this.appendFilesFromFileList([...eventTarget.files], e, fileCategory);
        if (this.clearInput) {
            eventTarget.value = '';
        }
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled change event.');
    }
    /**
     * Check whether the upload is completed (if all files of a category are uploaded and if all files in general are
     * uploaded).
     */
    checkUploadComplete() {
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Checking for upload completion...');
        // If no files were added, there is no upload that could be complete.
        if (this.getFilesOfAllCategories().length === 0) {
            return;
        }
        const stillUncompletedFileCategories = [];
        this.uncompletedFileCategories.forEach((fileCategory) => {
            // If category is empty, no upload will happen, so no "complete" event needs to be fired.
            if (this.files[fileCategory].length == 0) {
                return;
            }
            if (this.files[fileCategory].every((file) => file.isComplete)) {
                this.fire('categoryComplete', fileCategory);
            }
            else {
                stillUncompletedFileCategories.push(fileCategory);
            }
        });
        this.uncompletedFileCategories = stillUncompletedFileCategories;
        if (this.uncompletedFileCategories.length === 0) {
            // All chunks have been uploaded, complete
            this.fire('complete');
        }
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Checked for upload completion. Upload completed: ' + (this.uncompletedFileCategories.length ? 'no' : 'yes'));
    }
    /**
     * Event Handlers: This section should only include methods that are used to
     * handle events coming from the files or chunks.
     */
    /**
     * The event handler when the chunking of a file was started
     */
    handleChunkingStart(args, fileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkingStart" in main resumable object...', args);
        this.fire('chunkingStart', ...args, fileCategory);
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkingStart" in main resumable object.', args);
    }
    /**
     * The event handler when there was any progress while chunking a file
     */
    handleChunkingProgress(args, fileCategory) {
        // No debugging messages because this would really spam the console.
        this.fire('chunkingProgress', ...args, fileCategory);
    }
    /**
     * The event handler when the chunking of a file was completed
     */
    handleChunkingComplete(args, fileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkingComplete" in main resumable object...', args);
        this.fire('chunkingComplete', ...args, fileCategory);
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkingComplete" in main resumable object.', args);
    }
    /**
     * The event handler when a chunk was uploaded successfully
     */
    handleChunkSuccess(args, fileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkSuccess" in main resumable object...', args);
        this.fire('chunkSuccess', ...args, fileCategory);
        this.uploadNextChunk();
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkSuccess" in main resumable object.', args);
    }
    /**
     * The event handler when an error happened while uploading a chunk
     */
    handleChunkError(args, fileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkError" in main resumable object...', args);
        this.fire('chunkError', ...args, fileCategory);
        this.uploadNextChunk();
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkError" in main resumable object.', args);
    }
    /**
     * The event handler when an the upload of a chunk was canceled
     */
    handleChunkCancel(args, fileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkCancel" in main resumable object...', args);
        this.fire('chunkCancel', ...args, fileCategory);
        this.uploadNextChunk();
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkCancel" in main resumable object.', args);
    }
    /**
     * The event handler when the upload of a chunk is being retried
     */
    handleChunkRetry(args, fileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling "chunkRetry" in main resumable object...', args);
        this.fire('chunkRetry', ...args, fileCategory);
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled "chunkRetry" in main resumable object.', args);
    }
    /**
     * The event handler when there is any progress while uploading a chunk
     */
    handleChunkProgress(args, fileCategory) {
        // No debugging messages because this would really spam the console.
        this.fire('chunkProgress', ...args, fileCategory);
    }
    /**
     * The event handler when an error occurred during the upload of a file
     */
    handleFileError(args, fileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling "fileError" in main resumable object...', args);
        this.fire('fileError', ...args, fileCategory);
        // 'error' event for backward compatibility ('fileError' was not fired in previous versions).
        // If there will be other errors besides 'fileError's at some point, the 'error' event (as a general "catch all
        // errors" event) would make more sense.
        this.fire('error', args[1], args[0], fileCategory);
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled "fileError" in main resumable object.', args);
    }
    /**
     * The event handler when all chunks from a file were uploaded successfully
     */
    handleFileSuccess(args, fileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling "fileSuccess" in main resumable object...', args);
        this.fire('fileSuccess', ...args, fileCategory);
        this.checkUploadComplete();
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled "fileSuccess" in main resumable object.', args);
    }
    /**
     * The event handler when a file progress event was received
     */
    handleFileProgress(args, fileCategory) {
        // No debugging messages because this would really spam the console.
        this.fire('fileProgress', ...args, fileCategory);
        this.fire('progress');
    }
    /**
     * The event handler when the upload of a file was canceled
     */
    handleFileCancel(args, fileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling "fileCancel" in main resumable object...', args);
        this.fire('fileCancel', ...args, fileCategory);
        this.removeFile(args[0]);
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled "fileCancel" in main resumable object.', args);
    }
    /**
     * The event handler, when the retry of a file was initiated
     */
    handleFileRetry(args, fileCategory) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handling "fileRetry" in main resumable object...', args);
        this.fire('fileRetry', ...args, fileCategory);
        this.upload();
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Handled "fileRetry" in main resumable object.', args);
    }
}
exports.Resumable = Resumable;


/***/ }),
/* 1 */
/***/ (function(__unused_webpack_module, exports) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
class ResumableHelpers {
    /**
     * Stop the propagation and default behavior of the given event `e`.
     */
    static stopEvent(e) {
        e.stopPropagation();
        e.preventDefault();
    }
    /**
     * Generate a unique identifier for the given file based on its size and filename.
     * @param {ExtendedFile} file The file for which the identifier should be generated
     * @returns {string} The unique identifier for the given file object
     */
    static generateUniqueIdentifier(file) {
        // Remove special characters
        return (file.size + '-' + file.name.replace(/[^0-9a-zA-Z_-]/img, ''));
    }
    /**
     * Flatten the given array and all contained subarrays.
     * Credit: {@link https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore#_flattendeep}
     */
    static flattenDeep(array) {
        return Array.isArray(array)
            ? array.reduce((a, b) => a.concat(this.flattenDeep(b)), [])
            : [array];
    }
    /**
     * Filter the given array based on the predicate inside `callback`
     * and executes `errorCallback` for duplicate elements.
     */
    static uniqBy(array, callback, errorCallback) {
        let seen = new Set();
        return array.filter((item) => {
            let k = callback(item);
            if (seen.has(k)) {
                errorCallback(item);
                return false;
            }
            else {
                seen.add(k);
                return true;
            }
        });
    }
    /**
     * Format the size given in Bytes in a human readable format.
     */
    static formatSize(size) {
        if (size < 1024) {
            return size + ' bytes';
        }
        if (size < 1024 * 1024) {
            return (size / 1024.0).toFixed(0) + ' KB';
        }
        if (size < 1024 * 1024 * 1024) {
            return (size / 1024.0 / 1024.0).toFixed(1) + ' MB';
        }
        return (size / 1024.0 / 1024.0 / 1024.0).toFixed(1) + ' GB';
    }
    /**
     * Get the target url for the specified request type and params
     */
    static getTarget(requestType, sendTarget, testTarget, params, parameterNamespace = '') {
        let target = sendTarget;
        if (requestType === 'test' && testTarget) {
            target = testTarget === '/' ? sendTarget : testTarget;
        }
        let separator = target.indexOf('?') < 0 ? '?' : '&';
        let joinedParams = Object.entries(params).map(([key, value]) => [
            encodeURIComponent(parameterNamespace + key),
            encodeURIComponent(value),
        ].join('=')).join('&');
        if (joinedParams)
            target = target + separator + joinedParams;
        return target;
    }
    /**
     * If given debugVerbosityLevel is LOW or higher, print message to debug log.
     * Optional any number of arguments can be provided. They will be passed directly as additional arguments to the
     * console call.
     */
    static printDebugLow(debugVerbosityLevel, message, ...args) {
        if (debugVerbosityLevel === 1 /* DebugVerbosityLevel.LOW */ || debugVerbosityLevel === 2 /* DebugVerbosityLevel.HIGH */) {
            console.debug(message, ...args);
        }
    }
    /**
     * If given debugVerbosityLevel is HIGH, print message to debug log.
     * Optional any number of arguments can be provided. They will be passed directly as additional arguments to the
     * console call.
     */
    static printDebugHigh(debugVerbosityLevel, message, ...args) {
        if (debugVerbosityLevel === 2 /* DebugVerbosityLevel.HIGH */) {
            console.debug(message, ...args);
        }
    }
}
exports["default"] = ResumableHelpers;


/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
const resumableChunk_1 = __webpack_require__(3);
const resumableHelpers_1 = __webpack_require__(1);
const resumableEventHandler_1 = __webpack_require__(4);
/**
 * A single file object that should be uploaded in multiple chunks
 */
class ResumableFile extends resumableEventHandler_1.default {
    constructor(file, uniqueIdentifier, fileCategory, options) {
        super();
        this._prevProgress = 0;
        this.isPaused = false;
        this._chunks = [];
        this.chunkSize = 1024 * 1024; // 1 MB
        this.debugVerbosityLevel = 0 /* DebugVerbosityLevel.NONE */;
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
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Constructed ResumableFile.', this);
    }
    /**
     * Set the options provided inside the configuration object on this instance
     */
    setInstanceProperties(options) {
        Object.assign(this, options);
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Set ResumableFile instance properties.', this);
    }
    get file() {
        return this._file;
    }
    get fileName() {
        return this._fileName;
    }
    get size() {
        return this._size;
    }
    get relativePath() {
        return this._relativePath;
    }
    get uniqueIdentifier() {
        return this._uniqueIdentifier;
    }
    get fileCategory() {
        return this._fileCategory;
    }
    get chunks() {
        return this._chunks;
    }
    /**
     * Stop current uploads for this file
     */
    abort() {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Aborting upload of ResumableFile...', this);
        let abortCount = 0;
        for (const chunk of this._chunks) {
            if (chunk.status === "chunkUploading" /* ResumableChunkStatus.UPLOADING */) {
                chunk.abort();
                abortCount++;
            }
        }
        if (abortCount > 0)
            this.fire('fileProgress', this, null);
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Aborted upload of ResumableFile.', this);
    }
    /**
     * Cancel uploading this file and remove it from the file list
     */
    cancel() {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Cancelling upload of ResumableFile...', this);
        for (const chunk of this._chunks) {
            if (chunk.status === "chunkUploading" /* ResumableChunkStatus.UPLOADING */) {
                chunk.abort();
                this.fire('chunkCancel', chunk);
            }
        }
        // Reset this file to be void
        this._chunks = [];
        this.fire('fileCancel', this);
        this.fire('fileProgress', this, null);
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Cancelled upload of ResumableFile.', this);
    }
    /**
     * Retry uploading this file
     */
    retry() {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Retrying upload of ResumableFile...', this);
        this.bootstrap();
        let firedRetry = false;
        this.on('chunkingComplete', () => {
            if (!firedRetry)
                this.fire('fileRetry', this, null);
            firedRetry = true;
        });
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Retried upload of ResumableFile.', this);
    }
    /**
     * Prepare this file for a new upload, by dividing it into multiple chunks
     */
    bootstrap() {
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Bootstrapping and chunking ResumableFile...', this);
        const progressHandler = (message, chunk) => {
            // No debugging messages because this would really spam the console.
            this.fire('chunkProgress', chunk, message);
            this.fire('fileProgress', this, message);
        };
        const retryHandler = (message, chunk) => {
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handling "chunkRetry" in ResumableFile...', this, chunk, message);
            this.fire('chunkRetry', chunk, message);
            this.fire('fileRetry', this, message);
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handled "chunkRetry" in ResumableFile.', this, chunk, message);
        };
        const successHandler = (message, chunk) => {
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handling "chunkSuccess" in ResumableFile...', this, chunk, message);
            if (this._error)
                return;
            this.fire('chunkSuccess', chunk, message);
            this.fire('fileProgress', this, message);
            if (this.isComplete) {
                this.fire('fileSuccess', this, message);
            }
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handled "chunkSuccess" in ResumableFile.', this, chunk, message);
        };
        const errorHandler = (message, chunk) => {
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handling "chunkError" in ResumableFile...', this, chunk, message);
            this.fire('chunkError', chunk, message);
            this.abort();
            this._error = true;
            this._chunks = [];
            this.fire('fileError', this, message);
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handled "chunkError" in ResumableFile.', this, chunk, message);
        };
        this.abort();
        this._error = false;
        // Rebuild stack of chunks from file
        this._chunks = [];
        this._prevProgress = 0;
        const maxOffset = Math.max(Math.ceil(this._size / this.chunkSize), 1);
        for (var offset = 0; offset < maxOffset; offset++) {
            const chunk = new resumableChunk_1.default(this, offset, this.opts);
            chunk.on('chunkProgress', (message) => progressHandler(message, chunk));
            chunk.on('chunkError', (message) => errorHandler(message, chunk));
            chunk.on('chunkSuccess', (message) => successHandler(message, chunk));
            chunk.on('chunkRetry', (message) => retryHandler(message, chunk));
            this._chunks.push(chunk);
            this.fire('chunkingProgress', this, offset / maxOffset);
        }
        this.fire('chunkingComplete', this);
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Bootstrapped and chunked ResumableFile.', this);
    }
    /**
     * Get the progress for uploading this file based on the progress of the individual file chunks
     */
    progress() {
        if (this._error)
            return 1;
        // Sum up progress across everything
        var ret = 0;
        var error = false;
        for (const chunk of this._chunks) {
            if (chunk.status === "chunkError" /* ResumableChunkStatus.ERROR */)
                error = true;
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
    get isUploading() {
        return this._chunks.some((chunk) => chunk.status === "chunkUploading" /* ResumableChunkStatus.UPLOADING */);
    }
    /**
     * Check whether all of this file's chunks completed their upload requests and whether it should be
     * treated as completed.
     */
    get isComplete() {
        return !this._chunks.some((chunk) => chunk.status === "chunkPending" /* ResumableChunkStatus.PENDING */ || chunk.status === "chunkUploading" /* ResumableChunkStatus.UPLOADING */);
    }
    /**
     * Initiate the upload of a new chunk for this file. This function returns whether a new upload was started or not.
     */
    upload() {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Starting upload of next chunk of ResumableFile...', this);
        if (this.isPaused) {
            return false;
        }
        for (const chunk of this._chunks) {
            if (chunk.status === "chunkPending" /* ResumableChunkStatus.PENDING */) {
                chunk.send();
                resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Started upload of next chunk of ResumableFile.', this);
                return true;
            }
        }
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'No chunk found to upload for ResumableFile.', this);
        return false;
    }
    /**
     * Mark a given number of chunks as already uploaded to the server.
     * @param chunkNumber The index until which all chunks should be marked as completed
     */
    markChunksCompleted(chunkNumber) {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Marking ' + chunkNumber + ' chunks as complete for ResumableFile...', this);
        if (!this._chunks || this._chunks.length <= chunkNumber) {
            return;
        }
        for (let num = 0; num < chunkNumber; num++) {
            this._chunks[num].markComplete();
        }
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Marked ' + chunkNumber + ' chunks as complete for ResumableFile.', this);
    }
}
exports["default"] = ResumableFile;


/***/ }),
/* 3 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const resumableHelpers_1 = __webpack_require__(1);
const resumableEventHandler_1 = __webpack_require__(4);
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
/**
 * A file chunk that contains all the data that for a single upload request
 */
class ResumableChunk extends resumableEventHandler_1.default {
    constructor(fileObj, offset, options) {
        super();
        this.lastProgressCallback = new Date;
        this.tested = false;
        this.retries = 0;
        this.pendingRetry = false;
        this.isMarkedComplete = false;
        this.loaded = 0;
        this.xhr = null;
        // Option properties
        this.chunkSize = 1024 * 1024; // 1 MB
        this.fileParameterName = 'file';
        this.chunkNumberParameterName = 'resumableChunkNumber';
        this.chunkSizeParameterName = 'resumableChunkSize';
        this.currentChunkSizeParameterName = 'resumableCurrentChunkSize';
        this.totalSizeParameterName = 'resumableTotalSize';
        this.typeParameterName = 'resumableType';
        this.identifierParameterName = 'resumableIdentifier';
        this.fileCategoryParameterName = 'resumableFileCategory';
        this.fileNameParameterName = 'resumableFilename';
        this.relativePathParameterName = 'resumableRelativePath';
        this.totalChunksParameterName = 'resumableTotalChunks';
        this.throttleProgressCallbacks = 0.5;
        this.query = {};
        this.headers = {};
        this.method = 'multipart';
        this.uploadMethod = 'POST';
        this.testMethod = 'GET';
        this.parameterNamespace = '';
        this.testChunks = true;
        this.maxChunkRetries = 100;
        this.chunkRetryInterval = undefined;
        this.permanentErrors = [400, 401, 403, 404, 409, 415, 500, 501];
        this.withCredentials = false;
        this.xhrTimeout = 0;
        this.chunkFormat = 'blob';
        this.setChunkTypeFromFile = false;
        this.target = '/';
        this.testTarget = '';
        this.debugVerbosityLevel = 0 /* DebugVerbosityLevel.NONE */;
        this.setInstanceProperties(options);
        this.fileObj = fileObj;
        this.fileObjSize = fileObj.size;
        this.fileObjType = fileObj.file.type;
        this.offset = offset;
        // Computed properties
        this.startByte = this.offset * this.chunkSize;
        this.endByte = Math.min(this.fileObjSize, (this.offset + 1) * this.chunkSize);
        this.xhr = null;
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Constructed ResumableChunk.', this);
    }
    /**
     * Set the options provided inside the configuration object on this instance
     */
    setInstanceProperties(options) {
        Object.assign(this, options);
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Set ResumableChunk instance properties.', this);
    }
    /**
     * Set the header values for the current XMLHttpRequest
     */
    setCustomHeaders() {
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Setting custom headers for  XHR of ResumableChunk...', this);
        if (!this.xhr) {
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'No XHR found to set custom headers.', this);
            return;
        }
        let customHeaders = this.headers;
        if (customHeaders instanceof Function) {
            customHeaders = customHeaders(this.fileObj, this);
        }
        for (const header in customHeaders) {
            if (!customHeaders.hasOwnProperty(header))
                continue;
            this.xhr.setRequestHeader(header, customHeaders[header]);
        }
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Set custom headers for XHR of ResumableChunk.', this);
    }
    /**
     * Get query parameters for this chunk as an object, combined with custom parameters if provided
     */
    get formattedQuery() {
        var customQuery = this.query;
        if (typeof customQuery == 'function')
            customQuery = customQuery(this.fileObj, this);
        // Add extra data to identify chunk
        const extraData = {
            // define key/value pairs for additional parameters
            [this.chunkNumberParameterName]: this.offset + 1,
            [this.chunkSizeParameterName]: this.chunkSize,
            [this.currentChunkSizeParameterName]: this.endByte - this.startByte,
            [this.totalSizeParameterName]: this.fileObjSize,
            [this.typeParameterName]: this.fileObjType,
            [this.identifierParameterName]: this.fileObj.uniqueIdentifier,
            [this.fileCategoryParameterName]: this.fileObj.fileCategory,
            [this.fileNameParameterName]: this.fileObj.fileName,
            [this.relativePathParameterName]: this.fileObj.relativePath,
            [this.totalChunksParameterName]: this.fileObj.chunks.length,
        };
        return Object.assign(Object.assign({}, extraData), customQuery);
    }
    /**
     * Determine the status for this Chunk based on different parameters of the underlying XMLHttpRequest
     */
    get status() {
        if (this.pendingRetry) {
            // if pending retry then that's effectively the same as actively uploading,
            // there might just be a slight delay before the retry starts
            return "chunkUploading" /* ResumableChunkStatus.UPLOADING */;
        }
        else if (this.isMarkedComplete) {
            return "chunkSuccess" /* ResumableChunkStatus.SUCCESS */;
        }
        else if (!this.xhr) {
            return "chunkPending" /* ResumableChunkStatus.PENDING */;
        }
        else if (this.xhr.readyState < 4) {
            // Status is really 'OPENED', 'HEADERS_RECEIVED' or 'LOADING' - meaning that stuff is happening
            return "chunkUploading" /* ResumableChunkStatus.UPLOADING */;
        }
        else if (this.xhr.status === 200 || this.xhr.status === 201) {
            // HTTP 200, 201 (created)
            return "chunkSuccess" /* ResumableChunkStatus.SUCCESS */;
        }
        else if (this.permanentErrors.includes(this.xhr.status) || this.retries >= this.maxChunkRetries) {
            // HTTP 400, 404, 409, 415, 500, 501 (permanent error)
            return "chunkError" /* ResumableChunkStatus.ERROR */;
        }
        else {
            // this should never happen, but we'll reset and queue a retry
            // a likely case for this would be 503 service unavailable
            this.abort();
            return "chunkPending" /* ResumableChunkStatus.PENDING */;
        }
    }
    ;
    /**
     * Get the target url for the specified request type and the configured parameters of this chunk
     * @param requestType The type of the request, either 'test' or 'upload'
     */
    getTarget(requestType) {
        return resumableHelpers_1.default.getTarget(requestType, this.target, this.testTarget, this.formattedQuery, this.parameterNamespace);
    }
    /**
     * Makes a GET request without any data to see if the chunk has already been uploaded in a previous session
     */
    test() {
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Sending test request for ResumableChunk...', this);
        // Set up request and listen for event
        this.xhr = new XMLHttpRequest();
        var testHandler = () => {
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handling test request response for ResumableChunk...', this);
            this.tested = true;
            var status = this.status;
            if (status === "chunkSuccess" /* ResumableChunkStatus.SUCCESS */) {
                this.fire('chunkSuccess', this.message());
            }
            else {
                this.send();
            }
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handled test request response for ResumableChunk.', this);
        };
        this.xhr.addEventListener('load', testHandler, false);
        this.xhr.addEventListener('error', testHandler, false);
        this.xhr.addEventListener('timeout', testHandler, false);
        // Append the relevant chunk and send it
        this.xhr.open(this.testMethod, this.getTarget('test'));
        this.xhr.timeout = this.xhrTimeout;
        this.xhr.withCredentials = this.withCredentials;
        // Add data from header options
        this.setCustomHeaders();
        this.xhr.send(null);
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Sent test request for ResumableChunk.', this);
    }
    /**
     * Abort and reset a request
     */
    abort() {
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Aborting upload of ResumableChunk...', this);
        if (this.xhr)
            this.xhr.abort();
        this.xhr = null;
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Aborted upload of ResumableChunk.', this);
    }
    /**
     *  Uploads the actual data in a POST call
     */
    send() {
        if (this.testChunks && !this.tested) {
            resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Testing upload status of ResumableChunk before uploading...', this);
            this.test();
            resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Tested upload status of ResumableChunk before uploading. Chunk already uploaded: '
                + (this.status === "chunkSuccess" /* ResumableChunkStatus.SUCCESS */ ? 'yes' : 'no'), this);
            return;
        }
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Starting upload of ResumableChunk...', this);
        // Set up request and listen for event
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Creating XHR for upload of ResumableChunk...', this, this.xhr);
        this.xhr = new XMLHttpRequest();
        // Progress
        this.xhr.upload.addEventListener('progress', (e) => {
            if (Date.now() - this.lastProgressCallback.getTime() > this.throttleProgressCallbacks * 1000) {
                this.fire('chunkProgress', this.message());
                this.lastProgressCallback = new Date();
            }
            this.loaded = e.loaded || 0;
        }, false);
        this.loaded = 0;
        this.pendingRetry = false;
        this.fire('chunkProgress', this.message());
        /**
         * Handles the different xhr events based on the status of this chunk
         */
        let doneHandler = () => {
            var status = this.status;
            switch (status) {
                case "chunkSuccess" /* ResumableChunkStatus.SUCCESS */:
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handling "chunkSuccess" in ResumableChunk...', this);
                    this.fire('chunkSuccess', this.message());
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handled "chunkSuccess" in ResumableChunk.', this);
                    break;
                case "chunkError" /* ResumableChunkStatus.ERROR */:
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handling "chunkError" in ResumableChunk...', this);
                    this.fire('chunkError', this.message());
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handled "chunkError" in ResumableChunk.', this);
                    break;
                default:
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handling "chunkRetry" in ResumableChunk...', this);
                    this.fire('chunkRetry', this.message());
                    this.abort();
                    this.retries++;
                    let retryInterval = this.chunkRetryInterval;
                    if (retryInterval !== undefined) {
                        this.pendingRetry = true;
                        setTimeout(() => this.send(), retryInterval);
                    }
                    else {
                        this.send();
                    }
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Handled "chunkRetry" in ResumableChunk.', this);
                    break;
            }
        };
        this.xhr.addEventListener('load', doneHandler, false);
        this.xhr.addEventListener('error', doneHandler, false);
        this.xhr.addEventListener('timeout', doneHandler, false);
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Created XHR for upload of ResumableChunk.', this, this.xhr);
        // Set up the basic query data from Resumable
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Creating data for XHR for upload of ResumableChunk...', this, this.xhr);
        let bytes = this.fileObj.file.slice(this.startByte, this.endByte, this.setChunkTypeFromFile ? this.fileObj.file.type : '');
        let data = null;
        let parameterNamespace = this.parameterNamespace;
        // Add data from the query options
        if (this.method === 'octet') {
            data = bytes;
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Created "octet" data for XHR for upload of ResumableChunk.', this, data);
        }
        else {
            data = new FormData();
            for (const queryKey in this.formattedQuery) {
                data.append(parameterNamespace + queryKey, this.formattedQuery[queryKey]);
            }
            switch (this.chunkFormat) {
                case 'blob':
                    data.append(parameterNamespace + this.fileParameterName, bytes, this.fileObj.fileName);
                    resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Created "blob" data for XHR for upload of ResumableChunk.', this, data);
                    break;
                case 'base64':
                    var fr = new FileReader();
                    fr.onload = () => {
                        data.append(parameterNamespace + this.fileParameterName, fr.result);
                        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Created "base64" data for XHR for upload of ResumableChunk.', this, data);
                        this.xhr.send(data);
                        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Sent XHR for upload of ResumableChunk.', this, this.xhr);
                    };
                    fr.readAsDataURL(bytes);
                    break;
            }
        }
        let target = this.getTarget('upload');
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Opening XHR for upload of ResumableChunk...', this, this.xhr);
        this.xhr.open(this.uploadMethod, target);
        resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Opened XHR for upload of ResumableChunk.', this, this.xhr);
        if (this.method === 'octet') {
            this.xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        }
        this.xhr.timeout = this.xhrTimeout;
        this.xhr.withCredentials = this.withCredentials;
        // Add data from header options
        this.setCustomHeaders();
        if (this.chunkFormat === 'blob') {
            this.xhr.send(data);
            resumableHelpers_1.default.printDebugHigh(this.debugVerbosityLevel, 'Sent XHR for upload of ResumableChunk.', this, this.xhr);
        }
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Started upload of ResumableChunk.', this);
    }
    /**
     * Return the response text of the underlying XMLHttpRequest if it exists
     */
    message() {
        return this.xhr ? this.xhr.responseText : '';
    }
    ;
    /**
     * Return the progress for the current chunk as a number between 0 and 1
     * @param relative Whether or not the progress should be calculated based on the size of the entire file
     */
    progress(relative = false) {
        var factor = relative ? (this.endByte - this.startByte) / this.fileObjSize : 1;
        if (this.pendingRetry)
            return 0;
        if ((!this.xhr || !this.xhr.status) && !this.isMarkedComplete)
            factor *= .95;
        switch (this.status) {
            case "chunkSuccess" /* ResumableChunkStatus.SUCCESS */:
            case "chunkError" /* ResumableChunkStatus.ERROR */:
                return factor;
            case "chunkPending" /* ResumableChunkStatus.PENDING */:
                return 0;
            default:
                return this.loaded / (this.endByte - this.startByte) * factor;
        }
    }
    /**
     * Mark this chunk as completed because it was already uploaded to the server.
     */
    markComplete() {
        this.isMarkedComplete = true;
        resumableHelpers_1.default.printDebugLow(this.debugVerbosityLevel, 'Marked ResumableChunk as complete.', this);
    }
}
exports["default"] = ResumableChunk;


/***/ }),
/* 4 */
/***/ (function(__unused_webpack_module, exports) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
/**
 * The underlying base class for ResumableJS. This class is responsible for registering and executing
 * events and listeners.
 */
class ResumableEventHandler {
    /**
     * Construct a new event handler instance.
     */
    constructor() {
        this.registeredEventHandlers = {};
    }
    /**
     * Register a new callback for the given event.
     */
    on(event, callback) {
        event = event.toLowerCase();
        if (!this.registeredEventHandlers.hasOwnProperty(event)) {
            this.registeredEventHandlers[event] = [];
        }
        this.registeredEventHandlers[event].push(callback);
    }
    /**
     * Fire the event listeners for the given event with the given arguments as well as the wildcard event '*'
     */
    fire(event, ...args) {
        event = event.toLowerCase();
        this.executeEventCallback(event, ...args);
        this.executeEventCallback('*', event, ...args);
    }
    /**
     * Execute all callbacks for the given event with the provided arguments. This function is only used internally
     * to call all callbacks registered to a given event individually.
     */
    executeEventCallback(event, ...args) {
        if (!this.registeredEventHandlers.hasOwnProperty(event))
            return;
        this.registeredEventHandlers[event].forEach((callback) => callback(...args));
    }
}
exports["default"] = ResumableEventHandler;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=main.js.map