const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

const XHS_COOKIES = [
  { name: 'a1', value: process.env.XHS_A1 || '', domain: '.xiaohongshu.com' },
  { name: 'web_session', value: process.env.XHS_SESSION || '', domain: '.xiaohongshu.com' },
  { name: 'webId', value: process.env.XHS_WEBID || '', domain: '.xiaohongshu.com' }
];

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
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    });

    // 注入cookie
    await page.setCookie(...XHS_COOKIES);

    // 处理短链接
    let targetUrl = url;
    if (url.includes('xhslink')) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      targetUrl = page.url();
    }

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // 从 __INITIAL_STATE__ 提取
    let data = await page.evaluate(() => {
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
      data = await page.evaluate(() => {
        const title = document.querySelector('#detail-title')?.textContent
          || document.querySelector('.title')?.textContent || '';
        const desc = document.querySelector('#detail-desc')?.textContent
          || document.querySelector('.desc')?.textContent || '';
        const user = document.querySelector('.user-name')?.textContent
          || document.querySelector('.username')?.textContent || '';
        if (!title && !desc) return null;
        return { title, description: desc, user };
      });
    }

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
