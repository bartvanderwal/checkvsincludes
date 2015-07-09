var fs = require('fs'),
    // readFile = require('fs-readfile-promise'),
    xml2js = require('xml2js'),
    _ = require('lodash'),
    Promise = require('promise'),
    glob = require('glob'),
    upath = require('upath'),
    clone = require('clone'),
    minimatch = require('minimatch');

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
 *  
 * @param {} csProjFilename 
 * @param {} basePath Optional, the path to find the .csproj file in.
 * @returns {} All files from the given cs project file. If a basepath was given for the .csproj, then this path is added to the path of each of the returned filenames.
 */
function readCsProjeFile(csProjFilename) {
    // 5. Lees input file 'Perflectie.Web.csproj' file in.
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
                    reject('Error: No item groups found in ' + csProjFilename);
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

// 8. Voor elke bestandsnaam B in 'filesToCheck':
// 9.   Hoog 'nrOfCheckedFiles' met 1 op
// 10.   Check of de bestandsnaam B in de 'targetedFiles' voorkomt (e.g. is geincluded)
// 11.	     Zo niet: voeg dan bestandsnaam B toe aan 'errorList' en hoog 'nrOfNotIncludedFiles' met 1 op (zo wel: doe niks :)
// 12. Tot slot Print op het scherm als er eén of meer filenamen in 'errorList' staan en eventueel verdere variabelen (zie init) op het scherm
// 13. Geef alle originele input files (e.g. zonder filter) door naar output voor evt. volgende gulp task

// 1. Init:
var nrOfCheckedFiles = 0,
    nrOfTargetedFiles = 0,
    nrOfNotIncludedFiles = 0,
    notIncludedFiles = [],
    maxFilesToShowDefault = 20;

// 2. Lees het filter in uit params
// TODO. For nu even gehardcoded.
params = {
    stuffToCheck: ['app/**/*.js', 'Content/**/*.less', 'Content/**/*.css'],
    csProjFilename: 'Perflectie.Web.csproj',
    basePath: '../Perflectie.Web',
    maxFilesToShow: maxFilesToShowDefault,
    verbose: false
};

var config = clone(params);

function debug(message) {
    if (config.verbose) {
        console.log(message);
    }
}

debug('Starting.');
debug('Params: ');
debug(params);

if (params.basePath) {
    // Append a slash if missing.
    if (!config.basePath.endsWith('/')) {
        config.basePath += '/';
    }
    // Add base path to all patterns in stuff to check.
    _.each(config.stuffToCheck, function(pattern, patternKey, patternList) {
        // Remove slash from beginning of globs if present.
        if (pattern.startsWith('/')) {
            pattern = pattern.substring(1);
        }
        patternList[patternKey] = config.basePath + pattern;
    });
    // And prefix the .csproj file with the base path as well.
    config.csProjFilename = config.basePath + config.csProjFilename;
}
//

function getBasePath(pathAndFile) {
    if (!pathAndFile) {
        throw new Error('getBasePath: Supplied path is empty!');
    }
    // Remove a potential end slash from path to prevent errors 
    if (pathAndFile.endsWith('/')) {
        pathAndFile.substring(0, pathAndFile.length-1)
    }
    var index = pathAndFile.lastIndexOf('/');
    return index === -1 ? "" : pathAndFile.substring(0, index+1);
}

// 3. Lees alle bestandsnamen in uit de genoemde folder in array 'physicalFiles'.
function searchFilesNotIncludedIn(csProjFilename, filter) {
    return new Promise(function (resolve, reject) {
        if (config.stuffToCheck.length === 0) {
            reject('No stuff to check!');
            return;
        }
        var includedFiles = [];
        var basePath = getBasePath(csProjFilename);
        readCsProjeFile(csProjFilename)
            .then(function(result) {
            return new Promise(function (resolve, reject) {
                if (!result || result.length === 0) reject('No files in result');
                _.each(result, function (filename, fileKey, fileList) {
                    var pattern = filter[0];
                    // Do some conversions to allow simple string comparison to the files as returned by node - glob.
                    // 1. The files in the .csproj are in windows format, so convert to unix;
                    var unixFilename = upath.normalize(filename);
                    // 2. Add the basePath to the file - if set.
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
                    // }).then(function() {
                    // TODO BW Filter non relevant files from includedFiles list based on specified glob patterns (use minimatch library?).
                    // includedFiles = _.filter.
                    // });
                });
            }).then(function (includedFiles) {
                _.each(config.stuffToCheck, function (pattern, patternKey, patternList) {
                    var options = { debug: false };
                    glob(pattern, options, function (err, files) {
                        if (err) {
                            reject('Error for glob pattern \'' + pattern + '\' in stuff to check!');
                        }
                        if (files.length === 0) {
                            reject('No files for pattern \'' + pattern + '\' in stuff to check.');
                        }
                        _.each(files, function (filename, fileKey, fileList) {
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

searchFilesNotIncludedIn(config.csProjFilename, config.stuffToCheck).then(function(notIncludedFiles) {
    var nrOfNotIncludedFiles = notIncludedFiles.length;
    if (nrOfNotIncludedFiles > 0) {
        console.log('There ' + (nrOfNotIncludedFiles==1 ? 'is ' : 'are ') + nrOfNotIncludedFiles + ' of the total ' + nrOfCheckedFiles + ' checked files are NOT included in \'' + config.csProjFilename + '\':');
        var limitResultsShown = params.maxFilesToShow > 0;
        var notIncludedFilesShown = limitResultsShown ? notIncludedFiles.slice(0, params.maxFilesToShow) : notIncludedFiles;
        _.each(notIncludedFilesShown, function (filename) {
            console.log(filename);
        });
        if (limitResultsShown && nrOfNotIncludedFiles > params.maxFilesToShow) {
            console.log('Only the first ' + params.maxFilesToShow + ' are shown. Change \'maxFilesToShow\' parameter to show more (or less) (default: ' + maxFilesToShowDefault + ')');
        }
    } else {
        console.log('Total ' + nrOfCheckedFiles + ' checked files are included in \'' + config.csProjFilename + '\'.');
    }
}).catch(function(error) {
    console.log('Error \'searchFilesNotIncludedIn\': ' + error);
});
