class _FetchPlusBaseError extends Error {
	static clone(err: Error) {
		const self = new this()
		self.message = err.message
		self.name = this.name
		self.stack = err.stack
		return self
	}
}

class FetchPlusAbortError extends _FetchPlusBaseError {}

class FetchPlusTimeoutError extends _FetchPlusBaseError {}

class FetchPlusUnknownError extends _FetchPlusBaseError {}

export { FetchPlusAbortError, FetchPlusTimeoutError, FetchPlusUnknownError }
