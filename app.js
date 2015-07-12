// Imports.
var fs = require('fs'),
    xml2js = require('xml2js'),
    _ = require('lodash'),
    Promise = require('promise'),
    glob = require('glob'),
    upath = require('upath'),
    extend = require('extend'),
    minimatch = require('minimatch');

// Initialize variables.
var nrOfCheckedFiles = 0,
    nrOfIncludedFiles = 0,
    nrOfPhysicalFiles = 0,
    nrOfTargetedFiles = 0,
    nrOfNotIncludedFiles = 0,
    notIncludedFiles = [],
    maxFilesToShowDefault = 20,
    options = {};


// Polyfills for ES6 functions.
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(prefix) {
        return this.indexOf(prefix) === 0;
    }
}

// Source: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
if (!String.prototype.endsWith) {
    String.prototype.endsWith = function (searchString, position) {
        var subjectString = this.toString();
        if (position === undefined || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    };
}

/**
 * Print a debug message to the console (only if debug flag is set).
 * @param {string} The message to print.
 */
function debug(message) {
    if (options.verbose) {
        console.log(message);
    }
}

/**
 * Return the path of a given filename.
 * @param {string} The full path to a file, for instance '../MyApp.Web/App.Web.csproj'.
 * @returns {string} Only the path to the file excluding the filename, for instance 'App.Web.csproj'
 */
function getBasePath(pathAndFile) {
    if (!pathAndFile) {
        throw new Error('getBasePath: Supplied path is empty!');
    }
    // Remove a potential end slash from path to prevent errors 
    if (pathAndFile.endsWith('/')) {
        pathAndFile.substring(0, pathAndFile.length - 1)
    }
    var index = pathAndFile.lastIndexOf('/');
    return index === -1 ? "" : pathAndFile.substring(0, index + 1);
}


/**
 * @param {string} csProjFilename 
 * @returns {string} All files from the given cs project file.
 */
function readCsProjeFile(csProjFilename) {
    var fileIncludes = [];
    var parser = new xml2js.Parser();
    return new Promise(function(resolve, reject) {
        fs.readFile(csProjFilename, function (err, data) {
            if (err) {
                reject('File \'' + csProjFilename + '\' not found.');
                return;
            }
            parser.parseString(data, function (err, result) {
                var itemgroups = result.Project.ItemGroup;
                if (!itemgroups || itemgroups.length === 0) {
                    reject('No item groups found in ' + csProjFilename);
                }
                _.each(result.Project.ItemGroup, function(itemGroup, groupKey, groupList) {
                    if ((!itemGroup.Content || itemGroup.Content.length === 0)) {             
                        debug('Warning: No <Content> tags found in <ItemGroup> nr ' + groupKey + '.');
                        // When we are at the last group  iteration then filling the 'fileIncludes' is done, so 'return' it.
                        if (groupKey === groupList.length - 1) {
                            resolve(fileIncludes);
                        }
                    } else {
                        debug('Scanning ' + itemGroup.Content.length + ' <Content> tags found in <ItemGroup> nr ' + groupKey + '.');
                    }
                    _.each(itemGroup.Content, function(content, contentKey, contentList) {
                        // 6. Filter uit de fileContents alle <Content Include="x"> uit alle <ItemGroups> en sla elk van deze 'x'-en op in een array 'includedFiles'
                        if (content && content.$ && content.$.Include /* && content.$.Include.endsWith('.js') */) {
                            fileIncludes.push(content.$.Include);
                        }
                        // When we are at the last item of the last group in the (nested) iteration.
                        if (contentKey === contentList.length - 1 && groupKey === groupList.length - 1) {
                            // Then filling the 'fileIncludes' is done, so 'return' it.
                            resolve(fileIncludes);
                        }
                    });
                });
            });
        });
    });
}


function searchFilesNotIncludedIn(csProjFilename, filter) {
    return new Promise(function (resolve, reject) {
        if (filter.length === 0) {
            reject('No stuff to check!');
            return;
        }
        var includedFiles = [];
        var basePath = getBasePath(csProjFilename);
        readCsProjeFile(csProjFilename)
            .then(function(result) {
            return new Promise(function (resolve, reject) {
                if (!result || result.length === 0) reject('No files in result');
                nrOfIncludedFiles = result.length;
                _.each(result, function (filename, fileKey, fileList) {
                    var pattern = filter[0];
                    // Do some conversions to allow simple string comparison to the files as returned by node - glob.
                    // 1. The files in the .csproj are in windows format, so convert to unix;
                    var unixFilename = upath.normalize(filename);
                    // 2. Add the cwd to the file - if set.
                    if (basePath) {
                        unixFilename = basePath + unixFilename;
                    }
                    // 3. Check if the filename from the .csproj file matches any of the patterns in the filter (for instance it has a .js or .less extension e.g. filter = ['**/*.js/', '**/*.less']).
                    if (_.any(_.map(filter, function(pattern) {
                        return minimatch(unixFilename, pattern);
                    }))) {
                        // if so then include in list to test agains.
                        includedFiles.push(unixFilename);
                    }
                    if (fileKey === fileList.length - 1) {
                        resolve(includedFiles);
                    }
                });
            }).then(function(includedFiles) {
                _.each(filter, function(pattern, patternKey, patternList) {
                    glob(pattern, { debug: options.verbose, cwd: options.cwd }, function(err, files) {
                        if (err) {
                            reject('Error for glob pattern \'' + pattern + '\' in stuff to check!');
                        }
                        if (files.length === 0) {
                            reject('No files for pattern \'' + pattern + '\' in stuff to check.');
                        }
                        nrOfTargetedFiles = files.length;
                        _.each(files, function(filename, fileKey, fileList) {
                            // 4. Filter de bestandsnamen op het filter  bv. alleen **/*.js files - en sla op in array 'filesToCheck'.
                            var isIncluded = _.contains(includedFiles, filename);
                            nrOfCheckedFiles++;
                            if (!isIncluded) {
                                notIncludedFiles.push(filename);
                            }
                            // When we are at the last item of the last group in the (nested) iteration.
                            if (patternKey === patternList.length - 1 && fileKey === fileList.length - 1) {
                                // Then searching for not included files is done, so 'return' result.
                                resolve(notIncludedFiles);
                            }
                        });
                    });
                });
            });
        }).catch(function(error) {
            reject(error);
            return;
        });
    });
}


function check(patterns, userOptions, csproj) {    
    var defaultOptions = {
        csProjFilename: 'Perflectie.Web.csproj',
        cwd: '../Perflectie.Web',
        maxFilesToShow: maxFilesToShowDefault,
        verbose: false
    };
    
    options = extend(defaultOptions, userOptions);
    
    // If stuffToCheck contains a single string then convert it to array of one.
    if (patterns && typeof patterns === 'string') {
        patterns = [patterns];
    }
    
    options.stuffToCheck = patterns;

    debug('Starting.');
    debug('Options settings: ');
    debug(options);
    
    if (options.cwd) {
        // Append a slash if missing.
        if (!options.cwd.endsWith('/')) {
            options.cwd += '/';
        }
        // Add base path to all patterns in stuff to check.
        _.each(options.stuffToCheck, function (pattern, patternKey, patternList) {
            // Remove slash from beginning of globs if present.
            if (pattern.startsWith('/')) {
                pattern = pattern.substring(1);
            }
            patternList[patternKey] = options.cwd + pattern;
        });
        // And prefix the .csproj file with the base path as well.
        options.csProjFilename = options.cwd + options.csProjFilename;
    }

    var message;
    searchFilesNotIncludedIn(options.csProjFilename, options.stuffToCheck).then(function (notIncludedFiles) {
        var nrOfNotIncludedFiles = notIncludedFiles.length;
        if (nrOfNotIncludedFiles > 0) {
            message = 'There ' + (nrOfNotIncludedFiles == 1 ? 'is ' : 'are ') + nrOfNotIncludedFiles + ' of the total ' + nrOfCheckedFiles + ' checked files NOT included in \'' + options.csProjFilename + '\':';
            console.log(message);
            var limitResultsShown = options.maxFilesToShow > 0;
            var notIncludedFilesShown = limitResultsShown ? notIncludedFiles.slice(0, options.maxFilesToShow) : notIncludedFiles;
            _.each(notIncludedFilesShown, function (filename) {
                console.log(filename);
                message += "\n" + filename;
            });
            if (limitResultsShown && nrOfNotIncludedFiles > options.maxFilesToShow) {
                var subMessage = 'Only the first ' + options.maxFilesToShow + ' are shown. Change \'maxFilesToShow\' parameter to show more (or less) (default: ' + maxFilesToShowDefault + ')';
                console.log(subMessage);
            }
        } else {
            message = 'All ' + nrOfCheckedFiles + ' checked files are included in \'' + options.csProjFilename + '\'.'
            console.log(message);
        }
    }).catch(function(error) {
        console.log('Error: ' + error);
    });
}

exports.check = check;

check(['/Content/**/*.*', '/app/**/*.*'], { cwd: '../Perflectie.Web' }, 'Perflectie.Web.csproj');