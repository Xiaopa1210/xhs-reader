const NeteaseCloudMusicApi = require('NeteaseCloudMusicApi');
const express = require('express');
const app = express();
const fs = require('fs');
const COOKIE_FILE = '/root/netease-api/cookie.txt';

let savedCookie = '';
try { savedCookie = fs.readFileSync(COOKIE_FILE, 'utf8').trim(); } catch(e) {}

app.use(express.json());

app.get('/captcha/sent', async (req, res) => {
  try {
    const result = await NeteaseCloudMusicApi.captcha_sent({ phone: req.query.phone });
    res.json(result.body);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/login/cellphone', async (req, res) => {
  try {
    const result = await NeteaseCloudMusicApi.login_cellphone({ phone: req.query.phone, captcha: req.query.captcha });
    if (result.body.cookie) {
      savedCookie = result.body.cookie;
      fs.writeFileSync(COOKIE_FILE, savedCookie);
    }
    res.json({ code: result.body.code, profile: result.body.profile, cookie_saved: !!savedCookie });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/search', async (req, res) => {
  try {
    const result = await NeteaseCloudMusicApi.cloudsearch({ keywords: req.query.keywords, limit: req.query.limit || 5, cookie: savedCookie });
    res.json(result.body);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/song/url', async (req, res) => {
  try {
    const result = await NeteaseCloudMusicApi.song_url_v1({ id: req.query.id, level: 'exhigh', cookie: savedCookie });
    res.json(result.body);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/lyric', async (req, res) => {
  try {
    const result = await NeteaseCloudMusicApi.lyric({ id: req.query.id, cookie: savedCookie });
    res.json(result.body);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/song/detail', async (req, res) => {
  try {
    const result = await NeteaseCloudMusicApi.song_detail({ ids: req.query.ids, cookie: savedCookie });
    res.json(result.body);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/user/playlist', async (req, res) => {
  try {
    const result = await NeteaseCloudMusicApi.user_playlist({ uid: req.query.uid, cookie: savedCookie });
    res.json(result.body);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/playlist/detail', async (req, res) => {
  try {
    const result = await NeteaseCloudMusicApi.playlist_detail({ id: req.query.id, cookie: savedCookie });
    res.json(result.body);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/login/status', async (req, res) => {
  try {
    const result = await NeteaseCloudMusicApi.login_status({ cookie: savedCookie });
    res.json(result.body);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/', (req, res) => {
  res.json({ status: '小克的网易云音乐服务运行中（带登录）', logged_in: !!savedCookie });
});

app.listen(3000, () => console.log('NetEase API with login running on port 3000'));
