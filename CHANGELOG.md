# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### BREAKING
* (#25) Many class properties and some functions are `private` now and can't be accessed from the outside anymore. While these are technically breaking changes, there shouldn't have been any use cases for using those properties/functions.  
This **does not affect any of the options you can provide to the Resumable constructor**. Those did not change.  
All usable (not private) functions/properties are documented in the readme.
  The following class properties/functions are affected:
  * `Resumable` main class:
    * Properties that are not readable and not writable anymore:  
    `clearInput`, `dragOverClass`, `fileCategories`, `defaultFileCategory`, `fileTypes`, `fileTypeErrorCallback`, `_generateUniqueIdentifier`, `maxFileSize`, `maxFileSizeErrorCallback`, `maxFiles`, `maxFilesErrorCallback`, `minFileSize`, `minFileSizeErrorCallback`, `prioritizeFirstAndLastChunk`, `fileValidationErrorCallback`, `simultaneousUploads`
    * Functions that can't be called from the outside anymore:  
      `checkUploadComplete()`
  * `ResumableFile` class:
    * Properties that are not writable anymore, **but can still be read**:  
      `file`, `fileName`, `size`, `relativePath`, `uniqueIdentifier`, `fileCategory`, `chunks`
    * Functions that can't be called from the outside anymore:  
      `bootstrap()`
  * `ResumableChunk` class:
    * Properties that are not readable and not writable anymore:  
      `chunkNumberParameterName`, `chunkSizeParameterName`, `currentChunkSizeParameterName`, `totalSizeParameterName`, `typeParameterName`, `identifierParameterName`, `fileCategoryParameterName`, `fileNameParameterName`, `relativePathParameterName`, `totalChunksParameterName`, `throttleProgressCallbacks`, `query`, `headers`, `method`, `uploadMethod`, `testMethod`, `parameterNamespace`, `testChunks`, `maxChunkRetries`, `chunkRetryInterval`, `permanentErrors`, `withCredentials`, `xhrTimeout`, `chunkFormat`, `setChunkTypeFromFile`, `target`, `testTarget`
    * Functions that can't be called from the outside anymore:  
      `setCustomHeaders()`, `test()`
### Added


### Fixed


### Changed
* Let all events from files and chunks bubble up and make them accessible for users (#20)
* Update readme (#24)
* Make class properties and some functions private and add getters for some of the properties (see breaking changes) (#25)

### Removed



## [2.1.0] - 2023-03-21
### Added
* Using the new `setFileTypes` function you can now set the allowed file types at runtime (#8)
* Files that are added to the Resumable object are now always part of a file category (#11)
  * Resumable can still be used as before, without any extra handling of file categories. Internally the "default file category" will be used for all files then.
  * Some new construction options were added to support file categories (see docs for full explanation):
    * `fileCategoryParameterName`
    * `fileCategories`
    * `defaultFileCategory`
  * Many functions now support optionally passing in a file category (always defaulting to the "default file category")

### Changed
* Calling `handleDropEvent` does not remove the `dragOverClass` anymore from the event target (#10)
  * This does not affect the function of `assignDrop` and `unassignDrop`, they still handle the `dragOverClass`

### Fixed
* Documentation is now up-to-date again (see [Readme](README.md))
* Licensing texts has been updated to now include the participation of PCT (Point Cloud Technology) in this project

## [2.0.0] - 2023-02-23
This is the first version after we (Point Cloud Technology) started to maintain and modify this project.

### BREAKING
* Removed member `resumableObj` from `ResumableFile` class (#1)
* `errorCount` is not provided to a function passed as `fileTypeErrorCallback` anymore (#1)
* Some events have been removed (but will be re-added with version 2.2.0, see PR #20) (#1)
* No Internet Explorer support anymore (#2)

### Added
* File validators can now be added with the new `addFileValidator` function (#1)

### Changed
* Codebase is now split up into multiple files (instead of defining all classes in one big file) (#1)
* Codebase now uses TypeScript instead of vanilla JavaScript (#1)

## [1.2.0] - 2020-09-24
This was the last version before we (Point Cloud Technology) forked the original repo.
This is the state of the main branch of the original repo before we added any of our changes.
The original repo didn't include a CHANGELOG file.