'use strict'

const defer = require('deferred')

const MAXIMUM_TIME_TO_LIVE_QUERY = 5
const MAXIMUM_TIME_TO_LIVE_FTP = 1

class Request {
  constructor (aRequest, target) {
    this._request = aRequest
    this._deferred = defer()
    this._target = target
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
