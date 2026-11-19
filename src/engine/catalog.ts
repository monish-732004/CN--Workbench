import { CUSTOM_EXPECTED, type CustomQuestion } from "./custom";
import type { Difficulty } from "./types";

/** Shared (client + server) description of what a teacher can put in a room. */

export interface UnitInfo {
  id: 1 | 2 | 3 | 4 | 5;
  title: string;
}

export const UNITS: UnitInfo[] = [
  { id: 1, title: "Introduction to Networks" },
  { id: 2, title: "Addressing" },
  { id: 3, title: "Routing" },
  { id: 4, title: "Medium Access Control" },
  { id: 5, title: "Transport and Application" },
];

export type TemplateId =
  | "delayline"
  | "pinout"
  | "bitbench"
  | "slicer"
  | "fib"
  | "spf"
  | "vectors"
  | "crc"
  | "hamming"
  | "hexdump"
  | "ladder"
  | "sorter"
  | "sequence"
  | "form"
  | "table"
  | "stuffing";

export interface TopicInfo {
  id: string;
  unit: UnitInfo["id"];
  template: TemplateId;
  /** Variant for multi-topic templates. */
  mode?: string;
  title: string;
  /** What the student does, in one line. */
  mechanic: string;
  syllabus: string;
  /** Expected solve time in seconds per difficulty. */
  expected: Record<Difficulty, number>;
}

const t = (e: number, m: number, h: number): Record<Difficulty, number> => ({ easy: e, medium: m, hard: h });

export const TOPICS: TopicInfo[] = [
  // ── Unit 1 ──
  { id: "nettypes", unit: 1, template: "sorter", mode: "nettypes", title: "Network types", mechanic: "Sort networks into PAN, LAN, MAN, WAN", syllabus: "LAN, MAN, PAN, WAN", expected: t(60, 90, 120) },
  { id: "topology", unit: 1, template: "form", mode: "topology", title: "Topologies", mechanic: "Count links and ports for mesh, star, ring", syllabus: "Bus, star, ring, mesh, hybrid", expected: t(75, 120, 150) },
  { id: "switching", unit: 1, template: "sorter", mode: "switching", title: "Circuit and packet switching", mechanic: "Sort statements by switching method", syllabus: "Circuit switching, packet switching", expected: t(60, 90, 120) },
  { id: "layers", unit: 1, template: "sorter", mode: "layers", title: "OSI and TCP/IP layers", mechanic: "Place functions, devices and PDUs on layers", syllabus: "OSI layered architecture, TCP/IP model", expected: t(90, 120, 150) },
  { id: "delay", unit: 1, template: "delayline", title: "Latency and delay", mechanic: "Build a latency budget on a time axis", syllabus: "Latency, bandwidth, delay", expected: t(120, 180, 240) },
  { id: "media", unit: 1, template: "sorter", mode: "media", title: "Unguided media", mechanic: "Sort frequencies by medium, propagation, band", syllabus: "Radio waves, microwaves, infrared", expected: t(60, 90, 120) },
  { id: "cables", unit: 1, template: "pinout", title: "Twisted-pair cabling", mechanic: "Pick the cable and crimp an RJ-45 end", syllabus: "Guided media, RJ-45, colour codes", expected: t(75, 120, 150) },
  // ── Unit 2 ──
  { id: "ipclass", unit: 2, template: "sorter", mode: "ipclass", title: "IPv4 notation and classes", mechanic: "Sort dotted, binary and hex addresses into classes", syllabus: "IPv4 addressing, address space, classful addressing", expected: t(75, 120, 150) },
  { id: "mask", unit: 2, template: "bitbench", title: "Subnet masks", mechanic: "Find network and broadcast addresses bit by bit", syllabus: "Subnet mask, classless addressing, CIDR", expected: t(120, 180, 240) },
  { id: "flsm", unit: 2, template: "form", mode: "flsm", title: "FLSM subnetting", mechanic: "Borrow bits and describe a subnet", syllabus: "FLSM", expected: t(150, 210, 270) },
  { id: "vlsm", unit: 2, template: "slicer", title: "VLSM planning", mechanic: "Partition an address block into aligned subnets", syllabus: "VLSM, classless addressing", expected: t(240, 330, 480) },
  { id: "supernet", unit: 2, template: "form", mode: "supernet", title: "Supernetting", mechanic: "Summarise contiguous blocks into one route", syllabus: "Supernetting", expected: t(90, 120, 180) },
  { id: "nat", unit: 2, template: "table", mode: "nat", title: "NAT and PAT", mechanic: "Translate packets through a PAT router", syllabus: "NAT", expected: t(150, 210, 270) },
  { id: "domains", unit: 2, template: "form", mode: "domains", title: "Network devices", mechanic: "Count collision and broadcast domains", syllabus: "Hub, repeater, switch, bridge, router", expected: t(90, 120, 180) },
  { id: "maclearn", unit: 2, template: "table", mode: "maclearn", title: "Learning switches", mechanic: "Flood, forward or filter each frame", syllabus: "Switch: learning and forwarding", expected: t(120, 180, 210) },
  // ── Unit 3 ──
  { id: "lpm", unit: 3, template: "fib", title: "IP forwarding", mechanic: "Route packets by longest-prefix match", syllabus: "Forwarding of IP packets, static and default routing", expected: t(90, 150, 210) },
  { id: "dijkstra", unit: 3, template: "spf", title: "Link-state routing", mechanic: "Run Dijkstra on a weighted graph", syllabus: "Link state routing, OSPF", expected: t(150, 240, 330) },
  { id: "rip", unit: 3, template: "vectors", title: "Distance-vector routing", mechanic: "Apply a neighbour's RIP update", syllabus: "Distance vector routing, RIP", expected: t(120, 180, 240) },
  { id: "bgp", unit: 3, template: "table", mode: "bgp", title: "Path vector and BGP", mechanic: "Run the BGP route-selection flow", syllabus: "Path vector routing, BGP", expected: t(120, 180, 240) },
  { id: "protocols", unit: 3, template: "sorter", mode: "protocols", title: "RIP, OSPF, BGP, EIGRP", mechanic: "Match statements to routing protocols", syllabus: "RIP v1/v2, OSPF, BGP, EIGRP", expected: t(75, 105, 135) },
  { id: "ipv6", unit: 3, template: "form", mode: "ipv6", title: "IPv6 addressing", mechanic: "Compress, expand, classify, EUI-64", syllabus: "IPv6 addressing basics", expected: t(90, 150, 210) },
  { id: "multicast", unit: 3, template: "form", mode: "mcast", title: "Multicasting", mechanic: "Map a group to its block and MAC", syllabus: "Multicasting basics", expected: t(90, 120, 150) },
  // ── Unit 4 ──
  { id: "aloha", unit: 4, template: "form", mode: "aloha", title: "ALOHA", mechanic: "Frame time, vulnerable time, throughput", syllabus: "Pure and slotted ALOHA", expected: t(90, 150, 210) },
  { id: "csma", unit: 4, template: "form", mode: "csma", title: "CSMA/CD and Ethernet", mechanic: "Minimum frame, backoff, efficiency", syllabus: "CSMA/CD, CSMA/CA, Ethernet", expected: t(90, 150, 240) },
  { id: "mactype", unit: 4, template: "sorter", mode: "mactype", title: "Ethernet addresses", mechanic: "Sort MACs into unicast, multicast, broadcast", syllabus: "Ethernet addressing", expected: t(60, 90, 120) },
  { id: "windows", unit: 4, template: "form", mode: "windows", title: "Sliding window sizes", mechanic: "Window limits for S&W, GBN, SR", syllabus: "Flow control: stop and wait, sliding window", expected: t(75, 120, 180) },
  { id: "arq", unit: 4, template: "table", mode: "arq", title: "ARQ protocols", mechanic: "Step through losses and timeouts", syllabus: "Stop and wait ARQ, sliding window ARQ", expected: t(120, 180, 240) },
  { id: "checksum", unit: 4, template: "form", mode: "parity", title: "Parity and checksum", mechanic: "Parity bits, checksum fold and verify", syllabus: "Parity check, checksum", expected: t(75, 120, 180) },
  { id: "crc", unit: 4, template: "crc", title: "CRC", mechanic: "Modulo-2 long division on a bit board", syllabus: "Error detection: CRC", expected: t(150, 210, 300) },
  { id: "hamming", unit: 4, template: "hamming", title: "Hamming code", mechanic: "Encode, find the syndrome, correct the bit", syllabus: "Error correction: Hamming codes", expected: t(120, 210, 300) },
  { id: "stuffing", unit: 4, template: "stuffing", title: "HDLC bit stuffing", mechanic: "Insert and remove stuffed bits", syllabus: "Data link protocols: HDLC, PPP framing", expected: t(75, 120, 180) },
  { id: "links", unit: 4, template: "sequence", mode: "links", title: "HDLC and PPP sessions", mechanic: "Order frames and PPP phases", syllabus: "HDLC, PPP", expected: t(60, 90, 120) },
  // ── Unit 5 ──
  { id: "ports", unit: 5, template: "sorter", mode: "ports", title: "Port numbers", mechanic: "Sort ports by range and transport", syllabus: "Port numbers", expected: t(60, 90, 120) },
  { id: "headers", unit: 5, template: "hexdump", title: "UDP and TCP headers", mechanic: "Dissect a hex dump into header fields", syllabus: "UDP, TCP segment", expected: t(120, 210, 270) },
  { id: "tcp", unit: 5, template: "ladder", title: "TCP connection", mechanic: "Build the segment ladder with SEQ and ACK", syllabus: "TCP connection establishment, data transfer, termination", expected: t(120, 270, 360) },
  { id: "web", unit: 5, template: "form", mode: "httpftp", title: "HTTP and FTP", mechanic: "Connections, response times, ports", syllabus: "WWW and HTTP, FTP", expected: t(75, 150, 210) },
  { id: "ftp", unit: 5, template: "sequence", mode: "ftp", title: "FTP session", mechanic: "Order the FTP commands and replies", syllabus: "FTP", expected: t(60, 100, 120) },
  { id: "email", unit: 5, template: "sequence", mode: "smtp", title: "Email and SMTP", mechanic: "Order the SMTP exchange", syllabus: "Email: SMTP, POP, IMAP", expected: t(60, 120, 150) },
  { id: "dns", unit: 5, template: "sequence", mode: "dns", title: "DNS resolution", mechanic: "Order iterative and recursive lookups", syllabus: "DNS", expected: t(60, 100, 120) },
];

export const TOPIC_BY_ID: Record<string, TopicInfo> = Object.fromEntries(TOPICS.map((x) => [x.id, x]));

/** Modes that change with difficulty. */
export function resolveMode(topic: TopicInfo, d: Difficulty): string | undefined {
  if (topic.mode === "arq") return d === "easy" ? "stopwait" : d === "medium" ? "gbn" : "sr";
  if (topic.mode === "links") return d === "easy" ? "ppp" : d === "medium" ? "hdlc" : "ppp";
  return topic.mode;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export interface Slot {
  /** A catalogue topic id, or "custom:<questionId>" for a teacher-written question. */
  topicId: string;
  difficulty: Difficulty;
}

export const isCustomSlot = (s: Slot) => s.topicId.startsWith("custom:");

/**
 * Builds the paper: same slot list for every student. Topics are spread round-robin
 * per difficulty so the paper covers as many selected topics as possible; teacher
 * questions are appended at their own difficulty.
 */
export function buildSlots(topicIds: string[], mix: Record<Difficulty, number>, custom: CustomQuestion[] = []): Slot[] {
  const slots: Slot[] = [];
  if (topicIds.length) {
    let cursor = 0;
    for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
      for (let i = 0; i < mix[d]; i++) {
        slots.push({ topicId: topicIds[cursor % topicIds.length]!, difficulty: d });
        cursor++;
      }
    }
  }
  for (const q of custom) slots.push({ topicId: `custom:${q.id}`, difficulty: q.difficulty });
  return slots;
}

export function slotSeconds(s: Slot, custom: CustomQuestion[] = []): number {
  if (isCustomSlot(s)) {
    const q = custom.find((x) => `custom:${x.id}` === s.topicId);
    return q ? CUSTOM_EXPECTED[q.type][q.difficulty] : 90;
  }
  return TOPIC_BY_ID[s.topicId]?.expected[s.difficulty] ?? 120;
}

export function estimateSeconds(slots: Slot[], custom: CustomQuestion[] = []): number {
  return slots.reduce((sum, x) => sum + slotSeconds(x, custom), 0);
}
