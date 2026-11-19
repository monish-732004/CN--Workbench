import type { Rng } from "../rng";
import type { Difficulty, Template } from "../types";

/**
 * Put protocol steps in order. Step texts carry per-student values (names, addresses,
 * frame numbers) and are shuffled, so a shared answer like "3-1-4-2" is meaningless.
 * Grading compares step texts position by position, so identical texts (e.g. two
 * "250 OK" replies) are interchangeable.
 */
export interface SequenceParams {
  d: Difficulty;
  mode: string;
  prompt: string;
  steps: string[]; // correct order
  shuffled: number[]; // display order (indices into steps)
}

const ORGS = ["srmist", "annauniv", "iitm", "vit", "psgtech", "nitt", "amrita", "cit"];
const DEPTS = ["cse", "ece", "mech", "library", "exam", "placement", "hostel"];
const TLDS = ["edu", "in", "org", "com", "ac.in"];
const USERS = ["asha", "ravi", "meena", "karthik", "divya", "arun", "nisha", "vikram", "priya"];
const FILES = ["lab7.pkt", "notes-u3.pdf", "rip-config.txt", "vlsm-plan.xlsx", "ospf-areas.png", "report.docx"];

function host(rng: Rng) {
  const org = rng.pick(ORGS);
  const tld = rng.pick(TLDS);
  return { name: `${rng.pick(["www", "mail", "lms", "portal"])}.${rng.pick(DEPTS)}.${org}.${tld}`, org, tld };
}

function ip(rng: Rng) {
  return `${rng.pick([103, 117, 157, 164, 203])}.${rng.int(1, 254)}.${rng.int(0, 255)}.${rng.int(1, 254)}`;
}

const MODES: Record<string, (rng: Rng, d: Difficulty) => { prompt: string; steps: string[] }> = {
  dns(rng, d) {
    const h = host(rng);
    const addr = ip(rng);
    const tld = h.tld.split(".").pop()!;
    if (d === "hard") {
      return {
        prompt: `Order the messages in a RECURSIVE resolution of ${h.name}.`,
        steps: [
          `Host asks its local DNS server for ${h.name}`,
          `Local server forwards the query to a root server`,
          `Root server forwards the query to the .${tld} TLD server`,
          `TLD server forwards the query to the authoritative server for ${h.org}.${h.tld}`,
          `Authoritative server returns ${addr} to the TLD server`,
          `TLD server returns ${addr} to the root server`,
          `Root server returns ${addr} to the local server`,
          `Local server caches ${addr} and answers the host`,
        ],
      };
    }
    const steps = [
      `Host asks its local DNS server for ${h.name}`,
      `Local server asks a root server`,
      `Root server refers it to the .${tld} TLD server`,
      `Local server asks the .${tld} TLD server`,
      `TLD server refers it to the authoritative server for ${h.org}.${h.tld}`,
      `Local server asks the authoritative server`,
      `Authoritative server returns ${addr}`,
      `Local server caches ${addr} and answers the host`,
    ];
    return { prompt: `Order the messages in an ITERATIVE resolution of ${h.name}.`, steps: d === "easy" ? steps.filter((_, i) => i !== 3 && i !== 5) : steps };
  },
  smtp(rng, d) {
    const from = `${rng.pick(USERS)}@${rng.pick(DEPTS)}.${rng.pick(ORGS)}.edu`;
    const to1 = `${rng.pick(USERS)}@${rng.pick(DEPTS)}.${rng.pick(ORGS)}.in`;
    const to2 = `${rng.pick(USERS)}@${rng.pick(DEPTS)}.${rng.pick(ORGS)}.org`;
    const domain = from.split("@")[1]!;
    if (d === "easy") {
      return {
        prompt: `Order the commands an SMTP client sends to deliver one message from ${from}.`,
        steps: [`HELO ${domain}`, `MAIL FROM:<${from}>`, `RCPT TO:<${to1}>`, `DATA`, `Message body, ended by a line with "."`, `QUIT`],
      };
    }
    const steps = [
      `S: 220 service ready`,
      `C: HELO ${domain}`,
      `S: 250 OK`,
      `C: MAIL FROM:<${from}>`,
      `S: 250 OK`,
      `C: RCPT TO:<${to1}>`,
      `S: 250 OK`,
      ...(d === "hard" ? [`C: RCPT TO:<${to2}>`, `S: 250 OK`] : []),
      `C: DATA`,
      `S: 354 start mail input`,
      `C: message body and "."`,
      `S: 250 OK`,
      `C: QUIT`,
      `S: 221 service closing`,
    ];
    return { prompt: `Order the full SMTP exchange (client C, server S) for mail from ${from}.`, steps };
  },
  ftp(rng, d) {
    const user = rng.pick(USERS);
    const file = rng.pick(FILES);
    const steps = [
      `S: 220 service ready (control connection, port 21)`,
      `C: USER ${user}`,
      `S: 331 user name OK, password needed`,
      `C: PASS ********`,
      `S: 230 user login OK`,
      `C: PORT (client chooses a data port)`,
      `C: RETR ${file}`,
      `S: 150 opening data connection (from port 20)`,
      `Data connection carries ${file}`,
      `S: 226 closing data connection`,
      `C: QUIT`,
      `S: 221 service closing`,
    ];
    return { prompt: `Order the FTP session in which ${user} downloads ${file}.`, steps: d === "easy" ? steps.filter((s) => s.startsWith("C:")) : steps };
  },
  ppp(rng, d) {
    const auth = rng.pick(["PAP", "CHAP"]);
    const ncp = rng.pick(["IPCP", "IPv6CP"]);
    if (d === "hard") {
      const user = rng.pick(USERS);
      return {
        prompt: `Order the PPP link-up for ${user} using CHAP and ${ncp}.`,
        steps: [
          `Dead: no carrier`,
          `Establish: LCP negotiates link options`,
          `Authenticate: system sends a CHAP challenge`,
          `Authenticate: ${user} returns the hashed response`,
          `Authenticate: system sends CHAP success`,
          `Network: ${ncp} configures the network layer`,
          `Open: data transfer`,
          `Terminate: LCP closes the link`,
        ],
      };
    }
    const steps = [`Dead: no carrier detected`, `Establish: LCP negotiation`, `Authenticate: ${auth}`, `Network: ${ncp} configuration`, `Open: data transfer`, `Terminate: link closed, carrier dropped`];
    return { prompt: `Order the PPP transition phases for a link that uses ${auth}.`, steps: d === "easy" ? steps : [...steps.slice(0, 5), `Terminate: LCP termination`, `Dead: carrier dropped`] };
  },
  hdlc(rng, d) {
    const a = rng.pick(["A", "R1", "PC1", "Node A"]);
    const b = rng.pick(["B", "R2", "Server", "Node B"]);
    const k = d === "easy" ? 2 : d === "medium" ? 3 : 4;
    const frames = Array.from({ length: k }, (_, i) => `${a} sends I-frame N(S)=${i}`);
    return {
      prompt: `Order the HDLC exchange: ${a} opens a connection to ${b} in ABM, sends ${k} frames, then disconnects.`,
      steps: [`${a} sends U-frame SABM`, `${b} replies U-frame UA`, ...frames, `${b} sends S-frame RR N(R)=${k}`, `${a} sends U-frame DISC`, `${b} replies U-frame UA`],
    };
  },
};

export const SEQUENCE_MODES = Object.keys(MODES);

function lcs(a: string[], b: string[]) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
  return dp[a.length]![b.length]!;
}

export const sequence: Template<SequenceParams, string[]> = {
  id: "sequence",
  generate(rng, d, mode = "dns") {
    const gen = MODES[mode] ?? MODES.dns!;
    const { prompt, steps } = gen(rng, d);
    let shuffled = rng.shuffle(steps.map((_, i) => i));
    // never show the steps already in order
    if (shuffled.every((x, i) => x === i)) shuffled = [...shuffled.slice(1), shuffled[0]!];
    return { d, mode, prompt, steps, shuffled };
  },
  solve(p) {
    return p.steps;
  },
  view(p) {
    return { prompt: p.prompt, cards: p.shuffled.map((i) => ({ id: `s${i}`, text: p.steps[i]! })) };
  },
  checkpoints() {
    return [{ id: "order", title: "Order", weight: 1 }];
  },
  grade(p, s, _cp, r) {
    const ids: string[] = Array.isArray(r?.order) ? r.order : [];
    const texts = ids.map((id) => p.steps[Number(String(id).slice(1))] ?? "");
    const fields: Record<string, boolean> = {};
    let pos = 0;
    s.forEach((t, i) => {
      const ok = texts[i] === t;
      fields[`#${i + 1}`] = ok;
      if (ok) pos++;
    });
    // credit = mostly relative order (LCS), partly exact positions
    const score = texts.length === s.length ? 0.6 * (lcs(texts, s) / s.length) + 0.4 * (pos / s.length) : 0;
    return { score: pos === s.length ? 1 : Math.min(0.95, score), misconceptions: pos === s.length ? [] : [`seq.${p.mode}`], fields };
  },
  optimalMoves(p) {
    // minimal moves to sort the shuffled list by moving cards: n − LIS of positions
    const arr = p.shuffled;
    const tails: number[] = [];
    for (const x of arr) {
      let lo = 0;
      let hi = tails.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (tails[m]! < x) lo = m + 1;
        else hi = m;
      }
      tails[lo] = x;
    }
    return Math.max(1, arr.length - tails.length);
  },
  key(p) {
    return p.steps.join("|") + "#" + p.shuffled.join(",");
  },
};
