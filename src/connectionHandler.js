'use strict'
const DatabaseManager = require('./databaseManager')
const RequestHandler = require('./queryHandler')

const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Libp2PIpfsBrowser = require('libp2p-ipfs-browser')
const Logger = require('logplease')
const deferred = require('deferred')
Logger.setLogLevel(Logger.LogLevels.DEBUG) // change to ERROR

const logger = Logger.create('ConnectionHandler', { color: Logger.Colors.Blue })

module.exports = class ConnectionHandler {
  constructor (aFileMetadataHandler) {
    if (!aFileMetadataHandler) {
      throw new Error('Must specify at least the file metadataHandler')
    }

    this._db = new DatabaseManager(aFileMetadataHandler)
    this._node
    this._requestHandler
  }
  start (aPeerId) {
    let self = this
    let def = deferred()

    if (aPeerId) {
      def.resolve(aPeerId)
    } else {
      self._db.configExists()
        .then((exists) => {
          if (exists) {
            self._db.getConfig()
              .then((peerIdJSON) => deferred.promisify(PeerId.createFromJSON)(peerIdJSON))
              .then((peerId) => def.resolve(peerId))
          } else {
            deferred.promisify(PeerId.create)()
              .then((peerId) => {
                self._db.storeConfig(peerId.toJSON())
                  .then(() => def.resolve(peerId))
              })
          }
        })
    }
    return def.promise.then((peerId) => {
      this._db.setupFileStorage(peerId.toB58String())
      var peerInfo = new PeerInfo(peerId)
      self._node = new Libp2PIpfsBrowser(peerInfo)
      self._node.handle('/UP2P/queryTransfer', (protocol, conn) => self._requestHandler.initQueryStream(conn))
      self._node.handle('/UP2P/fileTransfer', (protocol, conn) => self._requestHandler.initFtpStream(conn))
      self._requestHandler = new RequestHandler(self._db, self._node)
      var ma = '/libp2p-webrtc-star/ip4/127.0.0.1/tcp/15555/ws/ipfs/' + peerId.toB58String()
      peerInfo.multiaddr.add(ma)
      logger.debug('YOU CAN REACH ME AT ID = ' + peerId.toB58String())
    })
      .then(() => deferred.promisify(self._node.start.bind(self._node))()
  )
  }
  connect (ma) {
    let self = this
    return deferred.promisify(self._node.dialByMultiaddr.bind(self._node))(ma, '/UP2P/queryTransfer')
      .then((conn) => self._requestHandler.initQueryStream(conn))
      .then(() => deferred.promisify(self._node.dialByMultiaddr.bind(self._node))(ma, '/UP2P/fileTransfer'))
      .then((conn) => self._requestHandler.initFtpStream(conn))
  }

  disconnect (userHash) {
    var ma = '/libp2p-webrtc-star/ip4/127.0.0.1/tcp/15555/ws/ipfs/' + userHash
    // TODO: REMOVE THE FOLLOWING LINE WHEN HANGUP BUG IS INVESTIGATED/FIXED
    this._requestHandler.disconnectConnection(userHash)
    return deferred.promisify(this._node.hangUpByMultiaddr.bind(this._node))(ma)
  }
}
