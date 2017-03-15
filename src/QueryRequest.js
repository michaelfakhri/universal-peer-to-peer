
const Request = require('./Request')

class QueryRequest extends Request {
  constructor (query, hops) {
    super('query', hops + 1)  // +1 for resolving of query done by this user

    this._query = query

    this._responses = []
  }

  getQuery () {
    return this._query
  }

  resolve (origin, queryResult) {
    super.setResult([{id: origin, hops: (super.getRoute().length - 1), queryResult: queryResult}])
  }

  addResponse (aResponse) {
    this._responses.push(aResponse)
  }

  getResponses () {
    return this._responses
  }

  toJSON () {
    let request = super.toJSON()
    request.query = this._query
    return request
  }

  fromJSON (request) {
    super.fromJSON(request)
    this._query = request.query
  }
}

module.exports = QueryRequest
