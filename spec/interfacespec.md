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
| `map_definition` | マップ定義（フロア、座標系、ビットマップ） | マップビューア（左上ペイン）初期化 |
| `map` | マップ表示命令（矩形ハイライト、オーバーレイ） | マップビューア（左上ペイン） |
| `highlight_room` | フロアプラン上の部屋をハイライト（レガシー） | マップビューア（左上ペイン） |
| `arrow` | フロアプラン上の部屋に方向矢印を表示（レガシー） | マップビューア（左上ペイン） |
| `clear_arrows` | フロアプラン上のすべての矢印をクリア（レガシー） | マップビューア（左上ペイン） |
| `clear_map` | マップのハイライトとオーバーレイをクリア | マップビューア（左上ペイン） |
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

**検出ロジック** (`backend/output_parser.py:107-195`):
1. **code_stepsから画像生成コードを検出**:
   - `plt.savefig()`, `fig.savefig()`, `matplotlib.pyplot.savefig()` のパターン
   - `.save()`, `.to_file()` などの画像保存メソッド
2. **正規表現でファイルパスを検出**: `([^\s]+\.(?:png|jpg|jpeg|gif|bmp|svg))`
3. **複数の場所を検索**: カレントディレクトリ、backend/、backend/data/、プロジェクトルート
4. **ファイルが見つかった場合、読み込んでBase64エンコード**
5. **Base64埋め込み画像も検出**: `data:image/([^;]+);base64,([A-Za-z0-9+/=]+)`

**フロントエンド処理** (`frontend/js/image-viewer.js`):
- 画像ビューア（左下ペイン）に表示
- クリックで拡大表示機能

---

### 5. map_definition (マップ定義データ)

**説明**: マルチフロア建物のマップ定義（静的データ）。フロア画像、座標系、矩形領域、ビットマップカタログを含む。

**構造**:
```json
{
  "type": "map_definition",
  "content": {
    "floors": [Floor],
    "bitmaps": [Bitmap]
  }
}
```

**Floor型**:
- `floorId` (string): 階の一意識別子（例: "1F", "2F", "B1"）
- `floorName` (string): 階の表示名（例: "1階", "地下1階"）
- `floorImage` (string): 平面図画像ファイル名
- `coordinateSystem` (object): 座標系定義（topLeft, bottomRight）
- `rectangles` (array): 矩形領域の配列（name, topLeft, bottomRight）

**Bitmap型**:
- `bitmapId` (string): ビットマップの一意識別子
- `bitmapName` (string): ビットマップの表示名
- `bitmapFile` (string): ビットマップファイル名

**送信タイミング** (`backend/main.py`):
- WebSocket接続直後に自動送信される（初回のみ）

**フロントエンド処理** (`frontend/js/map-viewer.js:719-738`):
- `loadMapDefinition()` でマップ定義を読み込み
- ビットマップカタログをプリロード
- 最初のフロアを表示

**詳細仕様**: `spec/2Dmapインターフェイス_20251029a.md` 参照

---

### 6. map (マップ表示命令)

**説明**: フロアプランに矩形ハイライトやオーバーレイ（ビットマップ・テキスト）を表示する命令。

**新フォーマット（v1.2+）**:
```json
{
  "type": "map",
  "content": {
    "floorId": "1F",
    "timestamp": "2025-10-30T10:30:00Z",
    "rectangles": [
      {
        "name": "Room1",
        "color": "#FF0000",
        "strokeOpacity": 1.0,
        "fillOpacity": 0.3,
        "showName": true
      }
    ],
    "overlays": [
      {
        "type": "bitmap",
        "bitmapId": "arrow_up",
        "position": {"type": "rectangle", "name": "Room1"}
      },
      {
        "type": "text",
        "text": "Exit",
        "fontSize": 14,
        "color": "#000000",
        "position": {"type": "coordinate", "x": 50.0, "y": 30.0}
      }
    ]
  }
}
```

**フィールド（新フォーマット）**:
- `floorId` (string): 表示対象の階ID
- `timestamp` (string): コマンド発行時刻（ISO 8601形式）
- `rectangles` (array): ハイライト表示する矩形の配列
- `overlays` (array): オーバーレイ表示要素（ビットマップ・テキスト）

**検出ロジック** (`backend/output_parser.py:455-498`):
- `MAP_COMMAND: {json}` パターンを検出
- `show_map()` ツールの実行結果から抽出

**データソース** (`backend/agent_wrapper.py:171-324`):
- `show_map()` ツールの実行結果

**レガシーフォーマット（v1.0）**:
座標データ（緯度経度など）の古いフォーマットも引き続きサポート：
```json
{
  "type": "map",
  "content": {
    "points": [{"lat": 35.6762, "lon": 139.6503}],
    "description": "Major cities in Japan"
  }
}
```

**フロントエンド処理** (`frontend/js/map-viewer.js`):
- 新フォーマット: `handleMapCommand()` でフロア切り替え、矩形ハイライト、オーバーレイ表示
- レガシー: Canvas 2Dマップビューアに座標をプロット

**詳細仕様**: `spec/2Dmapインターフェイス_20251029a.md` 参照

---

### 7. highlight_room (部屋のハイライト) - レガシー

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

### 8. arrow (方向矢印表示) - レガシー

**説明**: フロアプラン上の指定した部屋に方向矢印（上下左右）を表示

**構造**:
```json
{
  "type": "arrow",
  "content": {
    "room": "部屋名",
    "direction": "矢印の方向"
  }
}
```

**フィールド**:
- `content.room` (string, 必須): 矢印を表示する部屋名
  - サポートされる部屋名: `Room1`, `Room2`, `Bathroom`, `Kitchen`, `Toilet`, `Level1`, `Level2`
- `content.direction` (string, 必須): 矢印の方向
  - サポートされる方向: `up`, `down`, `left`, `right`

**例**:
```json
{
  "type": "arrow",
  "content": {
    "room": "Kitchen",
    "direction": "left"
  }
}
```

**検出ロジック** (`backend/output_parser.py:339-409`):
1. `code_steps` から `draw_arrow()` 関数呼び出しを検出
   - パターン: `draw_arrow\s*\(\s*room_name\s*=\s*["']([^"']+)["']\s*,\s*direction\s*=\s*["']([^"']+)["']\s*\)`
2. `ARROW_COMMAND: room=RoomName, direction=direction` パターンを検出
3. 重複チェックを行い、同じ矢印は一度だけ送信

**データソース** (`backend/agent_wrapper.py:138-158`):
- `draw_arrow(room_name, direction)` ツールの実行結果
- ツールは `ARROW_COMMAND: room=部屋名, direction=方向` を返す

**送信タイミング** (`backend/main.py`):
- エージェントが `draw_arrow()` ツールを呼び出した後、自動的に送信される

**フロントエンド処理** (`frontend/js/map-viewer.js:387-399`, `frontend/js/app.js:83-90`):
- マップビューアの `addArrow(room, direction)` メソッドを呼び出し
- 矢印ビットマップ画像 (`/backend/bitmaps/arrow_*.bmp`) を部屋の中央に表示
- 矢印サイズは部屋サイズの40%（最小30px、最大80px）

**使用例**:
```
ユーザー: "Bathroomに左矢印を表示して"
エージェント: draw_arrow("Bathroom", "left") を実行
結果: Bathroomの中央に左向き矢印が表示される
```

---

### 9. clear_arrows (矢印クリア) - レガシー

**説明**: フロアプラン上に表示されているすべての矢印をクリア

**構造**:
```json
{
  "type": "clear_arrows",
  "content": {}
}
```

**フィールド**:
- `content` (object): 空のオブジェクト（追加情報なし）

**例**:
```json
{
  "type": "clear_arrows",
  "content": {}
}
```

**検出ロジック** (`backend/output_parser.py:411-443`):
1. `code_steps` から `clear_arrows()` 関数呼び出しを検出
2. `CLEAR_ARROWS_COMMAND` パターンを検出

**データソース** (`backend/agent_wrapper.py:161-168`):
- `clear_arrows()` ツールの実行結果
- ツールは `CLEAR_ARROWS_COMMAND` を返す

**送信タイミング** (`backend/main.py`):
- エージェントが `clear_arrows()` ツールを呼び出した後、自動的に送信される

**フロントエンド処理** (`frontend/js/map-viewer.js:404-408`, `frontend/js/app.js:92-97`):
- マップビューアの `clearArrows()` メソッドを呼び出し
- `this.arrows = []` で矢印配列をクリア
- マップを再描画して矢印を削除

**UI操作**:
- マップビューア右上の「Clear Arrows」ボタンをクリックすることでも矢印をクリア可能
- ボタンは `frontend/index.html:15-18` で定義

**使用例**:
```
方法1: チャットコマンド
ユーザー: "矢印をクリアして"
エージェント: clear_arrows() を実行
結果: すべての矢印が消える

方法2: UIボタン
ユーザー: 「Clear Arrows」ボタンをクリック
結果: すべての矢印が即座に消える
```

---

### 10. clear_map (マップクリア)

**説明**: フロアプラン上に表示されているすべてのハイライトとオーバーレイをクリア

**構造**:
```json
{
  "type": "clear_map",
  "content": {}
}
```

**フィールド**:
- `content` (object): 空のオブジェクト（追加情報なし）

**例**:
```json
{
  "type": "clear_map",
  "content": {}
}
```

**検出ロジック** (`backend/output_parser.py:500-532`):
1. `code_steps` から `clear_map()` 関数呼び出しを検出
2. `CLEAR_MAP_COMMAND` パターンを検出

**データソース** (`backend/agent_wrapper.py:327-334`):
- `clear_map()` ツールの実行結果
- ツールは `CLEAR_MAP_COMMAND` を返す

**送信タイミング** (`backend/main.py`):
- エージェントが `clear_map()` ツールを呼び出した後、自動的に送信される

**フロントエンド処理** (`frontend/js/map-viewer.js:708-713`, `frontend/js/app.js:111-116`):
- マップビューアの `clearMap()` メソッドを呼び出し
- `this.displayRectangles = []` と `this.overlays = []` でクリア
- マップを再描画してクリーンな状態に戻す

**使用例**:
```
ユーザー: "マップをクリアして"
エージェント: clear_map() を実行
結果: すべてのハイライトとオーバーレイが消える
```

---

### 11. debug (デバッグ情報)

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

### 12. error (エラーメッセージ)

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
6. 各出力タイプ（code, text, image, map, arrow, clear_arrows, highlight_room）を順次送信
7. エラーが発生した場合、`error` メッセージ送信

### 矢印表示のリクエスト-レスポンスフロー

```
クライアント → サーバー
{
  "message": "Kitchenに左矢印を表示して"
}

サーバー → クライアント (1. ユーザーメッセージのエコー)
{
  "type": "user_message",
  "content": "Kitchenに左矢印を表示して"
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
  "content": "draw_arrow(room_name=\"Kitchen\", direction=\"left\")\nfinal_answer(\"左矢印がKitchenに描かれました。\")",
  "step": "Step 1",
  "language": "python"
}

サーバー → クライアント (4. 矢印表示コマンド)
{
  "type": "arrow",
  "content": {
    "room": "Kitchen",
    "direction": "left"
  }
}

サーバー → クライアント (5. テキスト応答)
{
  "type": "text",
  "content": "左矢印がKitchenに描かれました。"
}

フロントエンド処理:
- chat.js: arrowメッセージを受信し、notifyHandlers()を呼び出し
- app.js: arrowメッセージをMapViewerにルーティング
- map-viewer.js: addArrow("Kitchen", "left")を実行
- Canvas: Kitchenの中央に左矢印ビットマップを描画
```

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

**ファイル**: `backend/output_parser.py:27-95`

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
        "type": "highlight_room",
        "content": {
            "rooms": [str, ...]
        }
    },
    {
        "type": "arrow",
        "content": {
            "room": str,
            "direction": str  # "up", "down", "left", "right"
        }
    },
    {
        "type": "clear_arrows",
        "content": {}
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

#### 基本的なツールの例

**データ取得ツール** (`backend/agent_wrapper.py:126-135`):
```python
from smolagents import tool

@tool
def save_data(dataset: dict, file_name: str) -> None:
    """Takes the dataset in a dictionary format and saves it as a csv file.

    Args:
        dataset: dataset in a dictionary format
        file_name: name of the file of the saved dataset
    """
    df = pd.DataFrame(dataset)
    df.to_csv(f'{file_name}.csv', index = False)
```

#### UI統合ツールの例

**矢印表示ツール** (`backend/agent_wrapper.py:138-158`):
```python
@tool
def draw_arrow(room_name: str, direction: str) -> str:
    """Draws an arrow in the specified room on the floor plan map.

    Args:
        room_name: Name of the room where the arrow should be displayed
                   (e.g., 'Bathroom', 'Kitchen', 'Room1', 'Room2', 'Toilet', 'Level1', 'Level2')
        direction: Direction of the arrow - must be one of: 'up', 'down', 'left', 'right'

    Returns:
        A confirmation message that the arrow will be displayed
    """
    # Validate direction
    valid_directions = ['up', 'down', 'left', 'right']
    if direction.lower() not in valid_directions:
        return f"Error: Invalid direction '{direction}'. Must be one of: {', '.join(valid_directions)}"

    # Return arrow command - this will be parsed by output_parser
    return f"ARROW_COMMAND: room={room_name}, direction={direction.lower()}"
```

**矢印クリアツール** (`backend/agent_wrapper.py:161-168`):
```python
@tool
def clear_arrows() -> str:
    """Clears all arrows from the floor plan map.

    Returns:
        A confirmation message that arrows will be cleared
    """
    return "CLEAR_ARROWS_COMMAND"
```

**マップ表示ツール** (`backend/agent_wrapper.py:171-324`):
```python
@tool
def show_map(
    floor_id: str,
    highlight_rooms: str = "",
    room_colors: str = "",
    show_names: bool = True,
    bitmap_overlays: str = "",
    text_overlays: str = ""
) -> str:
    """Display a floor plan with optional highlighted rooms and overlays (bitmaps/text).

    Args:
        floor_id: ID of the floor to display (e.g., "1F", "2F", "B1")
        highlight_rooms: Comma-separated list of room names to highlight
        room_colors: Comma-separated list of colors in hex format for each room
        show_names: Whether to show room names on highlighted rooms (default True)
        bitmap_overlays: Bitmap overlays as semicolon-separated entries
                         Format: "bitmap_id:room_name" or "bitmap_id:x,y"
                         Example: "arrow_up:Room1;person:50.5,30.2"
        text_overlays: Text overlays as semicolon-separated entries
                       Format: "text:room_name" or "text:x,y"
                       Example: "Exit:Room1;Warning:45.0,60.0"

    Returns:
        A command string that will be parsed to display the map

    Examples:
        # Show floor 1F with Room1 highlighted in red
        show_map(floor_id="1F", highlight_rooms="Room1", room_colors="#FF0000")

        # Show room with person icon and name label
        show_map(floor_id="1F", highlight_rooms="Room1", room_colors="#FFD700",
                 bitmap_overlays="person:Room1", text_overlays="John:Room1")
    """
    # ... implementation returns MAP_COMMAND: {json}
```

**マップクリアツール** (`backend/agent_wrapper.py:327-334`):
```python
@tool
def clear_map() -> str:
    """Clears all highlights and overlays from the floor plan map, returning to default view.

    Returns:
        A command string that will clear the map display
    """
    return "CLEAR_MAP_COMMAND"
```

#### Agent初期化時にツールを登録

**ツール登録** (`backend/agent_wrapper.py:370-374`):
```python
# Create agent with custom tools
self.agent = CodeAgent(
    tools=[sql_engine, save_data, draw_arrow, clear_arrows, show_map, clear_map],
    model=model,
    additional_authorized_imports=['numpy', 'pandas', 'matplotlib.pyplot', 'seaborn', 'sklearn'],
)
```

#### UI統合のポイント

1. **コマンドパターンの使用**: ツールは特殊な文字列（例: `ARROW_COMMAND:`）を返し、OutputParserがこれを検出してフロントエンドメッセージに変換
2. **OutputParserでの検出**: `_extract_arrows()` メソッドでコマンド文字列やcode_stepsから関数呼び出しを検出
3. **フロントエンドへの送信**: 検出された情報を適切なメッセージタイプ（`arrow`、`clear_arrows`）に変換して送信
4. **UIコンポーネントへのルーティング**: `app.js` でメッセージタイプに応じて適切なビューア（MapViewer）のメソッドを呼び出し

### 新しい出力タイプの追加

1. `backend/output_parser.py` に新しい抽出メソッドを追加
2. `OutputParser.parse()` で新しいタイプを処理
3. フロントエンドで新しいビューアを実装
4. `frontend/js/app.js` でメッセージルーティングを追加

---

## バージョン情報

- **API バージョン**: 1.2
- **WebSocket プロトコル**: JSON
- **最終更新**: 2025-10-30

### 変更履歴

#### v1.2 (2025-10-30)
- **マルチフロア対応**: 新しい2Dマップインターフェースを実装（`spec/2Dmapインターフェイス_20251029a.md`参照）
- 新しいメッセージタイプを追加:
  - `map_definition`: マップ定義データ（フロア、座標系、ビットマップカタログ）
  - `clear_map`: マップのハイライトとオーバーレイをクリア
- `map` メッセージタイプの新フォーマット:
  - 矩形ハイライト（色、透明度、名前表示のカスタマイズ）
  - オーバーレイシステム（ビットマップ・テキスト）
  - 位置指定（矩形名 or 仮想座標）
- 新しいエージェントツールを追加:
  - `show_map()`: フロアプランに矩形とオーバーレイを表示
  - `clear_map()`: マップ表示をクリア
- **画像検出の改善**:
  - `code_steps`から`plt.savefig()`などの画像生成コードを検出
  - 複数の場所を検索（カレントディレクトリ、backend/、backend/data/、プロジェクトルート）
- **highlight_room表示の修正**: 新しいマルチフロアシステムで正しく動作するように修正
- レガシーサポート: `arrow`, `clear_arrows`, `highlight_room`, 旧`map`フォーマットは引き続きサポート

#### v1.1 (2025-10-29)
- 新しいメッセージタイプを追加: `arrow`, `clear_arrows`
- 新しいエージェントツールを追加: `draw_arrow()`, `clear_arrows()`
- MapViewerにUI操作ボタンを追加: "Clear Arrows"ボタン
- フロアプラン上に方向矢印を表示する機能を実装
- ビットマップ画像リソースを追加: `/backend/bitmaps/arrow_*.bmp`

#### v1.0 (2025-10-15)
- 初期リリース
- 基本的なメッセージタイプ: `user_message`, `text`, `code`, `image`, `map`, `highlight_room`, `debug`, `error`
- WebSocket双方向通信
- 4ペインレイアウト（マップ、画像、チャット、デバッグ）
