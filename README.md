<h1><p align="center"><img src="assets/ai.svg" alt="藍" height="200"></p></h1>
<p align="center">An Ai for Misskey. <a href="./torisetu.md">About Aira</a></p>

## これなに
Misskey用の日本語Botです。

## 本家(藍)との相違点
- 本家と口調が異なる
- 絵文字生成ができる
- 日付が変わったときにお知らせ
- 単語を覚えるタイムラインを変更できるように
- 絵文字追加時にお知らせ

## 実装予定
- 毎朝天気予報をお知らせしてくれる機能

## インストール (Docker)
1. まず適当なディレクトリに `git clone` します。
2. ディレクトリのルートにある `example.config.yaml` を `config.yaml` としてコピーしてから設定を変更・保存します。
3. `docker compose up -d` すれば起動できます。

## インストール (手動)
> Node.js と npm と MeCab (オプション) がインストールされている必要があります。

1. まず適当なディレクトリに `git clone` します。
2. ディレクトリのルートにある `example.config.yaml` を `config.yaml` としてコピーしてから設定を変更・保存します。
3. `pnpm install` して `pnpm build` して `pnpm start` すれば起動できます。

## フォント
一部の機能にはフォントが必要です。あいらにはフォントは同梱されていないので、ご自身でフォントを `fonts` ディレクトリに `default.ttf` (または `default.otf` ) という名前で設置してください。  
また、 `default.{ttf,otf}` に加えて `fonts` ディレクトリ内にTTFまたはOTF形式の任意のフォントを配置することで、絵文字の生成で利用できるフォントを追加することが出来ます。

## 記憶
あいらは記憶の保持にインメモリデータベースを使用しており、あいらのインストールディレクトリに `memory.json` という名前で永続化されます。

## ライセンス
MIT

## Awards
<img src="assets/WorksOnMyMachine.png" alt="Works on my machine" height="120">
