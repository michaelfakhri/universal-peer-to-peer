'use strict'

const Request = require('./Request')
const FileRequest = require('./FileRequest')
const QueryRequest = require('./QueryRequest')

module.exports.getRequest = function () {

}

module.exports.getRequestFromStringJSON = function (requestStr) {
  let requestJSON = JSON.parse(requestStr)

  let request = new Request()
  request.fromJSON(requestJSON)
  if (request.getType() === FileRequest.FILE_TYPE) {
    let fileRequest = new FileRequest()
    fileRequest.fromJSON(requestJSON)

    return fileRequest
  } else if (request.getType() === QueryRequest.QUERY_TYPE) {
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
