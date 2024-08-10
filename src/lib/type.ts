import { FetchPlusCompeteEnum } from './compete-enum'
import { FetchPlusAbortError, FetchPlusTimeoutError, FetchPlusUnknownError } from './error'

type FetchRequestInit = RequestInit

namespace FetchPlus {
	export type Options = {
		// 路由前綴
		prefix?: string
		// 就timeout(毫秒)
		timeout?: number
		// 重複次數 TODO
		retry?: number
		// 競態 TODO
		compete?: FetchPlusCompeteEnum
	}

	export type ApiOptions<Res = any> = Options & {
		// 取消控制器
		controller?: AbortController
		// 緩存時間(毫秒)
		cacheTime?: number
		// 是否無視緩存強制執行或者若有緩存就更新緩存數據
		mutate?: boolean | ((res: Res) => Res extends {} | [] ? void : Res)
		// 用於處理重複請求的標記，如果路徑相同且標記一致只會發起一次請求
		mark?: Mark
	}

	export type Mark = symbol | string | number | boolean

	export type Method = 'get' | 'post' | 'put' | 'delete'

	export type FetchErrors = FetchPlusAbortError | FetchPlusTimeoutError | FetchPlusUnknownError

	export type RequestInit<Url extends string = ''> = Omit<
		FetchRequestInit,
		'method'
	> & {
		params?: Record<string, any>
		resType?: ResType
		other?: any // 用戶自行決定的資料
	} & PathParams<Url>

	export type PathParams<Url extends string> = UrlPathParams<Url> extends undefined
		? {
				pathParams?: undefined
		  }
		: {
				pathParams: UrlPathParams<Url>
		  }

	export type UrlPathParams<
		Url extends string,
		Params extends string[] = [],
	> = Url extends `${infer B}/:${infer P}/${infer R}`
		? UrlPathParams<R, [...Params, P]>
		: Url extends `${infer B}/:${infer P}`
		  ? Record<[...Params, P][number], string>
		  : Params['length'] extends 0
		    ? undefined
		    : Record<Params[number], string>

	export type ResType = 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text'

	export type CacheMap = Record<string, { lastCacheTime: number; res: InterceptorResponse }>

	export type RepeatMarkMap = Record<
		symbol | string | number,
		[(arg: any) => void, (arg: any) => any][]
	>

	export type ControllerMap = Record<number, AbortController>

	export type InterceptorUseRequestCallback = (config: Config) => Config

	export type InterceptorUseRequest = (callback: InterceptorUseRequestCallback) => void

	export type InterceptorUseResponseCallback<R1 = any, R2 = any> = (
		res: InterceptorResponse<R1>,
	) => R2

	export type InterceptorUseResponse = <R1 = any, R2 = any>(
		callback: InterceptorUseResponseCallback<R1, R2>,
	) => void

	export type InterceptorUseErrorCallback<R = any> = (
		error: FetchErrors,
		userConfig: {
			url: string
			init: RequestInit | null
			apiOptions: ApiOptions | null
		},
	) => R

	export type InterceptorUseError = <R = any>(callback: InterceptorUseErrorCallback<R>) => void

	export type InterceptorUseFinallyCallback = () => void

	export type InterceptorUseFinally = (callback: InterceptorUseFinallyCallback) => void

	export type InterceptorResponse<Data = any> = Response & {
		data: Data | undefined
		config: Config & { method: FetchPlus.Method }
	}

	export type Config = RequestInit &
		ApiOptions & {
			url: string
		}

	export type InstanceFunc = {
		cancel: (controller: AbortController) => void
		cancelAll: () => void
		interceptors: {
			request: { use: InterceptorUseRequest }
			response: { use: InterceptorUseResponse }
			error: { use: InterceptorUseError }
			finally: { use: InterceptorUseFinally }
		}
	}

	export type Instance = {
		<R = InterceptorResponse, Url extends string = ''>(
			url: Url,
			init?: RequestInit<Url>,
			options?: ApiOptions<R>,
		): Promise<R>
	} & InstanceFunc
}

namespace TypeFetchPlus {
	export type Api = {
		response: any
		body?: string | FormData | Record<string, any>
		params?: FetchPlus.RequestInit['params']
		resType?: FetchPlus.RequestInit['resType']
	}

	export type Response<
		Apis extends Record<string, Api>,
		Url extends keyof Apis,
	> = Apis[Url] extends { response: infer Data } ? Data : undefined

	export type InitBody<
		Apis extends Record<string, Api>,
		Url extends keyof Apis,
	> = Apis[Url] extends { body: infer Body } ? { body: Body } : {}

	export type InitParams<
		Apis extends Record<string, Api>,
		Url extends keyof Apis,
	> = Apis[Url] extends { params: infer Params } ? { params: Params } : {}

	export type InitResType<
		Apis extends Record<string, Api>,
		Url extends keyof Apis,
	> = Apis[Url] extends { resType: infer ResType } ? { resType: ResType } : {}

	export type Init<Apis extends Record<string, Api>, Url extends keyof Apis> = Omit<
		FetchPlus.RequestInit<Url & string>,
		'body' | 'params' | 'resType'
	> &
		InitBody<Apis, Url> &
		InitParams<Apis, Url> &
		InitResType<Apis, Url>

	export type Options<Res = any> = Omit<FetchPlus.ApiOptions<Res>, 'controller'>

	export type DefineApis<T extends Record<string, Api>> = T

	export type Instance<Apis extends Record<string, Api>> = FetchPlus.InstanceFunc & {
		<Url extends keyof Apis>(
			url: Url,
			init?: Init<Apis, Url>,
			options?: Options<Response<Apis, Url>>,
		): Promise<Response<Apis, Url>>
	}
}

export type { FetchPlus, TypeFetchPlus }
