/* eslint-env mocha */
'use strict'
const Logger = require('logplease')
const assert = require('chai').assert
const UP2P = require('../src/index')
const MockMetadataHandler = require('./mockMetadataHandler')

Logger.setLogLevel(Logger.LogLevels.ERROR)

describe('Config storage', () => {
  it('check persistent config storage', (done) => {
    let peer1, peer2
    let config1, config2

    peer1 = new UP2P(new MockMetadataHandler())
    peer1.start()
      .then(() => peer1._db.getConfig())
      .then((config) => { config1 = config })
      .then(() => { peer2 = new UP2P(new MockMetadataHandler()) })
      .then(() => peer2.start())
      .then(() => peer2._db.getConfig())
      .then((config) => { config2 = config })
      .then(() => assert.deepEqual(config1, config2))
      .then(done)
      .catch((err) => console.error(err.stack))
  })
})
