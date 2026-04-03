# Universal Board Editor

ブラウザ上で動作するユニバーサル基板レイアウトエディタです。

## 機能

- 部品の配置・回転・ドラッグ移動
- 配線の描画（色選択可能）
- ホールへのラベル付け
- 表面 / 裏面の切り替え編集（ミラー表示）
- カスタム部品テンプレートの作成・編集
- プロジェクトの保存・読込（JSON）/ 画像出力（PNG）
- ズーム / スクロール対応
- localStorage への自動保存

## セットアップ

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
npm run preview
```

## 技術スタック

- React 19 + TypeScript
- Vite
- SmartHR UI
- HTML Canvas
