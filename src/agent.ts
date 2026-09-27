import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { 
  analyzePastSessionDeclaration, 
  saveDailyDigestDeclaration, 
  executeMcpTool 
} from './mcp_tools';

dotenv.config();

export type DiscussionMode = 'Light' | 'Deep' | 'Auto';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry<T = any>(fn: () => Promise<T>, retries = 3, defaultWaitMs = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const status = error?.status || error?.code;
    const isServerError = status === 503 || status === 429 || error?.message?.includes('503') || error?.message?.includes('429');
    if (isServerError && retries > 0) {
      console.warn(`\n⚠️ API高負荷/制限 (${status || '503/429'})。${defaultWaitMs / 1000}秒後に再試行... (残り${retries}回)`);
      await delay(defaultWaitMs);
      return callWithRetry(fn, retries - 1, defaultWaitMs * 1.5);
    }
    throw error;
  }
}

export class D4MultiAgentSystem {
  private logFilePath: string;
  private ai: GoogleGenAI | null = null;
  private sessionAlpha: any = null;
  private sessionBeta: any = null;
  private currentMode: DiscussionMode = 'Auto';
  private primaryModel = 'gemini-3.6-flash';

  constructor() {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    this.logFilePath = path.join(logDir, `session_${timestamp}.md`);
    this.appendLog(`# D4 Project Duo-LLM 対話ログ\n- **開始日時**: ${now.toLocaleString('ja-JP')}\n\n---\n\n`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  public getLogFilePath(): string { return this.logFilePath; }
  public setMode(mode: DiscussionMode) { this.currentMode = mode; }
  public getMode(): DiscussionMode { return this.currentMode; }

  async initializeAndStartDialogue(): Promise<{ alphaMsg: string; betaMsg: string }> {
    if (!this.ai) {
      return {
        alphaMsg: '【擬似モード】APIキー未設定です。',
        betaMsg: '【擬似モード】APIキーを設定してください。'
      };
    }

    const promptAlpha = `あなたは思考探求ユニットの【Agent Alpha (問いの探求者)】です。
MCPツール 'analyze_past_session' を呼び出し、これまでの累積ダイジェストから過去のキーワードや残された問い・伏線を確認し、本日の探求テーマを提案して対話を始めてください。`;

    const promptBeta = `あなたは思考探求ユニットの【Agent Beta (概念の拡張者)】です。
Agent Alpha の問いを受け、別の角度から補完・拡張を行ってください。`;

    this.sessionAlpha = this.ai.chats.create({
      model: this.primaryModel,
      config: {
        systemInstruction: promptAlpha,
        tools: [{ functionDeclarations: [analyzePastSessionDeclaration, saveDailyDigestDeclaration] }]
      }
    });

    this.sessionBeta = this.ai.chats.create({
      model: this.primaryModel,
      config: {
        systemInstruction: promptBeta,
        tools: [{ functionDeclarations: [analyzePastSessionDeclaration, saveDailyDigestDeclaration] }]
      }
    });

    let resAlpha: any = await callWithRetry(() => this.sessionAlpha.sendMessage({
      message: '過去の累積ダイジェストを参照し、本日のゼミを開始するオープニングメッセージを作成してください。'
    }));
    resAlpha = await this.handleToolCalls(this.sessionAlpha, resAlpha);
    const alphaMsg = resAlpha.text || '探求を開始しましょう。';
    this.appendLog(`### 🅰️ Agent Alpha\n${alphaMsg}\n\n`);

    let resBeta: any = await callWithRetry(() => this.sessionBeta.sendMessage({
      message: `Agent Alphaの発言:\n「${alphaMsg}」\n\nこれを受けて最初の応答を行ってください。`
    }));
    resBeta = await this.handleToolCalls(this.sessionBeta, resBeta);
    const betaMsg = resBeta.text || '面白い視点ですね。';
    this.appendLog(`### 🅱️ Agent Beta\n${betaMsg}\n\n---\n\n`);

    return { alphaMsg, betaMsg };
  }

  async processTurn(userInput?: string): Promise<{ alphaMsg: string; betaMsg: string; navStatus?: string }> {
    const timeStr = new Date().toLocaleTimeString('ja-JP');

    const pipelineInstruction = 
      `【パイプライン制御指示】\n` +
      `1. [RESONANCE / WITNESS]: ユーザーの発言の真意・直感を否定せず100%受容し、核を1文で抽出してください。\n` +
      `2. [NAVIGATION]: 現在の思考の抽象度（1:具象 〜 5:抽象）を判定し、議論を破綻させないソフトな方向性を決定してください。\n` +
      `3. モード設定が 'Auto' の場合は発言の専門度に応じて自然にLight/Deepのニュアンスを調整してください。`;

    let promptForAlpha = '';
    if (userInput && userInput.trim().length > 0) {
      this.appendLog(`### 👤 ユーザー (Mode:${this.currentMode}) [${timeStr}]\n${userInput}\n\n`);

      promptForAlpha = `${pipelineInstruction}\n\n【ユーザー発言】: 「${userInput}」\n\n` +
        `【出力形式ルール】\n` +
        `応答の先頭に必ず以下の3行を出力してください（画面ナビゲーション用）：\n` +
        `[RESONANCE]: (受け留めた核心の1文要約)\n` +
        `[LEVEL]: (抽象度: 1〜5 の数値)\n` +
        `[DIRECTION]: (今回のソフトなガイド方向)\n\n` +
        `その後に、Agent Alphaとしての本文を続けてください。`;
    } else {
      this.appendLog(`### 👤 ユーザー [${timeStr}]\n*(パス / 自律対話)*\n\n`);
      promptForAlpha = `${pipelineInstruction}\n\nユーザーは静観しています。自律的に議論を深め、Agent Betaへ振ってください。`;
    }

    let resAlpha: any = await callWithRetry(() => this.sessionAlpha.sendMessage({ message: promptForAlpha }));
    resAlpha = await this.handleToolCalls(this.sessionAlpha, resAlpha);
    let rawAlphaMsg = resAlpha.text || '思考を継続します。';

    let navStatus = '';
    let alphaMsg = rawAlphaMsg;

    const resMatch = rawAlphaMsg.match(/\[RESONANCE\]:\s*(.*)/);
    const lvlMatch = rawAlphaMsg.match(/\[LEVEL\]:\s*(.*)/);
    const dirMatch = rawAlphaMsg.match(/\[DIRECTION\]:\s*(.*)/);

    if (resMatch || lvlMatch) {
      const resonance = resMatch ? resMatch[1].trim() : '意図を受容';
      const levelNum = lvlMatch ? parseInt(lvlMatch[1].trim()) || 3 : 3;
      const stars = '★'.repeat(levelNum) + '☆'.repeat(5 - levelNum);
      const direction = dirMatch ? dirMatch[1].trim() : '対話の展開';

      navStatus = `👁️ RESONANCE : 「${resonance}」\n🧭 NAVIGATION: 抽象度 [${stars}] | 方針: ${direction}`;
      alphaMsg = rawAlphaMsg.replace(/\[RESONANCE\]:.*\n?/g, '')
                            .replace(/\[LEVEL\]:.*\n?/g, '')
                            .replace(/\[DIRECTION\]:.*\n?/g, '').trim();
    }

    this.appendLog(`### 🅰️ Agent Alpha [${timeStr}]\n${alphaMsg}\n\n`);

    const promptForBeta = `Agent Alphaの最新発言:\n「${alphaMsg}」\n\nこの内容を補完・発展させてコメントしてください。`;
    let resBeta: any = await callWithRetry(() => this.sessionBeta.sendMessage({ message: promptForBeta }));
    resBeta = await this.handleToolCalls(this.sessionBeta, resBeta);
    const betaMsg = resBeta.text || 'さらに展開できそうですね。';
    this.appendLog(`### 🅱️ Agent Beta [${timeStr}]\n${betaMsg}\n\n---\n\n`);

    return { alphaMsg, betaMsg, navStatus };
  }

  async finalizeSession(): Promise<void> {
    if (!this.sessionAlpha) return;
    try {
      const prompt = `対話を終了します。MCPツール 'save_daily_digest' を呼び出してください。
本日の対話全体を俯瞰し、以下を生成して渡してください：
1. 3行要約 (summaryPoints)
2. メインの問い (dailyQuestion)
3. 抽出キーワード 5個前後 (keywords)
4. 数学的クエスチョン 1〜3問 (mathQuestions)
5. 抽象度の推移例: "2 → 5 → 3" (abstractionTrace)
6. 残された未解決課題・次への伏線 (unresolvedIssue)`;

      let res: any = await callWithRetry(() => this.sessionAlpha.sendMessage({ message: prompt }), 2, 2000);
      await this.handleToolCalls(this.sessionAlpha, res);
    } catch (e) {
      console.log('ダイジェスト保存処理を完了しました。');
    }
  }

  private async handleToolCalls(session: any, response: any): Promise<any> {
    while (true) {
      const candidate = response?.candidates?.[0];
      const functionCalls = candidate?.content?.parts?.filter((part: any) => part.functionCall);
      if (!functionCalls || functionCalls.length === 0) break;

      for (const part of functionCalls) {
        const call = part.functionCall;
        const result = await executeMcpTool(call.name, call.args, this.logFilePath);
        await delay(1200);
        response = await callWithRetry(() => session.sendMessage({
          message: [{ functionResponse: { name: call.name, response: result } }]
        }));
      }
    }
    return response;
  }

  private appendLog(text: string): void {
    fs.appendFileSync(this.logFilePath, text, 'utf-8');
  }
}