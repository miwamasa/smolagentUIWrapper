これはsmolagent(https://github.com/huggingface/smolagents/tree/main)のUIのwrapperを作るテストである。

目的は、
1) smolagentのagentのUIのためのwrapperを実装することである
2)テストとして、簡易のチャットアプリを作成する
　左ペイン上が、２Dマップ表示、左ペイン下が画像（プロットの画像など）の表示、
　右ペインには、チャットのインターフェイスであり、文字列はここに表示される。

agentの出力の文字列は右ペイン、画像が含まれれば、それは左ペイン下、2Dマップに関わる情報が
出てきたら、左ペイン上に出力する。


## 関連ファイル
spec/DataAgent.py   smolagentの分析agentのコード
spec/specification.md   smolagentのagentのUIのためのwrapperの仕様

