/*
 * Jable 视频源 —— TVBox / 影视仓 通用 drpy(JS) 爬虫
 * 站点真实结构来源：jooservices/go-jabledownloader 的实测实现
 *   - 列表项：.video-img-box ，标题 h6.title a ，图 img[data-src] ，时长 .label
 *   - 详情页：/videos/<code>/ ，播放器把直链暴露成全局变量 hlsUrl（源码里也有 var hlsUrl='...'）
 *   - 媒体请求需要 Referer: https://en.jable.tv/
 *
 * ⚠ 已知风险：该站有 Cloudflare。参考实现是用无头浏览器抓的
 *   （fixture 明确记录：普通 HTTP 客户端拿到的是 CF 挑战页，浏览器渲染后才是真页面）。
 *   所以「分类/搜索」这一步有被 CF 拦住的可能，实测为准。
 */
var rule = {
    title: 'Jable',
    host: 'https://en.jable.tv',
    homeUrl: '/latest-updates/',

    // 分类页：fyclass 是分类标识，fypage 是页码
    url: '/fyclass/?page=fypage',
    // 搜索：** 代表搜索词，fypage 代表页码
    searchUrl: '/search/**/?page=fypage',
    searchable: 2,
    quickSearch: 1,
    filterable: 0,

    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://en.jable.tv/'
    },
    timeout: 10000,

    class_name: '最新&热门',
    class_url: 'latest-updates&hot',

    play_parse: true,
    // 一级 / 搜索：列表;标题;图片;描述;链接
    一级: '.video-img-box;h6&&Text;img&&data-src;.label&&Text;a&&href',
    搜索: '.video-img-box;h6&&Text;img&&data-src;.label&&Text;a&&href',

    // 单片，没有二级详情页，直接进播放
    二级: '*',

    // 免嗅探：请求播放页 → 正则取出 hlsUrl → 直链交给播放器
    lazy: `js:
        let html = request(input, {headers: rule.headers});
        let m = html.match(/var\\s+hlsUrl\\s*=\\s*'([^']+)'/);
        if (m && m[1]) {
            input = {parse: 0, jx: 0, url: m[1]};
        } else {
            // 取不到（多半是撞上 Cloudflare 挑战页）→ 交给壳子的嗅探器兜底
            input = {parse: 0, jx: 0, url: input};
        }
    `,

    // 兜底：让壳子在 webview 里打开播放页并嗅探 m3u8（webview 能自己过 CF 的 JS 挑战）
    sniffer: 1,
    isVideo: 'http((?!http).){26,}\\.(m3u8|mp4)',
}

// 备用规则：如果上面 a&&href 取到的详情链接不对（页面上有干扰 a 标签），
// 把 一级/搜索 换成下面这版纯 JS 解析（正则直接抓 /videos/<code>/）。
var ruleJsFallback = {
    一级: `js:
        let html = request(input, {headers: rule.headers});
        let list = [];
        let reg = /<a[^>]+href="(\\/videos\\/[a-z]+-\\d+\\/)"[^>]*>[\\s\\S]{0,400}?<h6[^>]*>([\\s\\S]*?)<\\/h6>[\\s\\S]{0,400}?data-src="([^"]+)"/g;
        let m;
        while ((m = reg.exec(html)) !== null) {
            list.push({
                url: m[1],
                title: m[2].replace(/<[^>]+>/g, '').trim(),
                img: m[3],
                desc: ''
            });
        }
        list
    `,
}
