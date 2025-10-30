# Smolagent UI Wrapper

smolagent（https://github.com/huggingface/smolagents）のUIラッパー実装です。

## 概要

このプロジェクトは、smolagentのチャットインターフェイスを提供し、agentの出力を以下の4つのペインに自動的に振り分けます：

- **左上ペイン**: 2Dマップ表示（座標データ）
- **左下ペイン**: 画像表示（プロット、グラフなど）
- **右上ペイン**: チャットインターフェイス（テキスト出力、**生成コード表示**）
- **右下ペイン**: デバッグビューア（OutputParserの結果をJSON形式で表示）

### UI レイアウト

```
┌─────────────┬─────────────┐
│  2D Map     │  Chat       │
│  (左上)     │  (右上)     │  ← 生成されたコードはここに表示
├─────────────┼─────────────┤
│  Images     │  Debug      │
│  (左下)     │  (右下)     │  ← Parser結果をJSON表示
└─────────────┴─────────────┘
```

## プロジェクト構造

```
smolagentUI/
├── backend/                    # Python FastAPI バックエンド
│   ├── main.py                # FastAPI アプリ、WebSocket
│   ├── agent_wrapper.py       # smolagent 統合 (Google Gemini 2.5 Flash)
│   ├── output_parser.py       # 出力タイプ判定 (コード抽出含む)
│   ├── requirements.txt       # Python 依存関係
│   ├── .env.example           # 環境変数のサンプル
│   ├── bitmaps/               # 矢印ビットマップ画像
│   │   ├── arrow_up.bmp      # 上矢印
│   │   ├── arrow_down.bmp    # 下矢印
│   │   ├── arrow_left.bmp    # 左矢印
│   │   └── arrow_right.bmp   # 右矢印
│   └── data/                  # データファイル
│       ├── OSM_floor.png      # フロアプラン画像
│       ├── OSM_floor-plan-rectangles.json  # 部屋座標データ
│       └── dfall.csv          # センサーデータ
├── frontend/                  # フロントエンド UI
│   ├── index.html            # 4ペインレイアウト
│   ├── css/
│   │   └── styles.css        # スタイルシート (コードブロック含む)
│   └── js/
│       ├── app.js            # メインアプリケーション
│       ├── chat.js           # チャット機能 (コードブロック表示)
│       ├── map-viewer.js     # 2Dマップビューア
│       ├── image-viewer.js   # 画像ビューア
│       └── debug-viewer.js   # デバッグビューア (JSON表示)
├── spec/
│   ├── DataAgent.py          # サンプル分析agent
│   ├── sampleGradio.py       # Gradio UI参考実装
│   ├── interfacespec.md      # インターフェイス仕様書（v1.2）
│   ├── 2Dmapインターフェイス_20251029a.md  # 新2Dマップ仕様
│   └── specification.md      # 仕様書
└── .claude/
    └── instructions.md       # プロジェクト説明
```

## セットアップ

### 1. Python環境のセットアップ

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 環境変数の設定（必須）

Google Gemini APIキーを設定します：

```bash
cd backend
cp .env.example .env
# .envファイルを編集してGOOGLE_API_KEYを設定
```

**.env** ファイルの内容：
```
GOOGLE_API_KEY=your_google_api_key_here
```

**Google Gemini APIキーの取得方法：**
1. https://aistudio.google.com/apikey にアクセス
2. Google アカウントでログイン
3. "Create API Key" をクリック
4. 生成されたキーを `.env` ファイルに貼り付け

### 3. サーバーの起動

```bash
cd backend
python main.py
```

サーバーは http://localhost:8000 で起動します。

### 4. ブラウザでアクセス

```
http://localhost:8000
```

## 使い方

### 基本的な使い方

1. ブラウザで http://localhost:8000 を開く
2. 右上ペインのチャット入力欄にメッセージを入力
3. "Send"ボタンをクリック、またはEnterキーで送信
4. Agentの応答が各ペインに自動的に表示されます：
   - **生成されたコード** → 右上ペイン（チャット）にコードブロックで表示
   - **テキスト出力** → 右上ペイン（チャット）
   - **画像・プロット** → 左下ペイン
   - **座標データ** → 左上ペイン（マップ）
   - **デバッグ情報** → 右下ペイン（JSON形式）

### コードブロック機能

smolagentsが生成したPythonコードは、自動的にチャット画面に表示されます：

- ✅ VS Code風のダークテーマ
- ✅ ステップ番号表示（Step 1, Step 2, ...）
- ✅ 言語バッジ（PYTHON）
- ✅ **コピーボタン** - ワンクリックでコードをクリップボードにコピー
- ✅ シンタックスハイライト対応

### サンプルクエリ

**Titanicデータセット分析用：**
```
- "Load the Titanic dataset and show me basic statistics"
- "Create a survival rate plot by passenger class"
- "Analyze the correlation between age and survival"
- "Show me the distribution of passengers by gender"
- "Generate a heatmap of feature correlations"
- "Save the Titanic dataset to a CSV file"
```

**フロアプランマップ表示（新機能）：**
```
- "1階のRoom1を赤色でハイライトして"
- "Show Room1 and Bathroom with different colors"
- "Display a person icon in Kitchen"
- "Show an up arrow in Room1 with the text 'Exit'"
- "Clear the map"
```

**フロアプラン矢印表示（レガシー）：**
```
- "Bathroomに左矢印を表示して"
- "Show a right arrow in Kitchen"
- "Display an up arrow in Room1 and a down arrow in Room2"
- "Toiletに上矢印を表示"
```

**その他：**
```
- "Generate a line plot with sine wave"
- "Create a scatter plot with random data"
- "Show me 5 random coordinates on the map"
```

## 機能

### バックエンド

- **FastAPI + WebSocket**: リアルタイム通信
- **Google Gemini 2.5 Flash**: LiteLLM経由で高性能なLLMを使用
- **agent_wrapper.py**: smolagentの実行とストリーム処理
  - `ActionStep`イベントからコード抽出
  - `stream=True`でリアルタイム処理
  - カスタムツール対応：
    - `sql_engine`: SQLデータベースクエリ実行
    - `save_data`: データをCSVファイルに保存
    - `show_map`: フロアプランに矩形ハイライトとオーバーレイを表示（v1.2新機能）
    - `clear_map`: マップ表示をクリア（v1.2新機能）
    - `draw_arrow`: フロアプランに方向矢印を表示（レガシー）
    - `clear_arrows`: 矢印をクリア（レガシー）
- **output_parser.py**: 出力の自動分類
  - **コードブロック抽出**（`python_interpreter`ツールコール）
  - **画像ファイル検出の改善**（v1.2）:
    - `code_steps`から`plt.savefig()`などを検出
    - 複数の場所を検索（.png, .jpg, etc）
  - Base64エンコード画像検出
  - 座標データ検出（lat/lon）
  - **マップコマンド抽出**（`MAP_COMMAND`、`CLEAR_MAP_COMMAND`パターン）
  - 矢印コマンド抽出（`ARROW_COMMAND`、`CLEAR_ARROWS_COMMAND`パターン）

### フロントエンド

- **4ペインレイアウト**: レスポンシブデザイン
- **チャット機能**: WebSocketによるリアルタイム通信
  - **コードブロック表示**（VS Code風ダークテーマ）
  - コピーボタン付き
  - ステップ番号表示
- **マップビューア**: Canvas でフロアプランとオーバーレイを表示
  - **マルチフロア対応**（v1.2新機能）:
    - フロア定義の動的読み込み（map_definition）
    - 仮想座標系による正確な位置指定
    - ビットマップカタログのプリロード
  - **矩形ハイライト**: 色・透明度・名前表示のカスタマイズ
  - **オーバーレイシステム**: ビットマップ・テキストの任意位置配置
    - 矩形名による位置指定（矩形の中央に配置）
    - 仮想座標(x,y)による位置指定
  - フロアプラン背景画像（OSM_floor.png）
  - 部屋矩形のオーバーレイ表示
  - 部屋のハイライト機能（レガシー対応）
  - 方向矢印表示（レガシー対応）
- **画像ビューア**: クリックで拡大表示
- **デバッグビューア**: OutputParserの結果をJSON形式でリアルタイム表示
  - Pretty print切り替え
  - クリアボタン
  - タイムスタンプ付き

## 開発

### カスタムツールの追加

`spec/DataAgent.py` を参考にして、カスタムツールを作成できます：

```python
from smolagents import tool

@tool
def my_custom_tool(param: str) -> str:
    """ツールの説明"""
    # 処理
    return result
```

#### show_map ツールの使用例（v1.2新機能）

`show_map` ツールを使って、フロアプランに矩形ハイライトとオーバーレイを表示できます：

```python
from smolagents import tool

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
    """
    # ... implementation
```

**使用例:**
- エージェントに「1階のRoom1を赤色でハイライトして」と指示すると、エージェントが自動的に `show_map(floor_id="1F", highlight_rooms="Room1", room_colors="#FF0000")` を呼び出します
- 「Kitchenに人のアイコンを表示」→ `show_map(floor_id="1F", bitmap_overlays="person:Kitchen")`
- 「Room1に上矢印とExitという文字を表示」→ `show_map(floor_id="1F", bitmap_overlays="arrow_up:Room1", text_overlays="Exit:Room1")`
- 複数の部屋、オーバーレイを同時に表示することも可能です
- マップをクリアするには `clear_map()` を呼び出します

**利用可能なビットマップ:**
- `arrow_up`, `arrow_down`, `arrow_left`, `arrow_right`: 方向矢印
- `person`, `warning`: その他のアイコン（拡張可能）

#### draw_arrow ツールの使用例（レガシー）

`draw_arrow` ツールを使って、フロアプランに方向矢印を表示できます（レガシー機能）：

```python
from smolagents import tool

@tool
def draw_arrow(room_name: str, direction: str) -> str:
    """Draws an arrow in the specified room on the floor plan map.

    Args:
        room_name: Name of the room (e.g., 'Bathroom', 'Kitchen', 'Room1', 'Room2', 'Toilet', 'Level1', 'Level2')
        direction: Direction of the arrow - must be one of: 'up', 'down', 'left', 'right'

    Returns:
        A confirmation message that the arrow will be displayed
    """
    return f"ARROW_COMMAND: room={room_name}, direction={direction.lower()}"
```

**使用例:**
- エージェントに「Bathroomに左矢印を表示して」と指示すると、エージェントが自動的に `draw_arrow("Bathroom", "left")` を呼び出します
- 矢印は対応する部屋の中央に表示されます
- 複数の矢印を同時に表示することも可能です
- **注**: 新しい実装では `show_map()` の使用を推奨します

### 出力パーサーのカスタマイズ

`backend/output_parser.py` の `_extract_images()` や `_extract_map_data()` メソッドを編集して、
独自の出力形式に対応できます。

## トラブルシューティング

### WebSocket接続エラー

- サーバーが起動しているか確認: `http://localhost:8000`
- ブラウザのコンソールでエラーをチェック
- ファイアウォール設定を確認

### smolagentsのインポートエラー

```bash
pip install --upgrade smolagents
```

### HuggingFace API エラー

- HF_TOKEN環境変数が設定されているか確認
- インターネット接続を確認

## ライセンス

このプロジェクトはテスト目的のサンプル実装です。

## 参考

- smolagents: https://github.com/huggingface/smolagents
- FastAPI: https://fastapi.tiangolo.com/
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
