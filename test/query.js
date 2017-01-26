/* eslint-env mocha */
'use strict'
const Logger = require('logplease')
const assert = require('chai').assert
const PeerId = require('peer-id')
const UP2P = require('../src/index')
const MockMetadataHandler = require('./mockMetadataHandler')

Logger.setLogLevel(Logger.LogLevels.ERROR)

let peers = []

describe('Query propagation across nodes', () => {
  let nrOfNodes = 3
  beforeEach((done) => {
    var count = 0
    var incrementDoneCount = () => ++count === nrOfNodes ? done() : undefined
    for (var i = 0; i < nrOfNodes; i++) {
      PeerId.create((err, id) => { // eslint-disable-line no-loop-func
        if (err) throw err
        let peer = new UP2P(new MockMetadataHandler())
        peers.push({id: id.toB58String(), peer: peer})
        peer.start(id)
          .then(incrementDoneCount)
      })
    }
  })

  afterEach((done) => {
    var count = 0
    var incrementDoneCount = () => ++count === nrOfNodes ? done() : undefined
    peers.forEach((peer) => {
      peer.peer.stop()
      .then(incrementDoneCount)
    })
    peers.splice(0, peers.length)
  })

  it('query between two nodes ', (done) => {
    peers[0].peer.connect(peers[1].id)
      .then(() => peers[0].peer.query('{}'))
      .then((result) => assert.sameDeepMembers(parseQueryResult(result), [peers[1].id]))
      .then(() => peers[0].peer.disconnect(peers[1].id))
      .then(done)
  })
  it('query between three nodes', (done) => {
    peers[0].peer.connect(peers[1].id)
      .then(() => peers[1].peer.connect(peers[2].id))
      .then(() => peers[0].peer.query('{}'))
      .then((result) => assert.sameDeepMembers(parseQueryResult(result), [peers[1].id, peers[2].id]))
      .then(() => peers[0].peer.disconnect(peers[1].id))
      .then(() => peers[2].peer.disconnect(peers[1].id))
      .then(done)
  })
  it('query between three nodes with overlap', (done) => {
    peers[0].peer.connect(peers[1].id)
      .then(() => peers[0].peer.connect(peers[2].id))
      .then(() => peers[1].peer.connect(peers[2].id))
      .then(() => peers[0].peer.query('{}'))
      .then((result) => assert.sameDeepMembers(parseQueryResult(result), [peers[1].id, peers[2].id]))
      .then(() => peers[0].peer.disconnect(peers[1].id))
      .then(() => peers[0].peer.disconnect(peers[2].id))
      .then(() => peers[1].peer.disconnect(peers[2].id))
      .then(done)
  })

  function parseQueryResult (responses) {
    return responses.map((response) => response.id)
  }
})
