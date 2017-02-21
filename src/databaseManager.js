'use strict'

const stream = require('pull-stream')
const pullDecode = require('pull-utf8-decoder')
const PullBlobStore = require('idb-pull-blob-store')
const PeerId = require('peer-id')

const deferred = require('deferred')

module.exports = class DatabaseManager {
  constructor (fileMetadata, EE) {
    this.metadata = fileMetadata
    this.config = new PullBlobStore('config')
    this._EE = EE
    this.myId

    this._EE.on('IncomingQueryRequest', this.onIncomingQueryRequest.bind(this))
    this._EE.on('IncomingFileRequest', this.onIncomingFileRequest.bind(this))
    this._EE.on('IncomingFileResponse', this.onIncomingFileResponse.bind(this))

  }
  onIncomingQueryRequest (request) {
    let self = this
    self.queryMetadata(request.getQuery())
      .then((queryResult) => {
        let response = {id: self.myId, result: queryResult}
        request.setResult([response])
        self._EE.emit('IncomingResponse', request)
      })
      .catch((err) => console.error(err.stack))
  }
  onIncomingFileRequest (request) {
    let self = this
    let fileHash = request.getFile()
    if (request.isRequestOriginThisNode()) {
      stream(
        request.getConnection(),
        self.getFileWriter(fileHash, function (err) {
          if (err) throw err
          self._EE.emit('ReleaseConnection', request.getTarget())
          request.getDeferred().resolve()
        })
      )
    } else {
      self.fileExists(request.getFile()).then(function (exists) {
        if (exists) {
          self.getMetadata(request.getFile()).then((metadata) => {
            request.setResult([{accepted: true, metadata: metadata}])
            stream(
              self.getFileReader(request.getFile()),
              request.getConnection()
            )
          })
        } else {
          request.setResult([{accepted: false, error: 'file NOT found'}])
        }
        self._EE.emit('ReturnToSender', request)
      })
    }
  }

  onIncomingFileResponse (request) {
    if (!request.getResult()[0].accepted) {
      request.getDeferred().reject(new Error(request.getResult()[0].error))
    } else {
      this.storeMetadata(request.getFile(), request.getResult()[0].metadata)
    }
  }

  start (aPeerId) {
    let self = this
    return self.getConfig(aPeerId)
      .then((peerId) => {
        self.files = new PullBlobStore('files-' + peerId.toB58String())
        self.myId = peerId.toB58String()

        return peerId
      })
  }

  getConfig (aPeerId) {
    let self = this
    let def = deferred()

    if (aPeerId) {
      def.resolve(aPeerId)
    } else {
      self.configExists()
      .then((exists) => {
        if (exists) {
          self.getConfigFromStorage()
            .then((peerIdJSON) => deferred.promisify(PeerId.createFromJSON)(peerIdJSON))
            .then((peerId) => def.resolve(peerId))
        } else {
          deferred.promisify(PeerId.create)()
          .then((peerId) => {
            self.storeConfig(peerId.toJSON())
              .then(() => def.resolve(peerId))
          })
        }
      })
    }

    // return peer-id instance so other modules can use it
    return def.promise
  }

  configExists () {
    return deferred.promisify(this.config.exists.bind(this.config))('config')
  }

  getConfigFromStorage () {
    var def = deferred()
    stream(
      this.config.read('config'),
      pullDecode(),
      stream.drain((data) => def.resolve(JSON.parse(data)), (err) => { if (err) return def.reject(err) })
    )
    return def.promise
  }

  storeConfig (jsonConfig) {
    var def = deferred()
    stream(
      stream.once(new Buffer(JSON.stringify(jsonConfig))),
      this.config.write('config', (err) => { if (err) return def.reject(err); def.resolve() })
    )
    return def.promise
  }

  fileExists (fileHash) {
    return deferred.promisify(this.files.exists.bind(this.files))(fileHash)
  }
  getFile (fileHash) {
    var def = deferred()
    stream(
        this.getFileReader(fileHash),
        stream.flatten(),
        stream.collect((err, arr) => { if (err) return def.reject(err); def.resolve(arr) })
      )
    return def.promise
  }
  getFileWriter (fileHash, cb) {
    return this.files.write(fileHash, (err) => { if (err) return cb(err); cb() })
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
