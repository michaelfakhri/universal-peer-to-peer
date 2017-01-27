'use strict'

const stream = require('pull-stream')
const pullPushable = require('pull-pushable')
const pullDecode = require('pull-utf8-decoder')
const Request = require('./request')
const RequestTracker = require('./requestTracker')

const deferred = require('deferred')
module.exports = class RequestHandler {
  constructor (aDbManager, EE) {
    this.dbManager = aDbManager
    this.activeQueryConnections = {}
    this.activeFtpConnections = {}
    this.activeRequests = []
    this.recentRequestIds = []
    this._EE = EE
    this.myId
    this.node
    this._EE.on('IncomingRequest', this.onIncominRequest.bind(this))
  }
  start (aNode) {
    this.node = aNode
    this.myId = aNode.peerInfo.id.toB58String()
  }

  onIncominRequest (request) {
    let self = this
    var requestId = request.getId()
    if (!request.isResponse()) {
      request.addToRoute(this.myId)
      if (request.getType() === 'file' && request.getRoute()[0] === self.myId) {
        let fileHash = request.getFile()
        let userHash = request.getTarget()
        let self = this
        if (!self.activeFtpConnections[userHash] || !self.activeQueryConnections[userHash]) {
          throw new Error('user is not connected')
        }
        if (self.activeFtpConnections[userHash].activeIncoming) {
          throw new Error('There is a file currently being transferred')
        }
        self.activeFtpConnections[userHash].activeIncoming = true

        var deferredFile = request.getDeferred()
        stream(
          self.activeFtpConnections[userHash].connection,
          self.dbManager.getFileWriter(fileHash, function (err) {
            if (err) throw err
            self.activeFtpConnections[userHash].activeIncoming = false
            deferredFile.resolve()
          })
        )

        var def = deferred()
        self.activeRequests[requestId] = new RequestTracker(request, 1, def)
        def.promise.then((request) => {
          if (!request.getResult()[0].accepted) {
            deferredFile.reject(request.getResult()[0].error)
          } else {
            self.dbManager.storeMetadata(fileHash, request.getResult()[0].metadata)
          }
        },
          deferredFile.reject
        )
        self.sendRequestToUser(userHash, request)
      } else {
        let nrOfExpectedResponses = 0
        if (this.recentRequestIds.indexOf(request.getId()) > -1) {
          request.setResult([])
          return request.getDeferred().resolve(request)
        } else if (request.decrementTimeToLive() > 0) {
          nrOfExpectedResponses = this.sendRequestToAll(request)
          if (request.getRoute()[0] !== self.myId) nrOfExpectedResponses++
        }
        this.activeRequests[requestId] = new RequestTracker(request, nrOfExpectedResponses, request.getDeferred())
        this.recentRequestIds.push(requestId)
        setTimeout(() => self.recentRequestIds.shift(), 5 * 1000)
      }
      if (request.getRoute()[0] !== self.myId && request.getType() === 'query') {
        let activeRequest = this.activeRequests[requestId]
        self.dbManager.queryMetadata(request.getQuery()).then((queryResult) => {
          var response = {id: self.myId, result: queryResult}
          activeRequest.responses.push(response)
          activeRequest.incrementReceivedResponses()
          if (activeRequest.isDone()) {
            request.setResult(activeRequest.responses)
            request.getDeferred().resolve(request)
            delete self.activeRequests[requestId]
          }
        })
      } else if (request.getRoute()[0] !== self.myId && request.getType() === 'file') {
        self.dbManager.fileExists(request.getFile()).then(function (exists) {
          if (exists) {
            self.dbManager.getMetadata(request.getFile()).then((metadata) => {
              request.setResult([{accepted: true, metadata: metadata}])
              stream(
                self.dbManager.getFileReader(request.getFile()),
                self.activeFtpConnections[request.getRoute()[0]].connection
              )
              request.getDeferred().resolve(request)
              delete self.activeRequests[requestId]
            })
          } else {
            request.setResult([{accepted: false, error: 'file NOT found'}])
            request.getDeferred().resolve(request)
            delete self.activeRequests[requestId]
          }
        })
      }
    } else {
      let activeRequest = this.activeRequests[requestId]
      activeRequest.incrementReceivedResponses()
      request.getResult().forEach((elementInArray) => activeRequest.addResponse(elementInArray))
      if (activeRequest.isDone()) {
        request.setResult(activeRequest.responses)
        activeRequest.def.resolve(request)
        delete self.activeRequests[requestId]
      }
    }
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

  initQueryStream (connection) {
    var self = this
    var queryPusher = pullPushable()
    stream(
      queryPusher, // data pusher
      connection, // p2p connection
      pullDecode(), // convert uint8 to utf8
      stream.drain(self.queryTransferProtocolHandler.bind(self), // function called when data arrives
        (err) => {
          if (err) console.error(err)
          connection.getObservedAddrs(function (err, data) {
            if (err) console.error(err)
            var addr = data[0].toString().split('/')
            self.disconnectConnection(addr[addr.length - 1])
          })
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
    var self = this
    var parsedRequest = Request.createFromString(request)
    if (!parsedRequest.isResponse()) {
      parsedRequest.getDeferred().promise.then(function (processedRequest) {
        var myIndex = processedRequest.getRoute().indexOf(self.myId)
        self.activeQueryConnections[processedRequest.getRoute()[myIndex - 1]].push(processedRequest.serialize())
      })
    }
    this._EE.emit('IncomingRequest', parsedRequest)
  }

  disconnectConnection (userHash) {
    if (this.activeQueryConnections[userHash]) this.activeQueryConnections[userHash].end()
    // TODO: Remove this forceful disconnection code
    delete this.activeQueryConnections[userHash]
    delete this.node.swarm.muxedConns[userHash]
  }

  buildAndSendFileRequest (fileHash, userHash) {

  }
}
