type ChatEvent = { type: "answer" | "done"; text: string } | { type: "error"; message: string };

export async function readChatStream(body: ReadableStream<Uint8Array>, onAnswer: (text: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let complete = false;
  function consume(line: string) {
    if (!line.trim()) return;
    const event: ChatEvent = JSON.parse(line);
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "answer" || event.type === "done") onAnswer(event.text);
    if (event.type === "done") complete = true;
  }
  try {
    while (!complete) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        consume(line);
        if (complete) break;
      }
      if (done) {
        if (!complete) consume(pending);
        break;
      }
    }
    if (!complete) throw new Error("การเชื่อมต่อขาดระหว่างตอบ กรุณาลองใหม่");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
