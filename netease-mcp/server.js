const express = require('express');
const app = express();
app.use(express.json());

const NETEASE = 'http://127.0.0.1:3000';

const TOOLS = [
  { name: "search_song", description: "搜索歌曲", inputSchema: { type: "object", properties: { keywords: { type: "string", description: "搜索关键词" }, limit: { type: "number", description: "返回数量，默认5" } }, required: ["keywords"] } },
  { name: "get_song_url", description: "获取歌曲播放链接", inputSchema: { type: "object", properties: { id: { type: "string", description: "歌曲ID" } }, required: ["id"] } },
  { name: "get_lyric", description: "获取歌词", inputSchema: { type: "object", properties: { id: { type: "string", description: "歌曲ID" } }, required: ["id"] } },
  { name: "get_song_detail", description: "获取歌曲详情", inputSchema: { type: "object", properties: { ids: { type: "string", description: "歌曲ID，多个用逗号分隔" } }, required: ["ids"] } }
];

async function callNetease(path) {
  const res = await fetch(NETEASE + path);
  return await res.json();
}

app.post('/mcp', async (req, res) => {
  const { method, params, id } = req.body;
  
  if (method === 'initialize') {
    return res.json({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'netease-music', version: '1.0.0' } } });
  }
  
  if (method === 'tools/list') {
    return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  }
  
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    let result;
    try {
      if (name === 'search_song') {
        const data = await callNetease(`/search?keywords=${encodeURIComponent(args.keywords)}&limit=${args.limit || 5}`);
        const songs = (data.result?.songs || []).map(s => ({ id: s.id, name: s.name, artist: s.ar?.map(a => a.name).join('/') || '', album: s.al?.name || '', duration: Math.floor(s.dt/1000) + 's' }));
        result = JSON.stringify(songs, null, 2);
      } else if (name === 'get_song_url') {
        const data = await callNetease(`/song/url?id=${args.id}`);
        result = JSON.stringify(data.data?.[0] || data, null, 2);
      } else if (name === 'get_lyric') {
        const data = await callNetease(`/lyric?id=${args.id}`);
        result = data.lrc?.lyric || '暂无歌词';
      } else if (name === 'get_song_detail') {
        const data = await callNetease(`/song/detail?ids=${args.ids}`);
        const songs = (data.songs || []).map(s => ({ id: s.id, name: s.name, artist: s.ar?.map(a => a.name).join('/') || '', album: s.al?.name || '' }));
        result = JSON.stringify(songs, null, 2);
      } else {
        result = 'Unknown tool: ' + name;
      }
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: result }] } });
    } catch(e) {
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true } });
    }
  }
  
  if (method === 'notifications/initialized') {
    return res.json({ jsonrpc: '2.0', id, result: {} });
  }
  
  res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
});

app.get('/mcp', (req, res) => {
  res.json({ name: 'netease-music', version: '1.0.0', description: '小克的网易云音乐MCP' });
});

app.listen(3001, () => console.log('MCP server running on port 3001'));
