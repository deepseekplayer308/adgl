var resultsPerPage = 25,
	maxPages = 100,
	baseReconnectDelayMs = 100,
	maxReconnectDelayMs = 3E4,
	enableSuggest = !1,
	enableInstantSearch = 1,
	page = document.getElementById("page"),
	current = document.getElementById("current"),
	searchInfo = document.getElementById("search-info"),
	pagination = document.getElementById("pagination"),
	scrollIndicator = document.getElementById("scroll-indicator"),
	incomingCount = document.getElementById("incoming-count"),
	searchForm = document.getElementById("search-form"),
	searchInput = document.getElementById("search-input"),
	homeLink = document.getElementById("home-link"),
	connectionIndicator = document.getElementById("connection-indicator"),
	notificationButton = document.getElementById("notification-button"),
	translateButton = document.getElementById("translate-button"),
	audioContext,
	notificationSoundBuffer,
	socket,
	reconnectDelayMs = baseReconnectDelayMs,
	reconnectTimer,
	isFirstReflow = !0,
	scrolledDown = !1,
	scrolling = !1,
	pendingRequest = null,
	xhr = null,
	results = [],
	incomingResults = [],
	incomingResultCount = 0,
	追踪项 = [],
	近期广告 = [],
	静音时间 = 5,
	网址 = new RegExp("^https\:\/\/deepseekplayer308\.github\.io\/" + encodeURIComponent("ad") + "(\\?{0,1}.*?)$", "i")

var animationEnd = 0,
	animationLengthMs = 500,
	animationRunning = !1,
	animationFrameRequest

var scrollAnimationEnd = 0,
	scrollAnimationLengthMs, scrollStartY, scrollEndY

function humanReadableDurationEn(a, b) {
	for (var c = Math.abs(b - a), d = [{
			unit: "minute",
			article: "a",
			ms: 6E4
		}, {
			unit: "hour",
			article: "an",
			ms: 36E5
		}, {
			unit: "day",
			article: "a",
			ms: 864E5
		}, {
			unit: "week",
			article: "a",
			ms: 6048E5
		}, {
			unit: "month",
			article: "a",
			ms: 2629746E3
		}, {
			unit: "year",
			article: "a",
			ms: 31556952E3
		}], e = null, f = 0; f < d.length && !(c < d[f].ms); ++f)
		e = d[f];
	return e ? (c = Math.floor(c / e.ms),
		1 < c ? c + " " + e.unit + "s" : e.article + " " + e.unit) : "a few seconds"
}

function humanReadableDuration(a, b) {
	for (var c = Math.abs(b - a), d = [{
			unit: "分 钟 ",
			article: "1 ",
			ms: 6E4
		}, {
			unit: "小 时 ",
			article: "1 ",
			ms: 36E5
		}, {
			unit: "天 ",
			article: "1 ",
			ms: 864E5
		}, {
			unit: "周 ",
			article: "1 ",
			ms: 6048E5
		}, {
			unit: "个 月 ",
			article: "1 ",
			ms: 2629746E3
		}, {
			unit: "年 ",
			article: "1 ",
			ms: 31556952E3
		}], e = null, f = 0; f < d.length && !(c < d[f].ms); ++f)
		e = d[f]
	return e ? (c = Math.floor(c / e.ms),
		1 < c ? c + " " + e.unit + "" : e.article + " " + e.unit) : "几 秒 "
}

function humanReadableAge(a, b) {
	"undefined" === typeof b && (b = (new Date).valueOf())
	if (translateButton.classList.contains("字母版")) {
		return humanReadableDurationEn(a > b ? b : a, b) + " ago"
	} else {
		return humanReadableDuration(a > b ? b : a, b) + "前"
	}
}

function clearResults() {
	results = []
	for (clearIncomingResults(); current.hasChildNodes();)
		current.removeChild(current.lastChild)
	current.classList.remove("animate-fade-out")
}

function addResult(a) {
	current.insertAdjacentHTML("afterbegin", formatResult(a))
	a.domNode = current.firstChild
	a.ageDomNode = a.domNode.getElementsByClassName("age")[0]
	a.deleted = !1
	results.push(a)
}

function populateResultsFromDom() {
	for (var a = current.childNodes, b = a.length - 1; 0 <= b; --b) {
		var c = a[b],
			c = {
				domNode: c,
				deleted: !1,
				ageDomNode: c.getElementsByClassName("age")[0],
				y: 0,
				timestamp: parseInt(c.getAttribute("data-timestamp"), 10),
				id: parseInt(c.getAttribute("data-id"), 10),
				name: c.getElementsByClassName("name")[0].innerText,
				message: c.getElementsByClassName("message")[0].innerText
			}
		results.push(c)
	}
}

function htmlEscape(a) {
	return document.createElement("div").appendChild(document.createTextNode(a)).parentNode.innerHTML.replace(/"/g, "&quot;")
}

function formatResult(a) {
	var b = htmlEscape(a.name),
		c = humanReadableAge(1E3 * a.timestamp)
	a = htmlEscape(a.message)
	a = parseTranslate(a) //New: Need to make sure translation do not break syntax	
	return "<tr class=\"row\"><td class=\"info\"><div class=\"name\">" + b + "</div><div class=\"age\">" + c + "</div></td><td class=\"message\">" + a + "</td><td class=\"delete\"></td></tr>"
}

function shouldAnimate() {
	return !0 !== document.hidden
}

function placeNewResults() {
	var a = 0,
		b
	for (b = results.length - 1; 0 <= b; --b) {
		var c = results[b]
		if ("undefined" !== typeof c.height) {
			a = c.y
			break
		}
	}
	for (b += 1; b < results.length; ++b)
		c = results[b],
		c.height = c.domNode.getBoundingClientRect().height,
		c.y = a - c.height,
		a = c.y
}

function computeTargetLayout() {
	for (var a = 0, b = results.length - 1; 0 <= b; --b) {
		var c = results[b]
		c.deleted && (c.domNode.style.zIndex = -1)
		c.oldY = c.y
		c.targetY = a
		c.deleted && (c.targetY -= c.height)
		a += c.deleted ? 0 : c.height
	}
	return a
}

function measureResults() {
	for (var a = 0; a < results.length; ++a) {
		var b = results[a]
		b.height = b.domNode.getBoundingClientRect().height
	}
}

function deleteOldResults() {
	for (var a = 0, b = results.length - 1; 0 <= b; --b) {
		var c = results[b]
		a > resultsPerPage ? c.deleted = !0 : c.deleted || ++a
	}
}

function reflowResults(a) {
	deleteOldResults()
	var b = computeTargetLayout()
	current.parentNode.style.height = b + "px"
	startAnimateResults(a ? animationLengthMs : 0)
}

function startAnimateResults(a) {
	animationEnd = (new Date).getTime() + a
	0 == a ? (animationRunning && window.cancelAnimationFrame(animationFrameRequest),
		animateResults()) : animationRunning || (animationRunning = !0,
		animationFrameRequest = window.requestAnimationFrame(animateResults))
}

function animateResults() {
	for (var a = (new Date).getTime(), a = a > animationEnd ? 1 : 1 - (animationEnd - a) / animationLengthMs, b = 1, c = results.length - 1; 0 <= c; --c) {
		var d = results[c],
			e = d.domNode
		d.y = a * d.targetY + (1 - a) * d.oldY
		e.style.transform = "translate3d(0, " + d.y + "px, 0)"
		//e.style.position = "absolute"
		//e.style.left = 0 + "px"
		//e.style.top = d.y +"px"
		d.deleted ? (b = 1 - (b - d.y) / d.height,
			e.style.opacity = b,
			0 == b && (current.removeChild(e),
				results.splice(c, 1))) : 1 >= d.oldY && (e.style.opacity = Math.min(1, 1 + d.y / d.height))
		b = d.y + d.height
	}
	1 > a ? animationFrameRequest = window.requestAnimationFrame(animateResults) : animationRunning = !1
}

function toggleScrollIndicator(a) {
	a ? scrollIndicator.classList.add("scroll-indicator-visible") : scrollIndicator.classList.remove("scroll-indicator-visible")
	a && (incomingCount.innerText = incomingResultCount)
}

function findDuplicates(a, b) {
	var c = []
	for (i = b.length - 1; 0 <= i; --i) {
		var d = b[i]
		a.name == d.name && a.message == d.message && c.push(d)
	}
	return c
}

function addIncomingResult(a) {
	incomingResults.push(a)
	trimIncomingResultsAmortized()
		++incomingResultCount
}

function clearIncomingResults() {
	incomingResults = []
	incomingResultCount = 0
}

function trimIncomingResults() {
	incomingResults.length > resultsPerPage && (incomingResults = incomingResults.slice(-resultsPerPage))
}

function trimIncomingResultsAmortized() {
	incomingResults.length > 2 * resultsPerPage && trimIncomingResults()
}

function forceReconnectWebSocket() {
	clearTimeout(reconnectTimer)
	reconnectDelayMs = baseReconnectDelayMs
	setupWebSocket()
}

function trimPathName(path) {
	var tPath = path
	path = path.replace(/^.+?(\?(?:(?:search)|(?:latest)).*?)$/gi, "$1")
	return ((tPath == path) ? "" : path)
}

function setupWebSocket() {
	connectionIndicator.classList.remove("connected")
	searchInput.classList.add("offline")
	document.getElementById("nav").classList.add("offline")
	document.getElementById("results-header").classList.add("offline")
	searchInput.setAttribute("placeholder", "正在联系服务器，暂无回应")
	socket && (socket.onclose = socket.onopen = socket.onmessage = null, socket.close())
	var a = trimPathName(document.location.href);
	(a.charAt(0) == "?") ? a = "/" + a.slice(1): a
	pendingRequest || (a = "/notify" + a)
	socket = new WebSocket("wss://" + "kamadan.decltype.org" + "/ws" + a) //window.location.hostname
	socket.onclose = function (a) {
		clearTimeout(reconnectTimer)
		reconnectTimer = setTimeout(setupWebSocket, reconnectDelayMs)
		reconnectDelayMs = Math.min(2 * reconnectDelayMs, maxReconnectDelayMs)
	}

	socket.onopen = function (a) {
		clearTimeout(reconnectTimer)
		reconnectDelayMs = baseReconnectDelayMs
		connectionIndicator.classList.add("connected")
		searchInput.classList.remove("offline")
		document.getElementById("nav").classList.remove("offline")
		document.getElementById("results-header").classList.remove("offline")
		searchInput.setAttribute("placeholder", "搜索词需用字母名 | 按以下格式寻人: 名=填名；亦可点击表内人名 (浏览器会自动复制该名) | [旗标]以示原文 | [齿轮]启动自动提示")

		if (window.location.href.match(网址)) {
			navigateUrl(window.location.href.match(网址)[1])
		}
		/* 
		  else {
			retrieveResults({
				query: "",
				offset: 0
			})
		}
		*/
	}

	socket.onmessage = function (a) {
		a = JSON.parse(a.data)
		for (var prop in a) {
			a[prop] = inputVal(a[prop])
		}
		if ("undefined" !== typeof a.query) {
			displayResults(a)
		} else {			
			if (!(违禁(a))) {				
				if (notificationButton.classList.contains("enabled")) {
					var 找到 = []
					if (追踪项.length > 0) {
						找到 = 追踪项.filter(项 => {
							return (a.message.match(new RegExp(项, "i")) || parseTranslate(a.message, false).match(new RegExp(项, "i")))
						})
						var 近期广告表 = 近期广告.reduce((总结, 项) => {
							总结 += 项.name + "\n" + 项.message + "\n"
							return 总结
						}, "")
						console.log("原文: \n" + a.name + "\n" + a.message + "\n正在追踪: " + 追踪项.toString() + "\n找到: " + 找到.toString() + "\n已见过的广告: \n" + 近期广告表)
						if ((找到.length > 0) && 未曾见过(a)) {
							var b = parseRequestFromUrl(trimPathName(document.location.href)),
								d = {
									body: "角色名: " + a.name + "\n" + parseTranslate(a.message, false), //所在地: 卡玛丹，艾斯坦之钻\n美洲1区
									icon: "帆船.png", //notification related:  /v/ZjA5Y2E4NT.png
									tag: "卡玛丹/" + b.query
								},
								e = "激战广告"
							b.query && (e = e + " - '" + b.query + "' 的搜索结果")
							console.log("找到, 正在试图发报")
							new Notification(e, d)
							playNotificationSound()
						}
					}
				}
				d = scrolledDown && !scrolling
				b = findDuplicates(a, results)
				if (d) {
					d = findDuplicates(a, incomingResults)
					b = b.concat(d)
					for (d = 0; d < b.length; ++d)
						b[d].deletedByIncoming = !0
					addIncomingResult(a)
					toggleScrollIndicator(!0)
				} else
					addResult(a),
					b.forEach(function (a) {
						a.deleted = !0
					}),
					placeNewResults(),
					reflowResults(shouldAnimate())
			}
		}
	}
}

function 违禁(a){
	var 禁言项 = ["GAMERSMARKÉT", "GVGMALL", "GAMERSMARKET", "\\\.COM", "LiveChat", "GOLDAA", "[^\\sA-Za-z]COM"]
	var 有违禁 = []	
	有违禁 = 禁言项.filter(项 => {
		return a.message.match(new RegExp(项, "i")) 
	})
	return ((有违禁.length==0) ? false : true)
}

function 未曾见过(新数据) {
	近期广告 = 近期广告.filter(还新否)
	for (var i = 0; i < 近期广告.length; i++) {
		var 记录 = 近期广告[i]
		if (新数据.name == 记录.name && 新数据.message == 记录.message) {
			return false
		}
	}
	新数据.接收时间 = (new Date()).getTime()
	近期广告.push(新数据)
	return true
}

function 还新否(广告) {
	var 现在时间 = new Date()
	var 广告时间 = new Date(广告.接收时间)
	return ((现在时间 - 广告时间) > (静音时间 * 60 * 1000)) ? false : true
}

function flushNewRows() {
	trimIncomingResults()
	for (var a = 0; a < incomingResults.length; ++a)
		addResult(incomingResults[a])
	clearIncomingResults()
	for (a = 0; a < results.length; ++a) {
		var b = results[a]
		b.deletedByIncoming && (b.deleted = !0)
	}
	placeNewResults()
	reflowResults(shouldAnimate())
	toggleScrollIndicator(!1)
}

function displayTitle(a) {
	var b = "广告|卡玛丹"
	a && (b = a + " - " + b)
	document.title = b
}

function displaySearchInfo(a) {
	var b = parseInt(a.offset, 10)
	if (0 < a.results.length) {
		var c = a.elapsed_microseconds / 1E3,
			b = b + 1,
			d = b + Math.min(resultsPerPage, a.results.length) - 1
		a = a.query ? "第 " + b + "-" + d + " 条 | 共" + ("true" === a.exact ? "有" : "约") + " " + a.num_results + " 则 与 '" + a.query + "' 相关的广告 (耗时 " + c + " 毫秒)" : "第 " + b + "-" + d + " 条 | 共 " + a.num_results + " 则 (耗时 " + c + " 毫秒)"
	} else
		a = "没有 与 '" + a.query + "' 相关的广告"
	searchInfo.classList.remove("animate-fade-out")
	searchInfo.innerText = a
}

function formatPageLink(a, b, c, d) {
	return "<a class=\"page-link" + (c ? " page-link-" + c : "\" href=\"" + a + (1 != b ? "/" + (b - 1) * resultsPerPage : "")) + "\">" + d + "</a>"
}

function formatPagination(a, b, c) {
	if (0 == c)
		return ""
	c = Math.min(Math.ceil(c / resultsPerPage), maxPages)
	b = Math.floor(b / resultsPerPage) + 1
	var d = Math.max(Math.min(b - 2, c - 4), 1),
		e = Math.min(c, d + 4)
	a = htmlEscape(a)
	for (var f = formatPageLink(a, 1, 1 == b ? "disabled" : "", "&laquo;"); d <= e; ++d)
		f += formatPageLink(a, d, b == d ? "current" : "", d)
	return f += formatPageLink(a, maxPages, b == c ? "disabled" : "", "&raquo;")
}

function displayPagination(a, b, c) {
	pagination.innerHTML = formatPagination(a, b, c)
}

function buildUrlFor(a, b) {
	var c = a ? "?search/" + encodeURIComponent(a) : "?latest"
	b = "undefined" !== typeof b ? parseInt(b, 10) : 0
	0 != b && (c += "/" + b)
	return c
}

function displayQuery(a) {
	searchInput.value = a
}

function displayResults(a) {
	pendingRequest = null
	var b = buildUrlFor(a.query)
	buildUrlFor(a.query, a.offset)
	var c = parseInt(a.num_results, 10)
	clearResults()
	for (var d = a.results.length - 1; 0 <= d; --d){
		if (违禁(a.results[d])) {
			a.results[d].message = "违禁广告，内容已删"			
		}
		addResult(a.results[d])
	}		
	displaySearchInfo(a)
	displayPagination(b, a.offset, c)
	placeNewResults()
	reflowResults()
	scrollToTop(100)
}

function parseRequestFromUrl(a) {
	(a.charAt(0) == "?") ? a = a.substr(1): a
	a = a.split(/\/+/)
	"" == a[0] && (a = a.slice(1))
	var b = "",
		c = 0
	1 <= a.length && "latest" == a[0] ? a = a.slice(1) : 2 <= a.length && "search" == a[0] && (b = decodeURIComponent(a[1]),
		a = a.slice(2))
	1 <= a.length && (c = parseInt(a[0], 10),
		isNaN(c) && (c = 0))
	return {
		query: b,
		offset: c
	}
}

function displayRequest(a) {
	displayTitle(a.query)
	displayQuery(a.query)
	a.query || 0 != a.offset || searchInput.focus()
	current.classList.add("animate-fade-out")
	searchInfo.classList.add("animate-fade-out")
}

function retrieveResults(a) {
	pendingRequest = a
	displayRequest(a)
	socket && socket.readyState == WebSocket.OPEN ? socket.send(JSON.stringify({
		query: a.query,
		offset: a.offset,
		suggest: enableSuggest
	})) : forceReconnectWebSocket()
}

function reflowDocument() {
	isFirstReflow && (scrolledDown = !isAtTopOfPage(),
		populateResultsFromDom())
	measureResults()
	isFirstReflow && (document.body.classList.remove("no-js"),
		document.body.classList.add("js"),
		isFirstReflow = !1)
	reflowResults()
}

function animateScroll() {
	var a = (new Date).getTime(),
		a = a > scrollAnimationEnd ? 1 : 1 - (scrollAnimationEnd - a) / scrollAnimationLengthMs
	window.scrollTo(0, Math.floor(a * scrollEndY + (1 - a) * scrollStartY))
	1 > a ? window.requestAnimationFrame(animateScroll) : scrolledDown = scrolling = !1
}

function scrollToTop(a) {
	var b = -page.getBoundingClientRect().top
	scrollAnimationLengthMs = "undefined" === typeof a ? animationLengthMs : a
	0 < b && (scrollStartY = b,
		scrollEndY = 0,
		scrollAnimationEnd = (new Date).getTime() + scrollAnimationLengthMs,
		scrolling = !0,
		window.requestAnimationFrame(animateScroll))
}

function play(a) {
	var b = audioContext.createBufferSource()
	b.buffer = a
	b.connect(audioContext.destination)
	b.start()
}

function playNotificationSound() {
	notificationSoundBuffer && play(notificationSoundBuffer)
}

function fetchNotificationSound() {
	//New: commented out the entire block below
	/*
    "undefined" === typeof notificationSoundBuffer && (notificationSoundBuffer = null,
    "undefined" !== typeof AudioContext && (audioContext = new AudioContext,
    window.fetch("ZTkxMjA0YW.mp3").then(function(a) { //notification related: /v/ZTkxMjA0YW.mp3 
        return a.arrayBuffer()
    }).then(function(a) {
        return audioContext.decodeAudioData(a)
    }).then(function(a) {
        notificationSoundBuffer = a
    })))
	*/
}

function isAtTopOfPage() {
	return 0 <= page.getBoundingClientRect().top
}

function isSelecting(a) {
	var b = getSelection()
	return 0 == b.toString().length ? !1 : (b = b.anchorNode) && a.contains(b)
}

function displayDeleteDialog(a) {
	if (translateButton.classList.contains("字母版")) {
		a = "<div id=\"modal\"><div id=\"dialog\"><div><h1>Request message deletion</h1>To delete this message, log in with <strong>" + htmlEscape(a.name) + "</strong> and enter the following command:</div><div id=\"command\">/whisper Chat Log, DELETE " + a.id + "</div><div id=\"dialog-footer\"><button id=\"dismiss\">Got it!</button></div></div></div>"
	} else {
		a = "<div id=\"modal\"><div id=\"dialog\"><div><h1>原文 及 删除办法</h1>原文: <div id=\"command\">" + htmlEscape(a.message) + "</div>删除办法: 以 <strong>" + htmlEscape(a.name) + "</strong> 角色登入激战，再用其 对话栏 发以下字条:</div><div id=\"command\">/whisper Chat Log, DELETE " + a.id + "</div><div id=\"dialog-footer\"><button id=\"dismiss\">返回</button></div></div></div>"
	}
	document.body.insertAdjacentHTML("beforeend", a)
}

function displayNotificationDialog() {
	var sForm
	if (!translateButton.classList.contains("字母版")) {
		sForm = "<div id=\"tracking-Form\" style=\"display:flex\"> \
				<div id=\"dialog\"> \
				<div> \
					<h1>自动提示 - 设置</h1> \
					<div>填入 物品名称，或各种别名，以逗号为分隔符，中外文通用</div> \
					<div id=\"command\"> \
					<div style=\"font-size:small\">(特殊符号需以\"\\\"号开头，例：\+)</div> \
					<textarea id=\"tracked-Items\" rows=\"5\" cols=\"50\"></textarea> \
					</div> \
					<div id=\"command\"> \
					<input type=\"number\" id=\"silent-Interval\" value=\"5\" min=\"0\" max=\"99\" required pattern=\"[0-9]{1,2}\"> \
					<span style=\"font-size:small\">分钟内不报重复的广告</span> \
					</div> \
				</div> \
				<div id=\"dialog-footer\"> \
					<button id=\"cancel-Notification\">取消</button> \
					<button id=\"begin-Notification\">启动</button> \
				</div> \
				</div> \
			</div>"
	} else {
		sForm = "<div id=\"tracking-Form\" style=\"display:flex\"> \
				<div id=\"dialog\"> \
				<div> \
					<h1>Notification Settings</h1> \
					<div>Enter Item Names | Use Comma Between Entries</div> \
					<div id=\"command\"> \
					<div style=\"font-size:small\">(Escape RegExp Symbols | E.g. \\+)</div> \
					<textarea id=\"tracked-Items\" rows=\"5\" cols=\"50\"></textarea> \
					</div> \
					<div id=\"command\"> \
					<span style=\"font-size:small\">Ignore Duplicates from the last </span> \
					<input type=\"number\" id=\"silent-Interval\" value=\"5\" min=\"0\" max=\"99\" required pattern=\"[0-9]{1,2}\"> \
					<span style=\"font-size:small\"> Minutes</span> \
					</div> \
				</div> \
				<div id=\"dialog-footer\"> \
					<button id=\"cancel-Notification\">Cancel</button> \
					<button id=\"begin-Notification\">Apply</button> \
				</div> \
				</div> \
			</div>"
	}
	document.body.insertAdjacentHTML("beforeend", sForm)
	//document.getElementById("tracking-Form").style.display = "flex"
	document.getElementById("tracked-Items").value = 追踪项.toString()
	document.getElementById("silent-Interval").value = 静音时间
}

function 开报(a) {
	a.preventDefault()
	追踪项 = document.getElementById("tracked-Items").value.split(/[,，]/).map(x => x.trim()).filter(x => (x != ""))
	var 内容分类 = 追踪项.reduce((驳回, 项) => {
		try {
			new RegExp(项, "i")
			驳回[0].push(项)
		} catch (e) {
			驳回[1].push(项)
		}
		return 驳回
	}, [
		[],
		[]
	])
	var 被驳回 = 内容分类[1]
	if (被驳回.length > 0) {
		var oldErrorMsg = document.getElementById("input-Error")
		if (oldErrorMsg) {
			oldErrorMsg.parentNode.removeChild(oldErrorMsg)
		}
		document.getElementById("tracked-Items").insertAdjacentHTML("afterend", "<div style='font-size:small' id='input-Error'> \
        输入失败，以下字条违规：" + 被驳回.toString() + "</div>")
		document.getElementById("tracked-Items").value = 内容分类[0]
		return 0
	}
	静音时间 = document.getElementById("silent-Interval").value
	if (!静音时间.match(/^[0-9]{1,2}$/i)) {
		return 0
	} else {
		静音时间 = parseInt(静音时间)
	}
	fetchNotificationSound()
	if ("granted" !== Notification.permission) {
		Notification.requestPermission(function (a) {
			if ("granted" === a) {
				notificationButton.classList.add("enabled")
				console.log("用户同意发报")
			} else {}
		})
	} else {
		//add enabled		
		console.log("开始发报")
		notificationButton.classList.toggle("enabled")
	}

	document.body.removeChild(document.getElementById("tracking-Form"))
}

function 取消按钮(a) {
	a.preventDefault()
	document.body.removeChild(document.getElementById("tracking-Form"))
}

document.getElementById("wiki-button").addEventListener("click", function (a) {
	a.preventDefault()
	location.href = "https://guildwars.huijiwiki.com/wiki/首页"
})

document.getElementById("dictionary-button").addEventListener("click", function (a) {
	a.preventDefault()
	location.href = "https://guildwars.huijiwiki.com/wiki/词典"
})

document.getElementById("translate-button").addEventListener("click", function (a) {
	a.preventDefault()
	var language = !translateButton.classList.contains("字母版")
	if (language) { //currently not in foreign text
		translateButton.classList.add("字母版")
		translateButton.setAttribute("title", "Chinese")
	} else { //currently foreign, so switch to Chinese mode
		translateButton.classList.remove("字母版")
		translateButton.setAttribute("title", "字母版")
	}
	if (window.location.href.match(网址)) {
		navigateUrl(window.location.href.match(网址)[1])
	}
})

function matchesRequest(a, b) {
	return a.query === b.query && a.offset == b.offset
}

function navigateUrl(a) {
	"?latest" == a && (a = "?")
	var b = parseRequestFromUrl(a),
		c = parseRequestFromUrl(trimPathName(document.location.href))
	matchesRequest(c, b) || history.pushState({}, "", (a == "?") ? "/ad" : "/ad" + a) //previously: a	
	retrieveResults(b)
}

function navigate(a, b) {
	var c = buildUrlFor(a, b)
	navigateUrl(c)
}

function updateTimestamps() {
	for (var a = (new Date).valueOf(), b = 0; b < results.length; ++b) {
		var c = results[b],
			d = humanReadableAge(1E3 * c.timestamp, a)
		d !== c.ageDomNode.innerText && (c.ageDomNode.innerText = d)
	}
}

enableInstantSearch && searchInput.addEventListener("input", function (a) {
	navigate(searchInput.value)
})

searchForm.addEventListener("submit", function (a) {
	a.preventDefault()
	if (searchInput.value.match(/^名\s*?=\s*?[^\s]+/)) {
		searchInput.value = searchInput.value.replace(/^名\s*?=\s*?(.+?)$/gi, "author:\"$1\"")
	} else {
		searchInput.value = searchTranslate(searchInput.value)
	}
	navigate(searchInput.value)
})

homeLink.addEventListener("click", function (a) {
	a.preventDefault()
	navigate()
})

notificationButton.addEventListener("click", function () {
	if ("undefined" === typeof Notification) {
		alert("浏览器无提示窗功能")
		notificationButton.classList.remove("enabled")
		近期广告 = []
	} else {
		if (notificationButton.classList.contains("enabled")) {
			console.log("停止发报")
			notificationButton.classList.remove("enabled")
			近期广告 = []
		} else {
			displayNotificationDialog()
		}
	}
})

scrollIndicator.addEventListener("click", function () {
	flushNewRows()
	scrollToTop()
})

window.addEventListener("popstate", function (a) {
	retrieveResults(parseRequestFromUrl(trimPathName(document.location.href)))
})

window.addEventListener("beforeunload", function () {
	socket && (clearTimeout(reconnectTimer), socket.onclose = function () {}, socket.close())
})

window.addEventListener("scroll", function () {
	(scrolledDown = !isAtTopOfPage()) || flushNewRows()
})

window.addEventListener("resize", reflowDocument)

document.addEventListener("click", function (a) {
	var b = a.target
	if (1 == a.which)
		if (b.classList.contains("name") && !isSelecting(b)) {
			c = getSelection()
			c.removeAllRanges()
			var d = document.createRange()
			d.selectNode(b)
			c.addRange(d)
			try {
				document.execCommand("copy")
			} catch (e) {}
			navigate("author:\"" + b.innerText + "\""),
				a.preventDefault()
		}
	else if (b.classList.contains("page-link") && b.hasAttribute("href"))
		navigateUrl(b.getAttribute("href")),
		a.preventDefault()
	else if (b.classList.contains("delete")) {
		a = b.parentNode
		for (var c, b = 0; b < results.length; ++b)
			results[b].domNode === a && (c = results[b])
		c && displayDeleteDialog(c)
	} else if ("modal" === b.id)
		document.body.removeChild(b)
	else if ("dismiss" === b.id)
		a = document.getElementById("modal"),
		document.body.removeChild(a)
	else if ("cancel-Notification" === b.id)
		取消按钮(a)
	else if ("begin-Notification" === b.id)
		开报(a)
	else if ("command" === b.id) {
		c = getSelection()
		c.removeAllRanges()
		var d = document.createRange()
		d.selectNode(b)
		c.addRange(d)
		try {
			document.execCommand("copy")
		} catch (e) {}
		a.preventDefault()
	}
})

window.setInterval(updateTimestamps, 1E3)
reflowDocument()
setupWebSocket();

(function (h, o, t, j, a, r) {
	h.hj = h.hj || function () {
		(h.hj.q = h.hj.q || []).push(arguments)
	};
	h._hjSettings = {
		hjid: 402228,
		hjsv: 5
	};
	a = o.getElementsByTagName('head')[0];
	r = o.createElement('script');
	r.async = 1;
	r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
	a.appendChild(r);
})(window, document, '//static.hotjar.com/c/hotjar-', '.js?sv=');

function searchTranslate(data) {
	return data
}

function inputVal(data) {
	if (Array.isArray(data)) {
		for (var o = 0; o < data.length; o++) {
			for (var field in data[o]) {
				data[o][field] = inputValHelper(data[o][field])
			}
		}
	} else {
		inputValHelper(data)
	}
	return data
}

function inputValHelper(data) {
	data = data.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<script[^>]+?\/>|<script(.|\s)*?\/script>/gi, "")
		.replace(/<\/html>/gi, "")
		.replace(/<html>/gi, "")
		.replace(/<\/body>/gi, "")
		.replace(/<body>/gi, "")
		.replace(/<head\/>/gi, "")
		.replace(/<head>/gi, "")
		.replace(/<\/head>/gi, "")
		.replace(/<\/.*?>/gi, "")
		.replace(/<.*?>/gi, "")
		.replace(/!\[CDATA\[.*?\]\]/gi, "")
		.replace(/&lt;.*?&gt;/gi, "")
	return data
}

function parseTranslate(data, 样式 = true) {
	data = data.replace(/^\s*?\r*?\n*?$/gi, "")
	
        data = data.replace(/^.*?Sàlê.*?$/gim, "")
	
	if (translateButton.classList.contains("字母版")) {
		if (样式) {
			data = data.replace(/^WTBUY|^WTB/gi, "<span style=\"color:#0000FF;\">WTB</span>")
			data = data.replace(/^WTSELL|^WTS/gi, "<span style=\"color:#BB00BB;\">WTS</span>")
			data = data.replace(/(^|[^A-Za-z])(WANT TO SELL)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#BB00BB;\">WTS</span>")
			data = data.replace(/(^|[^A-Za-z])(WANT TO BUY)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#0000FF;\">WTB</span>")
			data = data.replace(/(^|[^A-Za-z])(SELL*?I*?ING*?|WW*?TSS*?|WT\$|SELL|VENDR*?E*?|VVTS|W[^A-Za-z]*?T[^A-Za-z]*?S)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#BB00BB;\">WTS</span>")
			data = data.replace(/(^|[^A-Za-z])(BUYING|BUYIN|WYB|WW*?TBB*?|VVTB|ACHETE*?R*?S*?|BUY|W[^A-Za-z]*?T[^A-Za-z]*?B|WTV)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#0000FF;\">WTB</span>")
		} else {
			data = data.replace(/^WTBUY|^WTB/gi, "WTB")
			data = data.replace(/^WTSELL|^WTS/gi, "WTS")
			data = data.replace(/(^|[^A-Za-z])(WANT TO SELL)(?=[^A-Za-z]|$)/gi, "$1WTS")
			data = data.replace(/(^|[^A-Za-z])(WANT TO BUY)(?=[^A-Za-z]|$)/gi, "$1WTB")
			data = data.replace(/(^|[^A-Za-z])(SELL*?I*?ING*?|WW*?TSS*?|WT\$|SELL|VENDR*?E*?|VVTS|W[^A-Za-z]*?T[^A-Za-z]*?S)(?=[^A-Za-z]|$)/gi, "$1WTS")
			data = data.replace(/(^|[^A-Za-z])(BUYING|BUYIN|WYB|WW*?TBB*?|VVTB|ACHETE*?R*?S*?|BUY|W[^A-Za-z]*?T[^A-Za-z]*?B|WTV)(?=[^A-Za-z]|$)/gi, "$1WTB")
		}
		return data
	}
	//1. 起始项 (避免常见短句被拆散)

	if (样式) {
		data = data.replace(/^WTBUY|^WTB/gi, "<span style=\"color:#0000FF;font-weight:900\">买</span>")
		data = data.replace(/^WTS.*$|^WTSELL.*$/gim, "");
	} else {
		data = data.replace(/^WTBUY|^WTB/gi, "买")
		data = data.replace(/^WTS.*$|^WTSELL.*$/gim, "");
	}
	

	//2. 卖买
	if (样式) {
		data = data.replace(/(^|[^A-Za-z])(SELL*?I*?ING*?|WW*?TSS*?|WT\$|SELL|VENDR*?E*?|VVTS|W[^A-Za-z]*?T[^A-Za-z]*?S)(?=[^A-Za-z]|$)/gi, "$1")
		data = data.replace(/(^|[^A-Za-z])(BUYING|BUYIN|WYB|WW*?TBB*?|VVTB|ACHETE*?R*?S*?|BUY|W[^A-Za-z]*?T[^A-Za-z]*?B|WTV)(?=[^A-Za-z]|$)/gi, "$1<span style=\"color:#0000FF;font-weight:900\">买</span>")
	} else {
		data = data.replace(/(^|[^A-Za-z])(SELL*?I*?ING*?|WW*?TSS*?|WT\$|SELL|VENDR*?E*?|VVTS|W[^A-Za-z]*?T[^A-Za-z]*?S)(?=[^A-Za-z]|$)/gi, "$1")
		data = data.replace(/(^|[^A-Za-z])(BUYING|BUYIN|WYB|WW*?TBB*?|VVTB|ACHETE*?R*?S*?|BUY|W[^A-Za-z]*?T[^A-Za-z]*?B|WTV)(?=[^A-Za-z]|$)/gi, "$1买")
	}
	
	//报结果
	return data
}
