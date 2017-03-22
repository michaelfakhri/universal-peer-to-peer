<h1 align="center">DS2</h1>

[![Greenkeeper badge](https://badges.greenkeeper.io/michaelfakhri/ds2.svg)](https://greenkeeper.io/)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)
![](https://img.shields.io/badge/npm-%3E%3D%203.0.0-orange.svg?style=flat-square)
![](https://img.shields.io/badge/Node.js-%3E%3D%204.0.0-orange.svg?style=flat-square)
# Description
This module represents a node in a peer-to-peer network. It is capable of establishing connections to other peers, storing files and their metadata (information about the file), copying files from connected peers and querying the files in the connected network that are at a distance of n hops away.
Connections to peers are established using  WebRTC using the libp2p networking stack.
This module was designed mainly for browser operation but could be extended for Node.js operation in the future.
## Network model
There is no peer-discovery mechanism. Peers are expected to exchange identities in any suitable communication medium. This offers maximum control over who you connect to and who is connected to you.
Querying is done through flooding of the network through your connected peers in a similar fashion to early Gnutella protocol versions.
The network model and API are derived from work on the (DS)<sup>2</sup> thesis by Alan Davoust which can be found [here](http://sce.carleton.ca/~adavoust/A_Davoust_PhD_Thesis_2015.pdf).
### API
The API is documented [here](API.md)
### Usage
This library is available through the following sources:
* npm registry `ds2`
* UNPKG `https://unpkg.com/ds2/dist/index.min.js`
### Examples
```javascript

// Create a new instance and start it
// MetadataHandler is a metadata storage class that implements MetadataHandler interface.
let node = new DS2(new MetadataHandler())
node.start()
.then(() => {
  // Node has started
})

// After node is started, you can connect to node known as ‘QmUserID’
node.connect(‘QmUserID’)
.then(() => {
  // User is connected
})
.catch((err) => {
  // Operation failed with error err
})

// After node is started, you can publish a file with contents=fileContents of type ArrayBuffer and with metadata={fileMetadata: ‘this is some metadata’}. The ArrayBuffer is usually created using a FileReader invoking readAsArrayBuffer method on a File Object obtained from a HTML5 submitted form.
node.publish(fileContents : ArrayBuffer, {fileMetadata: ‘this is some metadata’})
.then((fileHash) => {
  // Do something with hash of file contents
})
.catch((err) => {
  // operation failed with error err
})

```
### Development prerequisites
Have Node.js >= 4.00 and npm >= 3.0.0 installed on your machine.
### Install
`npm install`
### Test
`npm test`
### Lint
`npm run lint`
