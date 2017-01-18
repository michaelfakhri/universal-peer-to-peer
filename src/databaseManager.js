'use strict'

const stream = require('pull-stream')
const pullDecode = require('pull-utf8-decoder')
const isNode = require('detect-node')
const PullBlobStore = (isNode) ? require('fs-pull-blob-store') : require('idb-pull-blob-store')

const deferred = require('deferred')

module.exports = class DatabaseManager {
  constructor (fileMetadata) {
    this.metadata = fileMetadata
    this.config = new PullBlobStore('config')
  }
  setupFileStorage (aUserHash) {
    this.files = new PullBlobStore('files-' + aUserHash)
  }

  configExists () {
    return deferred.promisify(this.config.exists.bind(this.config))('config')
  }

  getConfig () {
    let config = this.config
    return new Promise(function (resolve, reject) {
      stream(
        config.read('config'),
        pullDecode(),
        stream.drain(function (data) { resolve(JSON.parse(data)) },
          function (err) {
            if (err) return reject(err)
          })
      )
    })
  }

  storeConfig (jsonConfig) {
    return new Promise((resolve, reject) => {
      stream(
        stream.once(new Buffer(JSON.stringify(jsonConfig))),
        this.config.write('config', function (err) {
          if (err) return reject(err)
          resolve()
        })
      )
    })
  }

  fileExists (fileHash) {
    return deferred.promisify(this.files.exists.bind(this.files))(fileHash)
  }
  getFile (fileHash) {
    var def = deferred()
    stream(
        this.getFileReader(fileHash),
        stream.flatten(),
        stream.collect(function (err, arr) {
          if (err) return def.reject(err)
          def.resolve(arr)
        })
      )
    return def.promise
  }
  getFileWriter (fileHash, cb) {
    return this.files.write(fileHash, function (err) {
      if (err) return cb(err)
      cb()
    })
  }
  getFileReader (fileHash) {
    return this.files.read(fileHash)
  }
  deleteFile (fileHash) {
    return deferred.promisify(this.files.remove)(fileHash)
  }
  storeMetadata (fileHash, metadata) {
    return this.metadata.store(fileHash, metadata)
  }
  getMetadata (fileHash) {
    return this.metadata.get(fileHash)
  }
  queryMetadata (aQueryStr) {
    return this.metadata.query(aQueryStr)
  }
}
