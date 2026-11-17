const fs = require("fs/promises");
const path = require("path");

const filePath = path.resolve(process.env.EDPAY_SESSION_STORE || path.join(__dirname, "..", "var", "payment-sessions.json"));
let writes = Promise.resolve();

async function readStore() {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function save(reference, sessionId, amountMinor, currency) {
  writes = writes.catch(() => {}).then(async () => {
    const store = await readStore();
    const old = store[reference];
    if (old && (old.sessionId !== sessionId || old.amountMinor !== amountMinor || old.currency !== currency)) {
      throw new Error("Payment mapping conflict");
    }
    store[reference] = old || { sessionId, amountMinor, currency, paymentId: null, state: "open" };
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const temporary = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(store), { mode: 0o600 });
    await fs.rename(temporary, filePath);
  });
  return writes;
}

async function get(reference) {
  await writes;
  return (await readStore())[reference] || null;
}

async function markResolved(reference, paymentId) {
  writes = writes.catch(() => {}).then(async () => {
    const store = await readStore();
    const mapping = store[reference];
    if (!mapping || mapping.state !== "processing" || mapping.paymentId !== paymentId) return false;
    mapping.paymentId = paymentId;
    mapping.state = "resolved";
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const temporary = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(store), { mode: 0o600 });
    await fs.rename(temporary, filePath);
    return true;
  });
  return writes;
}

async function release(reference, paymentId) {
  writes = writes.catch(() => {}).then(async () => {
    const store = await readStore();
    const mapping = store[reference];
    if (!mapping || mapping.state !== "processing" || mapping.paymentId !== paymentId) return false;
    mapping.paymentId = null;
    mapping.state = "open";
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const temporary = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(store), { mode: 0o600 });
    await fs.rename(temporary, filePath);
    return true;
  });
  return writes;
}

async function claim(reference, paymentId) {
  writes = writes.catch(() => {}).then(async () => {
    const store = await readStore();
    const mapping = store[reference];
    if (!mapping || mapping.state !== "open") return false;
    mapping.paymentId = paymentId;
    mapping.state = "processing";
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const temporary = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(store), { mode: 0o600 });
    await fs.rename(temporary, filePath);
    return true;
  });
  return writes;
}

module.exports = { save, get, claim, release, markResolved };
