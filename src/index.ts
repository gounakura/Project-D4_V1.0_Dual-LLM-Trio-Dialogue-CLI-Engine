import readline from 'readline';
import { D4MultiAgentSystem } from './agent';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log("\n========================================================");
  console.log("   D4 Project 3rd: Dual-LLM Trio Dialogue Agent System   ");
  console.log("========================================================\n");

  const system = new D4MultiAgentSystem();

  console.log("🔍 累積ダイジェストをインデックス中... Alpha & Beta 準備完了\n");
  const initResult = await system.initializeAndStartDialogue();

  console.log(`🅰️ Agent Alpha:\n${initResult.alphaMsg}\n`);
  console.log(`🅱️ Agent Beta:\n${initResult.betaMsg}\n`);
  console.log("--------------------------------------------------------");
  console.log("💡 操作ガイド:");
  console.log(" ・テキストを入力         : 発話して3者対話を深める");
  console.log(" ・そのまま Enter         : AI同士の自律対話を進める");
  console.log(" ・mode auto/light/deep   : 思考モードの切替 (デフォルト: Auto)");
  console.log(" ・exit / quit            : 終了し思考の航海図を保存\n");

  while (true) {
    const statusPrompt = `👤 あなた (Mode:${system.getMode()}) [Enterで自律進展]: `;
    const userInput = await askQuestion(statusPrompt);
    const trimmed = userInput.trim();

    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      console.log("\n🗺️  本日の思考の航海図 (SESSION MAP) を作成中...");
      await system.finalizeSession();
      console.log(`\n🎉 ゼミを終了しました。ログは \`${system.getLogFilePath()}\` に保存されました。`);
      rl.close();
      break;
    }

    if (trimmed.toLowerCase() === 'mode auto') {
      system.setMode('Auto');
      console.log("\n🔄 モードを 【Auto (自動抽象度調整)】 に切り替えました。\n");
      continue;
    }
    if (trimmed.toLowerCase() === 'mode light') {
      system.setMode('Light');
      console.log("\n🔄 モードを 【Light (直感・ビジュアル視点)】 に切り替えました。\n");
      continue;
    }
    if (trimmed.toLowerCase() === 'mode deep') {
      system.setMode('Deep');
      console.log("\n🔄 モードを 【Deep (数理・厳密視点)】 に切り替えました。\n");
      continue;
    }

    console.log("\n🤖 (Alpha & Beta が思考中...)\n");
    try {
      const turnResult = await system.processTurn(trimmed);

      if (turnResult.navStatus) {
        console.log(`┌────────────────────────────────────────────────────────┐`);
        console.log(`│ 🛡️ 【思考の現在地 & 受容ログ】`);
        turnResult.navStatus.split('\n').forEach(line => console.log(`│ ${line}`));
        console.log(`└────────────────────────────────────────────────────────┘\n`);
      }

      console.log(`🅰️ Agent Alpha:\n${turnResult.alphaMsg}\n`);
      console.log(`🅱️ Agent Beta:\n${turnResult.betaMsg}\n`);
      console.log("--------------------------------------------------------");
    } catch (err) {
      console.error("\n⚠️ 通信一時エラーが発生しました。もう一度お試しください。");
    }
  }
}

main().catch(err => {
  console.error("致命的エラー:", err);
  process.exit(1);
});