// INTERNAL HELPER METHODS (handy, but ultimately not part of uploading)
export default class ResumableHelpers {
  /**
   * Stop the propagation and default behavior of the given event `e`.
   */
  static stopEvent(e: Event): void {
    e.stopPropagation();
    e.preventDefault();
  }

  /**
   *
   * @param file The file whose filename should be retrieved
   */
  static getFileNameFromFile(file: File): string {
    return /*file.fileName ||*/ file.name;
  }

  /**
   * Generate a unique identifier for the given file based on its size, filename and relative path.
   * @param {File} file The file for which the identifier should be generated
   * @returns {string} The unique identifier for the given file object
   */
  static generateUniqueIdentifier(file: File): string {
    var relativePath = file.webkitRelativePath || /*file.relativePath ||*/ this.getFileNameFromFile(file);
    var size = file.size;
    return (size + '-' + relativePath.replace(/[^0-9a-zA-Z_-]/img, ''));
  }

  /**
   * Flatten the given array and all contained subarrays.
   * Credit: {@link https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore#_flattendeep}
   */
  static flattenDeep(array: any[]): any[] {
    return Array.isArray(array)
      ? array.reduce((a, b) => a.concat(this.flattenDeep(b)), [])
      : [array];
  }

  /**
   * Filter the given array based on the predicate inside `callback`
   * and executes `errorCallback` for duplicate elements.
   */
  static uniqBy(array: any[], callback: Function, errorCallback: Function): any[] {
    let seen = new Set();
    return array.filter((item) => {
      let k = callback(item);
      if (seen.has(k)) {
        errorCallback(item);
        return false;
      } else {
        seen.add(k);
        return true;
      }
    });
  }

  /**
   * Format the size given in Bytes in a human readable format.
   */
  static formatSize(size: number): string {
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
  static getTarget(
    requestType: string,
    sendTarget: string,
    testTarget: string,
    params: object,
    parameterNamespace: string = ''
  ) {
    let target = sendTarget;

    if (requestType === 'test' && testTarget) {
      target = testTarget === '/' ? sendTarget : testTarget;
    }

    let separator = target.indexOf('?') < 0 ? '?' : '&';
    let joinedParams = Object.entries(params).map(([key, value]) => [
      encodeURIComponent(parameterNamespace + key),
      encodeURIComponent(value),
    ].join('=')).join('&');

    if (joinedParams) target = target + separator + joinedParams;

    return target;
  }
}