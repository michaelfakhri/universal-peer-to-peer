'use strict'

const MultihashingAsync = require('multihashing-async')
const stream = require('pull-stream')
const Logger = require('logplease')
const deferred = require('deferred')
Logger.setLogLevel(Logger.LogLevels.DEBUG) // change to ERROR

const logger = Logger.create('UP2P', { color: Logger.Colors.Blue })

const ConnectionHandler = require('./connectionHandler')

module.exports = class UniversalPeerToPeer {

  constructor (aPeerId, aFileMetadataHandler) {
    this._connectionHandler

    let self = this
    return new ConnectionHandler(aPeerId, aFileMetadataHandler) // returns a promise that resolves to the connectionHandler after all async tasks are completed
      .then((connectionHandler) => {
        self._connectionHandler = connectionHandler
        return deferred(self)
      })
  }

  start () {
    return deferred.promisify(this._connectionHandler._node.start.bind(this._connectionHandler._node))()
  }

  stop () {
    return deferred.promisify(this._connectionHandler._node.stop.bind(this._connectionHandler._node))()
  }

  connect (aUserHashStr) {
    var ma = '/libp2p-webrtc-star/ip4/127.0.0.1/tcp/15555/ws/ipfs/' + aUserHashStr
    logger.debug('Attempting to connect to ' + aUserHashStr)
    return this._connectionHandler.connect(ma)
  }
  disconnect (aUserHashStr) {
    return this._connectionHandler.disconnect(aUserHashStr)
  }
  publish (aData, aMetadata) {
    var self = this
    return deferred.promisify(MultihashingAsync)(Buffer(aData), 'sha2-256')
      .then((mh) => {
        var hash = MultihashingAsync.multihash.toB58String(mh)
        var def = deferred()
        stream(
          stream.once(aData),
          self._connectionHandler._db.getFileWriter(hash, function () {
            def.resolve(hash)
          })
        )
        return def.promise.then(() => self._connectionHandler._db.storeMetadata(hash, aMetadata)).then(() => hash)
      })
  }

  view (aDataHashStr) {
    return this._connectionHandler._db.getFile(aDataHashStr)
  }

  delete (aDataHashStr) {
    return this._connectionHandler._db.deleteFile(aDataHashStr)
  }

  copy (aDataHashStr, aUserHashStr) {
    return this._connectionHandler._requestHandler.buildAndSendFileRequest(aDataHashStr, aUserHashStr)
  }

  query (aQueryStr) {
    return this._connectionHandler._requestHandler.buildAndSendQuery(aQueryStr)
  }

  queryLocal (aQueryStr) {
    return this._connectionHandler._db.queryMetadata(aQueryStr)
  }
}
module.exports.Buffer = Buffer
