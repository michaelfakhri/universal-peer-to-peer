'use strict'
const Request = require('./request')

const stream = require('pull-stream')
const pullPushable = require('pull-pushable')
const pullDecode = require('pull-utf8-decoder')
const PeerInfo = require('peer-info')
const Libp2PIpfsBrowser = require('libp2p-ipfs-browser')
const Logger = require('logplease')
const deferred = require('deferred')
Logger.setLogLevel(Logger.LogLevels.DEBUG) // change to ERROR

const logger = Logger.create('ConnectionHandler', { color: Logger.Colors.Blue })

module.exports = class ConnectionHandler {
  constructor (EE) {
    this._EE = EE
    this.activeQueryConnections = {}
    this.activeFtpConnections = {}
    this._node
    this.myId

    this._EE.on('IncomingQueryRequest', this.onIncomingQueryRequest.bind(this))
    this._EE.on('IncomingFileRequest', this.onIncomingFileRequest.bind(this))
    this._EE.on('ReturnToSender', this.onReturnToSender.bind(this))
    this._EE.on('ReleaseConnection', this.onReleaseConnection.bind(this))
  }

  onIncomingQueryRequest (request) {
    let nrOfExpectedResponses = 0
    if (request.decrementTimeToLive() > 0) {
      nrOfExpectedResponses = this.sendRequestToAll(request)
    }
    request.setExpectedResponses(nrOfExpectedResponses + 1)
  }

  onIncomingFileRequest (request) {
    let self = this

    if (request.isRequestOriginThisNode()) {
      let userHash = request.getTarget()
      var deferredFile = request.getDeferred()
      if (!self.activeFtpConnections[userHash] || !self.activeQueryConnections[userHash]) {
        deferredFile.reject(new Error('user is not connected'))
      }
      if (self.activeFtpConnections[userHash].activeIncoming) {
        deferredFile.reject(new Error('There is a file currently being transferred'))
      }
      request.attachConnection(self.activeFtpConnections[userHash].connection)
      self.activeFtpConnections[userHash].activeIncoming = true
      self.sendRequestToUser(userHash, request)
    } else {
      request.attachConnection(self.activeFtpConnections[request.getRoute()[0]].connection)
    }
  }

  onReturnToSender (request) {
    var myIndex = request.getRoute().indexOf(this.myId)
    this.sendRequestToUser(request.getRoute()[myIndex - 1], request)
  }
  onReleaseConnection (userHash) {
    this.activeFtpConnections[userHash].activeIncoming = false
  }

  start (aPeerId) {
    let self = this
    let peerInfo = new PeerInfo(aPeerId)
    self._node = new Libp2PIpfsBrowser(peerInfo)
    self._node.handle('/UP2P/queryTransfer', (protocol, conn) => self.initQueryStream(conn))
    self._node.handle('/UP2P/fileTransfer', (protocol, conn) => self.initFtpStream(conn))
    let ma = '/libp2p-webrtc-star/ip4/127.0.0.1/tcp/15555/ws/ipfs/' + aPeerId.toB58String()
    peerInfo.multiaddr.add(ma)
    logger.debug('YOU CAN REACH ME AT ID = ' + aPeerId.toB58String())
    this.myId = aPeerId.toB58String()

    // return peer-id instance after libp2p node is started so other modules can use it
    return deferred.promisify(self._node.start.bind(self._node))().then(() => aPeerId)
  }
  connect (ma) {
    let self = this
    return deferred.promisify(self._node.dialByMultiaddr.bind(self._node))(ma, '/UP2P/queryTransfer')
      .then((conn) => self.initQueryStream(conn))
      .then(() => deferred.promisify(self._node.dialByMultiaddr.bind(self._node))(ma, '/UP2P/fileTransfer'))
      .then((conn) => self.initFtpStream(conn))
  }

  disconnect (userHash) {
    var ma = '/libp2p-webrtc-star/ip4/127.0.0.1/tcp/15555/ws/ipfs/' + userHash
    // TODO: REMOVE THE FOLLOWING LINE WHEN HANGUP BUG IS INVESTIGATED/FIXED
    this.disconnectConnection(userHash)
    return deferred.promisify(this._node.hangUpByMultiaddr.bind(this._node))(ma)
  }
  initQueryStream (connection) {
    var self = this
    var queryPusher = pullPushable()
    stream(
      queryPusher, // data pusher
      connection, // p2p connection
      pullDecode(), // convert uint8 to utf8
      stream.drain(self.queryTransferProtocolHandler.bind(self), // function called when data arrives
        (err) => {
          if (err) throw err
          connection.getObservedAddrs(function (err, data) { if (err) throw err; var addr = data[0].toString().split('/'); self.disconnectConnection(addr[addr.length - 1]) })
        }
      ) // function called when stream is done
    )
    connection.getObservedAddrs(function (err, data) { if (err) throw err; var addr = data[0].toString().split('/'); self.activeQueryConnections[addr[addr.length - 1]] = queryPusher })
  }
  initFtpStream (conn) {
    var self = this
    conn.getObservedAddrs(function (err, data) { if (err) throw err; var addr = data[0].toString().split('/'); self.activeFtpConnections[addr[addr.length - 1]] = {connection: conn, activeIncoming: false} })
  }

  queryTransferProtocolHandler (request) {
    var parsedRequest = Request.createFromString(request)
    if (parsedRequest.isResponse()) this._EE.emit('IncomingResponse', parsedRequest)
    else this._EE.emit('IncomingRequest', parsedRequest)
  }
  sendRequestToAll (query) {
    var count = 0
    for (var userHash in this.activeQueryConnections) {
      if (query.getRoute().indexOf(userHash) < 0) {
        this.activeQueryConnections[userHash].push(query.serialize())
        count++
      }
    }
    return count
  }
  sendRequestToUser (userHash, ftpRequest) {
    this.activeQueryConnections[userHash].push(ftpRequest.serialize())
  }
  disconnectConnection (userHash) {
    if (this.activeQueryConnections[userHash]) this.activeQueryConnections[userHash].end()
    // TODO: Remove this forceful disconnection code
    delete this.activeQueryConnections[userHash]
    delete this._node.swarm.muxedConns[userHash]
  }
}
