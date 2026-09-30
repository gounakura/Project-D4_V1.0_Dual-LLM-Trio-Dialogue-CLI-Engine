（はじめに）
***【本リポジトリの位置づけ：コンテキスト解析AIエージェント群の中核アーキテクチャ】***
本リポジトリ（Project D4 v1.0）は、AIエージェントにおける「多次元コンテキスト解析および自律評価機構」を検証するマルチプロジェクト群（B2 / C3 / D4）における**対話型グラデーション思考探求エンジン**です。

* **Project B2：「非構造化データ（音声物理量）」の動的感性マッピング**
  音声バイナリの物理特徴量からLLMが自律的中間レイヤーを構築し、感性コンテキストを可視化。
* **Project C3：「言語・文脈データ」の立体評価**
  テキストデータから「守り（リスク）」と「攻め（訴求力）」の2軸で多角的な定量・定性評価を実施。
* **Project D4（本プロダクト）：「対話型グラデーション思考探求エンジン」**
  Dual-LLM（Agent Alpha & Beta）の自律対話と、受容膜（Resonance）および抽象度インジケーター（Navigation）を備え、対話の抽象度を自在に行き来しながら思考を立体的に拡張・深化させる探求プラットフォーム。

### 他プロジェクトとの共通点および決定的な相違点
1. **共通点：コンテキストの「多角化」と「自動構造化」**
   B2・C3同様、人間の曖昧な直感や多次元の文脈情報をLLMがリアルタイムに受容・分解し、構造化された知見や指標へと昇華させるアーキテクチャ設計を踏襲しています。
2. **相違点：単一評価から「複数エージェントによる動的対話・思考探求」への拡張**
   B2やC3が「入力データに対する多次元レポート生成」を主眼としていたのに対し、D4では「問いの探求者（Alpha）」と「概念の拡張者（Beta）」という役割の異なるDual-LLMがユーザーを包み込む「3者対話（Trio Dialogue）」を形成します。
   さらに、発言を肯定受容する「受容膜（Witness/Resonance）」と、思考の抽象度（1〜5）を可視化・誘導する「航海図（Navigation）」を搭載し、対話の進展に応じた柔軟な思考の構造化を実現します。

---

 
# Project D4: Dual-LLM Trio Dialogue CLI Engine
**受容（Resonance）と航海図（Navigation）による「グラデーション型思考探求」プラットフォーム**

## 1. 概要
ユーザーの素朴な疑問や直感的な発言を肯定受容（受容膜）しながら、2つの役割の異なるLLMエージェント（Agent Alpha & Agent Beta）が対話を通じて概念を拡張・深遠化させる「思考探求型AI CLIシステム」です。
抽象度（具象 1 ↔ 5 抽象）の揺らぎをリアルタイムに評価・トラッキングし、セッション終了時には探求の軌跡を構造化した「思考の航海図 (SESSION MAP)」として自動生成・保存します。

---

## 2. 想定ユーザーと課題解決
- **想定ユーザー**: 複雑な概念の整理・アイデア出し・数学的/数理科学的な思考の深掘りを行いたい研究者、クリエイター、エンジニア。
- **課題**: 思考のアイディア出しにおいて、途中で論理が破綻したり、思考の抽象度が高すぎて着地点を見失う、あるいは単一のAI応答では思考が硬直化しやすいという問題。
- **導入効果**: Dual-LLMの自律的な掛け合いと「抽象度インジケーター」により、思考の破綻を防ぎつつ柔軟にアイデアを深遠化・構造化できます。

---

## 3. 主な使い方
1. **環境構築**
   リポジトリをクローンし、依存関係をインストールします。
   ```bash
   npm install
2.	.env ファイルの設定 プロジェクトルートに .env ファイルを作成し、Gemini APIキーを設定します。
コード スニペット
GEMINI_API_KEY=your_gemini_api_key_here
3.	エージェントの起動
Bash
npm start
4.	対話プロンプト操作
o	テキスト入力: 自身の問いや思いつきを入力して3者対話を深める
o	そのまま Enter: Alpha & Beta 同士の自律対話を進める
o	mode auto / mode light / mode deep: 思考モードの動的切り替え
o	exit / quit: セッションを終了し「思考の航海図 (SESSION MAP)」を生成・保存
## 4. アーキテクチャと処理フロー
4-1. システム構成図
コード スニペット
flowchart TD
    User[ユーザー / CLI] --> CLI_Engine[index.ts / CLI Control]
    CLI_Engine --> D4Engine[D4MultiAgentSystem]
    
    subgraph DualLLM [Dual-LLM Engine (Gemini 3.6 Flash)]
        D4Engine --> Alpha[Agent Alpha: 問いの探求者]
        D4Engine --> Beta[Agent Beta: 概念の拡張者]
    end

    subgraph Pipeline [パイプライン制御]
        Alpha --> Resonance[受容膜 RESONANCE: 肯定要約]
        Alpha --> Navigation[航海図 NAVIGATION: 抽象度 1~5 判定]
    end

    subgraph MCPTools [MCP ツールレイヤー]
        Alpha & Beta <--> MCP[mcp_tools.ts]
        MCP --> ReadDigest[analyze_past_session: 過去ログ参照]
        MCP --> SaveDigest[save_daily_digest: 航海図保存]
    end

    MCP --> Storage[(logs/ 蓄積ファイル)]
    Pipeline --> SessionMap[思考の航海図 SESSION MAP]
    SessionMap --> User
4-2. 処理フロー
1.	オープニング（過去セッションの接続）: 起動時、MCPツール analyze_past_session が過去の累積ダイジェストを参照し、前回の未解決課題やキーワードを引き継いでゼミを開始します。
2.	パイプライン処理（受容と航海）: ユーザーの発言に対し、Agent Alphaが [RESONANCE]（直感の否定なき受容）と [NAVIGATION]（抽象度レベル ★★★★☆ と進行ガイド）を算出し、コンソールにUI枠として表示します。
3.	Dual-LLMの応答・拡張: Alphaの受容・提起に基づき、Agent Betaが別の角度から補完・概念拡張を行います。
4.	セッションマップの自動生成: exit 実行時、MCPツール save_daily_digest が起動。セッション全体のキーワード、抽象度推移、数学的クエスチョン、3行要約等を抽出・保存します。
## 5. セットアップ
必要環境
•	Node.js: v18.0.0 以上
•	Google Gemini API Key (gemini-3.6-flash)
インストール手順
1.	リポジトリのクローンおよび依存パッケージのインストール:
Bash
npm install
2.	環境変数の設定: プロジェクトルートに .env ファイルを作成し、Gemini APIキーを設定します。
コード スニペット
GEMINI_API_KEY=your_gemini_api_key_here


## 6. 技術的・業務的な工夫点 (Highlights)
•	受容膜（Resonance）と航海図（Navigation）のパイプライン化: ユーザーの発話内容を対話が空転しないように否定せず真意を受け止める「受容膜」と、議論の抽象度を5段階で可視化する「ナビゲーション」をLLMの出力フォーマットとして規律化。
•	過去ログの文脈継承（MCP Tool analyze_past_session）: 過去のセッションの累積ダイジェスト（DIGEST_ACCUMULATED.md）からコンテキストを抽出し、一貫性のある対話探求を継続可能。
•	多重リトライ＆指数バックオフ機構（callWithRetry）: APIレート制限（429 / 503）検知時に自動でウェイト＆リトライを挟むことで、長時間の対話セッションでも途切れない堅牢性を確保。
## 7. 今後の展望・拡張性
•	対話のコンテキスト解析精度のさらなる向上と多角化
•	過去のダイジェスト蓄積アルゴリズムの最適化と高速化
•	思考モード（Light / Deep / Auto）のパラメータチューニングによる応答精度の向上

