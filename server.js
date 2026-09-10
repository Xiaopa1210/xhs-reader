const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/xhs', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: '请提供小红书链接，参数名为 url' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9'
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    const data = await page.evaluate(() => {
      const state = window.__INITIAL_STATE__;
      if (!state || !state.note || !state.note.noteDetailMap) return null;
      const noteMap = state.note.noteDetailMap;
      const firstKey = Object.keys(noteMap)[0];
      if (!firstKey) return null;
      const detail = noteMap[firstKey].note;
      return {
        title: detail.title || '',
        description: detail.desc || '',
        type: detail.type || '',
        likes: detail.interactInfo?.likedCount || '',
        comments: detail.interactInfo?.commentCount || '',
        collects: detail.interactInfo?.collectedCount || '',
        tags: (detail.tagList || []).map(t => t.name),
        images: (detail.imageList || []).map(img => img.urlDefault),
        user: detail.user?.nickname || ''
      };
    });

    if (!data) {
      return res.status(200).json({ error: '无法解析页面内容' });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: '抓取失败', detail: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.get('/', (req, res) => {
  res.json({ status: '小克的小红书阅读器运行中' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
