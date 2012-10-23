var fs = require('fs'),
    wrench = require('wrench'),
    util = require('util'),
    uuid = require('node-uuid'),
    mongo = require('mongojs'),
    db = mongo.connect('/videoProjects', ['projects', 'assets', 'files', 'compositions']);

var PROJECTS_PATH = __dirname + '/public/projects/';

function isProjectExistent(id, callback) {

    if (!id || id.length < 24) {
        //TODO check this
        //callback(false);
        return;
    }

    db.projects.findOne({_id : db.ObjectId(id)}, function onFound(err, docs) {
        callback(err === null);
    });
}

function getProjectPathByProjectId(id, callback) {

    db.projects.findOne({_id : db.ObjectId(id)}, function onFound(err, docs) {
        if (err) throw err;
        callback(docs.assetFolder);
    });

}

function createProject(data, callback) {

    //UUID for asset-folder
    data.assetFolder = uuid.v4().replace(/-/g, '');

    db.projects.save(data, function saveCallback(err, docs) {

            console.log('PROJECTS.JS::PROJECT CREATED', docs._id);

            createDir(PROJECTS_PATH + data.assetFolder, function onComplete(err) {
                createDir(PROJECTS_PATH + data.assetFolder + '/assets', function onComplete(err) {
                    callback(err, {
                        _id         : docs._id,
                        assetFolder : docs.assetFolder
                    });
                });
            });
        }
    );
}

function readProject(data, callback) {
    isProjectExistent(data._id, function (exists) {
        if (exists) {
            db.projects.findOne({_id : db.ObjectId(data._id)}, function onFound(err, docs) {
                if (docs) {
                    console.log('PROJECTS.JS::PROJECT FOUND', docs._id);
                    //didn't work this way
                    /* db.assets.find({projectId:data._id}, function onFound(err, assets){
                     docs.library = assets;
                     });*/
                }
                callback(err, docs);
            });
        }
        else {
            callback(new Error('Does not exist'), null);
        }
    });

}

function updateProject(data, callback) {

    db.projects.update({_id : db.ObjectId(data._id)}, {
        $set : {
            title        : data.title,
            library      : data.library,
            compositions : data.compositions,
            assetFolder  : data.assetFolder,
            date         : data.date
        }

    }, {multi : false}, function updateCallback(err, docs) {
        console.log('PROJECTS.JS::PROJECT UPDATED', data._id);
        callback(err, {});
    });

}

function deleteProject(data, callback) {

    var id = db.ObjectId(data._id),
        assetFolder = null;

    //to make sure nothing else gets deleted
    db.projects.findOne({_id : id}, {assetFolder : 1}, function onFound(err, docs) {
        assetFolder = docs.assetFolder;
        db.projects.remove({_id : id}, function deleteCallback(err, docs) {

            deleteDirSync(PROJECTS_PATH + assetFolder);
            console.log('PROJECTS.JS::PROJECT DELETED', id);

            callback(err, docs);

        });

    });
}

function createAsset(data, callback) {
    db.assets.save(data, function saveCallback(err, docs) {
            console.log('PROJECTS.JS::ASSET CREATED', docs._id);
            if (err) throw err;
            callback(err, docs);
        }
    );
}

function readAsset(data, callback) {
    db.assets.findOne({_id : db.ObjectId(data._id)}, function onFound(err, docs) {
        console.log('PROJECTS.JS::ASSET FOUND', docs._id);
        if (err) throw err;
        callback(err, docs);
    });

}

function updateAsset(data, callback) {
    var id = data._id;
    delete data._id;
    db.assets.update({_id : db.ObjectId(id)}, data, {multi : false},
        function updateCallback(err, docs) {
            data._id = id;
            console.log('PROJECTS.JS::ASSET UPDATED', id);
            if (err) throw err;
            callback(err, {});
        }

    )
    ;

}

function deleteAsset(data, callback) {

    var id = db.ObjectId(data._id),
        assetFolder = null;

    //to make sure nothing else gets deleted
    db.assets.find({_id : id}, {files : 1}, function onFound(err, docs) {
        //TODO delete all files and remove from db
        //assetFolder = docs.assetFolder;
        db.assets.remove({_id : id}, function deleteCallback(err, docs) {
            console.log('PROJECTS.JS::ASSET DELETED', id);
            if (err) throw err;
            callback(err, docs);

        });

    });
}

function createFile(data, callback) {
    //this shouldn't be stored on the server
    delete data.localUrl;
    delete data.localFile;
    delete data.id;

    db.files.save(data, function saveCallback(err, docs) {
            console.log('PROJECTS.JS::FILE CREATED', docs._id);
            if (err) throw err;
            docs.id = docs._id;
            delete docs._id;
            callback(err, docs);
        }
    );
}

function readFile(data, callback) {
    data._id = data.id;
    delete data.id;

    db.files.findOne({_id : db.ObjectId(data._id)}, function onFound(err, docs) {
        console.log('PROJECTS.JS::FILE FOUND', docs._id);
        if (err) throw err;
        callback(err, docs);
    });

}

function updateFile(data, callback) {
    var id = data.id,
        dataUpdate = {};

    //necessary because update could replace existing values
    if (data.assetId) dataUpdate.assetId = data.assetId;
    if (data.size) dataUpdate.size = data.size;
    if (data.ext) dataUpdate.ext = data.ext;
    if (data.remoteFileName) dataUpdate.remoteFileName = data.remoteFileName;
    if (data.isOriginal) dataUpdate.isOriginal = data.isOriginal;
    if (data.isComplete) dataUpdate.isComplete = data.isComplete;
    if (data.byteOffset) dataUpdate.byteOffset = data.byteOffset;
    if (data.encodingProgress) dataUpdate.encodingProgress = data.encodingProgress;


    db.files.update({_id : db.ObjectId(id)}, {$set : dataUpdate}, {multi : false},
        function updateCallback(err) {
            console.log('PROJECTS.JS::FILE UPDATED', id);
            if (err) throw err;
            callback(err, {});
        });
}

function deleteFile(data, callback) {

    var id = db.ObjectId(data.id),
        assetFolder = null;

    //to make sure nothing else gets deleted
    db.files.find({_id : id}, {files : 1}, function onFound(err, docs) {
        //TODO delete all files and remove from db
        //assetFolder = docs.assetFolder;
        db.files.remove({_id : id}, function deleteCallback(err, docs) {
            console.log('PROJECTS.JS::FILE DELETED', id);
            callback(err, docs);

        });

    });
}

function removeFile(filepath, callback) {
    fs.exists(filepath, function onFileExists(exists) {
        if (!exists) fs.unlink(filepath, function onFileUnlink(err) {
            if (err) throw err;
            callback();
        });
    });
}

function removeDirSync(path) {
    wrench.rmdirSyncRecursive(path);
}

function createDir(path, callback) {
    fs.exists(path, function onFileExists(exists) {
        if (!exists) fs.mkdir(path, 0777, function onDirCreated(err) {
            if (err) console.log(err);
            callback();
        });
    });
}

function clean(callback) {
    console.log('PROJECTS.JS::PROJECTS CLEANED');
    db.projects.remove({});
    db.assets.remove({});
    db.files.remove({});
    db.compositions.remove({});
    wrench.rmdirSyncRecursive(PROJECTS_PATH);
    createDir(PROJECTS_PATH, callback);
}


function getLibraryByProjectId(data, callback) {
    db.assets.find({projectId : data.id}, function onFound(err, docs) {
        console.log('PROJECTS.JS::LIBRARY SERVED WITH', docs.length, 'ASSETS');
        if (err) throw err;
        callback(err, docs);
    });
}

function getCompositionsByProjectId(data, callback) {
    db.compositions.find({projectId : data.id}, function onFound(err, docs) {
        console.log('PROJECTS.JS::COMPOSITIONS SERVED WITH', docs.length, 'COMPS.');
        if (err) throw err;
        callback(err, docs);
    });
}

function getFilesByAssetId(data, callback) {
    db.files.find({assetId : data.id}, function onFound(err, docs) {
        console.log('PROJECTS.JS::FILES SERVED WITH', docs.length, 'FILES');
        if (err) throw err;

        //the whole _id/id thing created a mess in the file-Model
        for (var i = 0; i < docs.length; i++) {
            docs[i].id = docs[i]._id;
            delete docs[i]._id;
        }

        callback(err, docs);
    });
}

function getAssetIdByFileId(fileId, callback) {
    db.files.findOne({_id : db.ObjectId(fileId)}, function onFound(err, docs) {
        if (err) throw err;
        callback(docs.assetId);
    });
}


//EXPORTS
exports.createProject = createProject;
exports.readProject = readProject;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;

exports.createAsset = createAsset;
exports.readAsset = readAsset;
exports.updateAsset = updateAsset;
exports.deleteAsset = deleteAsset;

exports.createFile = createFile;
exports.readFile = readFile;
exports.updateFile = updateFile;
exports.deleteFile = deleteFile;

exports.getLibraryByProjectId = getLibraryByProjectId;
exports.getCompositionsByProjectId = getCompositionsByProjectId;
exports.getFilesByAssetId = getFilesByAssetId;

exports.getAssetIdByFileId = getAssetIdByFileId;
exports.isProjectExistent = isProjectExistent;
exports.getProjectPathByProjectId = getProjectPathByProjectId;
exports.clean = clean;