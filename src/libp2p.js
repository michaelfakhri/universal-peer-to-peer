'use strict'

const WebRTCStar = require('libp2p-webrtc-star')
const spdy = require('libp2p-spdy')
const secio = require('libp2p-secio')
const libp2p = require('libp2p')

class Node extends libp2p {
  constructor (peerInfo, options) {
    let encryption
    const webRTCStar = new WebRTCStar()

    if (options.useEncryption) {
      encryption = [secio]
    } else {
      encryption = []
    }

    const modules = {
      transport: [
        webRTCStar
      ],
      connection: {
        muxer: [],
        crypto: encryption
      },
      discovery: []
    }

    super(modules, peerInfo, undefined, {})
  }
}

module.exports = Node
