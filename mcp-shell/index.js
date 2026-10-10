const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const sessions = new Map();

const TOOLS = [
  {
    name: 'run_command',
    description: '在VPS上执行shell命令',
    inputSchema: { type: 'object', properties: { command: { type: 'string', description: '要执行的shell命令' } }, required: ['command'] }
  },
  {
    name: 'read_file',
    description: '读取VPS上的文件内容',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: '文件绝对路径' } }, required: ['path'] }
  },
  {
    name: 'write_file',
    description: '写入内容到VPS上的文件',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: '文件绝对路径' }, content: { type: 'string', description: '文件内容' } }, required: ['path', 'content'] }
  },
  {
    name: 'list_dir',
    description: '列出VPS上的目录内容',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: '目录绝对路径' } }, required: ['path'] }
  }
];

function handleRequest(method, params) {
  if (method === 'initialize') {
    return { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'vps-shell', version: '1.0.0' } };
  }
  if (method === 'notifications/initialized') {
    return {};
  }
  if (method === 'tools/list') {
    return { tools: TOOLS };
  }
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      let result;
      if (name === 'run_command') {
        result = execSync(args.command, { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
      } else if (name === 'read_file') {
        result = fs.readFileSync(args.path, 'utf8');
      } else if (name === 'write_file') {
        const dir = path.dirname(args.path);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(args.path, args.content);
        result = 'File written successfully: ' + args.path;
      } else if (name === 'list_dir') {
        const items = fs.readdirSync(args.path, { withFileTypes: true });
        result = items.map(i => (i.isDirectory() ? '[DIR] ' : '[FILE] ') + i.name).join('\n');
      } else {
        return { content: [{ type: 'text', text: 'Unknown tool: ' + name }], isError: true };
      }
      return { content: [{ type: 'text', text: result || '(empty output)' }] };
    } catch (e) {
      return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true };
    }
  }
  return null;
}

app.post('/mcp', (req, res) => {
  let sessionId = req.headers['mcp-session-id'];
  
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessions.set(sessionId, { created: Date.now() });
  }
  
  res.setHeader('mcp-session-id', sessionId);
  
  const { method, params, id, jsonrpc } = req.body;
  
  if (!method) {
    return res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Missing method' } });
  }
  
  const result = handleRequest(method, params || {});
  
  if (result === null) {
    return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
  }
  
  res.json({ jsonrpc: '2.0', id, result });
});

app.get('/mcp', (req, res) => {
  res.json({ name: 'vps-shell', version: '1.0.0', description: '小克的VPS远程Shell MCP' });
});

app.delete('/mcp', (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (sessionId) sessions.delete(sessionId);
  res.status(200).end();
});

app.listen(3002, () => console.log('VPS Shell MCP running on port 3002'));
