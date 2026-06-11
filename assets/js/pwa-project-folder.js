(function (global) {
  'use strict';

  var folderHandle = null;
  var folderLabel = '';
  var files = [];
  var activeFileName = '';
  var canWrite = false;

  function parseWireId(filename) {
    var base = String(filename || '').replace(/\.xlsx$/i, '');
    var patterns = [
      /(?:^|[-_\s])W(\d{1,4})\b/i,
      /(?:^|[-_\s])wire[-_\s#]*(\d{1,4})\b/i,
      /PWA[-_](\d{1,4})/i,
      /(?:^|[-_\s])(\d{1,4})(?:[-_\s]|$)/
    ];
    var i;
    var match;
    for (i = 0; i < patterns.length; i += 1) {
      match = base.match(patterns[i]);
      if (match && match[1]) {
        return 'W' + String(parseInt(match[1], 10)).padStart(3, '0');
      }
    }
    return base.slice(0, 32);
  }

  function sortFiles(list) {
    list.sort(function (a, b) {
      var aw = a.wireId.replace(/\D/g, '') || '0';
      var bw = b.wireId.replace(/\D/g, '') || '0';
      var diff = parseInt(aw, 10) - parseInt(bw, 10);
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name);
    });
  }

  async function readDirectoryHandle(handle) {
    var out = [];
    for await (var entry of handle.values()) {
      if (entry.kind === 'file' && /\.xlsx$/i.test(entry.name) && entry.name.charAt(0) !== '~') {
        out.push({
          name: entry.name,
          wireId: parseWireId(entry.name),
          handle: entry,
          file: null
        });
      }
    }
    sortFiles(out);
    return out;
  }

  async function chooseFolder() {
    if (typeof global.showDirectoryPicker === 'function') {
      folderHandle = await global.showDirectoryPicker({ mode: 'readwrite' });
      folderLabel = folderHandle.name;
      canWrite = true;
      files = await readDirectoryHandle(folderHandle);
      return { name: folderLabel, files: files.slice(), canWrite: true };
    }
    return null;
  }

  function loadFallbackFiles(fileList) {
    files = [];
    folderHandle = null;
    canWrite = false;
    folderLabel = 'Selected files';
    Array.prototype.forEach.call(fileList || [], function (file) {
      if (/\.xlsx$/i.test(file.name) && file.name.charAt(0) !== '~') {
        files.push({
          name: file.name,
          wireId: parseWireId(file.name),
          handle: null,
          file: file
        });
      }
    });
    if (files.length) {
      var firstPath = files[0].file && files[0].file.webkitRelativePath;
      if (firstPath) {
        folderLabel = firstPath.split('/')[0] || 'Selected folder';
      }
    }
    sortFiles(files);
    return { name: folderLabel, files: files.slice(), canWrite: false };
  }

  async function refreshFolder() {
    if (!folderHandle) {
      return { name: folderLabel, files: files.slice(), canWrite: canWrite };
    }
    files = await readDirectoryHandle(folderHandle);
    return { name: folderLabel, files: files.slice(), canWrite: canWrite };
  }

  async function getFile(entry) {
    if (entry.handle && entry.handle.getFile) {
      return entry.handle.getFile();
    }
    return entry.file;
  }

  async function saveBlobToFolder(filename, blob) {
    if (!folderHandle || !canWrite) {
      return false;
    }
    var handle = await folderHandle.getFileHandle(filename, { create: true });
    var writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    files = await readDirectoryHandle(folderHandle);
    return true;
  }

  function setActiveFile(name) {
    activeFileName = name || '';
  }

  function getState() {
    return {
      folderLabel: folderLabel,
      files: files.slice(),
      activeFileName: activeFileName,
      canWrite: canWrite,
      hasFolder: files.length > 0 || !!folderHandle
    };
  }

  global.PwaProjectFolder = {
    parseWireId: parseWireId,
    chooseFolder: chooseFolder,
    loadFallbackFiles: loadFallbackFiles,
    refreshFolder: refreshFolder,
    getFile: getFile,
    saveBlobToFolder: saveBlobToFolder,
    setActiveFile: setActiveFile,
    getState: getState
  };
})(typeof window !== 'undefined' ? window : this);
