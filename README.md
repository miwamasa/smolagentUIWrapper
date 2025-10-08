# Smolagent UI Wrapper

smolagent（https://github.com/huggingface/smolagents）のUIラッパー実装です。

## 概要

このプロジェクトは、smolagentのチャットインターフェイスを提供し、agentの出力を以下の3つのペインに自動的に振り分けます：

- **左上ペイン**: 2Dマップ表示（座標データ）
- **左下ペイン**: 画像表示（プロット、グラフなど）
- **右ペイン**: チャットインターフェイス（テキスト出力）

## プロジェクト構造

```
smolagentUI/
├── backend/                    # Python FastAPI バックエンド
│   ├── main.py                # FastAPI アプリ、WebSocket
│   ├── agent_wrapper.py       # smolagent 統合
│   ├── output_parser.py       # 出力タイプ判定
│   └── requirements.txt       # Python 依存関係
├── frontend/                  # フロントエンド UI
│   ├── index.html            # メイン HTML
│   ├── css/
│   │   └── styles.css        # スタイルシート
│   └── js/
│       ├── app.js            # メインアプリケーション
│       ├── chat.js           # チャット機能
│       ├── map-viewer.js     # 2Dマップビューア
│       └── image-viewer.js   # 画像ビューア
├── spec/
│   ├── DataAgent.py          # サンプル分析agent
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
2. 右ペインのチャット入力欄にメッセージを入力
3. "Send"ボタンをクリック、またはEnterキーで送信
4. Agentの応答が各ペインに自動的に表示されます：
   - テキスト → 右ペイン（チャット）
   - 画像 → 左下ペイン
   - 座標データ → 左上ペイン（マップ）

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

**その他：**
```
- "Generate a line plot with sine wave"
- "Create a scatter plot with random data"
- "Show me 5 random coordinates on the map"
```

## 機能

### バックエンド

- **FastAPI + WebSocket**: リアルタイム通信
- **agent_wrapper.py**: smolagentの実行とストリーム処理
- **output_parser.py**: 出力の自動分類
  - 画像ファイル検出（.png, .jpg, etc）
  - Base64エンコード画像検出
  - 座標データ検出（lat/lon）

### フロントエンド

- **3ペインレイアウト**: レスポンシブデザイン
- **チャット機能**: WebSocketによるリアルタイム通信
- **マップビューア**: Canvas で2D座標をプロット
- **画像ビューア**: クリックで拡大表示

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
