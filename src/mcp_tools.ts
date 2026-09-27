import fs from 'fs';
import path from 'path';
import { FunctionDeclaration, Type } from '@google/genai';

const LOG_DIR = path.join(process.cwd(), 'logs');
const ACCUMULATED_DIGEST_PATH = path.join(LOG_DIR, 'DIGEST_ACCUMULATED.md');

export const analyzePastSessionDeclaration: FunctionDeclaration = {
  name: 'analyze_past_session',
  description: '過去の全対話ダイジェスト（DIGEST_ACCUMULATED.md）および最新ログから、到達点、積み重なったキーワード、過去の問いを抽出します。',
  parameters: {
    type: Type.OBJECT,
    properties: {
      maxCharacters: {
        type: Type.NUMBER,
        description: '読み込む文字数上限（デフォルト 3000文字）'
      }
    }
  }
};

export const saveDailyDigestDeclaration: FunctionDeclaration = {
  name: 'save_daily_digest',
  description: '対話終了時に、本日の航海地図、要約、思考の問い、キーワード、数学クエスチョンを個別ログおよび累積ダイジェストファイルに保存します。',
  parameters: {
    type: Type.OBJECT,
    properties: {
      summaryPoints: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '本日の議論の要約ポイント（3項目程度）'
      },
      dailyQuestion: {
        type: Type.STRING,
        description: '今日1日頭の片隅に置いておくためのメインの思考の問い'
      },
      keywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '本日のセッションから抽出された重要キーワード（5個前後）'
      },
      mathQuestions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '思考を鍛えるための数学的・構造的クエスチョン（1〜3問）'
      },
      abstractionTrace: {
        type: Type.STRING,
        description: '本日の対話の抽象度の推移（例: 3 → 5 → 3）'
      },
      unresolvedIssue: {
        type: Type.STRING,
        description: '本日残された未解決の課題や次の探求への伏線'
      }
    },
    required: ['summaryPoints', 'dailyQuestion', 'keywords', 'mathQuestions', 'abstractionTrace', 'unresolvedIssue']
  }
};

export async function executeMcpTool(name: string, args: any, currentLogFile?: string) {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  if (name === 'analyze_past_session') {
    let accumulatedContent = '';
    if (fs.existsSync(ACCUMULATED_DIGEST_PATH)) {
      accumulatedContent = fs.readFileSync(ACCUMULATED_DIGEST_PATH, 'utf-8');
    }

    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('session_') && f.endsWith('.md'))
      .sort()
      .reverse();

    let latestContent = '';
    if (files.length > 0) {
      const latestFile = path.join(LOG_DIR, files[0]);
      latestContent = fs.readFileSync(latestFile, 'utf-8');
    }

    const combinedSnippet = `--- 【累積思考ダイジェスト】 ---\n${accumulatedContent.slice(-2000)}\n\n--- 【直近ログ抜粋】 ---\n${latestContent.slice(-1500)}`;

    return {
      status: 'success',
      contextSnippet: combinedSnippet
    };
  }

  if (name === 'save_daily_digest') {
    const keywordsList: string[] = args.keywords || [];
    const mathQs: string[] = args.mathQuestions || [];
    const dateStr = new Date().toLocaleDateString('ja-JP');

    // コンソール（画面）への「思考の航海図 (SESSION MAP)」出力
    console.log("\n========================================================");
    console.log("🗺️  【本日の思考の航海図 (SESSION MAP)】");
    console.log("========================================================");
    console.log(`\n🏷️  抽出キーワード: ${keywordsList.map(k => `[${k}]`).join(" ")}`);
    console.log(`📈 抽象度の推移  : ${args.abstractionTrace}`);
    console.log(`❓ 未解決の課題  : ${args.unresolvedIssue}`);
    
    console.log(`\n📝 3行要約:`);
    args.summaryPoints.forEach((pt: string) => console.log(`  ・ ${pt}`));

    console.log(`\n💡 本日のメイン問い (Daily Question):`);
    console.log(`   > ${args.dailyQuestion}`);

    if (mathQs.length > 0) {
      console.log(`\n📐 思考を鍛える数学的クエスチョン:`);
      mathQs.forEach((mq: string, idx: number) => console.log(`   Q${idx + 1}.${mq}`));
    }
    console.log("========================================================\n");

    // 1. 個別ログファイル（.md）への保存
    if (currentLogFile && fs.existsSync(currentLogFile)) {
      const digestText = `\n\n---\n### 🗺️ 本日の思考の航海図 (Session Map)\n\n` +
        `- **抽象度の推移**: \`${args.abstractionTrace}\`\n` +
        `- **未解決の課題**: ${args.unresolvedIssue}\n\n` +
        `**🏷️ 抽出キーワード:**\n` + keywordsList.map(k => `- \`${k}\``).join('\n') + `\n\n` +
        `**📝 議論の要約:**\n` + args.summaryPoints.map((pt: string) => `- ${pt}`).join('\n') + `\n\n` +
        `**💡 今日の問い:**\n> ${args.dailyQuestion}\n\n` +
        `**📐 数学的クエスチョン:**\n` + mathQs.map((mq: string, i: number) => `${i + 1}. ${mq}`).join('\n') + `\n\n`;

      fs.appendFileSync(currentLogFile, digestText, 'utf-8');
    }

    // 2. 累積ダイジェストファイル (DIGEST_ACCUMULATED.md) への積み重ね保存
    const accumulatedText = `\n## 📅 ${dateStr} の探求ログ\n` +
      `- **キーワード**: ${keywordsList.join(', ')}\n` +
      `- **抽象度推移**: ${args.abstractionTrace}\n` +
      `- **メイン問い**: ${args.dailyQuestion}\n` +
      `- **未解決課題**: ${args.unresolvedIssue}\n` +
      `---\n`;

    fs.appendFileSync(ACCUMULATED_DIGEST_PATH, accumulatedText, 'utf-8');

    return { status: 'success', message: '航海図およびダイジェストが累積ファイルに保存されました。' };
  }

  throw new Error(`未知のMCPツール: ${name}`);
}