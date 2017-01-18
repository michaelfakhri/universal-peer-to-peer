'use strict'

const stream = require('pull-stream')
const pullPushable = require('pull-pushable')
const pullDecode = require('pull-utf8-decoder')
const Request = require('./request')
const RequestTracker = require('./requestTracker')

const deferred = require('deferred')
module.exports = class RequestHandler {
  constructor (aDbManager, aNode) {
    this.MAXIMUM_QUERY_TIME_PRIMARY = 15
    this.MAXIMUM_QUERY_TIME_SECONDARY = 5
    this.MAXIMUM_FILE_REQUEST_TIME = 20
    this.MAXIMUM_QUERY_TIME_RECENT = 5

    this.dbManager = aDbManager
    this.myId = aNode.peerInfo.id.toB58String()
    this.activeQueryConnections = {}
    this.activeFtpConnections = {}
    this.activeRequests = []
    this.recentRequestIds = []
    this.node = aNode
  }

  buildAndSendQuery (query) {
    var self = this

    var queryToSend = Request.create(self.myId, 'query', query)
    var requestId = queryToSend.getId()
    var def = deferred()
    var nrOfExpectedResponses = self.sendRequestToAll(queryToSend)
    self.activeRequests[requestId] = new RequestTracker(queryToSend, nrOfExpectedResponses, def)
    setTimeout(function () {
      var timedOutQuery = self.activeRequests[requestId]
      // could have been resolved by the transfer protocol
      if (timedOutQuery) {
        def.resolve(timedOutQuery.originalRequest)
        delete self.activeRequests[requestId]
      }
    }, self.MAXIMUM_QUERY_TIME_PRIMARY * 1000)
    return def.promise.then((request) => request.getResult())
  }
  requestProcessor (nrOfExpectedResponses, request) {
    let self = this
    var requestId = request.getId()
    if (request.getType() === 'query') {
      var def = deferred()
      def.promise.then(function (processedRequest) {
        var myIndex = processedRequest.getRoute().indexOf(self.myId)
        if (self.activeQueryConnections[processedRequest.getRoute()[myIndex - 1]]) {
          self.activeQueryConnections[processedRequest.getRoute()[myIndex - 1]].push(processedRequest.serialize())
        }
      })
      var activeQuery = new RequestTracker(request, (nrOfExpectedResponses + 1), def)
      if (self.recentRequestIds.indexOf(request.getId()) > -1) {
        let result = activeQuery.originalRequest
        result.setResult([])
        return def.resolve(result)
      } else {
        self.activeRequests[requestId] = activeQuery
      }
      self.recentRequestIds.push(requestId)
      setTimeout(() => self.recentRequestIds.shift(), self.MAXIMUM_QUERY_TIME_RECENT * 1000)
      self.dbManager.queryMetadata(request.getQuery()).then((queryResult) => {
        var response = {id: self.myId, result: queryResult}
        activeQuery.responses.push(response)
        activeQuery.incrementReceivedResponses()
        if (activeQuery.isDone()) {
          let result = activeQuery.originalRequest
          result.setResult(activeQuery.responses)
          def.resolve(result)
        } else {
          setTimeout(function () {
            var timedOutQuery = self.activeRequests[requestId]
            // could have been resolved by the transfer protocol
            if (timedOutQuery) {
              var result = timedOutQuery.originalRequest
              result.setResult(timedOutQuery.responses)
              def.resolve(result)
              delete self.activeRequests[requestId]
            }
          }, self.MAXIMUM_QUERY_TIME_SECONDARY * 1000)
        }
      })
    } else {
      self.dbManager.fileExists(request.getFile()).then(function (exists) {
        if (exists) {
          self.dbManager.getMetadata(request.getFile()).then((metadata) => {
            request.setResult([{ accepted: true, metadata: metadata }])
            stream(
              self.dbManager.getFileReader(request.getFile()),
              self.activeFtpConnections[request.getRoute()[0]].connection
            )
          })
        } else {
          request.setResult([{ accepted: false, error: 'file NOT found' }])
        }
        self.activeQueryConnections[request.getRoute()[0]].push(request.serialize())
      })
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
        function (err) {
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
      // new query handling
      var expectedNumberOfResponses = 0
      parsedRequest.addToRoute(self.myId)
      if (parsedRequest.decrementTimeToLive() > 0 && !self.recentRequestIds.indexOf(parsedRequest.getId()) > -1) {
        expectedNumberOfResponses = this.sendRequestToAll(parsedRequest)
      }
      self.requestProcessor(expectedNumberOfResponses, parsedRequest)
    } else {
      var activeRequest = this.activeRequests[parsedRequest.getId()]
      activeRequest.incrementReceivedResponses()
      parsedRequest.getResult().forEach((elementInArray) => activeRequest.addResponse(elementInArray))
      if (activeRequest.isDone()) {
        activeRequest.originalRequest.setResult(activeRequest.responses)
        activeRequest.def.resolve(activeRequest.originalRequest)
        delete self.activeRequests[parsedRequest.getId()]
      }
    }
  }

  disconnectConnection (userHash) {
    if (this.activeQueryConnections[userHash]) this.activeQueryConnections[userHash].end()
    // TODO: Remove this forceful disconnection code
    delete this.activeQueryConnections[userHash]
    delete this.node.swarm.muxedConns[userHash]
  }

  buildAndSendFileRequest (fileHash, userHash) {
    var deferredFile = deferred()
    var self = this
    if (!self.activeFtpConnections[userHash] || !self.activeQueryConnections[userHash]) {
      throw new Error('user is not connected')
    }
    if (self.activeFtpConnections[userHash].activeIncoming) {
      throw new Error('There is a file currently being transferred')
    }
    self.activeFtpConnections[userHash].activeIncoming = true

    var ftpRequestToSend = Request.create(self.myId, 'file', {file: fileHash})
    var requestId = ftpRequestToSend.getId()
    stream(
      self.activeFtpConnections[userHash].connection,
      self.dbManager.getFileWriter(fileHash, function (err) {
        if (err) throw err
        self.activeFtpConnections[userHash].activeIncoming = false
        deferredFile.resolve()
      })
    )

    var def = deferred()
    self.activeRequests[requestId] = new RequestTracker(ftpRequestToSend, 1, def)
    def.promise.then((request) => {
      if (!request.getResult()[0].accepted) {
        deferredFile.reject(request.getResult()[0].error)
      } else {
        self.dbManager.storeMetadata(fileHash, request.getResult()[0].metadata)
      }
    },
      deferredFile.reject
    )
    self.sendRequestToUser(userHash, ftpRequestToSend)
    setTimeout(function () {
      def.reject('Request TIMED OUT')
      delete self.activeRequests[requestId]
    }, self.MAXIMUM_FILE_REQUEST_TIME * 1000)
    return deferredFile.promise
  }
}
