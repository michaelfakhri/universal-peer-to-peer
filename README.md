<h1 align="center">UP2P in the browser</h1>
## API
<h3>constructor(fileMetadataHandler, [PeerId])</h3>
returns an instance of this module.
<h3>start()</h3>
returns a promise that resolves when network layer (libp2p) and storage are setup and started.
<h3>stop()</h3>
returns a promise that resolves when network layer (libp2p) is stopped.
<h3>connect(user)</h3>
returns a promise that resolves when peer is connected.
<h3>disconnect(user)</h3>
returns a promise that resolves when peer is disconnected.
<h3>Publish(data, metadata)</h3>
returns promise that resolves to the hash of the data once the data is stored and also stores the metadata.
<h3>delete(hash)</h3>
returns a promise that resolves when data is deleted.
<h3>copy(hash, user)</h3>
returns a promise that resolves when data is downloaded.
<h3>view(hash)</h3>
returns a promise that resolves to the data stored.
<h3>query(queryString)</h3>
returns promise that resolves when query responses are received.
<h3>queryLocal(queryString)</h3>
returns promise that resolves when query responses of the local database are retreived.
