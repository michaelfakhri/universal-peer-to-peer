'use strict'

const defer = require('deferred')

const MAXIMUM_TIME_TO_LIVE_QUERY = 5
const MAXIMUM_TIME_TO_LIVE_FTP = 1

class Request {
  constructor (aRequest, target) {
    this._request = aRequest
    this._deferred = defer()
    this._target = target
    this._connection
    this.expectedResponses = 0
    this.receivedResponses = 0
    this.responses = []
  }

  getDeferred () {
    return this._deferred
  }

  getTarget () {
    return this._target
  }

  setResult (aResult) {
    this._request.isResponse = true
    this._request.timeToLive = 0
    this._request.result = aResult
  }
  isResponse () {
    return this._request.isResponse
  }
  decrementTimeToLive () {
    return --this._request.timeToLive
  }
  addToRoute (aUserHash) {
    this._request.route.push(aUserHash)
  }

  getRoute () {
    return this._request.route
  }

  isRequestOriginThisNode () {
    return this._request.route.length === 1
  }

  getId () {
    return this._request.id.toString()
  }
  getResult () {
    return this._request.result
  }
  getFile () {
    return this._request.request.file
  }
  getQuery () {
    return this._request.request
  }
  isAccepted () {
    return this._request.result.accepted
  }
  serialize () {
    return JSON.stringify(this._request)
  }
  getType () {
    return this._request.type
  }

  isFile () {
    return this.getType() === 'file'
  }

  isQuery () {
    return this.getType() === 'query'
  }

  attachConnection (connection) {
    this._connection = connection
  }

  getConnection () {
    return this._connection
  }

  addResponse (aResponse) {
    this.responses.push(aResponse)
  }
  getResponses () {
    return this.responses
  }
  incrementReceivedResponses () {
    this.receivedResponses++
  }
  isDone () {
    return this.expectedResponses === this.receivedResponses
  }
  setExpectedResponses (anExpectedNrOfResponses) {
    this.expectedResponses = anExpectedNrOfResponses
  }
}

module.exports = Request

Request.create = function (type, aRequest, target) {
  let request = {}
  request.request = aRequest
  request.type = type
  if (type === 'query') {
    request.timeToLive = MAXIMUM_TIME_TO_LIVE_QUERY
  } else if (type === 'file') {
    request.timeToLive = MAXIMUM_TIME_TO_LIVE_FTP
  }
  request.id = window.crypto.getRandomValues(new Uint32Array(1))[0]
  request.response = false
  request.route = []
  request.isResponse = false
  request.result = undefined

  return new Request(request, target)
}

Request.createFromString = function (aReqStr) {
  return new Request(JSON.parse(aReqStr))
}
