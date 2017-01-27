'use strict'
class RequestTracker {
  constructor (anOriginalRequest, expectedResponses, deferredObject) {
    this.originalRequest = anOriginalRequest
    this.expectedResponses = expectedResponses
    this.receivedResponses = 0
    this.def = deferredObject
    this.responses = []

    this.resolve = this.def.resolve
    this.reject = this.def.reject
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
}
module.exports = RequestTracker
