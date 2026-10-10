from flask import Flask, request, jsonify
import os, json, tempfile, urllib.request

app = Flask(__name__)

model = None
def get_model():
    global model
    if model is None:
        from faster_whisper import WhisperModel
        model = WhisperModel('base', device='cpu', compute_type='int8')
    return model

TOOLS = [
    {
        'name': 'transcribe_audio',
        'description': '语音转文字，支持中英日多语言。传入音频文件URL或本地路径',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'audio_url': {'type': 'string', 'description': '音频文件的URL或本地路径'},
                'language': {'type': 'string', 'description': '语言代码，如zh/en/ja，省略则自动检测'}
            },
            'required': ['audio_url']
        }
    }
]

def transcribe(audio_path, language=None):
    m = get_model()
    segments, info = m.transcribe(audio_path, language=language, beam_size=5)
    texts = []
    for seg in segments:
        texts.append({
            'start': round(seg.start, 2),
            'end': round(seg.end, 2),
            'text': seg.text.strip()
        })
    full_text = ' '.join(t['text'] for t in texts)
    return {
        'language': info.language,
        'language_probability': round(info.language_probability, 3),
        'duration': round(info.duration, 2),
        'text': full_text,
        'segments': texts
    }

@app.route('/mcp', methods=['POST'])
def handle_mcp():
    body = request.json
    method = body.get('method', '')
    req_id = body.get('id')
    
    if method == 'initialize':
        return jsonify({'jsonrpc': '2.0', 'id': req_id, 'result': {
            'protocolVersion': '2024-11-05',
            'capabilities': {'tools': {}},
            'serverInfo': {'name': 'whisper-stt', 'version': '1.0.0'}
        }})
    
    if method == 'notifications/initialized':
        return jsonify({'jsonrpc': '2.0', 'id': req_id, 'result': {}})
    
    if method == 'tools/list':
        return jsonify({'jsonrpc': '2.0', 'id': req_id, 'result': {'tools': TOOLS}})
    
    if method == 'tools/call':
        args = body.get('params', {}).get('arguments', {})
        audio_url = args.get('audio_url', '')
        language = args.get('language')
        
        try:
            if audio_url.startswith('http'):
                tmp = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False)
                urllib.request.urlretrieve(audio_url, tmp.name)
                audio_path = tmp.name
            else:
                audio_path = audio_url
            
            result = transcribe(audio_path, language)
            
            if audio_url.startswith('http'):
                os.unlink(audio_path)
            
            return jsonify({'jsonrpc': '2.0', 'id': req_id, 'result': {
                'content': [{'type': 'text', 'text': json.dumps(result, ensure_ascii=False)}]
            }})
        except Exception as e:
            return jsonify({'jsonrpc': '2.0', 'id': req_id, 'result': {
                'content': [{'type': 'text', 'text': f'Error: {str(e)}'}],
                'isError': True
            }})
    
    return jsonify({'jsonrpc': '2.0', 'id': req_id, 'error': {'code': -32601, 'message': 'Unknown method'}})

@app.route('/mcp', methods=['GET'])
def mcp_info():
    return jsonify({'name': 'whisper-stt', 'version': '1.0.0', 'description': '小克的耳朵 - Whisper语音识别'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3004)
