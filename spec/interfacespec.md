# Backend-Frontend Interface Specification

## 概要

このドキュメントは、Smolagent UI Wrapperのバックエンドとフロントエンドのインターフェイス仕様を定義します。

- **バックエンド**: FastAPI + WebSocket
- **フロントエンド**: Vanilla JavaScript
- **通信プロトコル**: HTTP、WebSocket (JSON形式)

---

## HTTPエンドポイント

### GET /

**説明**: フロントエンドHTMLを配信

**リクエスト**: なし

**レスポンス**:
- Content-Type: `text/html`
- Body: `frontend/index.html` のコンテンツ

**ステータスコード**:
- `200 OK`: 正常にHTMLを返す
- `200 OK` (フォールバック): フロントエンドが見つからない場合、エラーメッセージを返す

---

### GET /static/*

**説明**: 静的ファイル（CSS、JavaScript、画像など）を配信

**リクエスト**: ファイルパス

**レスポンス**:
- Content-Type: ファイルタイプに応じて設定
- Body: 要求されたファイルの内容

**例**:
```
GET /static/css/styles.css
GET /static/js/app.js
```

---

## WebSocketエンドポイント

### WS /ws

**説明**: クライアント-サーバー間のリアルタイム双方向通信

**接続URL**: `ws://localhost:8000/ws` (開発環境)

**接続フロー**:
1. クライアントがWebSocket接続を確立
2. サーバーが接続を受け入れ (ConnectionManager)
3. クライアントがメッセージを送信
4. サーバーが処理し、複数のメッセージを返す
5. 切断時、サーバーがクライアントをリストから削除

---

## メッセージフォーマット

### クライアント → サーバー

#### ユーザーメッセージ送信

**形式**: JSON

**構造**:
```json
{
  "message": "ユーザーのクエリ文字列"
}
```

**フィールド**:
- `message` (string, 必須): ユーザーが入力したメッセージ

**例**:
```json
{
  "message": "Load the Titanic dataset and show me basic statistics"
}
```

**実装** (`frontend/js/chat.js:99`):
```javascript
this.ws.send(JSON.stringify({
    message: message
}));
```

---

### サーバー → クライアント

サーバーは複数のタイプのメッセージをクライアントに送信します。すべてのメッセージは以下の基本構造を持ちます：

**基本構造**:
```json
{
  "type": "メッセージタイプ",
  "content": "メッセージの内容（型はtypeによって異なる）"
}
```

#### メッセージタイプ一覧

| Type | 説明 | 処理箇所（フロントエンド） |
|------|------|---------------------------|
| `user_message` | ユーザーメッセージのエコーバック | チャットペイン |
| `text` | エージェントのテキスト応答 | チャットペイン |
| `code` | 生成されたコードブロック | チャットペイン（コードブロック表示） |
| `image` | 画像データ（Base64） | 画像ビューア（左下ペイン） |
| `map` | 2Dマップ座標データ | マップビューア（左上ペイン） |
| `highlight_room` | フロアプラン上の部屋をハイライト | マップビューア（左上ペイン） |
| `debug` | デバッグ情報（OutputParser結果） | デバッグビューア（右下ペイン） |
| `error` | エラーメッセージ | チャットペイン（エラー表示） |

---

### 1. user_message (ユーザーメッセージのエコーバック)

**説明**: サーバーが受信したユーザーメッセージの確認応答

**構造**:
```json
{
  "type": "user_message",
  "content": "ユーザーが送信したメッセージ"
}
```

**例**:
```json
{
  "type": "user_message",
  "content": "Show me 5 random coordinates on the map"
}
```

**送信タイミング** (`backend/main.py:60-63`):
- クライアントからメッセージを受信した直後

**フロントエンド処理** (`frontend/js/chat.js:117-120`):
- チャットペインにユーザーメッセージとして表示

---

### 2. text (エージェントのテキスト応答)

**説明**: Smolagentが生成したテキスト応答

**構造**:
```json
{
  "type": "text",
  "content": "エージェントの応答テキスト"
}
```

**例**:
```json
{
  "type": "text",
  "content": "Here are the basic statistics for the Titanic dataset:\n\nTotal passengers: 891\nSurvival rate: 38.4%"
}
```

**データソース** (`backend/agent_wrapper.py:195`):
- `agent_response["text"]` (smolagentの最終応答)

**フロントエンド処理** (`frontend/js/chat.js:122-125`):
- チャットペインにエージェント応答として表示

---

### 3. code (生成されたコードブロック)

**説明**: Smolagentが実行したPythonコード

**構造**:
```json
{
  "type": "code",
  "content": "Pythonコード文字列",
  "language": "プログラミング言語（デフォルト: python）",
  "step": "ステップ番号（オプション）"
}
```

**フィールド**:
- `content` (string, 必須): コードの内容
- `language` (string, オプション): プログラミング言語（デフォルト: `"python"`）
- `step` (string, オプション): ステップラベル（例: `"Step 1"`）

**例**:
```json
{
  "type": "code",
  "content": "import pandas as pd\nimport seaborn as sns\n\ndf = sns.load_dataset('titanic')\nprint(df.describe())",
  "language": "python",
  "step": "Step 1"
}
```

**データソース** (`backend/output_parser.py:190-269`):
- `agent_response["code_steps"]` - AgentWrapper が ActionStep から抽出
- マークダウンコードブロック（```）の検出
- ログからのコード抽出

**抽出ロジック** (`backend/agent_wrapper.py:169-186`):
```python
# ActionStep の tool_calls から python_interpreter を検出
if tool_call.name == "python_interpreter":
    code = args.get("code", str(args))
    code_steps.append({'code': code, 'step': f'Step {i+1}'})
```

**フロントエンド処理** (`frontend/js/chat.js:127-132`, `170-223`):
- VS Code風のダークテーマでコードブロック表示
- ステップラベル、言語バッジ、コピーボタンを含む

---

### 4. image (画像データ)

**説明**: 生成された画像（プロット、グラフなど）

**構造**:
```json
{
  "type": "image",
  "content": "Base64エンコードされた画像データ",
  "format": "画像フォーマット（png, jpg, etc.）",
  "path": "ファイルパス（オプション）"
}
```

**フィールド**:
- `content` (string, 必須): Base64エンコードされた画像データ
- `format` (string, 必須): 画像フォーマット（`png`, `jpg`, `jpeg`, `gif`, `bmp`, `svg`）
- `path` (string, オプション): ローカルファイルパス

**例**:
```json
{
  "type": "image",
  "content": "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
  "format": "png",
  "path": "plot.png"
}
```

**検出ロジック** (`backend/output_parser.py:75-120`):
1. 正規表現でファイルパスを検出: `([^\s]+\.(?:png|jpg|jpeg|gif|bmp|svg))`
2. ファイルが存在する場合、読み込んでBase64エンコード
3. Base64埋め込み画像も検出: `data:image/([^;]+);base64,([A-Za-z0-9+/=]+)`

**フロントエンド処理** (`frontend/js/image-viewer.js`):
- 画像ビューア（左下ペイン）に表示
- クリックで拡大表示機能

---

### 5. map (2Dマップ座標データ)

**説明**: 2D座標データ（緯度経度など）

**構造**:
```json
{
  "type": "map",
  "content": {
    "points": [
      {"lat": 緯度, "lon": 経度},
      ...
    ],
    "description": "説明文（オプション）"
  }
}
```

**フィールド**:
- `content.points` (array, 必須): 座標点の配列
  - `lat` (number): 緯度
  - `lon` (number): 経度
- `content.description` (string, オプション): データの説明

**例**:
```json
{
  "type": "map",
  "content": {
    "points": [
      {"lat": 35.6762, "lon": 139.6503},
      {"lat": 34.6937, "lon": 135.5023},
      {"lat": 43.0642, "lon": 141.3469}
    ],
    "description": "Major cities in Japan"
  }
}
```

**検出ロジック** (`backend/output_parser.py:122-188`):
1. マップ関連キーワードの検出: `coordinate`, `latitude`, `longitude`, `lat`, `lon`, `map`, etc.
2. 座標ペアの正規表現検出: `[-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+`
3. JSONオブジェクトからの抽出: `coordinates`, `points`, `locations`, `lat`, `lon` キーを持つオブジェクト

**フロントエンド処理** (`frontend/js/map-viewer.js`):
- Canvas 2Dマップビューア（左上ペイン）に座標をプロット
- 座標の自動スケーリングと中心揃え

---

### 6. highlight_room (部屋のハイライト)

**説明**: フロアプラン上の特定の部屋を青色でハイライト表示

**構造**:
```json
{
  "type": "highlight_room",
  "content": {
    "rooms": ["部屋名1", "部屋名2", ...]
  }
}
```

**フィールド**:
- `content.rooms` (array, 必須): ハイライトする部屋名の配列
  - サポートされる部屋名: `Room1`, `Room2`, `Bathroom`, `Kitchen`, `Toilet`, `Level1`, `Level2`

**例**:
```json
{
  "type": "highlight_room",
  "content": {
    "rooms": ["Kitchen", "Bathroom"]
  }
}
```

**検出ロジック** (`backend/output_parser.py:310-333`):
1. エージェントのテキスト応答から部屋名を検索（大文字小文字を区別しない）
2. 正規表現パターン: `\b部屋名\b` で単語境界を考慮した検索
3. 検出された部屋名をリストとして返す

**送信タイミング** (`backend/main.py:73-85`):
- エージェントがテキスト応答に部屋名を含む場合、自動的に送信される

**フロントエンド処理** (`frontend/js/map-viewer.js:387-405`, `frontend/js/app.js:74-81`):
- マップビューアの `highlightRooms()` メソッドを呼び出し
- ハイライトされた部屋は青色（#0066ff）の枠と塗りつぶしで表示
- 通常の部屋は赤色（#ff0000）で表示
- ハイライトされた部屋名は太字で大きく表示

---

### 7. debug (デバッグ情報)

**説明**: OutputParserの処理結果とエージェント応答の詳細

**構造**:
```json
{
  "type": "debug",
  "content": {
    "agent_response": {
      "text": "エージェントのテキスト応答",
      "raw_output": "生の出力",
      "code_steps": [...],
      "logs": [...]
    },
    "parsed_outputs": [
      {...出力オブジェクト1...},
      {...出力オブジェクト2...}
    ],
    "output_count": 出力の数
  }
}
```

**フィールド**:
- `content.agent_response` (object): AgentWrapperの生レスポンス
- `content.parsed_outputs` (array): OutputParserが分類した出力リスト
- `content.output_count` (number): 出力の総数

**例**:
```json
{
  "type": "debug",
  "content": {
    "agent_response": {
      "text": "Dataset loaded successfully",
      "raw_output": "...",
      "code_steps": [{"code": "df = sns.load_dataset('titanic')", "step": "Step 1"}],
      "logs": []
    },
    "parsed_outputs": [
      {"type": "code", "content": "...", "step": "Step 1"},
      {"type": "text", "content": "Dataset loaded successfully"}
    ],
    "output_count": 2
  }
}
```

**送信タイミング** (`backend/main.py:73-81`):
- OutputParserが応答を解析した後、他のメッセージ送信前

**フロントエンド処理** (`frontend/js/debug-viewer.js`):
- デバッグビューア（右下ペイン）にJSON形式で表示
- Pretty print 切り替え、クリア機能、タイムスタンプ付き

---

### 7. error (エラーメッセージ)

**説明**: エージェント処理中に発生したエラー

**構造**:
```json
{
  "type": "error",
  "content": "エラーメッセージ文字列"
}
```

**例**:
```json
{
  "type": "error",
  "content": "Error processing request: Connection timeout"
}
```

**送信タイミング** (`backend/main.py:87-92`):
- AgentWrapper実行時に例外が発生した場合

**フロントエンド処理** (`frontend/js/chat.js:134-137`):
- チャットペインにエラーメッセージとして表示（赤色ハイライト）

---

## メッセージシーケンス

### 典型的なリクエスト-レスポンスフロー

```
クライアント → サーバー
{
  "message": "Load the Titanic dataset and show statistics"
}

サーバー → クライアント (1. ユーザーメッセージのエコー)
{
  "type": "user_message",
  "content": "Load the Titanic dataset and show statistics"
}

サーバー → クライアント (2. デバッグ情報)
{
  "type": "debug",
  "content": {
    "agent_response": {...},
    "parsed_outputs": [...],
    "output_count": 3
  }
}

サーバー → クライアント (3. 生成されたコード)
{
  "type": "code",
  "content": "df = sns.load_dataset('titanic')\nprint(df.describe())",
  "step": "Step 1",
  "language": "python"
}

サーバー → クライアント (4. テキスト応答)
{
  "type": "text",
  "content": "Here are the basic statistics..."
}

サーバー → クライアント (5. 画像データ - もしあれば)
{
  "type": "image",
  "content": "iVBORw0KGgo...",
  "format": "png"
}
```

### 処理フロー (`backend/main.py:47-96`)

1. クライアントがメッセージ送信
2. サーバーが `user_message` をエコーバック
3. AgentWrapper が smolagent を実行
4. OutputParser が応答を解析
5. サーバーが `debug` メッセージ送信
6. 各出力タイプ（code, text, image, map）を順次送信
7. エラーが発生した場合、`error` メッセージ送信

---

## データ構造詳細

### AgentWrapper レスポンス構造

**ファイル**: `backend/agent_wrapper.py:194-202`

```python
{
    "text": str,           # エージェントの最終テキスト応答
    "images": [],          # (未使用 - OutputParserが埋める)
    "map_data": None,      # (未使用 - OutputParserが埋める)
    "raw_output": str,     # stdout/stderrの生出力
    "result": str | None,  # FinalAnswerStep の出力
    "code_steps": [        # 実行されたコードのリスト
        {
            "code": str,   # Pythonコード
            "step": str    # "Step 1", "Step 2", etc.
        },
        ...
    ],
    "logs": [              # ActionStepのログ情報
        {
            "step_number": int,
            "tool_calls": [str, ...]  # ツール名のリスト
        },
        ...
    ]
}
```

### OutputParser 出力構造

**ファイル**: `backend/output_parser.py:27-73`

```python
[
    {
        "type": "code",
        "content": str,
        "language": str,
        "step": str  # オプション
    },
    {
        "type": "text",
        "content": str
    },
    {
        "type": "image",
        "content": str,  # Base64
        "format": str,
        "path": str  # オプション
    },
    {
        "type": "map",
        "content": {
            "points": [{"lat": float, "lon": float}, ...],
            "description": str
        }
    },
    {
        "type": "error",
        "content": str
    }
]
```

---

## エラーハンドリング

### WebSocket切断

**シナリオ**: クライアントまたはサーバー側のネットワーク障害

**サーバー側** (`backend/main.py:94-96`):
```python
except WebSocketDisconnect:
    manager.disconnect(websocket)
    print("Client disconnected")
```

**クライアント側** (`frontend/js/chat.js:63-73`):
```javascript
this.ws.onclose = () => {
    this.isConnected = false;
    this.updateStatus('disconnected', 'Disconnected');

    // 3秒後に自動再接続
    setTimeout(() => {
        this.connect();
    }, 3000);
};
```

### エージェント実行エラー

**シナリオ**: smolagent の実行中にエラーが発生

**処理** (`backend/main.py:87-92`):
```python
except Exception as e:
    await manager.send_message({
        "type": "error",
        "content": f"Error processing request: {str(e)}"
    }, websocket)
```

**クライアント表示**:
- チャットペインに赤色でエラーメッセージ表示

### JSON パースエラー

**シナリオ**: 不正なJSON形式のメッセージを受信

**処理** (`frontend/js/chat.js:49-56`):
```javascript
this.ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
    } catch (error) {
        console.error('Error parsing message:', error);
    }
};
```

---

## セキュリティ考慮事項

### CORS設定

現在の実装では、FastAPIのデフォルト設定を使用しています。本番環境では、適切なCORS設定が必要です。

### WebSocket認証

現在は認証なしの接続を許可しています。本番環境では、トークンベースの認証を追加することを推奨します。

### コード実行

smolagentはユーザー入力を基にコードを生成・実行します。以下のセキュリティ対策が実施されています：

**制限事項** (`backend/agent_wrapper.py:66`):
```python
additional_authorized_imports=['numpy', 'pandas', 'matplotlib.pyplot', 'seaborn', 'sklearn']
```

- インポート可能なモジュールを制限
- ファイルシステムアクセスの制限（Pythonサンドボックス環境推奨）

---

## パフォーマンス考慮事項

### 非同期処理

**AgentWrapper** (`backend/agent_wrapper.py:104-111`):
```python
# 非同期エグゼキューターでブロッキングを回避
loop = asyncio.get_event_loop()
result = await loop.run_in_executor(
    None,
    self._run_agent_sync,
    user_input
)
```

### ストリーミング

**smolagent ストリーミング** (`backend/agent_wrapper.py:149`):
```python
for event in self.agent.run(user_input, stream=True):
    # ActionStep と FinalAnswerStep をリアルタイム処理
```

---

## 拡張性

### カスタムツールの追加

**例** (`backend/agent_wrapper.py:18-34`):
```python
from smolagents import tool

@tool
def get_titanic_data() -> dict:
    """Returns titanic dataset in a dictionary format."""
    df = sns.load_dataset('titanic')
    return df.to_dict()

# Agent初期化時にツールを追加
self.agent = CodeAgent(
    tools=[get_titanic_data, save_data],
    model=model
)
```

### 新しい出力タイプの追加

1. `backend/output_parser.py` に新しい抽出メソッドを追加
2. `OutputParser.parse()` で新しいタイプを処理
3. フロントエンドで新しいビューアを実装
4. `frontend/js/app.js` でメッセージルーティングを追加

---

## バージョン情報

- **API バージョン**: 1.0
- **WebSocket プロトコル**: JSON
- **最終更新**: 2025-10-15
