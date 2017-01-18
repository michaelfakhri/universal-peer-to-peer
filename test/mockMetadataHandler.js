'use strict'

const deferred = require('deferred')

module.exports = class MetadataHandler {

  constructor () {
    this.storage = {}
  }
  store (fileHash, metadata) {
    this.storage[fileHash] = metadata
    let d = deferred()
    setTimeout(() => d.resolve(), 1000)
    return d.promise
  }
  get (fileHash) {
    return deferred(this.storage[fileHash])
  }
  query (aQueryStr) {
    if (this.storage[aQueryStr]) return deferred(this.storage[aQueryStr])
    else return deferred(undefined)
  }
}

