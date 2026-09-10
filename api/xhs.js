export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: '请提供小红书链接，参数名为 url' });
  }

  try {
    // 如果是短链接，先跟踪重定向拿到真实URL
    let realUrl = url;
    if (url.includes('xhslink.com') || url.includes('xhslink.cn')) {
      const redirectRes = await fetch(url, { redirect: 'manual' });
      realUrl = redirectRes.headers.get('location') || url;
    }

    // 抓取小红书页面
    const response = await fetch(realUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      }
    });

    const html = await response.text();

    // 从页面中提取 __INITIAL_STATE__ 数据
    const match = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})\s*<\/script>/s);
    if (!match) {
      // 尝试另一种匹配方式
      const match2 = html.match(/window\.__INITIAL_STATE__\s*=\s*(.+?);\s*<\/script>/s);
      if (!match2) {
        return res.status(200).json({ 
          error: '无法解析页面内容',
          html_length: html.length,
          html_preview: html.substring(0, 500)
        });
      }
      try {
        const raw = match2[1].replace(/undefined/g, 'null');
        const data = JSON.parse(raw);
        const note = data?.note?.noteDetailMap;
        const firstKey = note ? Object.keys(note)[0] : null;
        const detail = firstKey ? note[firstKey]?.note : null;

        return res.status(200).json({
          title: detail?.title || '',
          description: detail?.desc || '',
          type: detail?.type || '',
          likes: detail?.interactInfo?.likedCount || '',
          comments: detail?.interactInfo?.commentCount || '',
          collects: detail?.interactInfo?.collectedCount || '',
          tags: (detail?.tagList || []).map(t => t.name),
          images: (detail?.imageList || []).map(img => img.urlDefault),
          user: detail?.user?.nickname || '',
        });
      } catch (e) {
        return res.status(200).json({ error: '解析JSON失败', detail: e.message });
      }
    }

    const raw = match[1].replace(/undefined/g, 'null');
    const data = JSON.parse(raw);
    const note = data?.note?.noteDetailMap;
    const firstKey = note ? Object.keys(note)[0] : null;
    const detail = firstKey ? note[firstKey]?.note : null;

    return res.status(200).json({
      title: detail?.title || '',
      description: detail?.desc || '',
      type: detail?.type || '',
      likes: detail?.interactInfo?.likedCount || '',
      comments: detail?.interactInfo?.commentCount || '',
      collects: detail?.interactInfo?.collectedCount || '',
      tags: (detail?.tagList || []).map(t => t.name),
      images: (detail?.imageList || []).map(img => img.urlDefault),
      user: detail?.user?.nickname || '',
    });

  } catch (err) {
    return res.status(500).json({ error: '抓取失败', detail: err.message });
  }
}
