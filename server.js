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
  const debug = req.query.debug === '1';
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

    await page.setCookie(...XHS_COOKIES);

    let targetUrl = url;
    if (url.includes('xhslink')) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      targetUrl = page.url();
    }

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));

    // 调试模式：返回页面原始信息
    if (debug) {
      const debugInfo = await page.evaluate(() => {
        const hasState = !!window.__INITIAL_STATE__;
        let stateKeys = [];
        let noteKeys = [];
        let noteDetailKeys = [];
        let firstNoteKeys = [];
        if (hasState) {
          stateKeys = Object.keys(window.__INITIAL_STATE__);
          if (window.__INITIAL_STATE__.note) {
            noteKeys = Object.keys(window.__INITIAL_STATE__.note);
            if (window.__INITIAL_STATE__.note.noteDetailMap) {
              noteDetailKeys = Object.keys(window.__INITIAL_STATE__.note.noteDetailMap);
              const firstKey = noteDetailKeys[0];
              if (firstKey) {
                firstNoteKeys = Object.keys(window.__INITIAL_STATE__.note.noteDetailMap[firstKey]);
              }
            }
          }
        }
        const title = document.title;
        const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
        return { hasState, stateKeys, noteKeys, noteDetailKeys, firstNoteKeys, title, metaDesc, ogTitle, ogDesc, url: window.location.href };
      });
      return res.status(200).json(debugInfo);
    }

    // 尝试多种提取方式
    let data = await page.evaluate(() => {
      // 方式1: __INITIAL_STATE__
      const state = window.__INITIAL_STATE__;
      if (state) {
        // 尝试 note.noteDetailMap
        if (state.note?.noteDetailMap) {
          const noteMap = state.note.noteDetailMap;
          const firstKey = Object.keys(noteMap)[0];
          if (firstKey) {
            const detail = noteMap[firstKey]?.note || noteMap[firstKey];
            if (detail?.title || detail?.desc) {
              return {
                title: detail.title || '',
                description: detail.desc || '',
                type: detail.type || '',
                likes: detail.interactInfo?.likedCount || '',
                comments: detail.interactInfo?.commentCount || '',
                collects: detail.interactInfo?.collectedCount || '',
                tags: (detail.tagList || []).map(t => t.name),
                images: (detail.imageList || []).map(img => img.urlDefault || img.url),
                user: detail.user?.nickname || ''
              };
            }
          }
        }
        // 尝试 note.note
        if (state.note?.note) {
          const detail = state.note.note;
          return {
            title: detail.title || '',
            description: detail.desc || '',
            type: detail.type || '',
            likes: detail.interactInfo?.likedCount || '',
            comments: detail.interactInfo?.commentCount || '',
            collects: detail.interactInfo?.collectedCount || '',
            tags: (detail.tagList || []).map(t => t.name),
            images: (detail.imageList || []).map(img => img.urlDefault || img.url),
            user: detail.user?.nickname || ''
          };
        }
      }
      return null;
    });

    // 方式2: meta标签
    if (!data || (!data.title && !data.description)) {
      data = await page.evaluate(() => {
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
        const title = document.title || '';
        if (ogTitle || ogDesc) {
          return { title: ogTitle || title, description: ogDesc, source: 'meta' };
        }
        return null;
      });
    }

    // 方式3: DOM提取
    if (!data) {
      data = await page.evaluate(() => {
        const selectors = [
          { title: '#detail-title', desc: '#detail-desc' },
          { title: '.note-title', desc: '.note-desc' },
          { title: '.title', desc: '.content' },
          { title: '[class*="title"]', desc: '[class*="desc"]' }
        ];
        for (const s of selectors) {
          const t = document.querySelector(s.title)?.textContent?.trim() || '';
          const d = document.querySelector(s.desc)?.textContent?.trim() || '';
          if (t || d) return { title: t, description: d, source: 'dom' };
        }
        return null;
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
