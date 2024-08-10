import queryString from 'query-string'
import cloneDeep from 'clone-deep'
import { FetchPlus } from './type'
import { FetchPlusAbortError, FetchPlusTimeoutError, FetchPlusUnknownError } from './error'

const _maxMethodTextLength = 'delete'.length - 1
const _minMethodTextLength = 'get'.length - 1

function _transMethodAndUrl(config: FetchPlus.Config): {
	method: FetchPlus.Method
	url: string
} {
	const { url, prefix = '', pathParams, params, body } = config
	let method: FetchPlus.Method = 'get'
	let _url = prefix

	if (url[_minMethodTextLength] === ':') {
		method = url.substring(0, _minMethodTextLength) as FetchPlus.Method
		_url += url.substring(_minMethodTextLength + 1)
	} else {
		for (let i = _minMethodTextLength + 1; i < _maxMethodTextLength + 2; i++) {
			if (url[i] === ':') {
				method = url.substring(0, i) as FetchPlus.Method
				_url += url.substring(i + 1)
				break
			}
		}

		if (_url.length === prefix.length) {
			_url += url
		}
	}

	if (pathParams != null) {
		const urls = _url.split('/')
		for (let i = 1; i < urls.length; i++) {
			if (urls[i][0] === ':') {
				// TODO [urls[i]] 這段應該是錯的
				urls[i] = pathParams[urls[i].substring(1)] || [urls[i]]
			}
		}
		_url = urls.join('/')
	}

	if (params != null) {
		_url += `?${queryString.stringify(params)}`
	}

	return {
		method,
		url: _url,
	}
}

// TODO retry
// TODO 競態
const createFetchPlus = (options: FetchPlus.Options = {}): FetchPlus.Instance => {
	const interceptors = {
		useRequest: null as FetchPlus.InterceptorUseRequestCallback | null,
		useResponse: null as FetchPlus.InterceptorUseResponseCallback | null,
		useError: null as FetchPlus.InterceptorUseErrorCallback | null,
		useFinally: null as FetchPlus.InterceptorUseFinallyCallback | null,
	}
	const cacheMap = {} as FetchPlus.CacheMap
	const controllerMap = {} as FetchPlus.ControllerMap
	const repeatMarkMap = {} as FetchPlus.RepeatMarkMap
	let id = 0

	const fetchPlus = (async <R>(
		url: string,
		init?: FetchPlus.RequestInit,
		apiOptions: FetchPlus.ApiOptions = {},
	) => {
		const fetchId = ++id
		let timoutId: NodeJS.Timeout | undefined
		let mark: symbol | string | number | undefined

		return new Promise<{ __markResolve?: 1; response: FetchPlus.InterceptorResponse }>(
			async (resolve, reject) => {
				try {
					let config: FetchPlus.Config = {
						...options,
						...apiOptions,
						...init,
						url,
					}

					if (interceptors.useRequest) {
						config = interceptors.useRequest(config)
					}

					const { method: resultMethod, url: resultUrl } = _transMethodAndUrl(config)
					let res = {} as FetchPlus.InterceptorResponse
					let lastCacheTime = 0
					let mutateFunc: undefined | (<T>(data: any) => T)
					const cacheUrl = `${resultMethod}:${resultUrl}`

					mark = (
						config.mark === true ||
						(config.cacheTime != null && config.cacheTime > 0) ||
						(config.mark == null && resultMethod === 'get')
							? cacheUrl
							: config.mark === false
								? null
								: config.mark
					) as string | symbol | number

					config.signal = (controllerMap[fetchId] =
						apiOptions.controller || new AbortController()).signal

					if (config.timeout != null && config.timeout > 0) {
						timoutId = setTimeout(() => {
							if (controllerMap[fetchId] != null) {
								controllerMap[fetchId].abort()
							} else {
								reject(new FetchPlusTimeoutError(`fetch timeout ${config.timeout}ms`))
							}
						}, config.timeout)
					}

					if (mark != null) {
						if (repeatMarkMap[mark] != null) {
							repeatMarkMap[mark].push([resolve, reject])
						} else {
							repeatMarkMap[mark] = [[resolve, reject]]
						}

						if (repeatMarkMap[mark].length > 1) {
							return
						}
					}

					if (cacheMap[cacheUrl] == null) {
						if (config.cacheTime) {
							lastCacheTime = Date.now() + config.cacheTime
						}
					} else {
						if (config.mutate) {
							if (typeof config.mutate === 'function') {
								mutateFunc = config.mutate

								if (config.cacheTime) {
									cacheMap[cacheUrl].lastCacheTime = Date.now() + config.cacheTime
								}
							} else {
								delete cacheMap[cacheUrl]

								if (config.cacheTime) {
									lastCacheTime = Date.now() + config.cacheTime
								}
							}
						} else if (cacheMap[cacheUrl].lastCacheTime <= Date.now()) {
							delete cacheMap[cacheUrl]

							if (config.cacheTime) {
								lastCacheTime = Date.now() + config.cacheTime
							}
						}
					}

					if (cacheMap[cacheUrl] == null) {
						const fetchConfig: FetchPlus.Config & { method: FetchPlus.Method } = {
							method: resultMethod,
							...config,
						}

						try {
							let originRes = await fetch(resultUrl, fetchConfig)

							res = originRes as unknown as FetchPlus.InterceptorResponse

							if (lastCacheTime > 0) {
								cacheMap[cacheUrl] = {
									lastCacheTime,
									res,
								}
							}

							res.data = await res[config?.resType || 'json']()
						} catch (e) {
							if ((e as Error).name === 'AbortError') {
								throw new FetchPlusAbortError('fetch abort')
							}
						} finally {
							res.config = fetchConfig
						}
					} else {
						if (mutateFunc) {
							if (typeof cacheMap[cacheUrl].res === 'object') {
								mutateFunc(cacheMap[cacheUrl].res)
								res = cacheMap[cacheUrl].res
							} else {
								res = cacheMap[cacheUrl].res = mutateFunc(cacheMap[cacheUrl].res)
							}
						} else {
							if (typeof cacheMap[cacheUrl].res === 'object') {
								res = cloneDeep(cacheMap[cacheUrl].res)
							} else {
								res = cacheMap[cacheUrl].res
							}
						}
					}

					resolve({ response: res })
				} catch (err) {
					reject(
						err instanceof FetchPlusAbortError || err instanceof FetchPlusTimeoutError
							? err
							: err instanceof Error
								? FetchPlusUnknownError.clone(err)
								: new FetchPlusUnknownError((err as Error)?.message || 'unknown'),
					)
				}
			},
		)
			.then(response => {
				if (response.__markResolve === 1) return response.response

				let result = response.response as R

				if (interceptors.useResponse != null) {
					result = interceptors.useResponse(response.response)
				}

				if (mark != null && repeatMarkMap[mark] != null) {
					for (let i = 1; i < repeatMarkMap[mark].length; i++) {
						repeatMarkMap[mark][i][0]({
							__markResolve: 1,
							response: typeof result === 'object' ? cloneDeep(result) : result,
						})
					}

					delete repeatMarkMap[mark]
				}

				return result
			})
			.catch(error => {
				if (error.__markReject === 1) {
					if (error.__response != null) return error.__response
					throw error.__error
				}

				let result: any

				if (interceptors.useError != null) {
					result = interceptors.useError(error, {
						url,
						init: init || null,
						apiOptions: apiOptions || null,
					})
				}

				if (mark != null && repeatMarkMap[mark] != null) {
					for (let i = 1; i < repeatMarkMap[mark].length; i++) {
						repeatMarkMap[mark][i][1]({
							__markReject: 1,
							__response: typeof result === 'object' ? cloneDeep(result) : result,
							__error: error,
						})
					}

					delete repeatMarkMap[mark]
				}

				if (result != null) return result

				throw error
			})
			.finally(() => {
				if (timoutId != null) {
					clearTimeout(timoutId)
				}

				if (controllerMap[fetchId] != null) {
					delete controllerMap[fetchId]
				}

				if (interceptors.useFinally != null) {
					interceptors.useFinally()
				}
			})
	}) as FetchPlus.Instance

	fetchPlus.cancel = (controller: AbortController) => {
		controller.abort()
	}

	fetchPlus.cancelAll = () => {
		for (const fetchId in controllerMap) {
			controllerMap[fetchId].abort()
			delete controllerMap[fetchId]
		}
	}

	fetchPlus.interceptors = {
		request: {
			use: callback => {
				interceptors.useRequest = callback
			},
		},
		response: {
			use: callback => {
				interceptors.useResponse = callback
			},
		},
		error: {
			use: callback => {
				interceptors.useError = callback
			},
		},
		finally: {
			use: callback => {
				interceptors.useFinally = callback
			},
		},
	}

	return fetchPlus
}

export { createFetchPlus }
