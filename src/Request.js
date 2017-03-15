'use strict'

const defer = require('deferred')

class Request {
  constructor (type, hops) {
    this._type = type
    this._timeToLive = hops
    this._route = []
    this._result = undefined
    this._id = window.crypto.getRandomValues(new Uint32Array(1))[0]

    this._deferred = defer()
    this._expectedResponses = 0
    this._receivedResponses = 0
  }

  getDeferred () {
    return this._deferred
  }

  setResult (aResult) {
    this._timeToLive = 0
    this._result = aResult
  }

  isResponse () {
    return this._result !== undefined
  }

  decrementTimeToLive () {
    return --this._timeToLive
  }

  addToRoute (aUserHash) {
    this._route.push(aUserHash)
  }

  getRoute () {
    return this._route
  }

  isRequestOriginThisNode () {
    return this._route.length === 1
  }

  getId () {
    return this._id.toString()
  }

  getResult () {
    return this._result
  }

  getType () {
    return this._type
  }

  incrementReceivedResponses () {
    this._receivedResponses++
  }

  isDone () {
    return this._expectedResponses === this._receivedResponses
  }

  setExpectedResponses (anExpectedNrOfResponses) {
    this._expectedResponses = anExpectedNrOfResponses
  }

  toJSON () {
    let request = {}

    request.id = this._id
    request.type = this._type
    request.route = this._route
    request.TTL = this._timeToLive
    request.result = this._result

    return request
  }

  fromJSON (request) {
    this._id = request.id
    this._type = request.type
    this._route = request.route
    this._timeToLive = request.TTL
    this._result = request.result
  }
}

module.exports = Request
