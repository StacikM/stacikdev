(function(global){
  const DEFAULT_FALLBACK = "ohno.html"
  const STORAGE_KEYS = {
    message: "crash_message",
    source: "crash_source",
    retry: "crash_retry"
  }

  function safeString(value, fallback){
    if(value == null || value === "") return fallback || ""
    if(typeof value === "string") return value
    if(value instanceof Error){
      return [value.name, value.message].filter(Boolean).join(": ")
    }
    try{
      return JSON.stringify(value)
    }catch(_err){
      return String(value)
    }
  }

  function getCurrentPage(){
    const path = global.location && global.location.pathname ? global.location.pathname : ""
    return path.split("/").pop() || "index.html"
  }

  function buildFallbackUrl(fallbackPage, payload){
    const url = new URL(fallbackPage || DEFAULT_FALLBACK, global.location.href)
    if(payload.message) url.searchParams.set("message", payload.message)
    if(payload.source) url.searchParams.set("source", payload.source)
    if(payload.retry) url.searchParams.set("retry", payload.retry)
    return url.toString()
  }

  function persistPayload(payload){
    try{
      sessionStorage.setItem(STORAGE_KEYS.message, payload.message || "")
      sessionStorage.setItem(STORAGE_KEYS.source, payload.source || "")
      sessionStorage.setItem(STORAGE_KEYS.retry, payload.retry || "")
    }catch(_err){
      return false
    }
    return true
  }

  function normalizePayload(input, options){
    const opts = options || {}
    const message = safeString(input, "Unknown crash")
    const source = safeString(opts.source, "Triggered by crash.js")
    const retry = safeString(opts.retry, getCurrentPage())
    const fallbackPage = safeString(opts.fallbackPage, DEFAULT_FALLBACK)
    return { message, source, retry, fallbackPage }
  }

  function triggerCrash(input, options){
    const payload = normalizePayload(input, options)
    persistPayload(payload)
    global.location.href = buildFallbackUrl(payload.fallbackPage, payload)
  }

  function installGlobalHandler(options){
    const opts = options || {}
    const fallbackPage = safeString(opts.fallbackPage, DEFAULT_FALLBACK)
    const retry = safeString(opts.retry, getCurrentPage())

    global.addEventListener("error", function(event){
      triggerCrash(event.error || event.message || "Unhandled error", {
        fallbackPage,
        retry,
        source: safeString(event.filename, "window.error")
      })
    })

    global.addEventListener("unhandledrejection", function(event){
      triggerCrash(event.reason || "Unhandled promise rejection", {
        fallbackPage,
        retry,
        source: "unhandledrejection"
      })
    })
  }

  global.triggerCrashFallback = triggerCrash
  global.CTKCrash = {
    trigger: triggerCrash,
    installGlobalHandler
  }
})(window)
