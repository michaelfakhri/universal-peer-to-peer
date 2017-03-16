'use strict'

const Request = require('./Request')
const FileRequest = require('./FileRequest')
const QueryRequest = require('./QueryRequest')

module.exports.createFromString = function (requestStr) {
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

module.exports.isFile = function (request) {
  return request instanceof FileRequest
}

module.exports.isQuery = function (request) {
  return request instanceof QueryRequest
}
