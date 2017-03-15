
const Request = require('./Request')
const FileRequest = require('./FileRequest')
const QueryRequest = require('./QueryRequest')

class RequestFactory {
  constructor () {
  }
}

RequestFactory.createFromString = function (requestStr) {
  let requestJSON = JSON.parse(requestStr)

  let request = new Request()
  request.fromJSON(requestJSON)

  if (request.getType() === 'file') {
    let fileRequest = new FileRequest()
    fileRequest.fromJSON(requestJSON)

    return fileRequest
  } else if (request.getType() === 'query') {
    let queryRequest = new QueryRequest()
    queryRequest.fromJSON(requestJSON)

    return queryRequest
  }
}

RequestFactory.isFile = function (request) {
  return request instanceof FileRequest
}

RequestFactory.isQuery = function (request) {
  return request instanceof QueryRequest
}

module.exports = RequestFactory
