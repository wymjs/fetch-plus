@wymjs/fetch-plus
===

> 增強版 fetch (沒 bug 不再維護，建議使用 @wymjs/type-safe-fetch)

## 安裝

```shell
# clone-deep, query-string 為關聯依賴
$ pnpm i @wymjs/fetch-plus clone-deep query-string
```

## 使用

```typescript
// @/service/api-types/dog.ts
import { type TypeFetchPlus } from '@wymjs/fetch-plus'
import type { ApiResponse } from '@/service/fetch2'

// 使用 namespace 將每個 api 路徑的響應區分開來
export namespace Dog {
  export type Body = {
    pageSize: number
    pageNumber: number
  }
  
  // 定義 Response 時可以使用生成工具來處理，
  // 我是使用 Jetbrains 的 Json2ts 來生成
  // 將指標點到這裡後按下右鍵，生成的彈窗勾選 type
  // 然後 Root name 輸入 Response 後按下 generate 就可以生成好類型了
  export type Response = {
    urls: string[]
  }
}

// 使用 TypeFetchPlus.DefineApis 定義 api 路徑對應的響應與請求類型
export type Apis = TypeFetchPlus.DefineApis<{
  // key 為 api 路徑，規則為 {method}:{path}
  // vscode 使用重構可以替換所有用到這 key 的值(webstorm 本來也可以的QQ)
  'post:/api/dogs': {
    // 傳入的 body 類型(可選)
    body: Dog.Body
    // params, resType 同 body 那樣定義即可
    // ...
    
    // 響應類型，此為必填，用 ApiResponse 將 Response 包裹住
    // ApiResponse 為統一的 api 響應格式
    response: ApiResponse<Dog.Response>
  }
  
  // 動態路由參數，使用 : 連接即可，後續使用 pathParams 替換
  'post:/api/dog/:id': {
    // ...
  }
}>



// fetch2.ts
import { createFetchPlus, type TypeFetchPlus } from '@wymjs/fetch-plus'

// 攔截器傳入的響應類型
type ApiDataBase<D = null> = {
  success: boolean
  data: D
}

// 統一響應類型
type ApiResponse<Data = null> = {
  success: boolean
  data: ApiDataBase<Data> | null
}

// 將最終類型使用 TypeFetchPlus.Instance 覆蓋(也可以用原本的，但沒覆蓋的類型爽，所以原本的類型作法就不作為最佳實踐寫文檔了)
const fetch2 = createFetchPlus() as TypeFetchPlus.Instance<
  // 將定義的類型使用 import & 連接起來
  import('@/service/api-types/dog.ts').Apis &
  // cat 就不寫了，一個模子
  import('@/service/api-types/cat.ts').Apis
>

// request 攔截器
fetch2.interceptors.request.use(config => {
  // 這裡可以自行替換 config 後返回，比方說：
  ;(config.headers as Record<string, string>).token = 'test_token'
  
  return config
})

// response 攔截器
fetch2.interceptors.response.use<ApiDataBase, ApiResponse>(res => {
  // 比方說可以寫統一響應
  const response = {
    success: res.data?.success === true,
    data: res.data || null,
  }
  
  return response
})

// 錯誤攔截器：有寫錯誤攔截的話，除非攔截器內寫到報錯，
// 不然 fetch2() 執行後絕不會出現錯誤，就不用 try/catch 來包裹
fetch2.interceptors.error.use<ApiResponse>((error, userConfig) => {
  return {
    success: false,
    data: null,
  }
})

// 最後攔截器：當 response/error 攔截器都結束後觸發
fetch2.interceptors.finally.use(() => {
  // 寫你需要
})



// 使用
// 當你輸入一參路徑時你將會發現 IDE 彈出下拉列出所有路徑
fetch2('post:/api/dogs', {
  // body 類型傳錯將會報錯
  // 不過這個庫推斷不完全，一定要傳入二參才會較驗哈哈
  body: {
    pageSize: 10,
    pageNumber: 1,
  }
})

fetch2('post:/api/dog/:id', {
  // 動態路由參數這樣替換
  pathParams: { id: '1' },
})

fetch2('xxx', {
  // 除了以上可傳外還有
  // params 為網址參數 ?& 那個，會自動將物件轉成字串拼接
  params: {},
  // resType 為 api 響應類型
  // 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text'
  resType: 'arrayBuffer',
  // other 為 any 類型，可以當作自行擴展的參數，給 request 攔截器取用
  other: {},
})

// 高級用法
// 三參
fetch2(
  '', undefined,
  // 三參內的參數都是選填
  {
    // 傳入自訂的 AbortController
    controller: new AbortController(),
    // 緩存時間(ms 為單位)，當緩存時間內調用該接口將會從緩存取值而非 api 響應
    // 緩存規則是 api 路徑相同的數據
    cacheTime: 1000 * 60,
    // 與 cacheTime 相互使用：是否無視緩存強制執行或者若有緩存就更新緩存數據
    // mutate 傳入 true，強會重新拉取數據放到緩存
    // mutate: true,
    // mutate 傳入方法將可以直接替換緩存數據(res 是緩存數據)
    mutate: res => {
      // 返回值的話是取代該路徑的緩存數據
      // return res

      // 也可以返回 void 直接替換對應 key 的數據
      res.xxx = xxx
    },
    // 用於處理重複請求的標記，如果路徑相同且標記一致只會發起一次請求，
    // 可傳入的類型有以下
    // symbol | string | number | boolean
    mark: Symbol(),
  })
```
