/* eslint-env mocha */
'use strict'
const Logger = require('logplease')
const assert = require('chai').assert
const UP2P = require('../src/index')
const MockMetadataHandler = require('./mockMetadataHandler')

Logger.setLogLevel(Logger.LogLevels.ERROR)

describe('Config storage in db', () => {
  it('check configs', (done) => {
    let peer1, peer2
    let config1, config2

    new UP2P(new MockMetadataHandler())
      .then((peer) => { peer1 = peer })
      .then(() => peer1._connectionHandler._db.getConfig())
      .then((config) => { config1 = config })
      .then(() => new UP2P(new MockMetadataHandler()))
      .then((peer) => { peer2 = peer })
      .then(() => peer2._connectionHandler._db.getConfig())
      .then((config) => { config2 = config })
      .then(() => assert.deepEqual(config1, config2)) // they equal each other since they share the same storage medium
      .then(done)
  })
})
