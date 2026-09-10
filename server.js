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
    
    // 模拟真实手机浏览器
    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    
    // 设置cookies和headers让小红书认为是真实用户
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    });

    // 处理短链接：先访问获取重定向
    let targetUrl = url;
    if (url.includes('xhslink')) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      targetUrl = page.url();
    }

    // 访问目标页面
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // 等待页面渲染
    await new Promise(r => setTimeout(r, 3000));

    // 尝试从 __INITIAL_STATE__ 提取
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

    // 如果没拿到，尝试从页面DOM直接提取
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
      return res.status(200).json({ error: '无法解析页面内容，小红书可能限制了访问' });
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
