'use strict'

const Request = require('./Request')

const NR_OF_HOPS_FILE = 1

const FILE_TYPE = 'file'

class FileRequest extends Request {
  constructor (file, target) {
    super(FILE_TYPE, NR_OF_HOPS_FILE + 1) // 1 for target user and +1 for processing by this user

    this._file = file
    this._target = target
    this._connection
  }

  getFile () {
    return this._file
  }

  getTarget () {
    return this._target
  }

  attachConnection (connection) {
    this._connection = connection
  }

  getConnection () {
    return this._connection
  }

  accept (metadata) {
    super.setResult({ accepted: true, metadata: metadata })
  }

  reject (error) {
    super.setResult({ accepted: false, error: error })
  }

  isAccepted () {
    return super.getResult().accepted
  }

  getMetadata () {
    return super.getResult().metadata
  }

  getError () {
    return super.getResult().error
  }

  toJSON () {
    let request = super.toJSON()
    request.file = this._file
    return request
  }

  fromJSON (request) {
    super.fromJSON(request)
    this._file = request.file
  }
}

module.exports = FileRequest
module.exports.FILE_TYPE = FILE_TYPE
