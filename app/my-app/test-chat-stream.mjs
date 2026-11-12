// Run with: node test-chat-stream.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("./app/lib/chat-stream.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { readChatStream } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
function body(text) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
}
const received = [];
await readChatStream(body('{"type":"answer","text":"สวัสดี"}\n{"type":"done","text":"สวัสดีค่ะ"}'), text => received.push(text));
assert.deepEqual(received, ["สวัสดี", "สวัสดีค่ะ"]);
await assert.rejects(readChatStream(body('{"type":"answer","text":"partial"}\n'), () => {}), /การเชื่อมต่อขาด/);
await assert.rejects(readChatStream(body('{"type":"error","message":"timeout"}\n'), () => {}), /timeout/);
console.log("Chat stream parser checks passed (Thai UTF-8 byte splits, EOF, errors)");
