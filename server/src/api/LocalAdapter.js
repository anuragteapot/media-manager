/**
 * @package     Media Manager
 * @SubPackage  LocalAdapter
 *
 * @copyright   Copyright (C) 2019. All rights reserved.
 * @license     GNU General Public License
 */

const fs = require('fs');
const readChunk = require('read-chunk');
const fileType = require('file-type');
const sizeOf = require('image-size');
const util = require('util');

const dirPremission = 0755;
class LocalAdapter {
  /**
   * Constructor
   *
   * @param
   *
   */
  constructor(req, res, next, rootPath) {
    // Request
    this.req = req;

    // Response
    this.res = res;

    // Next
    this.next = next;

    // Root Path
    if (fs.statSync(rootPath).isDirectory()) {
      this.rootPath = rootPath;
    } else {
      this.rootPath = './';
    }
  }

  /**
   *
   *
   */
  static getFiles(path) {
    const data = [];
    // Read each items in folder
    fs.readdirSync(path).forEach((item) => {
      const itemData = this.getPathInformation(path, item);
      data.push(itemData);
    });

    return data;
  }

  /**
   *
   *
   */
  static getDir(path) {
    if (fs.statSync(path).isDirectory()) {
      return path;
    }
    return path.substring(0, path.lastIndexOf('/'));
  }

  /**
   *
   *
   */
  static createDir(path, name) {
    var dir;

    if(name !== null || name !== '') {
       dir = path + name;
    } else {
       dir = path;
    }

    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, dirPremission);
        return true;
      } catch (e) {
        if (e.code != "EEXIST") {
          throw e;
        }
      }
    }
  }

  /**
   *
   *
   */
  static copy(sourcePath, destinationPath) {

    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source Path not exist.');
    }

    if (fs.statSync(sourcePath).isDirectory()) {
      this.copyDir(sourcePath, destinationPath);
    } else {
      this.copyFile(sourcePath, destinationPath);
    }

    return destinationPath;
  }

  /**
   *
   *
   */
  static copyDir(src, dest) {
    this.createDir(dest);
    var files = fs.readdirSync(src);

    for (var i = 0; i < files.length; i++) {
      var current = fs.lstatSync(path.join(src, files[i]));
      if (current.isDirectory()) {
        this.copyDir(path.join(src, files[i]), path.join(dest, files[i]));
      } else if (current.isSymbolicLink()) {
        var symlink = fs.readlinkSync(path.join(src, files[i]));
        fs.symlinkSync(symlink, path.join(dest, files[i]));
      } else {
        this.copyFile(path.join(src, files[i]), path.join(dest, files[i]));
      }
    }
  }


  /**
   *
   *
   */
  static copyFile(src, dest) {
    var oldFile = fs.createReadStream(src);
    var newFile = fs.createWriteStream(dest);
    util.pump(oldFile, newFile);
  }

  /**
   *
   *
   */
  static delete(path) {
    if (!fs.statSync(path).isDirectory() && fs.existsSync(path)) {
      try {
        fs.unlinkSync(path);
        return true;
      } catch (err) {
        return err;
      }
    } else {
      this.deleteFolder(path);

      if (fs.existsSync(path)) {
        return false;
      }
    }
    return true;
  }

  /**
   *
   *
   */
  static deleteDir(path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file) => {
        const curPath = `${path}/${file}`;
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          this.deleteFolder(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
    return true;
  }

  /**
   * Returns the folder or file information for the given path. The returned object
   * has the following properties:
   * - type:          The type can be file or dir
   * - name:          The name of the file
   * - path:          The relative path to the root
   * - extension:     The file extension
   * - size:          The size of the file
   * - create_date:   The date created
   * - modified_date: The date modified
   * - mime_type:     The mime type
   * - width:         The width, when available
   * - height:        The height, when available
   * - thumb_path     The thumbnail path of file, when available
   *
   */
  static getPathInformation(path, item) {
    const itemDataObj = {};
    const shasum = crypto.createHash('sha1');
    const stats = fs.statSync(path + item);
    let isDir = false;
    let fileBuffer = null;

    if (fs.statSync(path + item).isDirectory()) {
      isDir = true;
    } else {
      fileBuffer = readChunk.sync(path + item, 0, fileType.minimumBytes);
    }

    itemDataObj.name = item;

    shasum.update(path + item + stats.mtime);
    itemDataObj.id = shasum.digest('hex');
    itemDataObj.type = !isDir ? 'file' : 'dir';
    itemDataObj.mime_type = isDir ? 'directory' : '';

    if (!isDir && fileBuffer != null) {
      const fileInfo = fileType(fileBuffer);
      itemDataObj.extension = fileInfo.ext;
      itemDataObj.mime_type = fileInfo.mime;

      if (fileInfo.mime === 'image/jpeg' || fileInfo.mime === 'image/png' || fileInfo.mime === 'image/jpg') {
        const dimensions = sizeOf(path + item);

        itemDataObj.height = !isDir ? dimensions.height : '';
        itemDataObj.width = !isDir ? dimensions.width : '';

        itemDataObj.imgLazyUrl = `/api/images/${Buffer.from(path + item).toString('base64')}/t/${fileInfo.ext}/d/200/200/m/${fileInfo.mime}/${itemDataObj.id}`;
        itemDataObj.imgUrl = `/api/images/${Buffer.from(path + item).toString('base64')}/t/${fileInfo.ext}/d/200/200/m/${fileInfo.mime}/${itemDataObj.id}`;
        itemDataObj.filePath = `/api/images/${Buffer.from(path + item).toString('base64')}/t/${fileInfo.ext}/d/200/200/m/${fileInfo.mime}/${itemDataObj.id}`;
      } else {
        itemDataObj.filePath = `/api/files/${Buffer.from(path + item).toString('base64')}/t/${fileInfo.ext}/m/${fileInfo.mime}/s/${stats.size}/${itemDataObj.id}`;
      }

      const originalPath = `/api/thirdParty/${itemDataObj.extension}.svg`;
      itemDataObj.extImg = Buffer.from(originalPath).toString('base64');
    }

    itemDataObj.color = isDir ? '#3949AB' : '';
    itemDataObj.size = !isDir ? stats.size : '';

    const atime = new Date(util.inspect(stats.atime));
    const mtime = new Date(util.inspect(stats.mtime));
    const ctime = new Date(util.inspect(stats.ctime));

    itemDataObj.assigned_date = atime;
    itemDataObj.modified_date = mtime;
    itemDataObj.created_date = ctime;

    itemDataObj.path = path + item;

    itemDataObj.uid = stats.uid;

    return itemDataObj;
  }
}

const Adapter = new LocalAdapter();

module.exports = Adapter;
