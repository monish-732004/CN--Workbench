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
  | "ladder";

export interface TopicInfo {
  id: string;
  unit: UnitInfo["id"];
  template: TemplateId;
  title: string;
  /** What the student does, in one line. */
  mechanic: string;
  syllabus: string;
  /** Expected solve time in seconds per difficulty. */
  expected: Record<Difficulty, number>;
}

export const TOPICS: TopicInfo[] = [
  {
    id: "delay",
    unit: 1,
    template: "delayline",
    title: "Latency and delay",
    mechanic: "Build a latency budget on a time axis",
    syllabus: "Latency, bandwidth, delay",
    expected: { easy: 120, medium: 180, hard: 240 },
  },
  {
    id: "cables",
    unit: 1,
    template: "pinout",
    title: "Twisted-pair cabling",
    mechanic: "Pick the cable and crimp an RJ-45 end",
    syllabus: "Guided media, RJ-45, colour codes",
    expected: { easy: 75, medium: 120, hard: 150 },
  },
  {
    id: "mask",
    unit: 2,
    template: "bitbench",
    title: "Subnet masks",
    mechanic: "Find network and broadcast addresses bit by bit",
    syllabus: "IPv4 addressing, classful, subnet mask, CIDR",
    expected: { easy: 120, medium: 180, hard: 240 },
  },
  {
    id: "vlsm",
    unit: 2,
    template: "slicer",
    title: "VLSM planning",
    mechanic: "Partition an address block into aligned subnets",
    syllabus: "FLSM, VLSM, classless addressing",
    expected: { easy: 240, medium: 330, hard: 480 },
  },
  {
    id: "lpm",
    unit: 3,
    template: "fib",
    title: "IP forwarding",
    mechanic: "Route packets by longest-prefix match",
    syllabus: "Forwarding of IP packets, static and default routing",
    expected: { easy: 90, medium: 150, hard: 210 },
  },
  {
    id: "dijkstra",
    unit: 3,
    template: "spf",
    title: "Link-state routing",
    mechanic: "Run Dijkstra on a weighted graph",
    syllabus: "Link state routing, OSPF",
    expected: { easy: 150, medium: 240, hard: 330 },
  },
  {
    id: "rip",
    unit: 3,
    template: "vectors",
    title: "Distance-vector routing",
    mechanic: "Apply a neighbour's RIP update",
    syllabus: "Distance vector routing, RIP",
    expected: { easy: 120, medium: 180, hard: 240 },
  },
  {
    id: "crc",
    unit: 4,
    template: "crc",
    title: "CRC",
    mechanic: "Modulo-2 long division on a bit board",
    syllabus: "Error detection: CRC",
    expected: { easy: 150, medium: 210, hard: 300 },
  },
  {
    id: "hamming",
    unit: 4,
    template: "hamming",
    title: "Hamming code",
    mechanic: "Encode, find the syndrome, correct the bit",
    syllabus: "Error correction: Hamming codes",
    expected: { easy: 120, medium: 210, hard: 300 },
  },
  {
    id: "headers",
    unit: 5,
    template: "hexdump",
    title: "UDP and TCP headers",
    mechanic: "Dissect a hex dump into header fields",
    syllabus: "Port numbers, UDP, TCP segment",
    expected: { easy: 120, medium: 210, hard: 270 },
  },
  {
    id: "tcp",
    unit: 5,
    template: "ladder",
    title: "TCP connection",
    mechanic: "Build the segment ladder with SEQ and ACK",
    syllabus: "TCP connection establishment, data transfer, termination",
    expected: { easy: 120, medium: 270, hard: 360 },
  },
];

export const TOPIC_BY_ID: Record<string, TopicInfo> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export interface Slot {
  topicId: string;
  difficulty: Difficulty;
}

/**
 * Builds the paper: same slot list for every student. Topics are spread round-robin
 * per difficulty so the paper covers as many selected topics as possible.
 */
export function buildSlots(topicIds: string[], mix: Record<Difficulty, number>): Slot[] {
  const slots: Slot[] = [];
  if (topicIds.length === 0) return slots;
  let cursor = 0;
  for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
    for (let i = 0; i < mix[d]; i++) {
      slots.push({ topicId: topicIds[cursor % topicIds.length]!, difficulty: d });
      cursor++;
    }
  }
  return slots;
}

export function estimateSeconds(slots: Slot[]): number {
  return slots.reduce((s, x) => s + (TOPIC_BY_ID[x.topicId]?.expected[x.difficulty] ?? 120), 0);
}
